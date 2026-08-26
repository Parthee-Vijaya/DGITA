import { assertSameOrigin, authErrorResponse, noStoreJson } from "../../../../features/auth/http";
import { requireActor } from "../../../../features/auth/server";
import { OutboxError, processOutbox } from "../../../../features/mail/outbox";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor(request);
    const input = await request.json().catch(() => ({})) as { limit?: unknown };
    if (
      input.limit !== undefined &&
      (typeof input.limit !== "number" || !Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 10)
    ) {
      throw new OutboxError(422, "MAIL_LIMIT_INVALID", "Antallet skal være et heltal mellem 1 og 10.");
    }
    return noStoreJson(await processOutbox(actor, input.limit));
  } catch (error) {
    if (error instanceof OutboxError) {
      return noStoreJson({ error: error.message, code: error.code }, { status: error.status });
    }
    return authErrorResponse(error);
  }
}
