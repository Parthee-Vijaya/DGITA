import { authErrorResponse } from "../../../../../../features/auth/http";
import {
  ApprovalWorkflowError,
  getPublicApprovalAttachment,
} from "../../../../../../features/approval/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string; attachmentId: string }> },
) {
  try {
    const { token, attachmentId } = await context.params;
    const attachment = await getPublicApprovalAttachment(token, attachmentId);
    const safeFilename = attachment.filename.replace(/["\r\n]/gu, "_");
    return new Response(Uint8Array.from(attachment.bytes).buffer, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Type": attachment.contentType,
        "Content-Length": String(attachment.bytes.byteLength),
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Referrer-Policy": "no-referrer",
        "X-Content-SHA256": attachment.checksum,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ApprovalWorkflowError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return authErrorResponse(error);
  }
}
