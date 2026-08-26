import { assertSameOrigin, authErrorResponse, noStoreJson } from "../../../../../features/auth/http";
import { requireActor } from "../../../../../features/auth/server";
import { OutboxError, queueStatusMail } from "../../../../../features/mail/outbox";

export async function POST(
  request: Request,
  context: { params: Promise<{ caseNumber: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor(request);
    const { caseNumber } = await context.params;
    let input: { message?: unknown; idempotencyKey?: unknown };
    try {
      const value = await request.json() as unknown;
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("invalid body");
      }
      input = value as { message?: unknown; idempotencyKey?: unknown };
    } catch {
      throw new OutboxError(400, "MAIL_INVALID", "Anmodningen kunne ikke læses.");
    }
    return noStoreJson(
      await queueStatusMail(actor, caseNumber, {
        message: typeof input.message === "string" ? input.message : "",
        idempotencyKey: typeof input.idempotencyKey === "string" ? input.idempotencyKey : "",
      }),
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof OutboxError) {
      return noStoreJson({ error: error.message, code: error.code }, { status: error.status });
    }
    return authErrorResponse(error);
  }
}
