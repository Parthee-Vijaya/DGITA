import { assertSameOrigin, authErrorResponse, noStoreJson } from "../../../../features/auth/http";
import {
  ApprovalWorkflowError,
  decideLeaderApproval,
  getPublicApprovalRequest,
} from "../../../../features/approval/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    return noStoreJson({ approval: await getPublicApprovalRequest(token) });
  } catch (error) {
    return approvalError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    assertSameOrigin(request);
    const { token } = await context.params;
    const body = await request.json() as { decision?: unknown; comment?: unknown };
    if (body.decision !== "approved" && body.decision !== "rejected") {
      throw new ApprovalWorkflowError(422, "DECISION_INVALID", "Vælg godkend eller afvis.");
    }
    return noStoreJson({
      approval: await decideLeaderApproval(token, {
        decision: body.decision,
        comment: typeof body.comment === "string" ? body.comment : "",
      }),
    });
  } catch (error) {
    return approvalError(error);
  }
}

function approvalError(error: unknown) {
  if (error instanceof ApprovalWorkflowError) {
    return noStoreJson({ error: error.message, code: error.code }, { status: error.status });
  }
  return authErrorResponse(error);
}
