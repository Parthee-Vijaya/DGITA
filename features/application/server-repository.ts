import { ensurePortalSchema, getPersistenceBindings } from "../../db/persistence";
import type { ServerActor } from "../auth/types";
import {
  getAllErrors,
  getDisplaySystemName,
  normalizeApprovingLeader,
  pruneHiddenAnswers,
  type ApplicationFormState,
  type AttachmentDraft,
  type UploadKind,
} from "./engine";
import {
  applicationEditMode,
  correctionAttachmentId,
  correctionAuditEventId,
} from "./correction-policy";
import { normalizePersistedApplicationFormState } from "./state-validation";

type ApplicationRow = {
  id: string;
  tenant_id: string;
  owner_user_id: string;
  case_number: string;
  draft_state_json: string;
  status: string;
  row_version: number;
  current_version_number: number;
  current_version_id: string | null;
  updated_at: string;
};

type AttachmentRow = {
  id: string;
  application_id: string;
  kind: UploadKind;
  original_name: string;
  size_bytes: number;
  content_type: string;
  storage_key: string;
  checksum_sha256: string;
  status: string;
};

type VersionedAttachmentRow = AttachmentRow & {
  owner_user_id: string;
  scan_status: string;
  uploaded_by_user_id: string;
};

export class ApplicationRepositoryError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 413 | 422,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApplicationRepositoryError";
  }
}

export async function getLatestApplicationDraft(actor: ServerActor) {
  assertCanCreate(actor);
  const DB = await portalDb();
  const row = await DB.prepare(`
    SELECT id, tenant_id, owner_user_id, case_number, draft_state_json, status,
           row_version, current_version_number, current_version_id, updated_at
    FROM portal_applications
    WHERE tenant_id = ? AND owner_user_id = ? AND status = 'draft'
      AND id NOT LIKE 'demo:%'
    ORDER BY updated_at DESC LIMIT 1
  `)
    .bind(actor.tenantId, actor.userId)
    .first<ApplicationRow>();
  if (!row) return null;
  const state = parseApplicationState(row.draft_state_json);
  if (!state) return null;
  const attachments = await getApplicationAttachments(DB, row.id);
  return {
    id: row.id,
    caseNumber: row.case_number,
    state: hydratePortalAttachments(state, attachments),
    updatedAt: row.updated_at,
    rowVersion: row.row_version,
  };
}

export async function beginApplicationCorrection(
  actor: ServerActor,
  caseNumberValue: string,
) {
  assertCanCreate(actor);
  const caseNumber = normalizeCaseNumber(caseNumberValue);
  const DB = await portalDb();
  const row = await DB.prepare(`
    SELECT id, tenant_id, owner_user_id, case_number, draft_state_json, status,
           row_version, current_version_number, current_version_id, updated_at
    FROM portal_applications
    WHERE tenant_id = ? AND owner_user_id = ? AND case_number = ?
    LIMIT 1
  `)
    .bind(actor.tenantId, actor.userId, caseNumber)
    .first<ApplicationRow>();
  if (!row) {
    throw new ApplicationRepositoryError(
      404,
      "Sagen findes ikke, eller du har ikke adgang til den.",
    );
  }
  const rejection = await DB.prepare(`
    SELECT approver_name, decision_comment, decided_at
    FROM portal_approval_requests
    WHERE tenant_id = ? AND application_id = ? AND application_version_id = ?
      AND status = 'rejected'
    ORDER BY decided_at DESC, id DESC
    LIMIT 1
  `)
    .bind(actor.tenantId, row.id, row.current_version_id)
    .first<{
      approver_name: string;
      decision_comment: string | null;
      decided_at: string | null;
    }>();
  if (row.status !== "changes_requested" || !row.current_version_id) {
    throw new ApplicationRepositoryError(
      409,
      "Sagen er ikke klar til rettelser efter en afvisning.",
    );
  }

  const state = parseApplicationState(row.draft_state_json);
  if (!state) {
    throw new ApplicationRepositoryError(409, "Sagens formularversion kunne ikke åbnes.");
  }

  const now = new Date().toISOString();
  await DB.batch([
    DB.prepare(`
      UPDATE portal_approval_requests
      SET status = 'cancelled'
      WHERE tenant_id = ? AND application_id = ?
        AND status IN ('pending', 'approving', 'rejecting')
    `).bind(actor.tenantId, row.id),
    DB.prepare(`
      UPDATE portal_mail_outbox
      SET status = CASE
            WHEN status IN ('queued', 'failed') THEN 'cancelled'
            ELSE status
          END,
          text_body = '[Godkendelseslink annulleret, fordi ansøgningen rettes]',
          html_body = '<p>Godkendelseslinket er annulleret, fordi ansøgningen rettes.</p>',
          updated_at = ?
      WHERE tenant_id = ? AND application_id = ?
        AND template_key = 'approval.requested' AND status <> 'sent'
    `).bind(now, actor.tenantId, row.id),
  ]);
  await initializeCorrectionAttachments(DB, actor, row);

  const attachments = await getApplicationAttachments(DB, row.id);
  return {
    id: row.id,
    caseNumber: row.case_number,
    state: hydratePortalAttachments(state, attachments),
    updatedAt: row.updated_at,
    rowVersion: row.row_version,
    currentVersionNumber: row.current_version_number,
    nextVersionNumber: row.current_version_number + 1,
    mode: "correction" as const,
    rejection: rejection
      ? {
          approverName: rejection.approver_name,
          comment: rejection.decision_comment ?? "",
          decidedAt: rejection.decided_at,
        }
      : null,
  };
}

export async function saveApplicationDraft(
  actor: ServerActor,
  id: string,
  state: ApplicationFormState,
  expectedRowVersion?: number | null,
) {
  assertCanCreate(actor);
  assertApplicationId(id);
  const serialized = JSON.stringify(state);
  if (serialized.length > 600_000) {
    throw new ApplicationRepositoryError(413, "Kladden er for stor.");
  }

  const DB = await portalDb();
  const existing = await findApplicationById(DB, id);
  if (existing) {
    assertOwner(actor, existing);
    if (expectedRowVersion !== existing.row_version) {
      throw new ApplicationRepositoryError(
        409,
        "Sagen er ændret siden den blev åbnet. Hent den nyeste version, før du gemmer.",
      );
    }
    const editMode = applicationEditMode(existing.status);
    if (!editMode) {
      throw new ApplicationRepositoryError(
        409,
        "Den indsendte ansøgning er versionslåst og kan ikke overskrives.",
      );
    }
    const now = new Date().toISOString();
    const nextRowVersion = existing.row_version + 1;
    const eventType = editMode === "correction"
      ? "application.correction_saved"
      : "application.draft_saved";
    const auditId = crypto.randomUUID();
    const auditPayload = JSON.stringify({
      rowVersion: nextRowVersion,
      sourceVersionNumber: existing.current_version_number || undefined,
    });
    const saved = await DB.batch([
      DB.prepare(`
        UPDATE portal_applications
        SET title = ?, system_name = ?, draft_schema_version = ?, draft_state_json = ?,
            updated_at = ?, row_version = row_version + 1
        WHERE id = ? AND tenant_id = ? AND owner_user_id = ? AND status = ?
          AND row_version = ?
      `).bind(
        getDisplaySystemName(state),
        getDisplaySystemName(state),
        state.schemaVersion,
        serialized,
        now,
        id,
        actor.tenantId,
        actor.userId,
        existing.status,
        existing.row_version,
      ),
      DB.prepare(`
        INSERT INTO portal_audit_events
          (id, tenant_id, application_id, actor_user_id, actor_subject, event_type,
           entity_type, entity_id, payload_json, ip_hash, occurred_at)
        SELECT ?, ?, ?, ?, ?, ?, 'application', ?, ?, NULL, ?
        WHERE EXISTS (
          SELECT 1 FROM portal_applications
          WHERE id = ? AND tenant_id = ? AND owner_user_id = ? AND status = ?
            AND row_version = ? AND updated_at = ?
        )
      `).bind(
        auditId,
        actor.tenantId,
        id,
        actor.userId,
        actor.subject,
        eventType,
        id,
        auditPayload,
        now,
        id,
        actor.tenantId,
        actor.userId,
        existing.status,
        nextRowVersion,
        now,
      ),
    ]);
    if (
      Number(saved[0]?.meta.changes ?? 0) !== 1 ||
      Number(saved[1]?.meta.changes ?? 0) !== 1
    ) {
      throw new ApplicationRepositoryError(
        409,
        "Sagen blev ændret i en anden fane. Hent rettelserne igen.",
      );
    }
    return {
      id,
      caseNumber: existing.case_number,
      status: existing.status as "draft" | "changes_requested",
      updatedAt: now,
      rowVersion: nextRowVersion,
    };
  }

  const now = new Date().toISOString();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const caseNumber = newCaseNumber();
    const auditId = crypto.randomUUID();
    try {
      const created = await DB.batch([
        DB.prepare(`
          INSERT INTO portal_applications
            (id, tenant_id, owner_user_id, case_number, title, system_name, status,
             phase, assigned_consultant_user_id, draft_schema_version,
             draft_state_json, row_version, current_version_number,
             current_version_id, created_at, updated_at, submitted_at, closed_at)
          VALUES (?, ?, ?, ?, ?, ?, 'draft', 'Kladde', NULL, ?, ?, 1, 0, NULL, ?, ?, NULL, NULL)
        `).bind(
          id,
          actor.tenantId,
          actor.userId,
          caseNumber,
          getDisplaySystemName(state),
          getDisplaySystemName(state),
          state.schemaVersion,
          serialized,
          now,
          now,
        ),
        DB.prepare(`
          INSERT INTO portal_audit_events
            (id, tenant_id, application_id, actor_user_id, actor_subject, event_type,
             entity_type, entity_id, payload_json, ip_hash, occurred_at)
          VALUES (?, ?, ?, ?, ?, 'application.created', 'application', ?, ?, NULL, ?)
        `).bind(
          auditId,
          actor.tenantId,
          id,
          actor.userId,
          actor.subject,
          id,
          JSON.stringify({ caseNumber }),
          now,
        ),
      ]);
      if (
        Number(created[0]?.meta.changes ?? 0) !== 1 ||
        Number(created[1]?.meta.changes ?? 0) !== 1
      ) {
        throw new ApplicationRepositoryError(409, "Kladden kunne ikke oprettes atomisk.");
      }
      return {
        id,
        caseNumber,
        status: "draft" as const,
        updatedAt: now,
        rowVersion: 1,
      };
    } catch (error) {
      if (!isUniqueConstraint(error) || attempt === 4) throw error;
    }
  }
  throw new ApplicationRepositoryError(409, "Sagsnummeret kunne ikke oprettes.");
}

export async function submitApplication(
  actor: ServerActor,
  id: string,
  state: ApplicationFormState,
  expectedRowVersion?: number | null,
) {
  assertCanCreate(actor);
  assertApplicationId(id);
  if (JSON.stringify(state).length > 600_000) {
    throw new ApplicationRepositoryError(413, "Ansøgningen er for stor.");
  }
  const DB = await portalDb();
  let row = await findApplicationById(DB, id);
  const createdForSubmission = row === null;
  if (!row) {
    await saveApplicationDraft(actor, id, state, expectedRowVersion);
    row = await findApplicationById(DB, id);
  }
  if (!row) throw new ApplicationRepositoryError(404, "Kladden findes ikke.");
  assertOwner(actor, row);
  if (!createdForSubmission && expectedRowVersion !== row.row_version) {
    throw new ApplicationRepositoryError(
      409,
      "Sagen er ændret siden den blev åbnet. Hent den nyeste version, før du genindsender.",
    );
  }
  const editMode = applicationEditMode(row.status);
  if (!editMode) {
    throw new ApplicationRepositoryError(
      409,
      "Ansøgningen kan ikke indsendes fra dens aktuelle status.",
    );
  }

  const attachments = await getApplicationAttachments(DB, id);
  const canonicalState = hydratePortalAttachments(state, attachments);
  const errors = getAllErrors(canonicalState);
  if (errors.length > 0) {
    throw new ApplicationRepositoryError(
      422,
      "Ansøgningen mangler oplysninger, før den kan indsendes.",
      errors,
    );
  }

  const snapshot = pruneHiddenAnswers(canonicalState);
  const snapshotJson = JSON.stringify(snapshot);
  const includedAttachmentIds = new Set(
    Object.values(snapshot.attachments as ApplicationFormState["attachments"])
      .flat()
      .map((attachment) => attachment.id),
  );
  const hiddenAttachments = attachments.filter(
    (attachment) => !includedAttachmentIds.has(attachment.id),
  );
  const readyAttachments = attachments
    .filter(
      (attachment) =>
        attachment.status === "ready" && includedAttachmentIds.has(attachment.id),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const manifestJson = JSON.stringify(
    readyAttachments.map((attachment) => ({
      id: attachment.id,
      kind: attachment.kind,
      name: attachment.original_name,
      size: attachment.size_bytes,
      contentType: attachment.content_type,
      checksum: attachment.checksum_sha256,
    })),
  );
  const now = new Date().toISOString();
  const versionNumber = row.current_version_number + 1;
  const versionId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const notificationId = crypto.randomUUID();
  const outboxId = crypto.randomUUID();
  const systemName = getDisplaySystemName(canonicalState);
  const isResubmission = editMode === "correction";
  const eventType = isResubmission
    ? "application.resubmitted"
    : "application.submitted";
  const actionText = isResubmission ? "genindsendt" : "indsendt";
  const caseNumber = row.case_number;
  const mailSubject = `D-GITA: ${caseNumber} er ${actionText}`;
  const mailText = `Tak for din ansøgning om ${systemName}. Sagsnummer: ${caseNumber}. Version ${versionNumber} er låst og ${actionText} til D-GITA.`;
  const mailHtml = `<p>Hej ${escapeHtml(actor.displayName)}</p><p>Tak for din ansøgning om <strong>${escapeHtml(systemName)}</strong>.</p><p>Sagsnummer: <strong>${escapeHtml(caseNumber)}</strong><br>Version: ${versionNumber}</p><p>Versionen er låst og ${actionText} til D-GITA.</p>`;
  const attachmentCasClause = readyAttachments.length > 0
    ? `AND (
        SELECT COUNT(*) FROM portal_attachments
        WHERE tenant_id = ? AND application_id = ?
          AND application_version_id IS NULL AND status = 'ready'
          AND id IN (${readyAttachments.map(() => "?").join(", ")})
      ) = ?`
    : "";

  const submissionStatements = [
    DB.prepare(`
      UPDATE portal_applications
      SET status = 'submitted', phase = 'Indsendt', draft_state_json = ?,
          current_version_number = ?, current_version_id = ?, submitted_at = ?,
          updated_at = ?, row_version = row_version + 1
      WHERE id = ? AND tenant_id = ? AND owner_user_id = ?
        AND status = ? AND row_version = ?
        ${attachmentCasClause}
    `).bind(
      snapshotJson,
      versionNumber,
      versionId,
      now,
      now,
      id,
      actor.tenantId,
      actor.userId,
      row.status,
      row.row_version,
      ...(readyAttachments.length > 0
        ? [
            actor.tenantId,
            id,
            ...readyAttachments.map((attachment) => attachment.id),
            readyAttachments.length,
          ]
        : []),
    ),
    DB.prepare(`
      INSERT INTO portal_application_versions
        (id, tenant_id, application_id, version_number, schema_version,
         snapshot_json, snapshot_sha256, attachment_manifest_sha256,
         submitted_by_user_id, created_at, submitted_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM portal_applications
        WHERE id = ? AND tenant_id = ? AND owner_user_id = ?
          AND current_version_id = ? AND current_version_number = ?
          AND row_version = ?
      )
    `).bind(
      versionId,
      actor.tenantId,
      id,
      versionNumber,
      snapshot.schemaVersion,
      snapshotJson,
      await sha256Text(snapshotJson),
      await sha256Text(manifestJson),
      actor.userId,
      now,
      now,
      id,
      actor.tenantId,
      actor.userId,
      versionId,
      versionNumber,
      row.row_version + 1,
    ),
    DB.prepare(`
      UPDATE portal_approval_requests
      SET status = 'cancelled'
      WHERE tenant_id = ? AND application_id = ?
        AND status IN ('pending', 'approving', 'rejecting')
        AND EXISTS (
          SELECT 1 FROM portal_applications
          WHERE id = ? AND tenant_id = ? AND current_version_id = ?
        )
    `).bind(actor.tenantId, id, id, actor.tenantId, versionId),
    DB.prepare(`
      UPDATE portal_mail_outbox
      SET status = CASE
            WHEN status IN ('queued', 'failed') THEN 'cancelled'
            ELSE status
          END,
          text_body = '[Godkendelseslink erstattet af en nyere version]',
          html_body = '<p>Godkendelseslinket er erstattet af en nyere version.</p>',
          updated_at = ?
      WHERE tenant_id = ? AND application_id = ?
        AND template_key = 'approval.requested' AND status <> 'sent'
        AND EXISTS (
          SELECT 1 FROM portal_applications
          WHERE id = ? AND tenant_id = ? AND current_version_id = ?
        )
    `).bind(now, actor.tenantId, id, id, actor.tenantId, versionId),
  ];

  submissionStatements.push(...readyAttachments.map((attachment) => DB.prepare(`
    UPDATE portal_attachments
    SET application_version_id = ?, immutable_at = ?
    WHERE id = ? AND tenant_id = ? AND application_id = ?
      AND application_version_id IS NULL AND status = 'ready'
      AND EXISTS (
        SELECT 1 FROM portal_applications
        WHERE id = ? AND tenant_id = ? AND current_version_id = ?
      )
  `).bind(
    versionId,
    now,
    attachment.id,
    actor.tenantId,
    id,
    id,
    actor.tenantId,
    versionId,
  )));
  const includedAttachmentFilter = readyAttachments.length > 0
    ? `AND id NOT IN (${readyAttachments.map(() => "?").join(", ")})`
    : "";
  submissionStatements.push(DB.prepare(`
    UPDATE portal_attachments
    SET status = 'deleted', deleted_at = ?
    WHERE tenant_id = ? AND application_id = ?
      AND application_version_id IS NULL AND status = 'ready'
      ${includedAttachmentFilter}
      AND EXISTS (
        SELECT 1 FROM portal_applications
        WHERE id = ? AND tenant_id = ? AND current_version_id = ?
      )
  `).bind(
    now,
    actor.tenantId,
    id,
    ...readyAttachments.map((attachment) => attachment.id),
    id,
    actor.tenantId,
    versionId,
  ));
  submissionStatements.push(
    DB.prepare(`
      INSERT INTO portal_audit_events
        (id, tenant_id, application_id, actor_user_id, actor_subject, event_type,
         entity_type, entity_id, payload_json, ip_hash, occurred_at)
      SELECT ?, ?, ?, ?, ?, ?, 'application', ?, ?, NULL, ?
      WHERE EXISTS (
        SELECT 1 FROM portal_applications
        WHERE id = ? AND tenant_id = ? AND current_version_id = ?
      )
    `).bind(
      auditId,
      actor.tenantId,
      id,
      actor.userId,
      actor.subject,
      eventType,
      id,
      JSON.stringify({
        caseNumber,
        versionNumber,
        previousVersionNumber: isResubmission ? row.current_version_number : undefined,
      }),
      now,
      id,
      actor.tenantId,
      versionId,
    ),
    DB.prepare(`
      INSERT INTO portal_notifications
        (id, tenant_id, recipient_user_id, application_id, source_event_id,
         event_type, title, body, link_path, status, created_at, read_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unread', ?, NULL
      WHERE EXISTS (
        SELECT 1 FROM portal_audit_events WHERE id = ? AND tenant_id = ?
      )
    `).bind(
      notificationId,
      actor.tenantId,
      actor.userId,
      id,
      auditId,
      eventType,
      `${caseNumber} er ${actionText}`,
      `Version ${versionNumber} er låst og ${actionText} til D-GITA.`,
      `/?case=${encodeURIComponent(caseNumber)}`,
      now,
      auditId,
      actor.tenantId,
    ),
    DB.prepare(`
      INSERT OR IGNORE INTO portal_mail_outbox
        (id, tenant_id, application_id, recipient_user_id, recipient_email,
         recipient_name, template_key, subject, text_body, html_body,
         attachments_json, idempotency_key, status, attempt_count,
         next_attempt_at, provider, provider_message_id, last_error,
         created_by_user_id, created_at, updated_at, sent_at)
      SELECT ?, ?, ?, ?, ?, ?, 'application.submitted', ?, ?, ?, ?, ?,
             'queued', 0, ?, 'microsoft_graph', NULL, NULL, ?, ?, ?, NULL
      WHERE EXISTS (
        SELECT 1 FROM portal_audit_events WHERE id = ? AND tenant_id = ?
      )
    `).bind(
      outboxId,
      actor.tenantId,
      id,
      actor.userId,
      actor.email,
      actor.displayName,
      mailSubject,
      mailText,
      mailHtml,
      JSON.stringify([{ receiptKind: "submission", applicationVersionId: versionId }]),
      `application.submitted:${versionId}:${actor.email.toLowerCase()}`,
      now,
      actor.userId,
      now,
      now,
      auditId,
      actor.tenantId,
    ),
  );

  let submissionResults: D1Result[];
  try {
    submissionResults = await DB.batch(submissionStatements);
  } catch (error) {
    if (isUniqueConstraint(error)) {
      throw new ApplicationRepositoryError(
        409,
        "Sagen blev ændret i en anden fane. Hent rettelserne igen.",
      );
    }
    throw error;
  }
  if (Number(submissionResults[0]?.meta.changes ?? 0) !== 1) {
    throw new ApplicationRepositoryError(
      409,
      "Sagen blev ændret i en anden fane. Hent rettelserne igen.",
    );
  }

  if (hiddenAttachments.length > 0) {
    const { FILES } = await getPersistenceBindings();
    await Promise.allSettled(
      hiddenAttachments.map((attachment) => FILES.delete(attachment.storage_key)),
    );
  }

  return {
    id,
    caseNumber,
    status: "submitted" as const,
    versionNumber,
    submittedAt: now,
    mode: editMode,
    rowVersion: row.row_version + 1,
  };
}

export async function getOwnedDraftForUpload(actor: ServerActor, id: string) {
  assertCanCreate(actor);
  assertApplicationId(id);
  const DB = await portalDb();
  const row = await findApplicationById(DB, id);
  if (!row) throw new ApplicationRepositoryError(404, "Kladden findes ikke.");
  assertOwner(actor, row);
  if (!applicationEditMode(row.status)) {
    throw new ApplicationRepositoryError(409, "Bilag på en indsendt version er låst.");
  }
  return { DB, application: row };
}

export async function storeApplicationAttachment(
  actor: ServerActor,
  applicationId: string,
  kind: UploadKind,
  file: File,
) {
  const { DB } = await getOwnedDraftForUpload(actor, applicationId);
  const { FILES } = await getPersistenceBindings();
  const bytes = await file.arrayBuffer();
  const checksum = await sha256Bytes(bytes);
  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-140) || "document";
  const storageKey = `tenants/${actor.tenantId}/applications/${applicationId}/${id}/${safeName}`;
  const contentType = file.type || "application/octet-stream";
  await FILES.put(storageKey, bytes, {
    httpMetadata: { contentType },
    customMetadata: {
      tenantId: actor.tenantId,
      applicationId,
      ownerUserId: actor.userId,
      kind,
      checksum,
    },
  });
  const now = new Date().toISOString();
  try {
    const inserted = await DB.prepare(`
      INSERT INTO portal_attachments
        (id, tenant_id, application_id, application_version_id, owner_user_id,
         kind, original_name, size_bytes, content_type, storage_key,
         checksum_sha256, status, scan_status, uploaded_by_user_id,
         created_at, immutable_at, deleted_at)
      SELECT ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'ready', 'not_configured', ?, ?, NULL, NULL
      WHERE EXISTS (
        SELECT 1 FROM portal_applications
        WHERE id = ? AND tenant_id = ? AND owner_user_id = ?
          AND status IN ('draft', 'changes_requested')
      )
    `).bind(
      id,
      actor.tenantId,
      applicationId,
      actor.userId,
      kind,
      file.name,
      file.size,
      contentType,
      storageKey,
      checksum,
      actor.userId,
      now,
      applicationId,
      actor.tenantId,
      actor.userId,
    ).run();
    if (Number(inserted.meta.changes ?? 0) !== 1) {
      throw new ApplicationRepositoryError(
        409,
        "Sagen blev indsendt, før bilaget var færdigt. Åbn sagen igen.",
      );
    }
  } catch (error) {
    await FILES.delete(storageKey);
    throw error;
  }
  return {
    id,
    kind,
    name: file.name,
    size: file.size,
    type: contentType,
    status: "uploaded" as const,
  } satisfies AttachmentDraft;
}

export async function deleteApplicationAttachment(
  actor: ServerActor,
  applicationId: string,
  attachmentId: string,
) {
  const { DB } = await getOwnedDraftForUpload(actor, applicationId);
  const row = await DB.prepare(`
    SELECT storage_key FROM portal_attachments
    WHERE id = ? AND tenant_id = ? AND application_id = ? AND owner_user_id = ?
      AND application_version_id IS NULL AND status = 'ready'
    LIMIT 1
  `)
    .bind(attachmentId, actor.tenantId, applicationId, actor.userId)
    .first<{ storage_key: string }>();
  if (!row) return false;
  const now = new Date().toISOString();
  const deleted = await DB.prepare(`
    UPDATE portal_attachments SET status = 'deleted', deleted_at = ?
    WHERE id = ? AND tenant_id = ? AND application_id = ?
      AND application_version_id IS NULL
      AND EXISTS (
        SELECT 1 FROM portal_applications
        WHERE id = ? AND tenant_id = ? AND owner_user_id = ?
          AND status IN ('draft', 'changes_requested')
      )
  `).bind(
    now,
    attachmentId,
    actor.tenantId,
    applicationId,
    applicationId,
    actor.tenantId,
    actor.userId,
  ).run();
  if (Number(deleted.meta.changes ?? 0) !== 1) {
    throw new ApplicationRepositoryError(
      409,
      "Bilaget kunne ikke fjernes, fordi sagen blev ændret samtidig.",
    );
  }
  const { FILES } = await getPersistenceBindings();
  await FILES.delete(row.storage_key).catch(() => undefined);
  await appendApplicationAudit(DB, actor, applicationId, "attachment.deleted", {
    attachmentId,
  });
  return true;
}

async function portalDb() {
  await ensurePortalSchema();
  return (await getPersistenceBindings()).DB;
}

async function findApplicationById(DB: D1Database, id: string) {
  return DB.prepare(`
    SELECT id, tenant_id, owner_user_id, case_number, draft_state_json, status,
           row_version, current_version_number, current_version_id, updated_at
    FROM portal_applications WHERE id = ? LIMIT 1
  `).bind(id).first<ApplicationRow>();
}

async function getApplicationAttachments(DB: D1Database, applicationId: string) {
  const result = await DB.prepare(`
    SELECT id, application_id, kind, original_name, size_bytes, content_type,
           storage_key, checksum_sha256, status
    FROM portal_attachments
    WHERE application_id = ? AND application_version_id IS NULL
      AND status = 'ready'
    ORDER BY created_at, id
  `).bind(applicationId).all<AttachmentRow>();
  return result.results;
}

async function initializeCorrectionAttachments(
  DB: D1Database,
  actor: ServerActor,
  application: ApplicationRow,
) {
  const versionId = application.current_version_id;
  if (!versionId) return;
  const auditEventId = correctionAuditEventId(application.id, versionId);
  const initialized = await DB.prepare(`
    SELECT id FROM portal_audit_events
    WHERE id = ? AND tenant_id = ? AND application_id = ?
    LIMIT 1
  `)
    .bind(auditEventId, actor.tenantId, application.id)
    .first<{ id: string }>();
  if (initialized) return;

  const source = await DB.prepare(`
    SELECT id, application_id, kind, original_name, size_bytes, content_type,
           storage_key, checksum_sha256, status, owner_user_id, scan_status,
           uploaded_by_user_id
    FROM portal_attachments
    WHERE tenant_id = ? AND application_id = ? AND application_version_id = ?
      AND status = 'ready'
    ORDER BY created_at, id
  `)
    .bind(actor.tenantId, application.id, versionId)
    .all<VersionedAttachmentRow>();
  const { FILES } = await getPersistenceBindings();
  const now = new Date().toISOString();

  for (const attachment of source.results) {
    const id = await correctionAttachmentId(versionId, attachment.id);
    const existing = await DB.prepare(`
      SELECT id FROM portal_attachments
      WHERE id = ? AND tenant_id = ? AND application_id = ?
      LIMIT 1
    `)
      .bind(id, actor.tenantId, application.id)
      .first<{ id: string }>();
    if (existing) continue;

    const stored = await FILES.get(attachment.storage_key);
    if (!stored) {
      throw new ApplicationRepositoryError(
        409,
        `Bilaget “${attachment.original_name}” kunne ikke klargøres til rettelser.`,
      );
    }
    const safeName = attachment.original_name
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .slice(-140) || "document";
    const storageKey = `tenants/${actor.tenantId}/applications/${application.id}/corrections/${versionId}/${id}/${safeName}`;
    await FILES.put(storageKey, await stored.arrayBuffer(), {
      httpMetadata: { contentType: attachment.content_type },
      customMetadata: {
        tenantId: actor.tenantId,
        applicationId: application.id,
        ownerUserId: actor.userId,
        kind: attachment.kind,
        checksum: attachment.checksum_sha256,
        sourceAttachmentId: attachment.id,
        sourceVersionId: versionId,
      },
    });
    await DB.prepare(`
      INSERT OR IGNORE INTO portal_attachments
        (id, tenant_id, application_id, application_version_id, owner_user_id,
         kind, original_name, size_bytes, content_type, storage_key,
         checksum_sha256, status, scan_status, uploaded_by_user_id,
         created_at, immutable_at, deleted_at)
      VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?, NULL, NULL)
    `).bind(
      id,
      actor.tenantId,
      application.id,
      application.owner_user_id,
      attachment.kind,
      attachment.original_name,
      attachment.size_bytes,
      attachment.content_type,
      storageKey,
      attachment.checksum_sha256,
      attachment.scan_status,
      actor.userId,
      now,
    ).run();
  }

  await DB.prepare(`
    INSERT OR IGNORE INTO portal_audit_events
      (id, tenant_id, application_id, actor_user_id, actor_subject, event_type,
       entity_type, entity_id, payload_json, ip_hash, occurred_at)
    VALUES (?, ?, ?, ?, ?, 'application.correction_started', 'application', ?, ?, NULL, ?)
  `).bind(
    auditEventId,
    actor.tenantId,
    application.id,
    actor.userId,
    actor.subject,
    application.id,
    JSON.stringify({
      sourceVersionId: versionId,
      sourceVersionNumber: application.current_version_number,
      copiedAttachmentCount: source.results.length,
    }),
    now,
  ).run();
}

function hydratePortalAttachments(
  state: ApplicationFormState,
  rows: AttachmentRow[],
): ApplicationFormState {
  const attachments: ApplicationFormState["attachments"] = {
    "risk-assessment": [],
    "data-processing-agreement": [],
    contract: [],
    "supplier-checklist": [],
    architecture: [],
  };
  for (const row of rows) {
    if (!(row.kind in attachments)) continue;
    attachments[row.kind].push({
      id: row.id,
      kind: row.kind,
      name: row.original_name,
      size: row.size_bytes,
      type: row.content_type,
      status: "uploaded",
    });
  }
  return { ...state, attachments };
}

async function appendApplicationAudit(
  DB: D1Database,
  actor: ServerActor,
  applicationId: string,
  eventType: string,
  payload: unknown,
) {
  await DB.prepare(`
    INSERT INTO portal_audit_events
      (id, tenant_id, application_id, actor_user_id, actor_subject, event_type,
       entity_type, entity_id, payload_json, ip_hash, occurred_at)
    VALUES (?, ?, ?, ?, ?, ?, 'application', ?, ?, NULL, ?)
  `).bind(
    crypto.randomUUID(), actor.tenantId, applicationId, actor.userId, actor.subject,
    eventType, applicationId, JSON.stringify(payload), new Date().toISOString(),
  ).run();
}

function parseApplicationState(value: string): ApplicationFormState | null {
  try {
    const candidate = normalizePersistedApplicationFormState(JSON.parse(value));
    return candidate ? normalizeApprovingLeader(candidate) : null;
  } catch {
    return null;
  }
}

function assertApplicationId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) {
    throw new ApplicationRepositoryError(400, "Ugyldig kladde.");
  }
}

function normalizeCaseNumber(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!/^ITA-\d{6,8}$/.test(normalized)) {
    throw new ApplicationRepositoryError(400, "Ugyldigt sagsnummer.");
  }
  return normalized;
}

function assertOwner(actor: ServerActor, row: ApplicationRow) {
  if (row.tenant_id !== actor.tenantId || row.owner_user_id !== actor.userId) {
    throw new ApplicationRepositoryError(403, "Kladden tilhører ikke den aktuelle bruger.");
  }
}

function assertCanCreate(actor: ServerActor) {
  if (actor.role === "consultant") {
    throw new ApplicationRepositoryError(
      403,
      "D-GITA-konsulenter kan behandle sager, men ikke oprette ansøgninger.",
    );
  }
}

function newCaseNumber() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 100_000_000;
  return `ITA-${String(value).padStart(8, "0")}`;
}

function isUniqueConstraint(error: unknown) {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}

async function sha256Text(value: string) {
  return sha256Bytes(new TextEncoder().encode(value));
}

async function sha256Bytes(value: ArrayBuffer | ArrayBufferView) {
  const source = ArrayBuffer.isView(value)
    ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    : new Uint8Array(value);
  const bytes = Uint8Array.from(source);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}
