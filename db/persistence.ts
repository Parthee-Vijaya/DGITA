import type {
  ApplicationFormState,
  AttachmentDraft,
  UploadKind,
} from "../features/application/engine";

type DraftRow = {
  id: string;
  state_json: string;
  status: "draft" | "submitted";
  updated_at: string;
};

type AttachmentRow = {
  id: string;
  draft_id: string;
  kind: UploadKind;
  name: string;
  size: number;
  content_type: string;
  storage_key: string;
};

type PersistenceBindings = {
  DB: D1Database;
  FILES: R2Bucket;
};

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

export async function getPersistenceBindings() {
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

export async function ensurePersistenceSchema() {
  const { DB } = await getPersistenceBindings();
  await DB.batch([
    DB.prepare(`
      CREATE TABLE IF NOT EXISTS application_drafts (
        id TEXT PRIMARY KEY,
        schema_version TEXT NOT NULL,
        state_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        submitted_at TEXT
      )
    `),
    DB.prepare(`
      CREATE TABLE IF NOT EXISTS application_attachments (
        id TEXT PRIMARY KEY,
        draft_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        size INTEGER NOT NULL,
        content_type TEXT NOT NULL,
        storage_key TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        FOREIGN KEY (draft_id) REFERENCES application_drafts(id) ON DELETE CASCADE
      )
    `),
    DB.prepare(
      "CREATE INDEX IF NOT EXISTS application_drafts_status_idx ON application_drafts(status)",
    ),
    DB.prepare(
      "CREATE INDEX IF NOT EXISTS application_attachments_draft_idx ON application_attachments(draft_id)",
    ),
  ]);
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
