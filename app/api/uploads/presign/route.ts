import { readJsonObject,  assertSameOrigin, authErrorResponse, noStoreJson } from "../../../../features/auth/http";
import { requireActor } from "../../../../features/auth/server";
import {
  DirectUploadValidationError,
  parseDirectUploadMetadata,
} from "../../../../features/application/direct-upload-policy";
import {
  DirectUploadUnavailableError,
  prepareDirectApplicationUpload,
} from "../../../../features/application/direct-upload-server";
import { ApplicationRepositoryError } from "../../../../features/application/server-repository";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor(request);
    const body = await readJsonObject(request) as Record<string, unknown>;
    if (typeof body.draftId !== "string") {
      return noStoreJson({ error: "Ugyldig kladde." }, { status: 400 });
    }
    const metadata = parseDirectUploadMetadata(body);
    const directUpload = await prepareDirectApplicationUpload(actor, body.draftId, metadata);
    return noStoreJson({ directUpload }, { status: 201 });
  } catch (error) {
    return directUploadError(error);
  }
}

function directUploadError(error: unknown) {
  if (
    error instanceof DirectUploadValidationError ||
    error instanceof ApplicationRepositoryError ||
    error instanceof DirectUploadUnavailableError
  ) {
    return noStoreJson({ error: error.message }, { status: error.status });
  }
  return authErrorResponse(error);
}
