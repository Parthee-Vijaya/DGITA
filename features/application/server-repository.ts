import { ensurePortalSchema, getPersistenceBindings } from "../../db/persistence";
import type { ServerActor } from "../auth/types";
import {
  getAllErrors,
  getDisplaySystemName,
  pruneHiddenAnswers,
  type ApplicationFormState,
  type AttachmentDraft,
  type UploadKind,
} from "./engine";

type ApplicationRow = {
  id: string;
  tenant_id: string;
  owner_user_id: string;
  case_number: string;
  draft_state_json: string;
  status: string;
  row_version: number;
  current_version_number: number;
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
           row_version, current_version_number, updated_at
    FROM portal_applications
    WHERE tenant_id = ? AND owner_user_id = ? AND status = 'draft'
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
  };
}

export async function saveApplicationDraft(
  actor: ServerActor,
  id: string,
  state: ApplicationFormState,
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
    if (existing.status !== "draft") {
      throw new ApplicationRepositoryError(
        409,
        "Den indsendte ansøgning er versionslåst og kan ikke overskrives.",
      );
    }
    const now = new Date().toISOString();
    await DB.prepare(`
      UPDATE portal_applications
      SET title = ?, system_name = ?, draft_schema_version = ?, draft_state_json = ?,
          updated_at = ?, row_version = row_version + 1
      WHERE id = ? AND tenant_id = ? AND owner_user_id = ? AND status = 'draft'
    `)
      .bind(
        getDisplaySystemName(state),
        getDisplaySystemName(state),
        state.schemaVersion,
        serialized,
        now,
        id,
        actor.tenantId,
        actor.userId,
      )
      .run();
    await appendApplicationAudit(DB, actor, id, "application.draft_saved", {
      rowVersion: existing.row_version + 1,
    });
    return { id, caseNumber: existing.case_number, status: "draft" as const, updatedAt: now };
  }

  const now = new Date().toISOString();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const caseNumber = newCaseNumber();
    try {
      await DB.prepare(`
        INSERT INTO portal_applications
          (id, tenant_id, owner_user_id, case_number, title, system_name, status,
           phase, assigned_consultant_user_id, draft_schema_version,
           draft_state_json, row_version, current_version_number,
           current_version_id, created_at, updated_at, submitted_at, closed_at)
        VALUES (?, ?, ?, ?, ?, ?, 'draft', 'Kladde', NULL, ?, ?, 1, 0, NULL, ?, ?, NULL, NULL)
      `)
        .bind(
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
        )
        .run();
      await appendApplicationAudit(DB, actor, id, "application.created", { caseNumber });
      return { id, caseNumber, status: "draft" as const, updatedAt: now };
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
) {
  const draft = await saveApplicationDraft(actor, id, state);
  const DB = await portalDb();
  const row = await findApplicationById(DB, id);
  if (!row) throw new ApplicationRepositoryError(404, "Kladden findes ikke.");
  assertOwner(actor, row);
  if (row.status !== "draft") {
    throw new ApplicationRepositoryError(409, "Ansøgningen er allerede indsendt.");
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
  if (hiddenAttachments.length > 0) {
    const { FILES } = await getPersistenceBindings();
    await Promise.all(hiddenAttachments.map((attachment) => FILES.delete(attachment.storage_key)));
    const deletedAt = new Date().toISOString();
    await DB.batch(hiddenAttachments.map((attachment) => DB.prepare(`
      UPDATE portal_attachments SET status = 'deleted', deleted_at = ?
      WHERE id = ? AND tenant_id = ? AND application_id = ?
        AND application_version_id IS NULL
    `).bind(deletedAt, attachment.id, actor.tenantId, id)));
  }
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

  await DB.batch([
    DB.prepare(`
      INSERT INTO portal_application_versions
        (id, tenant_id, application_id, version_number, schema_version,
         snapshot_json, snapshot_sha256, attachment_manifest_sha256,
         submitted_by_user_id, created_at, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    ),
    DB.prepare(`
      UPDATE portal_applications
      SET status = 'submitted', phase = 'Indsendt', draft_state_json = ?,
          current_version_number = ?, current_version_id = ?, submitted_at = ?,
          updated_at = ?, row_version = row_version + 1
      WHERE id = ? AND tenant_id = ? AND owner_user_id = ?
        AND status = 'draft' AND row_version = ?
    `).bind(
      snapshotJson,
      versionNumber,
      versionId,
      now,
      now,
      id,
      actor.tenantId,
      actor.userId,
      row.row_version,
    ),
    DB.prepare(`
      UPDATE portal_attachments
      SET application_version_id = ?, immutable_at = ?
      WHERE tenant_id = ? AND application_id = ?
        AND application_version_id IS NULL AND status = 'ready'
    `).bind(versionId, now, actor.tenantId, id),
    DB.prepare(`
      INSERT INTO portal_audit_events
        (id, tenant_id, application_id, actor_user_id, actor_subject, event_type,
         entity_type, entity_id, payload_json, ip_hash, occurred_at)
      VALUES (?, ?, ?, ?, ?, 'application.submitted', 'application', ?, ?, NULL, ?)
    `).bind(
      auditId,
      actor.tenantId,
      id,
      actor.userId,
      actor.subject,
      id,
      JSON.stringify({ caseNumber: draft.caseNumber, versionNumber }),
      now,
    ),
  ]);

  return {
    id,
    caseNumber: draft.caseNumber,
    status: "submitted" as const,
    versionNumber,
    submittedAt: now,
  };
}

export async function getOwnedDraftForUpload(actor: ServerActor, id: string) {
  assertCanCreate(actor);
  assertApplicationId(id);
  const DB = await portalDb();
  const row = await findApplicationById(DB, id);
  if (!row) throw new ApplicationRepositoryError(404, "Kladden findes ikke.");
  assertOwner(actor, row);
  if (row.status !== "draft") {
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
    await DB.prepare(`
      INSERT INTO portal_attachments
        (id, tenant_id, application_id, application_version_id, owner_user_id,
         kind, original_name, size_bytes, content_type, storage_key,
         checksum_sha256, status, scan_status, uploaded_by_user_id,
         created_at, immutable_at, deleted_at)
      VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'ready', 'not_configured', ?, ?, NULL, NULL)
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
    ).run();
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
  const { FILES } = await getPersistenceBindings();
  await FILES.delete(row.storage_key);
  const now = new Date().toISOString();
  await DB.prepare(`
    UPDATE portal_attachments SET status = 'deleted', deleted_at = ?
    WHERE id = ? AND tenant_id = ? AND application_id = ?
      AND application_version_id IS NULL
  `).bind(now, attachmentId, actor.tenantId, applicationId).run();
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
           row_version, current_version_number, updated_at
    FROM portal_applications WHERE id = ? LIMIT 1
  `).bind(id).first<ApplicationRow>();
}

async function getApplicationAttachments(DB: D1Database, applicationId: string) {
  const result = await DB.prepare(`
    SELECT id, application_id, kind, original_name, size_bytes, content_type,
           storage_key, checksum_sha256, status
    FROM portal_attachments
    WHERE application_id = ? AND status = 'ready'
    ORDER BY created_at, id
  `).bind(applicationId).all<AttachmentRow>();
  return result.results;
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
    const candidate = JSON.parse(value) as Partial<ApplicationFormState>;
    return candidate.schemaVersion === "dgita-v1" && candidate.attachments
      ? candidate as ApplicationFormState
      : null;
  } catch {
    return null;
  }
}

function assertApplicationId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) {
    throw new ApplicationRepositoryError(400, "Ugyldig kladde.");
  }
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
