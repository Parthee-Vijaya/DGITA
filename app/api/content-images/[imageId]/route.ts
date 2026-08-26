import { authErrorResponse } from "../../../../features/auth/http";
import { requireActor } from "../../../../features/auth/server";
import {
  getPortalImageForActor,
  PortalAccessError,
} from "../../../../features/workspace/server-repository";

export async function GET(
  request: Request,
  context: { params: Promise<{ imageId: string }> },
) {
  try {
    const actor = await requireActor(request);
    const { imageId } = await context.params;
    const { row, bytes } = await getPortalImageForActor(actor, imageId);
    return new Response(bytes, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Length": String(row.size_bytes),
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Type": row.content_type,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof PortalAccessError) {
      return Response.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return authErrorResponse(error);
  }
}
