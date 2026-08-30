export type CronAuthorizationStatus =
  | "authorized"
  | "not_configured"
  | "unauthorized";

/**
 * Vercel sends CRON_SECRET as an exact Bearer token. A missing or
 * malformed or short secret is treated as a deployment error rather than as a
 * weak credential that can accidentally be reproduced by a caller.
 */
export function getCronAuthorizationStatus(
  authorization: string | null,
  secret: string | undefined,
): CronAuthorizationStatus {
  if (!secret || secret.length < 32 || secret.trim() !== secret) {
    return "not_configured";
  }
  return authorization === `Bearer ${secret}` ? "authorized" : "unauthorized";
}
