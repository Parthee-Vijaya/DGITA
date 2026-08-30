import { assertSameOrigin, authErrorResponse, noStoreJson } from "../../../../features/auth/http";
import { requireActor } from "../../../../features/auth/server";
import {
  cancelDirectApplicationUpload,
  completeDirectApplicationUpload,
  DirectUploadUnavailableError,
} from "../../../../features/application/direct-upload-server";
import { ApplicationRepositoryError } from "../../../../features/application/server-repository";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor(request);
    const body = await request.json() as {
      draftId?: unknown;
      attachmentId?: unknown;
      blobUrl?: unknown;
    };
    if (
      typeof body.draftId !== "string" ||
      typeof body.attachmentId !== "string" ||
      typeof body.blobUrl !== "string" ||
      !/^[0-9a-f-]{36}$/iu.test(body.attachmentId)
    ) {
      return noStoreJson({ error: "Ugyldig upload." }, { status: 400 });
    }
    const attachment = await completeDirectApplicationUpload(
      actor,
      body.draftId,
      body.attachmentId,
      body.blobUrl,
    );
    return noStoreJson({ attachment });
  } catch (error) {
    if (error instanceof ApplicationRepositoryError || error instanceof DirectUploadUnavailableError) {
      return noStoreJson({ error: error.message }, { status: error.status });
    }
    return authErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor(request);
    const body = await request.json() as {
      draftId?: unknown;
      attachmentId?: unknown;
      blobUrl?: unknown;
    };
    if (
      typeof body.draftId !== "string" ||
      typeof body.attachmentId !== "string" ||
      (body.blobUrl !== undefined && body.blobUrl !== null && typeof body.blobUrl !== "string") ||
      !/^[0-9a-f-]{36}$/iu.test(body.attachmentId)
    ) {
      return noStoreJson({ error: "Ugyldig upload." }, { status: 400 });
    }
    const deleted = await cancelDirectApplicationUpload(
      actor,
      body.draftId,
      body.attachmentId,
      body.blobUrl ?? null,
    );
    return noStoreJson({ deleted });
  } catch (error) {
    if (error instanceof ApplicationRepositoryError || error instanceof DirectUploadUnavailableError) {
      return noStoreJson({ error: error.message }, { status: error.status });
    }
    return authErrorResponse(error);
  }
}
