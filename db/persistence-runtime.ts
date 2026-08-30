export type PersistenceRuntime = "cloudflare" | "vercel";

export type VercelPersistenceEnvironment = {
  [key: string]: string | undefined;
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
  BLOB_READ_WRITE_TOKEN?: string;
  BLOB_STORE_ID?: string;
  VERCEL_OIDC_TOKEN?: string;
};

type ResolvedBlobAuthentication =
  | {
      blobToken: string;
      blobStoreId?: never;
      blobOidcToken?: never;
    }
  | {
      blobToken?: never;
      blobStoreId: string;
      blobOidcToken?: string;
    };

export type ResolvedVercelPersistenceEnvironment = {
  databaseUrl: string;
  authToken: string;
} & ResolvedBlobAuthentication;

export class VercelPersistenceConfigurationError extends Error {
  readonly code = "VERCEL_PERSISTENCE_CONFIGURATION_ERROR";

  constructor(missingVariables: string[]) {
    super(
      `Vercel-persistens er kun delvist konfigureret. Mangler: ${missingVariables.join(", ")}.`,
    );
    this.name = "VercelPersistenceConfigurationError";
  }
}

function environmentValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function runtimeEnvironment(): VercelPersistenceEnvironment {
  return typeof process === "undefined" ? {} : process.env;
}

/**
 * A single configured Vercel variable is treated as an explicit runtime signal.
 * This prevents a partial production configuration from silently falling back
 * to Cloudflare bindings that do not exist in a Vercel Function.
 */
export function hasVercelPersistenceSignal(
  environment: VercelPersistenceEnvironment = runtimeEnvironment(),
) {
  return Boolean(
    environmentValue(environment.TURSO_DATABASE_URL) ||
      environmentValue(environment.TURSO_AUTH_TOKEN) ||
      environmentValue(environment.BLOB_READ_WRITE_TOKEN) ||
      environmentValue(environment.BLOB_STORE_ID),
  );
}

export function getConfiguredPersistenceRuntime(
  environment: VercelPersistenceEnvironment = runtimeEnvironment(),
): PersistenceRuntime {
  return hasVercelPersistenceSignal(environment) ? "vercel" : "cloudflare";
}

export function readVercelPersistenceEnvironment(
  environment: VercelPersistenceEnvironment = runtimeEnvironment(),
): ResolvedVercelPersistenceEnvironment | null {
  const databaseUrl = environmentValue(environment.TURSO_DATABASE_URL);
  const authToken = environmentValue(environment.TURSO_AUTH_TOKEN);
  const blobToken = environmentValue(environment.BLOB_READ_WRITE_TOKEN);
  const blobStoreId = environmentValue(environment.BLOB_STORE_ID);
  const blobOidcToken = environmentValue(environment.VERCEL_OIDC_TOKEN);
  const hasBlobAuthentication = Boolean(blobToken || blobStoreId);

  if (!databaseUrl && !authToken && !blobToken && !blobStoreId) return null;

  const missingVariables = [
    !databaseUrl && "TURSO_DATABASE_URL",
    !authToken && "TURSO_AUTH_TOKEN",
    !hasBlobAuthentication && "BLOB_READ_WRITE_TOKEN eller BLOB_STORE_ID",
  ].filter((variable): variable is string => Boolean(variable));

  if (!databaseUrl || !authToken || !hasBlobAuthentication) {
    throw new VercelPersistenceConfigurationError(missingVariables);
  }

  return blobToken
    ? { databaseUrl, authToken, blobToken }
    : {
        databaseUrl,
        authToken,
        blobStoreId: blobStoreId as string,
        ...(blobOidcToken ? { blobOidcToken } : {}),
      };
}

/** Validate a logical pathname before it is sent to Vercel Blob's write API. */
export function toPrivateBlobPathname(storageKey: string) {
  const segments = storageKey.split("/");
  const hasUnsafeSegment = segments.some((segment) => {
    if (segment === "" || segment === "." || segment === "..") return true;
    try {
      const decoded = decodeURIComponent(segment);
      return decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\");
    } catch {
      return true;
    }
  });

  if (
    storageKey.length === 0 ||
    storageKey !== storageKey.trim() ||
    storageKey.startsWith("/") ||
    /[\u0000-\u001f\u007f?#\\]/u.test(storageKey) ||
    /^[a-z][a-z\d+.-]*:/i.test(storageKey) ||
    hasUnsafeSegment
  ) {
    throw new TypeError("Dokumentlagerets storage_key er ikke et gyldigt privat Blob-pathname.");
  }
  return storageKey;
}

export type PrivateBlobLocator = {
  kind: "pathname" | "url";
  value: string;
};

const PRIVATE_BLOB_HOST_SUFFIX = ".private.blob.vercel-storage.com";

export function toPrivateBlobUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("Dokumentlagerets URL er ugyldig.");
  }

  const storeLabel = url.hostname.endsWith(PRIVATE_BLOB_HOST_SUFFIX)
    ? url.hostname.slice(0, -PRIVATE_BLOB_HOST_SUFFIX.length)
    : "";

  if (
    value !== value.trim() ||
    url.protocol !== "https:" ||
    !/^[a-z0-9-]+$/i.test(storeLabel) ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    url.pathname === "/" ||
    value.includes("?") ||
    value.includes("#")
  ) {
    throw new TypeError("Dokumentlagerets URL er ikke en sikker privat Vercel Blob-URL.");
  }

  // URL normaliserer bl.a. DNS-hostnavne til lowercase. Vercel Blobs SDK kan
  // returnere store-labelen med mixed case, så den strukturelt validerede,
  // kanoniske URL er den autoritative reference, vi gemmer og signerer.
  return url.href;
}

/** Accept a safe legacy pathname or an exact private Vercel Blob URL. */
export function toPrivateBlobLocator(value: string): PrivateBlobLocator {
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) {
    return { kind: "url", value: toPrivateBlobUrl(value) };
  }
  return { kind: "pathname", value: toPrivateBlobPathname(value) };
}

export function toPrivateBlobLocation(value: string) {
  return toPrivateBlobLocator(value).value;
}
