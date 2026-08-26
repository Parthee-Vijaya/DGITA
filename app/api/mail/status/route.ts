import { authErrorResponse, noStoreJson } from "../../../../features/auth/http";
import { requireActor } from "../../../../features/auth/server";
import { getMailDashboard, OutboxError } from "../../../../features/mail/outbox";

export async function GET(request: Request) {
  try {
    return noStoreJson(await getMailDashboard(await requireActor(request)));
  } catch (error) {
    if (error instanceof OutboxError) {
      return noStoreJson({ error: error.message, code: error.code }, { status: error.status });
    }
    return authErrorResponse(error);
  }
}
