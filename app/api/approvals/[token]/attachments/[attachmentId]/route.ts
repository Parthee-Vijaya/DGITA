import { authErrorResponse, noStoreJson } from "../../../../../../features/auth/http";
import {
  ApprovalWorkflowError,
  authorizePublicApprovalAttachment,
  getPublicApprovalAttachment,
} from "../../../../../../features/approval/server";
import {
  createPrivateBlobDownloadUrl,
  inspectPrivateBlobIntegrity,
  isVercelBlobTransferEnabled,
  VercelBlobTransferError,
} from "../../../../../../features/application/vercel-blob-transfer";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string; attachmentId: string }> },
) {
  try {
    const { token, attachmentId } = await context.params;
    if (isVercelBlobTransferEnabled()) {
      const attachment = await authorizePublicApprovalAttachment(token, attachmentId);
      const integrity = await inspectPrivateBlobIntegrity(attachment.storageKey);
      if (
        integrity.size !== attachment.size ||
        integrity.checksum !== attachment.checksum
      ) {
        throw new ApprovalWorkflowError(
          409,
          "APPROVAL_ATTACHMENT_INTEGRITY",
          "Bilaget kunne ikke integritetskontrolleres.",
        );
      }
      const location = await createPrivateBlobDownloadUrl(attachment.storageKey);
      return new Response(null, {
        status: 307,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Content-Security-Policy": "default-src 'none'; sandbox",
          Location: location,
          "Referrer-Policy": "no-referrer",
          "X-Content-SHA256": attachment.checksum,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
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
    if (error instanceof VercelBlobTransferError) {
      return noStoreJson({ error: error.message }, { status: 503 });
    }
    return authErrorResponse(error);
  }
}
