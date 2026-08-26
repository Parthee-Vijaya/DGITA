import {
  DEFAULT_CONTENT,
  DEFAULT_IMAGES,
  DEMO_CASES,
  DEMO_VIEWERS,
  EMPTY_D_GITA_APPROVAL,
  isSafeContentUrl,
  isSafeImageUrl,
  normalizeDgitaApproval,
  type CaseRecord,
  type ContentEntry,
  type DgitaApproval,
  type FieldComment,
  type ImageEntry,
  type WorkspaceRole,
} from "./model";

import { ensurePortalSchema, getPersistenceBindings } from "../../db/persistence";

export type PortalActor = {
  userId?: string;
  subject: string;
  tenantId: string;
  role: WorkspaceRole;
  displayName: string;
  email: string;
  initials: string;
  municipality: string;
  provider: string;
};

type ApplicationRow = {
  id: string;
  case_number: string;
  tenant_id: string;
  owner_user_id: string;
  owner_subject: string;
  owner_email: string;
  applicant_name: string;
  municipality: string;
  system_name: string | null;
  status: string;
  phase: string;
  consultant_name: string | null;
  draft_state_json: string;
  created_at: string;
  updated_at: string;
};

type StoredContentRow = {
  key: string;
  content_type: string;
  value_json: string;
};

type StoredApprovalRow = {
  case_number: string;
  internal_fields_json: string;
};

type StoredFieldCommentRow = {
  id: string;
  case_number: string;
  field_id: string;
  visibility: "applicant" | "internal";
  body: string;
  author_subject: string;
  author_name: string;
  created_at: string;
};

const DEFAULT_APPROVALS: Record<string, DgitaApproval> = {
  "ITA-001284": {
    ...EMPTY_D_GITA_APPROVAL,
    approved: "Ja",
    date: "2026-08-26",
    legalBasis: "GDPR",
    responsible: "Peter Bjerre Ahlgren",
    hasAdditionalResponsible: "Nej",
    itConsultant: "Casper Kjeldsen Ravn",
    infrastructureChanges: "Ja",
    notes: "Arkitekturtegning skal eftersendes før endelig afslutning.",
    internalComments: "Afstem teknisk ejer med Infrastruktur på næste statusmøde.",
    phase: "Under behandling",
  },
};

const EXTRA_DEMO_USERS = [
  {
    id: "kalundborg-user-anita-lauridsen",
    email: "anita.lauridsen@kalundborg.dk",
    displayName: "Anita Mark Vig Lauridsen",
    role: "user" as const,
  },
  {
    id: "kalundborg-consultant-peter-bjerre",
    email: "peter.bjerre@kalundborg.dk",
    displayName: "Peter Bjerre Ahlgren",
    role: "consultant" as const,
  },
];

export class PortalAccessError extends Error {
  constructor(
    readonly status: 401 | 403 | 404 | 409 | 422,
    message: string,
  ) {
    super(message);
    this.name = "PortalAccessError";
  }
}

export async function preparePortalData() {
  await ensurePortalSchema();
  const { DB } = await getPersistenceBindings();
  await seedPortalDefaults(DB);
  return DB;
}

export async function resolveActorUserId(DB: D1Database, actor: PortalActor) {
  if (actor.userId) return actor.userId;
  const row = await DB.prepare(
    `SELECT id FROM portal_users
     WHERE tenant_id = ? AND external_subject = ? AND status = 'active'
     LIMIT 1`,
  )
    .bind(actor.tenantId, actor.subject)
    .first<{ id: string }>();
  if (!row) throw new PortalAccessError(401, "Brugeren findes ikke i portalen.");
  return row.id;
}

export async function listCasesForActor(actor: PortalActor): Promise<CaseRecord[]> {
  const DB = await preparePortalData();
  const userId = await resolveActorUserId(DB, actor);
  const ownerClause = actor.role === "user" ? "AND a.owner_user_id = ?" : "";
  const query = `
    SELECT
      a.id, a.case_number, a.tenant_id, a.owner_user_id, a.system_name,
      a.status, a.phase, a.draft_state_json, a.created_at, a.updated_at,
      owner.external_subject AS owner_subject,
      owner.email AS owner_email,
      owner.display_name AS applicant_name,
      tenant.name AS municipality,
      consultant.display_name AS consultant_name
    FROM portal_applications a
    INNER JOIN portal_users owner ON owner.id = a.owner_user_id
    INNER JOIN portal_tenants tenant ON tenant.id = a.tenant_id
    LEFT JOIN portal_users consultant ON consultant.id = a.assigned_consultant_user_id
    WHERE a.tenant_id = ? ${ownerClause}
    ORDER BY a.updated_at DESC, a.case_number DESC
  `;
  const statement = DB.prepare(query);
  const result = actor.role === "user"
    ? await statement.bind(actor.tenantId, userId).all<ApplicationRow>()
    : await statement.bind(actor.tenantId).all<ApplicationRow>();
  return result.results.map(toCaseRecord);
}

export async function getWorkspaceForActor(actor: PortalActor) {
  const DB = await preparePortalData();
  const userId = await resolveActorUserId(DB, actor);
  const contentStatement = actor.role === "admin"
    ? DB.prepare(
        `SELECT key, content_type, value_json FROM portal_content_entries
         WHERE tenant_id = ? AND content_type IN ('content', 'image')
         ORDER BY created_at, key`,
      ).bind(actor.tenantId)
    : DB.prepare(
        `SELECT key, content_type, value_json FROM portal_content_entries
         WHERE tenant_id = ? AND status = 'published'
           AND content_type IN ('content', 'image')
         ORDER BY created_at, key`,
      ).bind(actor.tenantId);
  const contentRows = (await contentStatement.all<StoredContentRow>()).results;

  const accessClause = actor.role === "user" ? "AND a.owner_user_id = ?" : "";
  const accessBindings = actor.role === "user"
    ? [actor.tenantId, userId]
    : [actor.tenantId];

  const commentResult = await DB.prepare(`
    SELECT c.id, a.case_number, c.field_id, c.visibility, c.body,
           author.external_subject AS author_subject,
           author.display_name AS author_name, c.created_at
    FROM portal_field_comments c
    INNER JOIN portal_applications a ON a.id = c.application_id AND a.tenant_id = c.tenant_id
    INNER JOIN portal_users author ON author.id = c.author_user_id
    WHERE c.tenant_id = ? AND c.status = 'active' ${accessClause}
      ${actor.role === "user" ? "AND c.visibility = 'applicant'" : ""}
    ORDER BY c.created_at
  `)
    .bind(...accessBindings)
    .all<StoredFieldCommentRow>();

  let approvals: Record<string, DgitaApproval> = {};
  if (actor.role !== "user") {
    const approvalRows = await DB.prepare(`
      SELECT a.case_number, approval.internal_fields_json
      FROM portal_dgita_approvals approval
      INNER JOIN portal_applications a
        ON a.id = approval.application_id AND a.tenant_id = approval.tenant_id
      WHERE approval.tenant_id = ?
      ORDER BY approval.updated_at
    `)
      .bind(actor.tenantId)
      .all<StoredApprovalRow>();
    approvals = Object.fromEntries(
      approvalRows.results.flatMap((row) => {
        const parsed = parseJson<DgitaApproval>(row.internal_fields_json);
        return parsed ? [[row.case_number, normalizeDgitaApproval(parsed)]] : [];
      }),
    );
  }

  return {
    content: contentRows
      .filter((row) => row.content_type === "content")
      .flatMap((row) => parseEntry<ContentEntry>(row.value_json)),
    images: contentRows
      .filter((row) => row.content_type === "image")
      .flatMap((row) => parseEntry<ImageEntry>(row.value_json)),
    approvals,
    fieldComments: commentResult.results.map((row) => ({
      id: row.id,
      caseId: row.case_number,
      fieldId: row.field_id,
      fieldLabel: fieldLabel(row.field_id),
      body: row.body,
      authorSubject: row.author_subject,
      authorName: row.author_name,
      createdAt: row.created_at,
      visibility: row.visibility,
    } satisfies FieldComment)),
  };
}

export async function upsertContentForActor(
  actor: PortalActor,
  entry: ContentEntry,
) {
  requireAdmin(actor);
  if (!entry.id || !entry.title.trim() || !entry.body.trim()) {
    throw new PortalAccessError(422, "Titel og tekst skal udfyldes.");
  }
  if (entry.url && !isSafeContentUrl(entry.url)) {
    throw new PortalAccessError(422, "Linkadressen er ikke tilladt.");
  }
  const DB = await preparePortalData();
  const userId = await resolveActorUserId(DB, actor);
  const existing = await DB.prepare(
    `SELECT value_json FROM portal_content_entries
     WHERE tenant_id = ? AND key = ? AND content_type = 'content' LIMIT 1`,
  )
    .bind(actor.tenantId, entry.id)
    .first<{ value_json: string }>();
  const stable = existing ? parseJson<ContentEntry>(existing.value_json) : null;
  const now = new Date().toISOString();
  const saved: ContentEntry = {
    ...entry,
    category: stable?.category ?? entry.category,
    location: stable?.location ?? entry.location,
    updatedAt: now,
    updatedBy: actor.displayName,
  };
  await DB.prepare(`
    INSERT INTO portal_content_entries
      (id, tenant_id, key, locale, page_path, content_type, value_json, status,
       version, updated_by_user_id, created_at, updated_at, published_at)
    VALUES (?, ?, ?, 'da-DK', ?, 'content', ?, ?, 1, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, key, locale) DO UPDATE SET
      value_json = excluded.value_json,
      status = excluded.status,
      version = portal_content_entries.version + 1,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = excluded.updated_at,
      published_at = excluded.published_at
  `)
    .bind(
      `content:${actor.tenantId}:${saved.id}`,
      actor.tenantId,
      saved.id,
      saved.location,
      JSON.stringify(saved),
      saved.published ? "published" : "draft",
      userId,
      now,
      now,
      saved.published ? now : null,
    )
    .run();
  await recordAudit(DB, actor, "content.updated", "content_entry", saved.id, {
    published: saved.published,
  });
  return saved;
}

export async function deleteContentForActor(actor: PortalActor, key: string) {
  requireAdmin(actor);
  const DB = await preparePortalData();
  const result = await DB.prepare(
    `DELETE FROM portal_content_entries
     WHERE tenant_id = ? AND key = ? AND content_type = 'content'`,
  )
    .bind(actor.tenantId, key)
    .run();
  await recordAudit(DB, actor, "content.deleted", "content_entry", key, {});
  return Number(result.meta.changes ?? 0) > 0;
}

export async function upsertImageForActor(actor: PortalActor, entry: ImageEntry) {
  requireAdmin(actor);
  if (!entry.id || !entry.alt.trim() || !isSafeImageUrl(entry.src)) {
    throw new PortalAccessError(422, "Billede eller alttekst er ugyldig.");
  }
  const DB = await preparePortalData();
  const userId = await resolveActorUserId(DB, actor);
  const existing = await DB.prepare(
    `SELECT value_json FROM portal_content_entries
     WHERE tenant_id = ? AND key = ? AND content_type = 'image' LIMIT 1`,
  )
    .bind(actor.tenantId, entry.id)
    .first<{ value_json: string }>();
  const stable = existing ? parseJson<ImageEntry>(existing.value_json) : null;
  const now = new Date().toISOString();
  const saved: ImageEntry = {
    ...entry,
    location: stable?.location ?? entry.location,
    updatedAt: now,
    updatedBy: actor.displayName,
  };
  await DB.prepare(`
    INSERT INTO portal_content_entries
      (id, tenant_id, key, locale, page_path, content_type, value_json, status,
       version, updated_by_user_id, created_at, updated_at, published_at)
    VALUES (?, ?, ?, 'da-DK', ?, 'image', ?, 'published', 1, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, key, locale) DO UPDATE SET
      value_json = excluded.value_json,
      version = portal_content_entries.version + 1,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = excluded.updated_at,
      published_at = excluded.published_at
  `)
    .bind(
      `image:${actor.tenantId}:${saved.id}`,
      actor.tenantId,
      saved.id,
      saved.location,
      JSON.stringify(saved),
      userId,
      now,
      now,
      now,
    )
    .run();
  await recordAudit(DB, actor, "image.updated", "content_entry", saved.id, {});
  return saved;
}

export async function saveApprovalForActor(
  actor: PortalActor,
  caseNumber: string,
  approval: DgitaApproval,
) {
  if (actor.role === "user") {
    throw new PortalAccessError(403, "Kun D-GITA kan redigere godkendelsesfelter.");
  }
  const DB = await preparePortalData();
  const userId = await resolveActorUserId(DB, actor);
  const application = await accessibleApplication(DB, actor, caseNumber);
  const now = new Date().toISOString();
  const normalized: DgitaApproval = {
    ...normalizeDgitaApproval(approval),
    updatedAt: now,
    updatedBy: actor.displayName,
  };
  await DB.prepare(`
    INSERT INTO portal_dgita_approvals
      (id, tenant_id, application_id, application_version_id, reviewer_user_id,
       status, internal_fields_json, decision_comment, created_at, updated_at, decided_at)
    VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, application_id) DO UPDATE SET
      reviewer_user_id = excluded.reviewer_user_id,
      status = excluded.status,
      internal_fields_json = excluded.internal_fields_json,
      decision_comment = excluded.decision_comment,
      updated_at = excluded.updated_at,
      decided_at = excluded.decided_at
  `)
    .bind(
      `approval:${actor.tenantId}:${application.id}`,
      actor.tenantId,
      application.id,
      userId,
      normalized.approved === "Ja" ? "approved" : normalized.approved === "Nej" ? "rejected" : "draft",
      JSON.stringify(normalized),
      normalized.notes,
      now,
      now,
      normalized.approved ? now : null,
    )
    .run();
  await DB.prepare(
    `UPDATE portal_applications SET phase = ?, updated_at = ?, row_version = row_version + 1
     WHERE id = ? AND tenant_id = ?`,
  )
    .bind(normalized.phase, now, application.id, actor.tenantId)
    .run();
  await recordAudit(DB, actor, "dgita.review.updated", "application", application.id, {
    phase: normalized.phase,
    approved: normalized.approved,
  });
  return normalized;
}

export async function addFieldCommentForActor(
  actor: PortalActor,
  input: Pick<FieldComment, "id" | "caseId" | "fieldId" | "fieldLabel" | "body" | "visibility">,
) {
  if (actor.role === "user") {
    throw new PortalAccessError(403, "Kun D-GITA kan kommentere ansøgningsfelter.");
  }
  if (!input.body.trim() || input.body.length > 8_000) {
    throw new PortalAccessError(422, "Kommentaren er tom eller for lang.");
  }
  const DB = await preparePortalData();
  const userId = await resolveActorUserId(DB, actor);
  const application = await accessibleApplication(DB, actor, input.caseId);
  const now = new Date().toISOString();
  await DB.prepare(`
    INSERT INTO portal_field_comments
      (id, tenant_id, application_id, application_version_id, field_id,
       author_user_id, visibility, body, status, parent_comment_id,
       created_at, edited_at, resolved_at)
    VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'active', NULL, ?, NULL, NULL)
  `)
    .bind(
      input.id,
      actor.tenantId,
      application.id,
      input.fieldId,
      userId,
      input.visibility,
      input.body.trim(),
      now,
    )
    .run();
  await recordAudit(DB, actor, "field_comment.created", "field_comment", input.id, {
    fieldId: input.fieldId,
    visibility: input.visibility,
  }, application.id);
  return {
    ...input,
    body: input.body.trim(),
    authorSubject: actor.subject,
    authorName: actor.displayName,
    createdAt: now,
  } satisfies FieldComment;
}

export async function resetWorkspaceContentForActor(actor: PortalActor) {
  requireAdmin(actor);
  const DB = await preparePortalData();
  await DB.prepare(
    `DELETE FROM portal_content_entries
     WHERE tenant_id = ? AND content_type IN ('content', 'image')`,
  )
    .bind(actor.tenantId)
    .run();
  await seedContentDefaults(DB, actor.tenantId);
  await recordAudit(DB, actor, "content.reset", "tenant", actor.tenantId, {});
}

export async function resetWorkspaceImagesForActor(actor: PortalActor) {
  requireAdmin(actor);
  const DB = await preparePortalData();
  await DB.prepare(
    `DELETE FROM portal_content_entries
     WHERE tenant_id = ? AND content_type = 'image'`,
  )
    .bind(actor.tenantId)
    .run();
  await seedImageDefaults(DB, actor.tenantId);
  await recordAudit(DB, actor, "images.reset", "tenant", actor.tenantId, {});
}

async function seedPortalDefaults(DB: D1Database) {
  const now = "2026-08-26T12:00:00.000Z";
  const statements: D1PreparedStatement[] = [
    DB.prepare(`
      INSERT OR IGNORE INTO portal_tenants
        (id, slug, name, authority_code, status, created_at, updated_at)
      VALUES ('kalundborg', 'kalundborg', 'Kalundborg Kommune', '326', 'active', ?, ?)
    `).bind(now, now),
  ];

  for (const viewer of Object.values(DEMO_VIEWERS)) {
    statements.push(...demoUserStatements(DB, viewer.subject, viewer.email, viewer.displayName, viewer.role, now));
  }
  for (const user of EXTRA_DEMO_USERS) {
    statements.push(...demoUserStatements(DB, user.id, user.email, user.displayName, user.role, now));
  }
  await runBatches(DB, statements);
  await seedContentDefaults(DB, "kalundborg");
  await seedDemoApplications(DB, now);
}

function demoUserStatements(
  DB: D1Database,
  id: string,
  email: string,
  displayName: string,
  role: WorkspaceRole,
  now: string,
) {
  const databaseRole = role === "consultant" ? "dgita_consultant" : role;
  return [
    DB.prepare(`
      INSERT OR IGNORE INTO portal_users
        (id, tenant_id, identity_provider, external_subject, email, display_name,
         status, created_at, updated_at, last_login_at)
      VALUES (?, 'kalundborg', 'dev', ?, ?, ?, 'active', ?, ?, NULL)
    `).bind(id, id, email, displayName, now, now),
    DB.prepare(`
      INSERT OR IGNORE INTO portal_user_roles
        (id, tenant_id, user_id, role, created_at, created_by_user_id)
      VALUES (?, 'kalundborg', ?, ?, ?, NULL)
    `).bind(`role:${id}:${databaseRole}`, id, databaseRole, now),
  ];
}

async function seedContentDefaults(DB: D1Database, tenantId: string) {
  const now = "2026-08-26T12:00:00.000Z";
  const statements: D1PreparedStatement[] = [];
  for (const entry of DEFAULT_CONTENT) {
    statements.push(DB.prepare(`
      INSERT OR IGNORE INTO portal_content_entries
        (id, tenant_id, key, locale, page_path, content_type, value_json, status,
         version, updated_by_user_id, created_at, updated_at, published_at)
      VALUES (?, ?, ?, 'da-DK', ?, 'content', ?, ?, 1, NULL, ?, ?, ?)
    `).bind(
      `content:${tenantId}:${entry.id}`,
      tenantId,
      entry.id,
      entry.location,
      JSON.stringify(entry),
      entry.published ? "published" : "draft",
      now,
      now,
      entry.published ? now : null,
    ));
  }
  await runBatches(DB, statements);
  await seedImageDefaults(DB, tenantId);
}

async function seedImageDefaults(DB: D1Database, tenantId: string) {
  const now = "2026-08-26T12:00:00.000Z";
  const statements: D1PreparedStatement[] = [];
  for (const entry of DEFAULT_IMAGES) {
    statements.push(DB.prepare(`
      INSERT OR IGNORE INTO portal_content_entries
        (id, tenant_id, key, locale, page_path, content_type, value_json, status,
         version, updated_by_user_id, created_at, updated_at, published_at)
      VALUES (?, ?, ?, 'da-DK', ?, 'image', ?, 'published', 1, NULL, ?, ?, ?)
    `).bind(
      `image:${tenantId}:${entry.id}`,
      tenantId,
      entry.id,
      entry.location,
      JSON.stringify(entry),
      now,
      now,
      now,
    ));
  }
  await runBatches(DB, statements);
}

async function seedDemoApplications(DB: D1Database, fallbackNow: string) {
  const statements: D1PreparedStatement[] = [];
  for (const item of DEMO_CASES) {
    const status = item.phase === "Kladde"
      ? "draft"
      : item.phase === "Indsendt"
        ? "submitted"
        : item.phase === "Under behandling"
          ? "under_review"
          : "closed";
    const consultantId = item.consultant === "Peter Bjerre Ahlgren"
      ? "kalundborg-consultant-peter-bjerre"
      : item.consultant === DEMO_VIEWERS.consultant.displayName
        ? DEMO_VIEWERS.consultant.subject
        : item.consultant === "Anita Mark Vig Lauridsen"
          ? "kalundborg-user-anita-lauridsen"
          : item.consultant === DEMO_VIEWERS.user.displayName
            ? DEMO_VIEWERS.user.subject
            : null;
    statements.push(DB.prepare(`
      INSERT OR IGNORE INTO portal_applications
        (id, tenant_id, owner_user_id, case_number, title, system_name, status,
         phase, assigned_consultant_user_id, draft_schema_version, draft_state_json,
         row_version, current_version_number, current_version_id, created_at,
         updated_at, submitted_at, closed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'dgita-v1', ?, 1, 0, NULL, ?, ?, ?, ?)
    `).bind(
      `demo:${item.id}`,
      item.tenantId,
      item.ownerSubject,
      item.id,
      item.system,
      item.system,
      status,
      item.phase,
      consultantId,
      JSON.stringify({ _demo: { leader: item.leader, approval: item.approval } }),
      parseDemoDate(item.created) ?? fallbackNow,
      parseDemoDate(item.changed) ?? fallbackNow,
      status === "draft" ? null : parseDemoDate(item.changed) ?? fallbackNow,
      status === "closed" ? parseDemoDate(item.changed) ?? fallbackNow : null,
    ));
  }
  await runBatches(DB, statements);

  for (const [caseNumber, approval] of Object.entries(DEFAULT_APPROVALS)) {
    const application = await DB.prepare(
      "SELECT id FROM portal_applications WHERE tenant_id = 'kalundborg' AND case_number = ? LIMIT 1",
    ).bind(caseNumber).first<{ id: string }>();
    if (!application) continue;
    await DB.prepare(`
      INSERT OR IGNORE INTO portal_dgita_approvals
        (id, tenant_id, application_id, application_version_id, reviewer_user_id,
         status, internal_fields_json, decision_comment, created_at, updated_at, decided_at)
      VALUES (?, 'kalundborg', ?, NULL, ?, 'approved', ?, ?, ?, ?, ?)
    `).bind(
      `approval:kalundborg:${application.id}`,
      application.id,
      "kalundborg-consultant-peter-bjerre",
      JSON.stringify(approval),
      approval.notes,
      fallbackNow,
      fallbackNow,
      fallbackNow,
    ).run();
  }
}

async function accessibleApplication(
  DB: D1Database,
  actor: PortalActor,
  caseNumber: string,
) {
  const userId = await resolveActorUserId(DB, actor);
  const row = actor.role === "user"
    ? await DB.prepare(
        `SELECT id, status FROM portal_applications
         WHERE tenant_id = ? AND case_number = ? AND owner_user_id = ? LIMIT 1`,
      ).bind(actor.tenantId, caseNumber, userId).first<{ id: string; status: string }>()
    : await DB.prepare(
        `SELECT id, status FROM portal_applications
         WHERE tenant_id = ? AND case_number = ? LIMIT 1`,
      ).bind(actor.tenantId, caseNumber).first<{ id: string; status: string }>();
  if (!row) throw new PortalAccessError(404, "Sagen findes ikke, eller du har ikke adgang.");
  return row;
}

async function recordAudit(
  DB: D1Database,
  actor: PortalActor,
  eventType: string,
  entityType: string,
  entityId: string,
  payload: unknown,
  applicationId: string | null = null,
) {
  const actorUserId = await resolveActorUserId(DB, actor);
  await DB.prepare(`
    INSERT INTO portal_audit_events
      (id, tenant_id, application_id, actor_user_id, actor_subject, event_type,
       entity_type, entity_id, payload_json, ip_hash, occurred_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
  `).bind(
    crypto.randomUUID(), actor.tenantId, applicationId, actorUserId, actor.subject,
    eventType, entityType, entityId, JSON.stringify(payload), new Date().toISOString(),
  ).run();
}

async function runBatches(DB: D1Database, statements: D1PreparedStatement[]) {
  for (let start = 0; start < statements.length; start += 40) {
    await DB.batch(statements.slice(start, start + 40));
  }
}

function toCaseRecord(row: ApplicationRow): CaseRecord {
  const metadata = parseJson<{ _demo?: { leader?: string; approval?: CaseRecord["approval"] }; approvingLeader?: string }>(row.draft_state_json);
  return {
    id: row.case_number,
    tenantId: row.tenant_id,
    ownerSubject: row.owner_subject,
    ownerEmail: row.owner_email,
    system: row.system_name || "Ikke navngivet",
    phase: normalizePhase(row.phase),
    created: formatDanishDate(row.created_at),
    changed: formatDanishDate(row.updated_at),
    consultant: row.consultant_name || "Ikke tildelt",
    applicant: row.applicant_name,
    municipality: row.municipality.replace(/ Kommune$/, ""),
    leader: metadata?._demo?.leader || metadata?.approvingLeader || "Ikke valgt",
    approval: metadata?._demo?.approval || (row.status === "draft" ? "Ikke startet" : "Afventer"),
  };
}

function normalizePhase(value: string): CaseRecord["phase"] {
  return value === "Indsendt" || value === "Under behandling" || value === "Afsluttet"
    ? value
    : "Kladde";
}

function formatDanishDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("da-DK", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date).replace(",", "");
}

function parseDemoDate(value: string) {
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:00.000Z`;
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function parseEntry<T>(value: string): T[] {
  const parsed = parseJson<T>(value);
  return parsed ? [parsed] : [];
}

function fieldLabel(fieldId: string) {
  const labels: Record<string, string> = {
    system: "System eller løsning",
    purpose: "Formål og ønsket effekt",
    users: "Antal brugere",
    "personal-data": "Personoplysninger",
    finance: "Samlet finansiering",
  };
  return labels[fieldId] ?? fieldId;
}

function requireAdmin(actor: PortalActor) {
  if (actor.role !== "admin") {
    throw new PortalAccessError(403, "Kun administratorer kan ændre portalindhold.");
  }
}
