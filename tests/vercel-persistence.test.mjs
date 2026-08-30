import assert from "node:assert/strict";
import test from "node:test";

import { createClient } from "@libsql/client";

import { portalSchemaStatements } from "../db/persistence.ts";
import {
  getConfiguredPersistenceRuntime,
  hasVercelPersistenceSignal,
  readVercelPersistenceEnvironment,
  toPrivateBlobLocation,
  toPrivateBlobLocator,
  toPrivateBlobPathname,
  toPrivateBlobUrl,
} from "../db/persistence-runtime.ts";
import {
  createLibsqlD1Adapter,
  createPrivateBlobR2Adapter,
  enableLibsqlForeignKeys,
} from "../db/vercel-persistence.ts";

async function withMemoryDatabase(run) {
  const client = createClient({ url: ":memory:", intMode: "number" });
  await enableLibsqlForeignKeys(client);
  const DB = createLibsqlD1Adapter(client);
  try {
    await run({ client, DB });
  } finally {
    client.close();
  }
}

test("Vercel-miljøet kræver en komplet Turso- og Blob-konfiguration", () => {
  assert.equal(hasVercelPersistenceSignal({}), false);
  assert.equal(getConfiguredPersistenceRuntime({}), "cloudflare");
  assert.equal(readVercelPersistenceEnvironment({}), null);
  assert.equal(
    hasVercelPersistenceSignal({ TURSO_DATABASE_URL: "libsql://example.turso.io" }),
    true,
  );
  assert.throws(
    () => readVercelPersistenceEnvironment({ TURSO_DATABASE_URL: "libsql://example.turso.io" }),
    (error) => {
      assert.equal(error.code, "VERCEL_PERSISTENCE_CONFIGURATION_ERROR");
      assert.match(error.message, /TURSO_AUTH_TOKEN/);
      assert.match(error.message, /BLOB_READ_WRITE_TOKEN/);
      return true;
    },
  );
  assert.deepEqual(
    readVercelPersistenceEnvironment({
      TURSO_DATABASE_URL: " libsql://example.turso.io ",
      TURSO_AUTH_TOKEN: " database-token ",
      BLOB_READ_WRITE_TOKEN: " blob-token ",
    }),
    {
      databaseUrl: "libsql://example.turso.io",
      authToken: "database-token",
      blobToken: "blob-token",
    },
  );
  assert.deepEqual(
    readVercelPersistenceEnvironment({
      TURSO_DATABASE_URL: "libsql://example.turso.io",
      TURSO_AUTH_TOKEN: "database-token",
      BLOB_STORE_ID: "store_demo",
      VERCEL_OIDC_TOKEN: "oidc-token",
    }),
    {
      databaseUrl: "libsql://example.turso.io",
      authToken: "database-token",
      blobStoreId: "store_demo",
      blobOidcToken: "oidc-token",
    },
  );
  assert.deepEqual(
    readVercelPersistenceEnvironment({
      TURSO_DATABASE_URL: "libsql://example.turso.io",
      TURSO_AUTH_TOKEN: "database-token",
      BLOB_STORE_ID: "store_demo",
    }),
    {
      databaseUrl: "libsql://example.turso.io",
      authToken: "database-token",
      blobStoreId: "store_demo",
    },
  );
  assert.equal(
    getConfiguredPersistenceRuntime({ TURSO_DATABASE_URL: "libsql://example.turso.io" }),
    "vercel",
  );
  assert.equal(toPrivateBlobPathname("tenants/demo/document.pdf"), "tenants/demo/document.pdf");
  const privateBlobUrl =
    "https://store123.private.blob.vercel-storage.com/opaque/document-abc.pdf";
  assert.equal(toPrivateBlobUrl(privateBlobUrl), privateBlobUrl);
  assert.equal(
    toPrivateBlobUrl(
      "https://StoreABC.private.blob.vercel-storage.com/opaque/document-abc.pdf",
    ),
    "https://storeabc.private.blob.vercel-storage.com/opaque/document-abc.pdf",
  );
  assert.equal(toPrivateBlobLocation(privateBlobUrl), privateBlobUrl);
  assert.deepEqual(toPrivateBlobLocator(privateBlobUrl), {
    kind: "url",
    value: privateBlobUrl,
  });
  assert.deepEqual(toPrivateBlobLocator("tenants/demo/document.pdf"), {
    kind: "pathname",
    value: "tenants/demo/document.pdf",
  });
  assert.throws(() => toPrivateBlobLocation("https://store123.public.blob.vercel-storage.com/a"));
  assert.throws(() => toPrivateBlobLocation("https://a.b.private.blob.vercel-storage.com/a"));
  assert.throws(() => toPrivateBlobLocation("https://example.com/a"));
  assert.throws(() => toPrivateBlobLocation("https://user@store123.private.blob.vercel-storage.com/a"));
  assert.throws(() => toPrivateBlobLocation("https://store123.private.blob.vercel-storage.com:8443/a"));
  assert.throws(() => toPrivateBlobLocation("https://store123.private.blob.vercel-storage.com/a?x=1"));
  assert.throws(() => toPrivateBlobLocation("https://store123.private.blob.vercel-storage.com/#x"));
  assert.throws(() => toPrivateBlobLocation("https://store123.private.blob.vercel-storage.com/"));
  assert.throws(() => toPrivateBlobPathname("../document.pdf"));
  assert.throws(() => toPrivateBlobPathname("tenants/%2e%2e/document.pdf"));
  assert.throws(() => toPrivateBlobPathname("tenants/demo/document.pdf?download=1"));
});

test("D1-facaden understøtter prepare, bind, first, all, run og meta.changes", async () => {
  await withMemoryDatabase(async ({ DB }) => {
    await DB.prepare(`CREATE TABLE items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1
    )`).run();

    const reusableInsert = DB.prepare("INSERT INTO items (id, name) VALUES (?, ?)");
    const firstInsert = await reusableInsert.bind("one", "Første").run();
    const secondInsert = await reusableInsert.bind("two", "Anden").run();
    assert.equal(firstInsert.meta.changes, 1);
    assert.equal(secondInsert.meta.changes, 1);

    assert.deepEqual(
      await DB.prepare("SELECT id, name, revision FROM items WHERE id = ?")
        .bind("one")
        .first(),
      { id: "one", name: "Første", revision: 1 },
    );
    assert.equal(
      await DB.prepare("SELECT name FROM items WHERE id = ?").bind("two").first("name"),
      "Anden",
    );
    assert.equal(
      await DB.prepare("SELECT id FROM items WHERE id = ?").bind("missing").first(),
      null,
    );

    const all = await DB.prepare("SELECT id, name FROM items ORDER BY id").all();
    assert.deepEqual(all.results, [
      { id: "one", name: "Første" },
      { id: "two", name: "Anden" },
    ]);

    const updated = await DB.prepare(
      "UPDATE items SET name = ?, revision = revision + 1 WHERE id = ? AND revision = ?",
    ).bind("Opdateret", "one", 1).run();
    const stale = await DB.prepare(
      "UPDATE items SET name = ?, revision = revision + 1 WHERE id = ? AND revision = ?",
    ).bind("Forældet", "one", 1).run();
    assert.equal(updated.meta.changes, 1);
    assert.equal(stale.meta.changes, 0);
  });
});

test("D1 batch ruller alle skrivninger tilbage ved fejl", async () => {
  await withMemoryDatabase(async ({ DB }) => {
    await DB.prepare("CREATE TABLE unique_items (id TEXT PRIMARY KEY, value TEXT NOT NULL UNIQUE)").run();

    await assert.rejects(
      DB.batch([
        DB.prepare("INSERT INTO unique_items (id, value) VALUES (?, ?)").bind("one", "samme"),
        DB.prepare("INSERT INTO unique_items (id, value) VALUES (?, ?)").bind("two", "samme"),
        DB.prepare("INSERT INTO unique_items (id, value) VALUES (?, ?)").bind("three", "tredje"),
      ]),
    );

    const row = await DB.prepare("SELECT COUNT(*) AS count FROM unique_items").first();
    assert.equal(row.count, 0);
  });
});

test("det fulde portalskema håndhæver foreign keys og immutable audit events", async () => {
  await withMemoryDatabase(async ({ DB }) => {
    await DB.batch(portalSchemaStatements.map((statement) => DB.prepare(statement)));

    assert.equal(await DB.prepare("PRAGMA foreign_keys").first("foreign_keys"), 1);
    await DB.prepare("INSERT INTO portal_tenants (id, slug, name) VALUES (?, ?, ?)")
      .bind("tenant-one", "kalundborg", "Kalundborg Kommune")
      .run();
    await DB.prepare(
      "INSERT INTO portal_bootstrap_state (tenant_id, scope, version) VALUES (?, ?, ?)",
    ).bind("tenant-one", "portal-defaults", "2026-08-30.1").run();
    assert.deepEqual(
      await DB.prepare(
        "SELECT scope, version FROM portal_bootstrap_state WHERE tenant_id = ?",
      ).bind("tenant-one").first(),
      { scope: "portal-defaults", version: "2026-08-30.1" },
    );
    await DB.prepare(`INSERT INTO portal_users (
      id, tenant_id, identity_provider, external_subject, email, display_name
    ) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind("user-one", "tenant-one", "dev", "subject-one", "demo@example.dk", "Demo Bruger")
      .run();

    await assert.rejects(
      DB.prepare(`INSERT INTO portal_users (
        id, tenant_id, identity_provider, external_subject, email, display_name
      ) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind("orphan", "unknown-tenant", "dev", "orphan", "orphan@example.dk", "Ingen")
        .run(),
      /FOREIGN KEY/i,
    );

    await DB.prepare(`INSERT INTO portal_audit_events (
      id, tenant_id, actor_user_id, actor_subject, event_type, entity_type, entity_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind("audit-one", "tenant-one", "user-one", "subject-one", "demo.created", "tenant", "tenant-one")
      .run();
    await assert.rejects(
      DB.prepare("UPDATE portal_audit_events SET event_type = ? WHERE id = ?")
        .bind("demo.changed", "audit-one")
        .run(),
      /append-only/i,
    );
    await assert.rejects(
      DB.prepare("DELETE FROM portal_audit_events WHERE id = ?").bind("audit-one").run(),
      /append-only/i,
    );
  });
});

function createFakePrivateBlobSdk() {
  const records = new Map();
  const calls = { put: [], get: [], del: [] };

  return {
    records,
    calls,
    sdk: {
      async put(pathname, body, options) {
        const bytes = new Uint8Array(await new Response(body).arrayBuffer());
        const uploadedAt = new Date("2026-08-30T10:00:00.000Z");
        const actualPathname = `opaque/${pathname}.stored`;
        const url = `https://store123.private.blob.vercel-storage.com/${actualPathname}`;
        const record = {
          bytes,
          contentType: options.contentType || "application/octet-stream",
          uploadedAt,
          etag: `etag-${pathname}`,
          actualPathname,
          url,
        };
        records.set(pathname, record);
        records.set(url, record);
        calls.put.push({ pathname, options });
        return {
          url,
          downloadUrl: `${url}?download=1`,
          pathname: actualPathname,
          contentType: record.contentType,
          contentDisposition: "attachment",
          etag: record.etag,
        };
      },
      async get(pathname, options) {
        calls.get.push({ pathname, options });
        const record = records.get(pathname);
        if (!record) return null;
        return {
          statusCode: 200,
          stream: new Blob([record.bytes]).stream(),
          headers: new Headers({ "content-type": record.contentType }),
          blob: {
            url: record.url,
            downloadUrl: `${record.url}?download=1`,
            pathname: record.actualPathname,
            contentDisposition: "attachment",
            cacheControl: "private, no-store",
            uploadedAt: record.uploadedAt,
            etag: record.etag,
            contentType: record.contentType,
            size: record.bytes.byteLength,
          },
        };
      },
      async del(pathnames, options) {
        const keys = Array.isArray(pathnames) ? pathnames : [pathnames];
        keys.forEach((key) => records.delete(key));
        calls.del.push({ pathnames, options });
      },
    },
  };
}

test("R2-facaden gemmer, læser og sletter private Vercel Blobs via injicerbar SDK", async () => {
  const fake = createFakePrivateBlobSdk();
  const FILES = createPrivateBlobR2Adapter("secret-blob-token", fake.sdk);
  const key = "tenants/demo/applications/case/document.txt";

  const stored = await FILES.put(key, new TextEncoder().encode("kvittering"), {
    httpMetadata: { contentType: "text/plain" },
    customMetadata: { tenantId: "demo" },
  });
  const privateUrl = `https://store123.private.blob.vercel-storage.com/opaque/${key}.stored`;
  assert.equal(stored.key, privateUrl);
  assert.equal(stored.size, 10);
  assert.deepEqual(fake.calls.put[0], {
    pathname: key,
    options: {
      access: "private",
      token: "secret-blob-token",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/plain",
    },
  });

  const object = await FILES.get(stored.key);
  assert.ok(object);
  assert.equal(object.key, privateUrl);
  assert.equal(await object.text(), "kvittering");
  assert.equal(object.httpMetadata.contentType, "text/plain");
  assert.deepEqual(fake.calls.get[0], {
    pathname: privateUrl,
    options: { access: "private", token: "secret-blob-token", useCache: false },
  });

  await FILES.delete(stored.key);
  assert.deepEqual(fake.calls.del[0], {
    pathnames: privateUrl,
    options: { token: "secret-blob-token" },
  });
  assert.equal(await FILES.get(stored.key), null);
});

test("R2-facaden kan autentificere private Blobs med Vercel OIDC", async () => {
  const fake = createFakePrivateBlobSdk();
  const FILES = createPrivateBlobR2Adapter(
    { blobStoreId: "store_demo", blobOidcToken: "oidc-token" },
    fake.sdk,
  );
  const key = "tenants/demo/applications/case/oidc.txt";

  const stored = await FILES.put(key, "oidc", {
    httpMetadata: { contentType: "text/plain" },
  });
  assert.deepEqual(fake.calls.put[0].options, {
    access: "private",
    storeId: "store_demo",
    oidcToken: "oidc-token",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "text/plain",
  });

  await FILES.get(stored.key);
  assert.deepEqual(fake.calls.get[0].options, {
    access: "private",
    storeId: "store_demo",
    oidcToken: "oidc-token",
    useCache: false,
  });

  await FILES.delete(stored.key);
  assert.deepEqual(fake.calls.del[0].options, {
    storeId: "store_demo",
    oidcToken: "oidc-token",
  });
});

test("R2-facaden lader Blob SDK hente request-context OIDC-tokenet", async () => {
  const fake = createFakePrivateBlobSdk();
  const FILES = createPrivateBlobR2Adapter(
    { blobStoreId: "store_demo" },
    fake.sdk,
  );
  const key = "tenants/demo/applications/case/request-context.txt";

  await FILES.put(key, "context", {
    httpMetadata: { contentType: "text/plain" },
  });
  assert.deepEqual(fake.calls.put[0].options, {
    access: "private",
    storeId: "store_demo",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "text/plain",
  });
});
