import { authErrorResponse, noStoreJson } from "../../../../../features/auth/http";
import { requireActor } from "../../../../../features/auth/server";
import {
  FileAccessError,
  listCaseAttachments,
} from "../../../../../features/application/file-repository";

export async function GET(
  request: Request,
  context: { params: Promise<{ caseNumber: string }> },
) {
  try {
    const actor = await requireActor(request);
    const { caseNumber } = await context.params;
    return noStoreJson({ files: await listCaseAttachments(actor, caseNumber) });
  } catch (error) {
    if (error instanceof FileAccessError) {
      return noStoreJson({ error: error.message }, { status: error.status });
    }
    return authErrorResponse(error);
  }
}
