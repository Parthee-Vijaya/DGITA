import { authErrorResponse, noStoreJson } from "../../../../../features/auth/http";
import { requireActor } from "../../../../../features/auth/server";
import {
  CaseDialogError,
  listCaseActivity,
} from "../../../../../features/cases/dialog-repository";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ caseNumber: string }> },
) {
  try {
    const actor = await requireActor(request);
    const { caseNumber } = await context.params;
    return noStoreJson({ events: await listCaseActivity(actor, caseNumber) });
  } catch (error) {
    if (error instanceof CaseDialogError) {
      return noStoreJson(
        { code: error.code, error: error.message },
        { status: error.status },
      );
    }
    return authErrorResponse(error);
  }
}
