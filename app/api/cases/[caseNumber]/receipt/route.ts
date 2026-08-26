import { authErrorResponse } from "../../../../../features/auth/http";
import { requireActor } from "../../../../../features/auth/server";
import {
  getOrCreateReceipt,
  ReceiptError,
  type ReceiptKind,
} from "../../../../../features/receipt/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ caseNumber: string }> },
) {
  try {
    const actor = await requireActor(request);
    const { caseNumber } = await context.params;
    const kind = receiptKindFromRequest(request);
    const receipt = await getOrCreateReceipt(actor, caseNumber, kind);
    const body = Uint8Array.from(receipt.bytes).buffer;
    return new Response(body, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Type": "application/pdf",
        "Content-Length": String(receipt.bytes.byteLength),
        "Content-Disposition": `attachment; filename="${receipt.filename}"`,
        "X-Content-Type-Options": "nosniff",
        ...(receipt.checksum ? { "X-Content-SHA256": receipt.checksum } : {}),
      },
    });
  } catch (error) {
    if (error instanceof ReceiptError) {
      return Response.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return authErrorResponse(error);
  }
}

function receiptKindFromRequest(request: Request): ReceiptKind {
  const value = new URL(request.url).searchParams.get("kind") ?? "submission";
  if (value === "submission" || value === "approval" || value === "final") {
    return value;
  }
  throw new ReceiptError(400, "Kvitteringstypen er ugyldig.");
}
