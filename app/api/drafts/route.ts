import { assertSameOrigin, authErrorResponse, noStoreJson } from "../../../features/auth/http";
import { requireActor } from "../../../features/auth/server";
import {
  ApplicationRepositoryError,
  beginApplicationCorrection,
  getLatestApplicationDraft,
  saveApplicationDraft,
  submitApplication,
} from "../../../features/application/server-repository";
import { isApplicationFormState } from "../../../features/application/state-validation";

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
      action?: unknown;
      caseNumber?: unknown;
      id?: unknown;
      draft?: unknown;
      status?: unknown;
      expectedRowVersion?: unknown;
    };
    if (body.action === "begin-correction") {
      if (typeof body.caseNumber !== "string") {
        return noStoreJson({ error: "Ugyldigt sagsnummer." }, { status: 400 });
      }
      return noStoreJson({
        draft: await beginApplicationCorrection(actor, body.caseNumber),
      });
    }
    if (typeof body.id !== "string" || !isApplicationFormState(body.draft)) {
      return noStoreJson({ error: "Ugyldig kladde." }, { status: 400 });
    }
    if (body.status !== "draft" && body.status !== "submitted") {
      return noStoreJson({ error: "Ugyldig kladdestatus." }, { status: 400 });
    }
    if (
      body.expectedRowVersion !== undefined &&
      body.expectedRowVersion !== null &&
      (!Number.isInteger(body.expectedRowVersion) ||
        (body.expectedRowVersion as number) < 1)
    ) {
      return noStoreJson({ error: "Ugyldig versionsmarkør." }, { status: 400 });
    }
    const expectedRowVersion = typeof body.expectedRowVersion === "number"
      ? body.expectedRowVersion
      : null;
    const result = body.status === "submitted"
      ? await submitApplication(actor, body.id, body.draft, expectedRowVersion)
      : await saveApplicationDraft(actor, body.id, body.draft, expectedRowVersion);
    return noStoreJson(result);
  } catch (error) {
    return applicationError(error);
  }
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
