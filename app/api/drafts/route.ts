import { assertSameOrigin, authErrorResponse, noStoreJson } from "../../../features/auth/http";
import { requireActor } from "../../../features/auth/server";
import {
  ApplicationRepositoryError,
  getLatestApplicationDraft,
  saveApplicationDraft,
  submitApplication,
} from "../../../features/application/server-repository";
import type { ApplicationFormState } from "../../../features/application/engine";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    return noStoreJson({ draft: await getLatestApplicationDraft(actor) });
  } catch (error) {
    return applicationError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor(request);
    const body = (await request.json()) as {
      id?: unknown;
      draft?: unknown;
      status?: unknown;
    };
    if (typeof body.id !== "string" || !isApplicationState(body.draft)) {
      return noStoreJson({ error: "Ugyldig kladde." }, { status: 400 });
    }
    const result = body.status === "submitted"
      ? await submitApplication(actor, body.id, body.draft)
      : await saveApplicationDraft(actor, body.id, body.draft);
    return noStoreJson(result);
  } catch (error) {
    return applicationError(error);
  }
}

function isApplicationState(value: unknown): value is ApplicationFormState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ApplicationFormState>;
  return candidate.schemaVersion === "dgita-v1" && Boolean(candidate.attachments);
}

function applicationError(error: unknown) {
  if (error instanceof ApplicationRepositoryError) {
    return noStoreJson(
      { error: error.message, errors: error.details },
      { status: error.status },
    );
  }
  return authErrorResponse(error);
}
