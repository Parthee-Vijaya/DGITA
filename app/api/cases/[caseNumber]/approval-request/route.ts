import { assertSameOrigin, authErrorResponse, noStoreJson } from "../../../../../features/auth/http";
import { requireActor } from "../../../../../features/auth/server";
import {
  ApprovalWorkflowError,
  createLeaderApprovalRequest,
} from "../../../../../features/approval/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ caseNumber: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor(request);
    const { caseNumber } = await context.params;
    return noStoreJson(
      await createLeaderApprovalRequest(actor, caseNumber, new URL(request.url).origin),
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof ApprovalWorkflowError) {
      return noStoreJson({ error: error.message, code: error.code }, { status: error.status });
    }
    return authErrorResponse(error);
  }
}
