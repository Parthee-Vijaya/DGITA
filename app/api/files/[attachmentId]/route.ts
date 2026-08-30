import { authErrorResponse, noStoreJson } from "../../../../features/auth/http";
import { requireActor } from "../../../../features/auth/server";
import {
  authorizeAttachmentDownload,
  FileAccessError,
  getAttachmentDownload,
} from "../../../../features/application/file-repository";
import {
  createPrivateBlobDownloadUrl,
  isVercelBlobTransferEnabled,
  VercelBlobTransferError,
} from "../../../../features/application/vercel-blob-transfer";

export async function GET(
  request: Request,
  context: { params: Promise<{ attachmentId: string }> },
) {
  try {
    const actor = await requireActor(request);
    const { attachmentId } = await context.params;
    if (isVercelBlobTransferEnabled()) {
      const row = await authorizeAttachmentDownload(actor, attachmentId);
      const location = await createPrivateBlobDownloadUrl(row.storage_key);
      return new Response(null, {
        status: 307,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Location: location,
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const { row, object } = await getAttachmentDownload(actor, attachmentId);
    const headers = new Headers();
    headers.set("Cache-Control", "private, no-store, max-age=0");
    headers.set("Content-Type", row.content_type || "application/octet-stream");
    headers.set("Content-Length", String(row.size_bytes));
    headers.set(
      "Content-Disposition",
      `attachment; filename="${asciiFilename(row.original_name)}"; filename*=UTF-8''${encodeURIComponent(row.original_name)}`,
    );
    return new Response(object.body, { headers });
  } catch (error) {
    if (error instanceof FileAccessError) {
      return Response.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof VercelBlobTransferError) {
      return noStoreJson({ error: error.message }, { status: 503 });
    }
    return authErrorResponse(error);
  }
}

function asciiFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/["\\]/g, "_").slice(0, 160) || "document";
}
