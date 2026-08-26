export const APPROVAL_TOKEN_PLACEHOLDER = "__DGITA_APPROVAL_TOKEN__";

const LOCAL_DEVELOPMENT_SECRET =
  "dgita-local-development-approval-secret-2026-only";

export class ApprovalTokenConfigurationError extends Error {
  constructor() {
    super("Godkendelsestokens er ikke konfigureret i servermiljøet.");
    this.name = "ApprovalTokenConfigurationError";
  }
}

export async function approvalTokenForRequest(
  requestId: string,
  applicationOrigin?: string,
) {
  if (!/^[0-9a-f-]{36}$/iu.test(requestId)) {
    throw new ApprovalTokenConfigurationError();
  }
  const environment = await approvalTokenEnvironment();
  const configuredSecret = environment.DGITA_APPROVAL_TOKEN_SECRET?.trim();
  const secret = configuredSecret || developmentSecret(applicationOrigin);
  if (!secret || secret.length < 32) {
    throw new ApprovalTokenConfigurationError();
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`dgita-approval-v1:${requestId}`),
  );
  return base64Url(new Uint8Array(signature));
}

async function approvalTokenEnvironment() {
  const result: Record<string, string | undefined> = {};
  if (typeof process !== "undefined") {
    result.DGITA_APPROVAL_TOKEN_SECRET = process.env.DGITA_APPROVAL_TOKEN_SECRET;
    result.NODE_ENV = process.env.NODE_ENV;
  }
  try {
    const { env } = await import("cloudflare:workers");
    const workerEnvironment = env as Record<string, unknown>;
    if (typeof workerEnvironment.DGITA_APPROVAL_TOKEN_SECRET === "string") {
      result.DGITA_APPROVAL_TOKEN_SECRET =
        workerEnvironment.DGITA_APPROVAL_TOKEN_SECRET;
    }
  } catch {
    // Workers-bindings er ikke tilgængelige i almindelige Node-tests.
  }
  return result;
}

function developmentSecret(applicationOrigin?: string) {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    return null;
  }
  if (applicationOrigin) {
    const hostname = new URL(applicationOrigin).hostname.toLowerCase();
    if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) return null;
  }
  return LOCAL_DEVELOPMENT_SECRET;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}
