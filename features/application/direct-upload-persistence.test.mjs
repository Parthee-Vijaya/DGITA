import assert from "node:assert/strict";
import test from "node:test";

process.env.TURSO_DATABASE_URL = ":memory:";
process.env.TURSO_AUTH_TOKEN = "direct-upload-test-database-token";
process.env.BLOB_READ_WRITE_TOKEN = "direct-upload-test-blob-token";

const {
  DIRECT_UPLOAD_VERIFICATION_LEASE_MS,
  MAX_ACTIVE_DIRECT_UPLOADS_PER_APPLICATION,
  MAX_ACTIVE_DIRECT_UPLOADS_PER_USER,
} = await import("./direct-upload-policy.ts");
const {
  acknowledgeApplicationAttachmentBlobDeletion,
  acquireApplicationAttachmentVerification,
  beginApplicationAttachmentUpload,
  claimAbandonedApplicationUploads,
  discardApplicationAttachmentVerification,
  finalizeApplicationAttachmentUpload,
  getApplicationAttachmentUpload,
} = await import("./server-repository.ts");
const { ensurePortalSchema, getPersistenceBindings } = await import("../../db/persistence.ts");

await ensurePortalSchema();
const { DB } = await getPersistenceBindings();

const metadata = {
  kind: "contract",
  name: "kontrakt.pdf",
  size: 42,
  contentType: "application/pdf",
  checksum: "a".repeat(64),
};

async function createFixture(label, applicationCount = 1) {
  const suffix = crypto.randomUUID();
  const tenantId = `tenant-${label}-${suffix}`;
  const userId = `user-${label}-${suffix}`;
  await DB.prepare("INSERT INTO portal_tenants (id, slug, name) VALUES (?, ?, ?)")
    .bind(tenantId, `slug-${suffix}`, "Testkommune")
    .run();
  await DB.prepare(`
    INSERT INTO portal_users
      (id, tenant_id, identity_provider, external_subject, email, display_name)
    VALUES (?, ?, 'dev', ?, ?, 'Uploadtester')
  `).bind(userId, tenantId, `subject-${suffix}`, `${suffix}@example.dk`).run();

  const applicationIds = [];
  for (let index = 0; index < applicationCount; index += 1) {
    const applicationId = crypto.randomUUID();
    applicationIds.push(applicationId);
    await DB.prepare(`
      INSERT INTO portal_applications
        (id, tenant_id, owner_user_id, case_number, draft_schema_version,
         draft_state_json, status, phase)
      VALUES (?, ?, ?, ?, 'test', '{}', 'draft', 'Kladde')
    `).bind(
      applicationId,
      tenantId,
      userId,
      `ITA-${suffix.slice(0, 6)}${index}`,
    ).run();
  }

  return {
    actor: {
      userId,
      subject: `subject-${suffix}`,
      tenantId,
      role: "user",
      displayName: "Uploadtester",
      email: `${suffix}@example.dk`,
      initials: "UT",
      municipality: "Testkommune",
      provider: "dev",
    },
    applicationIds,
  };
}

function privateBlobUrl(upload, suffix = "AbCdEf0123456789") {
  const pathname = upload.logicalStorageKey.replace(
    /\.pdf$/u,
    `-${suffix}.pdf`,
  );
  return `https://store123.private.blob.vercel-storage.com/${pathname}`;
}

test("verification lease er CAS-låst, kan overtages efter udløb og finaliseres idempotent", { concurrency: false }, async () => {
  const { actor, applicationIds: [applicationId] } = await createFixture("lease");
  const upload = await beginApplicationAttachmentUpload(actor, applicationId, metadata);
  const authoritativeStorageKey = privateBlobUrl(upload);
  const startedAt = Date.parse("2026-08-30T10:00:00.000Z");

  const firstLease = await acquireApplicationAttachmentVerification(
    actor,
    upload,
    authoritativeStorageKey,
    startedAt,
  );
  await assert.rejects(
    acquireApplicationAttachmentVerification(
      actor,
      upload,
      authoritativeStorageKey,
      startedAt + 1,
    ),
    /kontrolleres allerede/u,
  );

  const recoveredLease = await acquireApplicationAttachmentVerification(
    actor,
    { ...upload, status: "verifying", storageKey: authoritativeStorageKey },
    authoritativeStorageKey,
    startedAt + DIRECT_UPLOAD_VERIFICATION_LEASE_MS,
  );
  assert.notEqual(recoveredLease.leaseToken, firstLease.leaseToken);
  assert.equal(
    await discardApplicationAttachmentVerification(actor, firstLease),
    null,
    "en forældet worker må ikke slette den nye verifikators Blob",
  );

  const attachment = await finalizeApplicationAttachmentUpload(actor, recoveredLease, {
    ...metadata,
    storageLocator: authoritativeStorageKey,
  });
  assert.equal(attachment.id, upload.id);
  assert.equal(attachment.status, "uploaded");
  const ready = await getApplicationAttachmentUpload(actor, applicationId, upload.id);
  assert.equal(ready.status, "ready");
  assert.equal(ready.storageKey, authoritativeStorageKey);
  assert.equal(
    await DB.prepare(
      "SELECT COUNT(*) AS count FROM portal_attachment_upload_locks WHERE attachment_id = ?",
    ).bind(upload.id).first("count"),
    0,
  );
  await assert.rejects(
    DB.prepare(`
      INSERT INTO portal_attachment_upload_locks
        (attachment_id, authoritative_storage_key, lease_token, acquired_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      upload.id,
      authoritativeStorageKey,
      crypto.randomUUID(),
      new Date().toISOString(),
      new Date().toISOString(),
    ).run(),
    /upload locks require a mutable pending attachment/u,
  );
});

test("fejloprydning kræver den aktuelle lease og kvitteres først efter Blob-sletning", { concurrency: false }, async () => {
  const { actor, applicationIds: [applicationId] } = await createFixture("discard");
  const upload = await beginApplicationAttachmentUpload(actor, applicationId, metadata);
  const authoritativeStorageKey = privateBlobUrl(upload);
  const lease = await acquireApplicationAttachmentVerification(
    actor,
    upload,
    authoritativeStorageKey,
  );

  const target = await discardApplicationAttachmentVerification(actor, lease);
  assert.deepEqual(target, {
    attachmentId: upload.id,
    storageKey: authoritativeStorageKey,
    leaseToken: lease.leaseToken,
  });
  assert.equal(
    await DB.prepare(
      "SELECT COUNT(*) AS count FROM portal_attachment_upload_locks WHERE attachment_id = ?",
    ).bind(upload.id).first("count"),
    1,
    "retry-markøren skal overleve indtil Blob-sletningen er bekræftet",
  );
  assert.equal(await acknowledgeApplicationAttachmentBlobDeletion(target), true);
  assert.equal(await acknowledgeApplicationAttachmentBlobDeletion(target), false);
});

test("aktive uploadkvoter håndhæves atomisk pr. sag og pr. bruger", { concurrency: false }, async () => {
  const applicationFixture = await createFixture("application-quota");
  for (let index = 0; index < MAX_ACTIVE_DIRECT_UPLOADS_PER_APPLICATION; index += 1) {
    await beginApplicationAttachmentUpload(
      applicationFixture.actor,
      applicationFixture.applicationIds[0],
      { ...metadata, name: `kontrakt-${index}.pdf` },
    );
  }
  await assert.rejects(
    beginApplicationAttachmentUpload(
      applicationFixture.actor,
      applicationFixture.applicationIds[0],
      { ...metadata, name: "for-mange.pdf" },
    ),
    /Sagen har for mange/u,
  );

  const userFixture = await createFixture("user-quota", 4);
  for (let index = 0; index < MAX_ACTIVE_DIRECT_UPLOADS_PER_USER; index += 1) {
    await beginApplicationAttachmentUpload(
      userFixture.actor,
      userFixture.applicationIds[Math.floor(index / MAX_ACTIVE_DIRECT_UPLOADS_PER_APPLICATION)],
      { ...metadata, name: `bruger-${index}.pdf` },
    );
  }
  await assert.rejects(
    beginApplicationAttachmentUpload(
      userFixture.actor,
      userFixture.applicationIds[3],
      { ...metadata, name: "bruger-for-mange.pdf" },
    ),
    /Du har for mange/u,
  );
});

test("TTL-oprydning claimer pending/verifying holdbart uden at ramme en aktiv eller genvundet lease", { concurrency: false }, async () => {
  const { actor, applicationIds: [applicationId] } = await createFixture("cleanup");
  const now = Date.parse("2026-08-30T12:00:00.000Z");
  const old = now - 2 * 60 * 60 * 1_000;

  const pending = await beginApplicationAttachmentUpload(actor, applicationId, {
    ...metadata,
    name: "pending.pdf",
  });
  await DB.prepare("UPDATE portal_attachments SET created_at = ? WHERE id = ?")
    .bind(new Date(old).toISOString(), pending.id)
    .run();

  const stale = await beginApplicationAttachmentUpload(actor, applicationId, {
    ...metadata,
    name: "stale.pdf",
  });
  const staleLease = await acquireApplicationAttachmentVerification(
    actor,
    stale,
    privateBlobUrl(stale),
    old,
  );

  const active = await beginApplicationAttachmentUpload(actor, applicationId, {
    ...metadata,
    name: "active.pdf",
  });
  await acquireApplicationAttachmentVerification(
    actor,
    active,
    privateBlobUrl(active),
    now,
  );

  const recovered = await beginApplicationAttachmentUpload(actor, applicationId, {
    ...metadata,
    name: "recovered.pdf",
  });
  const expiredRecoveredLease = await acquireApplicationAttachmentVerification(
    actor,
    recovered,
    privateBlobUrl(recovered),
    old,
  );
  await acquireApplicationAttachmentVerification(
    actor,
    { ...recovered, status: "verifying", storageKey: expiredRecoveredLease.storageKey },
    expiredRecoveredLease.storageKey,
    now,
  );

  const cleanup = await claimAbandonedApplicationUploads(now, 25);
  assert.equal(cleanup.pendingQuarantined, 1);
  assert.equal(cleanup.verifyingDiscarded, 1);
  const targets = new Map(cleanup.deletionTargets.map((target) => [target.attachmentId, target]));
  assert.equal(targets.has(pending.id), false);
  assert.equal(targets.get(stale.id)?.storageKey, staleLease.storageKey);
  assert.equal(targets.has(active.id), false);
  assert.equal(targets.has(recovered.id), false);

  assert.equal(
    await DB.prepare("SELECT status FROM portal_attachments WHERE id = ?")
      .bind(pending.id)
      .first("status"),
    "quarantined",
    "pending uden autoritativ Blob-URL må ikke frigive orphan-kvoten",
  );
  assert.equal(
    await DB.prepare("SELECT status FROM portal_attachments WHERE id = ?")
      .bind(active.id)
      .first("status"),
    "verifying",
  );
  assert.equal(
    await DB.prepare("SELECT status FROM portal_attachments WHERE id = ?")
      .bind(recovered.id)
      .first("status"),
    "verifying",
  );
  for (const target of targets.values()) {
    assert.equal(await acknowledgeApplicationAttachmentBlobDeletion(target), true);
  }
});
