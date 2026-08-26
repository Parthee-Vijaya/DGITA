import {
  ensurePersistenceSchema,
  getDraft,
  getPersistenceBindings,
  isPersistenceUnavailable,
  readDraftCookie,
  safeUuid,
} from "../../../db/persistence";
import {
  validateUpload,
  type AttachmentDraft,
  type UploadKind,
} from "../../../features/application/engine";

const uploadKinds = new Set<UploadKind>([
  "risk-assessment",
  "data-processing-agreement",
  "contract",
  "supplier-checklist",
  "architecture",
]);

export async function POST(request: Request) {
  try {
    await ensurePersistenceSchema();
    const form = await request.formData();
    const draftId = form.get("draftId");
    const kind = form.get("kind");
    const file = form.get("file");

    if (
      !safeUuid(draftId) ||
      typeof kind !== "string" ||
      !uploadKinds.has(kind as UploadKind) ||
      !(file instanceof File)
    ) {
      return noStoreJson({ error: "Ugyldig upload." }, { status: 400 });
    }
    if (readDraftCookie(request) !== draftId || !(await getDraft(draftId))) {
      return noStoreJson(
        { error: "Kladden tilhører ikke denne session." },
        { status: 403 },
      );
    }

    const uploadKind = kind as UploadKind;
    const validationError = validateUpload(uploadKind, file);
    if (validationError) {
      return noStoreJson({ error: validationError }, { status: 422 });
    }

    const id = crypto.randomUUID();
    const safeName =
      file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-140) || "document";
    const storageKey = `drafts/${draftId}/${id}/${safeName}`;
    const { DB, FILES } = await getPersistenceBindings();
    await FILES.put(storageKey, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
      customMetadata: { draftId, kind: uploadKind, originalName: file.name },
    });

    const now = new Date().toISOString();
    try {
      await DB.prepare(`
        INSERT INTO application_attachments
          (id, draft_id, kind, name, size, content_type, storage_key, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(
          id,
          draftId,
          uploadKind,
          file.name,
          file.size,
          file.type || "application/octet-stream",
          storageKey,
          now,
        )
        .run();
    } catch (error) {
      await FILES.delete(storageKey);
      throw error;
    }

    const attachment: AttachmentDraft = {
      id,
      kind: uploadKind,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      status: "uploaded",
    };
    return noStoreJson({ attachment }, { status: 201 });
  } catch (error) {
    return persistenceUnavailable(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await ensurePersistenceSchema();
    const body = (await request.json()) as { id?: unknown; draftId?: unknown };
    if (!safeUuid(body.id) || !safeUuid(body.draftId)) {
      return noStoreJson({ error: "Ugyldigt bilag." }, { status: 400 });
    }
    if (readDraftCookie(request) !== body.draftId) {
      return noStoreJson(
        { error: "Kladden tilhører ikke denne session." },
        { status: 403 },
      );
    }

    const { DB, FILES } = await getPersistenceBindings();
    const row = await DB.prepare(
      "SELECT storage_key FROM application_attachments WHERE id = ? AND draft_id = ? LIMIT 1",
    )
      .bind(body.id, body.draftId)
      .first<{ storage_key: string }>();
    if (!row) return noStoreJson({ ok: true });

    await FILES.delete(row.storage_key);
    await DB.prepare("DELETE FROM application_attachments WHERE id = ? AND draft_id = ?")
      .bind(body.id, body.draftId)
      .run();
    return noStoreJson({ ok: true });
  } catch (error) {
    return persistenceUnavailable(error);
  }
}

function noStoreJson(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(data, { ...init, headers });
}

function persistenceUnavailable(error: unknown) {
  if (!isPersistenceUnavailable(error)) throw error;
  return noStoreJson(
    {
      code: "PERSISTENCE_UNAVAILABLE",
      error: "Kladder og bilag er ikke aktiveret i denne serverruntime.",
    },
    { status: 503 },
  );
}
