import { readJsonObject,  assertSameOrigin, authErrorResponse, noStoreJson } from "../../../features/auth/http";
import { requireActor } from "../../../features/auth/server";
import {
  ApplicationRepositoryError,
  deleteApplicationAttachment,
  storeApplicationAttachment,
} from "../../../features/application/server-repository";
import { validateUpload, type UploadKind } from "../../../features/application/engine";

const uploadKinds = new Set<UploadKind>([
  "risk-assessment",
  "data-processing-agreement",
  "contract",
  "supplier-checklist",
  "architecture",
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor(request);
    const form = await request.formData();
    const draftId = form.get("draftId");
    const kind = form.get("kind");
    const file = form.get("file");
    if (
      typeof draftId !== "string" ||
      typeof kind !== "string" ||
      !uploadKinds.has(kind as UploadKind) ||
      !(file instanceof File)
    ) {
      return noStoreJson({ error: "Ugyldig upload." }, { status: 400 });
    }
    const uploadKind = kind as UploadKind;
    const validationError = validateUpload(uploadKind, file);
    if (validationError) {
      return noStoreJson({ error: validationError }, { status: 422 });
    }
    const attachment = await storeApplicationAttachment(actor, draftId, uploadKind, file);
    return noStoreJson({ attachment }, { status: 201 });
  } catch (error) {
    return applicationError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor(request);
    const body = (await readJsonObject(request)) as { id?: unknown; draftId?: unknown };
    if (typeof body.id !== "string" || typeof body.draftId !== "string") {
      return noStoreJson({ error: "Ugyldigt bilag." }, { status: 400 });
    }
    await deleteApplicationAttachment(actor, body.draftId, body.id);
    return noStoreJson({ ok: true });
  } catch (error) {
    return applicationError(error);
  }
}

function applicationError(error: unknown) {
  if (error instanceof ApplicationRepositoryError) {
    return noStoreJson({ error: error.message }, { status: error.status });
  }
  return authErrorResponse(error);
}
