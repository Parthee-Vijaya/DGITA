import assert from "node:assert/strict";
import test from "node:test";

import { MAX_UPLOAD_BYTES } from "./engine.ts";
import {
  isAllowedPrivateBlobUrl,
  isAllowedVercelBlobUploadUrl,
} from "./direct-upload-client.ts";
import {
  DIRECT_UPLOAD_ABANDONED_TTL_MS,
  DIRECT_UPLOAD_VERIFICATION_LEASE_MS,
  DirectUploadValidationError,
  MAX_ACTIVE_DIRECT_UPLOADS_PER_APPLICATION,
  MAX_ACTIVE_DIRECT_UPLOADS_PER_USER,
  directUploadCleanupLimit,
  directUploadLifecycleTimes,
  directUploadMatches,
  parseDirectUploadMetadata,
  safeAttachmentStorageName,
} from "./direct-upload-policy.ts";
import {
  isVercelBlobTransferEnabled,
  mergePrivateBlobSignedUrl,
  privateBlobActualPathname,
  privateBlobPathMatchesLogical,
} from "./vercel-blob-transfer.ts";

const checksum = "A".repeat(64);

test("direct upload accepterer præcis 25 MB og normaliserer metadata", () => {
  const parsed = parseDirectUploadMetadata({
    kind: "contract",
    name: " Kontrakt 2026.pdf ",
    size: MAX_UPLOAD_BYTES,
    contentType: "APPLICATION/PDF",
    checksum,
  });

  assert.deepEqual(parsed, {
    kind: "contract",
    name: "Kontrakt 2026.pdf",
    size: MAX_UPLOAD_BYTES,
    contentType: "application/pdf",
    checksum: checksum.toLowerCase(),
  });
});

test("direct upload afviser for store filer, MIME-spoofing og ugyldig checksum", () => {
  assert.throws(
    () => parseDirectUploadMetadata({
      kind: "contract",
      name: "kontrakt.pdf",
      size: MAX_UPLOAD_BYTES + 1,
      contentType: "application/pdf",
      checksum,
    }),
    (error) => error instanceof DirectUploadValidationError && error.status === 413,
  );
  assert.throws(
    () => parseDirectUploadMetadata({
      kind: "contract",
      name: "kontrakt.pdf",
      size: 42,
      contentType: "image/jpeg",
      checksum,
    }),
    /indholdstype/u,
  );
  assert.throws(
    () => parseDirectUploadMetadata({
      kind: "contract",
      name: "kontrakt.pdf",
      size: 42,
      contentType: "application/pdf",
      checksum: "ikke-sha256",
    }),
    /kontrolsum/u,
  );
});

test("lagerstier neutraliserer filnavne og integritet kræver eksakt match", () => {
  assert.equal(safeAttachmentStorageName("../../Min kontrakt (endelig).pdf"), ".._.._Min_kontrakt_endelig_.pdf");
  const expected = {
    size: 42,
    contentType: "application/pdf",
    checksum: "a".repeat(64),
  };
  assert.equal(directUploadMatches(expected, expected), true);
  assert.equal(directUploadMatches(expected, { ...expected, size: 41 }), false);
  assert.equal(directUploadMatches(expected, { ...expected, checksum: "b".repeat(64) }), false);
});

test("direct upload har faste kvoter, leases og en afgrænset oprydningsbatch", () => {
  assert.equal(MAX_ACTIVE_DIRECT_UPLOADS_PER_APPLICATION, 10);
  assert.equal(MAX_ACTIVE_DIRECT_UPLOADS_PER_USER, 30);

  const now = Date.parse("2026-08-30T12:00:00.000Z");
  assert.deepEqual(directUploadLifecycleTimes(now), {
    acquiredAt: "2026-08-30T12:00:00.000Z",
    leaseExpiresAt: new Date(now + DIRECT_UPLOAD_VERIFICATION_LEASE_MS).toISOString(),
    abandonedBefore: new Date(now - DIRECT_UPLOAD_ABANDONED_TTL_MS).toISOString(),
  });
  assert.equal(directUploadCleanupLimit(), 25);
  assert.equal(directUploadCleanupLimit(500), 100);
  assert.throws(() => directUploadCleanupLimit(0), /batchstørrelse/u);
  assert.throws(() => directUploadLifecycleTimes(Number.NaN), /tidspunkt/u);
});

test("Vercel Blob transport kræver en komplet server-side persistence-konfiguration", () => {
  assert.equal(isVercelBlobTransferEnabled({
    TURSO_DATABASE_URL: "libsql://database.example",
    TURSO_AUTH_TOKEN: "database-secret",
    BLOB_READ_WRITE_TOKEN: "server-secret",
  }), true);
  assert.equal(isVercelBlobTransferEnabled({}), false);
  assert.throws(
    () => isVercelBlobTransferEnabled({ BLOB_READ_WRITE_TOKEN: "server-secret" }),
    /delvist konfigureret/u,
  );
});

test("browseren accepterer kun Vercels officielle signed upload-hosts", () => {
  assert.equal(
    isAllowedVercelBlobUploadUrl("https://vercel.com/api/blob/?pathname=safe.pdf&signature=test"),
    true,
  );
  assert.equal(
    isAllowedVercelBlobUploadUrl("https://store.private.blob.vercel-storage.com/safe.pdf"),
    true,
  );
  assert.equal(isAllowedVercelBlobUploadUrl("http://vercel.com/api/blob"), false);
  assert.equal(isAllowedVercelBlobUploadUrl("https://vercel.com.evil.example/api/blob"), false);
  assert.equal(isAllowedVercelBlobUploadUrl("https://vercel.com/api/blob-evil"), false);
  assert.equal(isAllowedVercelBlobUploadUrl("https://vercel.com/api/not-blob"), false);
});

test("browseren accepterer kun rene private Blob-referencer fra PUT-svaret", () => {
  assert.equal(
    isAllowedPrivateBlobUrl("https://store123.private.blob.vercel-storage.com/internal/file.pdf"),
    true,
  );
  assert.equal(
    isAllowedPrivateBlobUrl("https://store123.public.blob.vercel-storage.com/internal/file.pdf"),
    false,
  );
  assert.equal(
    isAllowedPrivateBlobUrl("https://store123.private.blob.vercel-storage.com/internal/file.pdf?token=x"),
    false,
  );
  assert.equal(
    isAllowedPrivateBlobUrl("https://evil.example/internal/file.pdf"),
    false,
  );
});

test("downloadsignering bevarer den autoritative Blob-host og faktiske URL-sti", () => {
  const exact = "https://actualstore.private.blob.vercel-storage.com/generated/opaque%20file.pdf";
  const generated = "https://wrongstore.private.blob.vercel-storage.com/generated/opaque%20file.pdf?vercel-blob-delegation=scope&vercel-blob-signature=sig";
  const merged = new URL(mergePrivateBlobSignedUrl(exact, generated));
  assert.equal(merged.origin, new URL(exact).origin);
  assert.equal(merged.pathname, new URL(exact).pathname);
  assert.equal(merged.searchParams.get("vercel-blob-delegation"), "scope");
  assert.equal(merged.searchParams.get("vercel-blob-signature"), "sig");
  assert.equal(privateBlobActualPathname(exact), "generated/opaque file.pdf");
});

test("opaque Blob-sti bindes til præcis tenant, sag, upload-id og filnavn", () => {
  const logical = "tenants/tenant-1/applications/app-1/upload-1/kontrakt.pdf";
  assert.equal(
    privateBlobPathMatchesLogical(
      "tenants/tenant-1/applications/app-1/upload-1/kontrakt-AbCdEf0123456789AbCdEf01234567.pdf",
      logical,
    ),
    true,
  );
  assert.equal(privateBlobPathMatchesLogical(logical, logical), true);
  assert.equal(
    privateBlobPathMatchesLogical(
      "tenants/tenant-1/applications/anden-sag/upload-1/kontrakt-AbCdEf0123456789.pdf",
      logical,
    ),
    false,
  );
  assert.equal(
    privateBlobPathMatchesLogical(
      "tenants/tenant-1/applications/app-1/upload-2/kontrakt-AbCdEf0123456789.pdf",
      logical,
    ),
    false,
  );
  assert.equal(
    privateBlobPathMatchesLogical(
      "tenants/tenant-1/applications/app-1/upload-1/andet-AbCdEf0123456789.pdf",
      logical,
    ),
    false,
  );
});
