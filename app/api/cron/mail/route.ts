import { noStoreJson } from "../../../../features/auth/http";
import { cleanupAbandonedDirectApplicationUploads } from "../../../../features/application/direct-upload-server";
import { getCronAuthorizationStatus } from "../../../../features/mail/cron-auth";
import { processScheduledOutbox } from "../../../../features/mail/outbox";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = getCronAuthorizationStatus(
    request.headers.get("authorization"),
    process.env.CRON_SECRET,
  );

  if (authorization === "not_configured") {
    return noStoreJson(
      {
        code: "CRON_SECRET_NOT_CONFIGURED",
        error: "Mail-cronjobbet er ikke konfigureret.",
      },
      { status: 503 },
    );
  }

  if (authorization === "unauthorized") {
    return noStoreJson(
      { code: "CRON_UNAUTHORIZED", error: "Uautoriseret cron-kald." },
      {
        status: 401,
        headers: { "WWW-Authenticate": "Bearer" },
      },
    );
  }

  const uploadCleanup = await cleanupAbandonedDirectApplicationUploads().catch(() => ({
    pendingQuarantined: 0,
    verifyingDiscarded: 0,
    blobsDeleted: 0,
    blobsPendingRetry: 0,
    failed: true as const,
  }));
  const mail = await processScheduledOutbox(10);
  return noStoreJson({ ...mail, uploadCleanup });
}
