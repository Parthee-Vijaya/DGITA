import {
  MAX_UPLOAD_BYTES,
  validateUpload,
  type UploadKind,
} from "./engine";

/**
 * Keep unfinished direct uploads bounded even when a browser is closed before
 * it sends the completion callback. Ready attachments do not count toward
 * these limits.
 */
export const MAX_ACTIVE_DIRECT_UPLOADS_PER_APPLICATION = 10;
export const MAX_ACTIVE_DIRECT_UPLOADS_PER_USER = 30;

/** A verifier may take over a lease only after the former worker is stale. */
export const DIRECT_UPLOAD_VERIFICATION_LEASE_MS = 15 * 60 * 1_000;

/** Unfinished uploads are abandoned after the signed upload URL has long expired. */
export const DIRECT_UPLOAD_ABANDONED_TTL_MS = 60 * 60 * 1_000;

export const DIRECT_UPLOAD_CLEANUP_BATCH_SIZE = 25;

export const DIRECT_UPLOAD_KINDS = new Set<UploadKind>([
  "risk-assessment",
  "data-processing-agreement",
  "contract",
  "supplier-checklist",
  "architecture",
]);

export type DirectUploadMetadata = {
  kind: UploadKind;
  name: string;
  size: number;
  contentType: string;
  checksum: string;
};

export class DirectUploadValidationError extends Error {
  constructor(readonly status: 400 | 413 | 422, message: string) {
    super(message);
    this.name = "DirectUploadValidationError";
  }
}

export function parseDirectUploadMetadata(value: unknown): DirectUploadMetadata {
  if (!isRecord(value)) {
    throw new DirectUploadValidationError(400, "Ugyldige uploadoplysninger.");
  }

  const { kind, name, size, contentType, checksum } = value;
  if (
    typeof kind !== "string" ||
    !DIRECT_UPLOAD_KINDS.has(kind as UploadKind) ||
    typeof name !== "string" ||
    typeof size !== "number" ||
    typeof contentType !== "string" ||
    typeof checksum !== "string"
  ) {
    throw new DirectUploadValidationError(400, "Ugyldige uploadoplysninger.");
  }

  const normalizedName = name.trim();
  if (!normalizedName || normalizedName.length > 255 || /[\r\n\0]/u.test(normalizedName)) {
    throw new DirectUploadValidationError(422, "Filnavnet er ugyldigt.");
  }
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new DirectUploadValidationError(422, "Filen er tom eller har en ugyldig størrelse.");
  }
  if (size > MAX_UPLOAD_BYTES) {
    throw new DirectUploadValidationError(413, "Filen må højst fylde 25 MB.");
  }

  const normalizedContentType = contentType.trim().toLowerCase() || "application/octet-stream";
  if (normalizedContentType.length > 200 || /[\r\n\0]/u.test(normalizedContentType)) {
    throw new DirectUploadValidationError(422, "Filens indholdstype er ugyldig.");
  }
  const validationError = validateUpload(kind as UploadKind, {
    name: normalizedName,
    size,
    type: contentType.trim().toLowerCase(),
  });
  if (validationError) {
    throw new DirectUploadValidationError(422, validationError);
  }

  const normalizedChecksum = checksum.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(normalizedChecksum)) {
    throw new DirectUploadValidationError(422, "Filens kontrolsum er ugyldig.");
  }

  return {
    kind: kind as UploadKind,
    name: normalizedName,
    size,
    contentType: normalizedContentType,
    checksum: normalizedChecksum,
  };
}

export function safeAttachmentStorageName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/gu, "_").slice(-140) || "document";
}

export function directUploadMatches(
  expected: Pick<DirectUploadMetadata, "size" | "contentType" | "checksum">,
  observed: Pick<DirectUploadMetadata, "size" | "contentType" | "checksum">,
) {
  return (
    expected.size === observed.size &&
    expected.checksum === observed.checksum &&
    expected.contentType === observed.contentType
  );
}

export function directUploadLifecycleTimes(now = Date.now()) {
  if (!Number.isFinite(now)) throw new TypeError("Uploadtidspunktet er ugyldigt.");
  return {
    acquiredAt: new Date(now).toISOString(),
    leaseExpiresAt: new Date(now + DIRECT_UPLOAD_VERIFICATION_LEASE_MS).toISOString(),
    abandonedBefore: new Date(now - DIRECT_UPLOAD_ABANDONED_TTL_MS).toISOString(),
  };
}

export function directUploadCleanupLimit(value = DIRECT_UPLOAD_CLEANUP_BATCH_SIZE) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError("Uploadoprydningens batchstørrelse er ugyldig.");
  }
  return Math.min(value, 100);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
