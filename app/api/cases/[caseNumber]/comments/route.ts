import {
  assertSameOrigin,
  authErrorResponse,
  noStoreJson,
} from "../../../../../features/auth/http";
import { requireActor } from "../../../../../features/auth/server";
import {
  CaseDialogError,
  createCaseComment,
  listCaseComments,
} from "../../../../../features/cases/dialog-repository";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ caseNumber: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const actor = await requireActor(request);
    const { caseNumber } = await context.params;
    return noStoreJson({ comments: await listCaseComments(actor, caseNumber) });
  } catch (error) {
    return caseDialogErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor(request);
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 32_000) {
      throw new CaseDialogError(413, "REQUEST_TOO_LARGE", "Kommentaren er for stor.");
    }
    const { caseNumber } = await context.params;
    const body = await readJson(request);
    await createCaseComment(actor, caseNumber, body);
    return noStoreJson(
      { comments: await listCaseComments(actor, caseNumber) },
      { status: 201 },
    );
  } catch (error) {
    return caseDialogErrorResponse(error);
  }
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new CaseDialogError(400, "INVALID_JSON", "Kommentaren kunne ikke læses.");
  }
}

function caseDialogErrorResponse(error: unknown) {
  if (error instanceof CaseDialogError) {
    return noStoreJson(
      { code: error.code, error: error.message },
      { status: error.status },
    );
  }
  return authErrorResponse(error);
}
