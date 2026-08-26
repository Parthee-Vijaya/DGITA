import type {
  ApplicationFormState,
  AttachmentDraft,
  UploadKind,
} from "../features/application/engine";

export type DraftRow = {
  id: string;
  state_json: string;
  status: "draft" | "submitted";
  updated_at: string;
};

export type AttachmentRow = {
  id: string;
  draft_id: string;
  kind: UploadKind;
  name: string;
  size: number;
  content_type: string;
  storage_key: string;
};

export type PersistenceBindings = {
  DB: D1Database;
  FILES: R2Bucket;
};

const legacySchemaStatements = [
  `CREATE TABLE IF NOT EXISTS application_drafts (
    id TEXT PRIMARY KEY,
    schema_version TEXT NOT NULL,
    state_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    submitted_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS application_attachments (
    id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    content_type TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    FOREIGN KEY (draft_id) REFERENCES application_drafts(id) ON DELETE CASCADE
  )`,
  "CREATE INDEX IF NOT EXISTS application_drafts_status_idx ON application_drafts(status)",
  "CREATE INDEX IF NOT EXISTS application_attachments_draft_idx ON application_attachments(draft_id)",
] as const;

/**
 * Canonical portal schema. Every entry is exactly one SQLite statement so D1
 * can safely prepare and batch it. Drizzle migrations remain the deployment
 * source of truth; this idempotent bootstrap supports fresh local/Sites DBs.
 */
export const portalSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS portal_tenants (
    id TEXT PRIMARY KEY NOT NULL,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    authority_code TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS portal_tenants_slug_uidx ON portal_tenants(slug)",
  "CREATE INDEX IF NOT EXISTS portal_tenants_status_idx ON portal_tenants(status)",

  `CREATE TABLE IF NOT EXISTS portal_users (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    identity_provider TEXT NOT NULL,
    external_subject TEXT NOT NULL,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TEXT,
    FOREIGN KEY (tenant_id) REFERENCES portal_tenants(id) ON DELETE RESTRICT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS portal_users_tenant_provider_subject_uidx
    ON portal_users(tenant_id, identity_provider, external_subject)`,
  "CREATE INDEX IF NOT EXISTS portal_users_tenant_email_idx ON portal_users(tenant_id, email)",
  "CREATE INDEX IF NOT EXISTS portal_users_tenant_status_idx ON portal_users(tenant_id, status)",

  `CREATE TABLE IF NOT EXISTS portal_user_roles (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id TEXT,
    FOREIGN KEY (tenant_id) REFERENCES portal_tenants(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES portal_users(id) ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS portal_user_roles_tenant_user_role_uidx
    ON portal_user_roles(tenant_id, user_id, role)`,
  "CREATE INDEX IF NOT EXISTS portal_user_roles_tenant_role_idx ON portal_user_roles(tenant_id, role)",

  `CREATE TABLE IF NOT EXISTS portal_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_session_id TEXT,
    roles_snapshot_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    revoked_at TEXT,
    ip_hash TEXT,
    user_agent_hash TEXT,
    FOREIGN KEY (tenant_id) REFERENCES portal_tenants(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES portal_users(id) ON DELETE CASCADE
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS portal_sessions_token_hash_uidx ON portal_sessions(token_hash)",
  `CREATE INDEX IF NOT EXISTS portal_sessions_user_active_idx
    ON portal_sessions(tenant_id, user_id, revoked_at, expires_at)`,
  "CREATE INDEX IF NOT EXISTS portal_sessions_expiry_idx ON portal_sessions(expires_at)",

  `CREATE TABLE IF NOT EXISTS portal_applications (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    case_number TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Ny ansøgning',
    system_name TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    phase TEXT NOT NULL DEFAULT 'draft',
    assigned_consultant_user_id TEXT,
    draft_schema_version TEXT NOT NULL,
    draft_state_json TEXT NOT NULL,
    row_version INTEGER NOT NULL DEFAULT 1,
    current_version_number INTEGER NOT NULL DEFAULT 0,
    current_version_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TEXT,
    closed_at TEXT,
    FOREIGN KEY (tenant_id) REFERENCES portal_tenants(id) ON DELETE RESTRICT,
    FOREIGN KEY (owner_user_id) REFERENCES portal_users(id) ON DELETE RESTRICT,
    FOREIGN KEY (assigned_consultant_user_id) REFERENCES portal_users(id) ON DELETE SET NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS portal_applications_tenant_case_uidx
    ON portal_applications(tenant_id, case_number)`,
  `CREATE INDEX IF NOT EXISTS portal_applications_owner_status_idx
    ON portal_applications(tenant_id, owner_user_id, status, updated_at)`,
  `CREATE INDEX IF NOT EXISTS portal_applications_queue_idx
    ON portal_applications(tenant_id, status, phase, updated_at)`,
  `CREATE INDEX IF NOT EXISTS portal_applications_assignee_idx
    ON portal_applications(tenant_id, assigned_consultant_user_id, status)`,

  `CREATE TABLE IF NOT EXISTS portal_application_versions (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    application_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    schema_version TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    snapshot_sha256 TEXT NOT NULL,
    attachment_manifest_sha256 TEXT,
    submitted_by_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES portal_tenants(id) ON DELETE RESTRICT,
    FOREIGN KEY (application_id) REFERENCES portal_applications(id) ON DELETE RESTRICT,
    FOREIGN KEY (submitted_by_user_id) REFERENCES portal_users(id) ON DELETE RESTRICT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS portal_application_versions_application_number_uidx
    ON portal_application_versions(application_id, version_number)`,
  `CREATE INDEX IF NOT EXISTS portal_application_versions_tenant_application_idx
    ON portal_application_versions(tenant_id, application_id, submitted_at)`,

  `CREATE TABLE IF NOT EXISTS portal_attachments (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    application_id TEXT NOT NULL,
    application_version_id TEXT,
    owner_user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    original_name TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    content_type TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    checksum_sha256 TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    scan_status TEXT NOT NULL DEFAULT 'pending',
    uploaded_by_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    immutable_at TEXT,
    deleted_at TEXT,
    FOREIGN KEY (tenant_id) REFERENCES portal_tenants(id) ON DELETE RESTRICT,
    FOREIGN KEY (application_id) REFERENCES portal_applications(id) ON DELETE RESTRICT,
    FOREIGN KEY (application_version_id) REFERENCES portal_application_versions(id) ON DELETE RESTRICT,
    FOREIGN KEY (owner_user_id) REFERENCES portal_users(id) ON DELETE RESTRICT,
    FOREIGN KEY (uploaded_by_user_id) REFERENCES portal_users(id) ON DELETE RESTRICT
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS portal_attachments_storage_key_uidx ON portal_attachments(storage_key)",
  `CREATE INDEX IF NOT EXISTS portal_attachments_owner_idx
    ON portal_attachments(tenant_id, owner_user_id, status)`,
  `CREATE INDEX IF NOT EXISTS portal_attachments_application_idx
    ON portal_attachments(tenant_id, application_id, created_at)`,
  "CREATE INDEX IF NOT EXISTS portal_attachments_version_idx ON portal_attachments(application_version_id)",

  `CREATE TABLE IF NOT EXISTS portal_content_entries (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    key TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'da-DK',
    page_path TEXT NOT NULL,
    content_type TEXT NOT NULL,
    value_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    version INTEGER NOT NULL DEFAULT 1,
    updated_by_user_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TEXT,
    FOREIGN KEY (tenant_id) REFERENCES portal_tenants(id) ON DELETE RESTRICT,
    FOREIGN KEY (updated_by_user_id) REFERENCES portal_users(id) ON DELETE RESTRICT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS portal_content_entries_tenant_key_locale_uidx
    ON portal_content_entries(tenant_id, key, locale)`,
  `CREATE INDEX IF NOT EXISTS portal_content_entries_page_status_idx
    ON portal_content_entries(tenant_id, page_path, status)`,

  `CREATE TABLE IF NOT EXISTS portal_images (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    content_entry_id TEXT,
    storage_key TEXT NOT NULL,
    original_name TEXT NOT NULL,
    alt_text TEXT NOT NULL DEFAULT '',
    content_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    checksum_sha256 TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ready',
    uploaded_by_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY (tenant_id) REFERENCES portal_tenants(id) ON DELETE RESTRICT,
    FOREIGN KEY (content_entry_id) REFERENCES portal_content_entries(id) ON DELETE SET NULL,
    FOREIGN KEY (uploaded_by_user_id) REFERENCES portal_users(id) ON DELETE RESTRICT
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS portal_images_storage_key_uidx ON portal_images(storage_key)",
  "CREATE INDEX IF NOT EXISTS portal_images_tenant_status_idx ON portal_images(tenant_id, status)",
  "CREATE INDEX IF NOT EXISTS portal_images_content_entry_idx ON portal_images(content_entry_id)",

  `CREATE TABLE IF NOT EXISTS portal_dgita_approvals (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    application_id TEXT NOT NULL,
    application_version_id TEXT,
    reviewer_user_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    internal_fields_json TEXT NOT NULL DEFAULT '{}',
    decision_comment TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at TEXT,
    FOREIGN KEY (tenant_id) REFERENCES portal_tenants(id) ON DELETE RESTRICT,
    FOREIGN KEY (application_id) REFERENCES portal_applications(id) ON DELETE RESTRICT,
    FOREIGN KEY (application_version_id) REFERENCES portal_application_versions(id) ON DELETE RESTRICT,
    FOREIGN KEY (reviewer_user_id) REFERENCES portal_users(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS portal_dgita_approvals_queue_idx
    ON portal_dgita_approvals(tenant_id, status, updated_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS portal_dgita_approvals_tenant_application_uidx
    ON portal_dgita_approvals(tenant_id, application_id)`,
  `CREATE INDEX IF NOT EXISTS portal_dgita_approvals_application_idx
    ON portal_dgita_approvals(tenant_id, application_id, application_version_id)`,

  `CREATE TABLE IF NOT EXISTS portal_field_comments (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    application_id TEXT NOT NULL,
    application_version_id TEXT,
    field_id TEXT NOT NULL,
    author_user_id TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'applicant',
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    parent_comment_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    edited_at TEXT,
    resolved_at TEXT,
    FOREIGN KEY (tenant_id) REFERENCES portal_tenants(id) ON DELETE RESTRICT,
    FOREIGN KEY (application_id) REFERENCES portal_applications(id) ON DELETE RESTRICT,
    FOREIGN KEY (application_version_id) REFERENCES portal_application_versions(id) ON DELETE RESTRICT,
    FOREIGN KEY (author_user_id) REFERENCES portal_users(id) ON DELETE RESTRICT
  )`,
  `CREATE INDEX IF NOT EXISTS portal_field_comments_field_idx
    ON portal_field_comments(tenant_id, application_id, field_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS portal_field_comments_visibility_idx
    ON portal_field_comments(tenant_id, application_id, visibility)`,

  `CREATE TABLE IF NOT EXISTS portal_case_comments (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    application_id TEXT NOT NULL,
    application_version_id TEXT,
    author_user_id TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'shared',
    category TEXT NOT NULL DEFAULT 'comment',
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    parent_comment_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    edited_at TEXT,
    resolved_at TEXT,
    FOREIGN KEY (tenant_id) REFERENCES portal_tenants(id) ON DELETE RESTRICT,
    FOREIGN KEY (application_id) REFERENCES portal_applications(id) ON DELETE RESTRICT,
    FOREIGN KEY (application_version_id) REFERENCES portal_application_versions(id) ON DELETE RESTRICT,
    FOREIGN KEY (author_user_id) REFERENCES portal_users(id) ON DELETE RESTRICT
  )`,
  `CREATE INDEX IF NOT EXISTS portal_case_comments_case_idx
    ON portal_case_comments(tenant_id, application_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS portal_case_comments_visibility_idx
    ON portal_case_comments(tenant_id, application_id, visibility)`,

  `CREATE TABLE IF NOT EXISTS portal_audit_events (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    application_id TEXT,
    actor_user_id TEXT,
    actor_subject TEXT NOT NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    ip_hash TEXT,
    occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES portal_tenants(id) ON DELETE RESTRICT,
    FOREIGN KEY (application_id) REFERENCES portal_applications(id) ON DELETE RESTRICT,
    FOREIGN KEY (actor_user_id) REFERENCES portal_users(id) ON DELETE RESTRICT
  )`,
  `CREATE INDEX IF NOT EXISTS portal_audit_events_application_idx
    ON portal_audit_events(tenant_id, application_id, occurred_at)`,
  `CREATE INDEX IF NOT EXISTS portal_audit_events_entity_idx
    ON portal_audit_events(tenant_id, entity_type, entity_id, occurred_at)`,
  `CREATE INDEX IF NOT EXISTS portal_audit_events_actor_idx
    ON portal_audit_events(tenant_id, actor_user_id, occurred_at)`,

  `CREATE TRIGGER IF NOT EXISTS portal_application_versions_no_update
    BEFORE UPDATE ON portal_application_versions
    BEGIN SELECT RAISE(ABORT, 'submitted application versions are immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS portal_application_versions_no_delete
    BEFORE DELETE ON portal_application_versions
    BEGIN SELECT RAISE(ABORT, 'submitted application versions are immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS portal_versioned_attachments_no_update
    BEFORE UPDATE ON portal_attachments
    WHEN OLD.application_version_id IS NOT NULL
    BEGIN SELECT RAISE(ABORT, 'versioned attachments are immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS portal_versioned_attachments_no_delete
    BEFORE DELETE ON portal_attachments
    WHEN OLD.application_version_id IS NOT NULL
    BEGIN SELECT RAISE(ABORT, 'versioned attachments are immutable'); END`,
  `CREATE TRIGGER IF NOT EXISTS portal_audit_events_no_update
    BEFORE UPDATE ON portal_audit_events
    BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END`,
  `CREATE TRIGGER IF NOT EXISTS portal_audit_events_no_delete
    BEFORE DELETE ON portal_audit_events
    BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END`,
] as const;

let legacySchemaPromise: Promise<void> | null = null;
let portalSchemaPromise: Promise<void> | null = null;

export class PersistenceUnavailableError extends Error {
  readonly code = "PERSISTENCE_UNAVAILABLE";

  constructor() {
    super("Kladde- og bilagslager er ikke tilgængeligt i denne driftsmiljø.");
    this.name = "PersistenceUnavailableError";
  }
}

export function isPersistenceUnavailable(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "PERSISTENCE_UNAVAILABLE"
  );
}

export async function getPersistenceBindings(): Promise<PersistenceBindings> {
  try {
    const { env } = await import("cloudflare:workers");
    const bindings = env as unknown as PersistenceBindings;
    if (!bindings.DB || !bindings.FILES) {
      throw new PersistenceUnavailableError();
    }
    return bindings;
  } catch (error) {
    if (isPersistenceUnavailable(error)) throw error;
    throw new PersistenceUnavailableError();
  }
}

async function runSchemaBatch(DB: D1Database, statements: readonly string[]) {
  const batch = statements.map((statement) => DB.prepare(statement));
  await DB.batch(batch);
}

async function ensureLegacySchema() {
  if (!legacySchemaPromise) {
    legacySchemaPromise = (async () => {
      const { DB } = await getPersistenceBindings();
      await runSchemaBatch(DB, legacySchemaStatements);
    })().catch((error) => {
      legacySchemaPromise = null;
      throw error;
    });
  }
  await legacySchemaPromise;
}

export async function ensurePortalSchema() {
  if (!portalSchemaPromise) {
    portalSchemaPromise = (async () => {
      const { DB } = await getPersistenceBindings();
      await runSchemaBatch(DB, portalSchemaStatements);
    })().catch((error) => {
      portalSchemaPromise = null;
      throw error;
    });
  }
  await portalSchemaPromise;
}

/** Backwards-compatible bootstrap used by the existing draft/upload routes. */
export async function ensurePersistenceSchema() {
  await ensureLegacySchema();
  await ensurePortalSchema();
}

export function readDraftCookie(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)dgita_draft=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function draftCookie(id: string) {
  return `dgita_draft=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`;
}

export async function getDraft(id: string) {
  const { DB } = await getPersistenceBindings();
  return DB.prepare(
    "SELECT id, state_json, status, updated_at FROM application_drafts WHERE id = ? LIMIT 1",
  )
    .bind(id)
    .first<DraftRow>();
}

export async function getDraftAttachments(id: string) {
  const { DB } = await getPersistenceBindings();
  const result = await DB.prepare(
    `SELECT id, draft_id, kind, name, size, content_type, storage_key
     FROM application_attachments WHERE draft_id = ? ORDER BY created_at`,
  )
    .bind(id)
    .all<AttachmentRow>();
  return result.results;
}

export function hydrateAttachments(
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
    const attachment: AttachmentDraft = {
      id: row.id,
      kind: row.kind,
      name: row.name,
      size: row.size,
      type: row.content_type,
      status: "uploaded",
    };
    attachments[row.kind].push(attachment);
  }
  return { ...state, attachments };
}

export function safeUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
}
