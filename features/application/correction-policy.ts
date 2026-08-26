export type ApplicationEditMode = "draft" | "correction";

export function applicationEditMode(status: string): ApplicationEditMode | null {
  if (status === "draft") return "draft";
  if (status === "changes_requested") return "correction";
  return null;
}

export function correctionAuditEventId(applicationId: string, versionId: string) {
  return `correction-started:${applicationId}:${versionId}`;
}

export async function correctionAttachmentId(
  versionId: string,
  sourceAttachmentId: string,
) {
  const source = new TextEncoder().encode(`${versionId}:${sourceAttachmentId}`);
  const digest = await crypto.subtle.digest("SHA-256", source);
  const hex = Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
