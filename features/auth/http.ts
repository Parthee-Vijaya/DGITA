import type { AuthEnvironment } from "./primitives";

export class AuthHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    status: number,
    code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthHttpError";
    this.status = status;
    this.code = code;
  }
}

export function assertSameOrigin(
  request: Request,
  environment: AuthEnvironment = {},
) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return;

  const suppliedOrigin = request.headers.get("origin");
  if (!suppliedOrigin || suppliedOrigin === "null") {
    throw new AuthHttpError(
      403,
      "INVALID_ORIGIN",
      "Anmodningen mangler en gyldig oprindelse.",
    );
  }

  const configuredOrigin = environment.DGITA_APP_ORIGIN;
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(configuredOrigin || request.url).origin;
  } catch {
    throw new AuthHttpError(
      500,
      "AUTH_CONFIGURATION_ERROR",
      "Loginmiljøet er ikke konfigureret korrekt.",
    );
  }

  let normalizedOrigin: string;
  try {
    normalizedOrigin = new URL(suppliedOrigin).origin;
  } catch {
    throw new AuthHttpError(403, "INVALID_ORIGIN", "Oprindelsen er ugyldig.");
  }

  if (normalizedOrigin !== expectedOrigin) {
    throw new AuthHttpError(
      403,
      "ORIGIN_MISMATCH",
      "Anmodningen kommer ikke fra denne portal.",
    );
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new AuthHttpError(
      403,
      "CROSS_SITE_REQUEST",
      "Anmodningen blev afvist af portalens sikkerhedskontrol.",
    );
  }
}

export function noStoreJson(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.set("Vary", appendVary(headers.get("Vary"), "Cookie, Origin"));
  return Response.json(data, { ...init, headers });
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthHttpError) {
    return noStoreJson(
      { code: error.code, error: error.message },
      { status: error.status },
    );
  }

  console.error("Authentication request failed", error);
  return noStoreJson(
    {
      code: "AUTH_UNAVAILABLE",
      error: "Loginfunktionen er midlertidigt utilgængelig.",
    },
    { status: 503 },
  );
}

function appendVary(current: string | null, value: string) {
  const fields = new Set(
    `${current ?? ""},${value}`
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean),
  );
  return [...fields].join(", ");
}
