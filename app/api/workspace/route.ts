import {
  assertSameOrigin,
  authErrorResponse,
  noStoreJson,
} from "../../../features/auth/http";
import { requireActor } from "../../../features/auth/server";
import {
  PortalAccessError,
  addFieldCommentForActor,
  deleteContentForActor,
  getWorkspaceForActor,
  resetWorkspaceContentForActor,
  resetWorkspaceImagesForActor,
  saveApprovalForActor,
  upsertContentForActor,
  upsertImageForActor,
} from "../../../features/workspace/server-repository";
import type {
  ContentEntry,
  DgitaApproval,
  FieldComment,
  ImageEntry,
} from "../../../features/workspace/model";

type WorkspaceMutation =
  | { action: "content.upsert"; entry: ContentEntry }
  | { action: "content.delete"; id: string }
  | { action: "image.upsert"; entry: ImageEntry }
  | { action: "content.reset" }
  | { action: "image.reset" }
  | { action: "approval.save"; caseId: string; approval: DgitaApproval }
  | {
      action: "field-comment.add";
      comment: Pick<FieldComment, "id" | "caseId" | "fieldId" | "fieldLabel" | "body" | "visibility">;
    };

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    return noStoreJson({ workspace: await getWorkspaceForActor(actor) });
  } catch (error) {
    return workspaceError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor(request);
    const body = (await request.json()) as WorkspaceMutation;
    switch (body.action) {
      case "content.upsert":
        return noStoreJson({ entry: await upsertContentForActor(actor, body.entry) });
      case "content.delete":
        return noStoreJson({ deleted: await deleteContentForActor(actor, body.id) });
      case "image.upsert":
        return noStoreJson({ entry: await upsertImageForActor(actor, body.entry) });
      case "content.reset":
        await resetWorkspaceContentForActor(actor);
        return noStoreJson({ ok: true });
      case "image.reset":
        await resetWorkspaceImagesForActor(actor);
        return noStoreJson({ ok: true });
      case "approval.save":
        return noStoreJson({ approval: await saveApprovalForActor(actor, body.caseId, body.approval) });
      case "field-comment.add":
        return noStoreJson({ comment: await addFieldCommentForActor(actor, body.comment) }, { status: 201 });
      default:
        return noStoreJson({ error: "Ukendt handling." }, { status: 400 });
    }
  } catch (error) {
    return workspaceError(error);
  }
}

function workspaceError(error: unknown) {
  if (error instanceof PortalAccessError) {
    return noStoreJson({ error: error.message }, { status: error.status });
  }
  return authErrorResponse(error);
}
