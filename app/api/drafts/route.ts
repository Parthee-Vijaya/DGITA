import {
  draftCookie,
  ensurePersistenceSchema,
  getDraft,
  getDraftAttachments,
  getPersistenceBindings,
  hydrateAttachments,
  isPersistenceUnavailable,
  readDraftCookie,
  safeUuid,
} from "../../../db/persistence";
import {
  getAllErrors,
  pruneHiddenAnswers,
  type ApplicationFormState,
} from "../../../features/application/engine";

export async function GET(request: Request) {
  try {
    await ensurePersistenceSchema();
    const id = readDraftCookie(request);
    if (!id) return noStoreJson({ draft: null });

    const row = await getDraft(id);
    if (!row || row.status !== "draft") return noStoreJson({ draft: null });

    const attachments = await getDraftAttachments(id);
    const state = hydrateAttachments(
      JSON.parse(row.state_json) as ApplicationFormState,
      attachments,
    );
    return noStoreJson({
      draft: { id: row.id, state, updatedAt: row.updated_at },
    });
  } catch (error) {
    return persistenceUnavailable(error);
  }
}

export async function POST(request: Request) {
  try {
    await ensurePersistenceSchema();
    const body = (await request.json()) as {
      id?: unknown;
      draft?: unknown;
      status?: unknown;
    };
    if (!safeUuid(body.id) || !isApplicationState(body.draft)) {
      return noStoreJson({ error: "Ugyldig kladde." }, { status: 400 });
    }

    const stateJson = JSON.stringify(body.draft);
    if (stateJson.length > 600_000) {
      return noStoreJson({ error: "Kladden er for stor." }, { status: 413 });
    }

    const status = body.status === "submitted" ? "submitted" : "draft";
    const currentCookie = readDraftCookie(request);
    if (currentCookie && currentCookie !== body.id) {
      const currentDraft = await getDraft(currentCookie);
      if (currentDraft?.status === "draft") {
        return noStoreJson(
          { error: "Kladden tilhører ikke denne session." },
          { status: 403 },
        );
      }
    }

    const { DB } = await getPersistenceBindings();
    const existingAttachments = await getDraftAttachments(body.id);
    const canonicalState = hydrateAttachments(body.draft, existingAttachments);

    if (status === "submitted") {
      const errors = getAllErrors(canonicalState);
      if (errors.length > 0) {
        return noStoreJson(
          { error: "Ansøgningen er ikke gyldig.", errors },
          { status: 422 },
        );
      }
    }

    const now = new Date().toISOString();
    const storedState =
      status === "submitted" ? pruneHiddenAnswers(canonicalState) : canonicalState;
    await DB.prepare(`
      INSERT INTO application_drafts
        (id, schema_version, state_json, status, created_at, updated_at, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        schema_version = excluded.schema_version,
        state_json = excluded.state_json,
        status = excluded.status,
        updated_at = excluded.updated_at,
        submitted_at = excluded.submitted_at
    `)
      .bind(
        body.id,
        canonicalState.schemaVersion,
        JSON.stringify(storedState),
        status,
        now,
        now,
        status === "submitted" ? now : null,
      )
      .run();

    return noStoreJson(
      { id: body.id, status, updatedAt: now },
      { headers: { "Set-Cookie": draftCookie(body.id) } },
    );
  } catch (error) {
    return persistenceUnavailable(error);
  }
}

function isApplicationState(value: unknown): value is ApplicationFormState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ApplicationFormState>;
  return (
    candidate.schemaVersion === "dgita-v1" &&
    (candidate.knownSystem === "ja" || candidate.knownSystem === "nej") &&
    typeof candidate.attachments === "object"
  );
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
