import type { WorkspaceRole } from "../workspace/model";

export const SESSION_COOKIE_NAME = "dgita_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
const AUTH_ROLES = ["user", "consultant", "admin"] as const;

export type AuthEnvironment = Record<string, string | undefined>;

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return (
    typeof value === "string" &&
    (AUTH_ROLES as readonly string[]).includes(value)
  );
}

export function parseCookie(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;

    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}

export function readSessionToken(cookieHeader: string | null) {
  const value = parseCookie(cookieHeader, SESSION_COOKIE_NAME);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export function createSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function sessionCookie(
  token: string,
  requestUrl: string | URL,
  ttlSeconds = SESSION_TTL_SECONDS,
) {
  const url = new URL(requestUrl);
  const expires = new Date(Date.now() + ttlSeconds * 1_000).toUTCString();
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${ttlSeconds}`,
    `Expires=${expires}`,
    url.protocol === "https:" ? "Secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
}

export function expiredSessionCookie(requestUrl: string | URL) {
  const url = new URL(requestUrl);
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    url.protocol === "https:" ? "Secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
}

export function isDevLoginEnabled(
  requestUrl: string | URL,
  environment: AuthEnvironment = {},
) {
  if (environment.DGITA_ENABLE_DEV_LOGIN?.toLowerCase() === "true") {
    return true;
  }

  const hostname = new URL(requestUrl).hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function initialsFor(displayName: string) {
  const parts = displayName
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase("da-DK");
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toLocaleUpperCase("da-DK");
}
