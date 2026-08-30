import assert from "node:assert/strict";
import test from "node:test";

import { createClient } from "@libsql/client";

import { portalSchemaStatements } from "../db/persistence.ts";
import {
  createLibsqlD1Adapter,
  enableLibsqlForeignKeys,
} from "../db/vercel-persistence.ts";
import { ensureVersionedSeed } from "../features/workspace/seed-guard.ts";

async function withDatabase(run) {
  const client = createClient({ url: ":memory:", intMode: "number" });
  await enableLibsqlForeignKeys(client);
  const DB = createLibsqlD1Adapter(client);
  await DB.batch(portalSchemaStatements.map((statement) => DB.prepare(statement)));
  try {
    await run({ client, DB });
  } finally {
    client.close();
  }
}

const identity = {
  tenantId: "kalundborg",
  scope: "test-defaults",
  version: "v1",
};

test("seed-guard samler samtidige kald og gemmer en holdbar versionsmarkør", async () => {
  await withDatabase(async ({ client, DB }) => {
    let calls = 0;
    const seed = async (database) => {
      calls += 1;
      await database.prepare(
        "INSERT OR IGNORE INTO portal_tenants (id, slug, name) VALUES (?, ?, ?)",
      ).bind("kalundborg", "kalundborg", "Kalundborg Kommune").run();
    };

    await Promise.all([
      ensureVersionedSeed(DB, identity, seed),
      ensureVersionedSeed(DB, identity, seed),
    ]);
    assert.equal(calls, 1);

    const secondAdapter = createLibsqlD1Adapter(client);
    await ensureVersionedSeed(secondAdapter, identity, seed);
    assert.equal(calls, 1);
    assert.equal(
      await secondAdapter.prepare(
        "SELECT version FROM portal_bootstrap_state WHERE tenant_id = ? AND scope = ?",
      ).bind(identity.tenantId, identity.scope).first("version"),
      "v1",
    );
  });
});

test("et fejlet seed markeres ikke og kan forsøges igen", async () => {
  await withDatabase(async ({ DB }) => {
    let calls = 0;
    const seed = async (database) => {
      calls += 1;
      if (calls === 1) throw new Error("seed failed");
      await database.prepare(
        "INSERT INTO portal_tenants (id, slug, name) VALUES (?, ?, ?)",
      ).bind("kalundborg", "kalundborg", "Kalundborg Kommune").run();
    };

    await assert.rejects(ensureVersionedSeed(DB, identity, seed), /seed failed/u);
    assert.equal(
      await DB.prepare("SELECT COUNT(*) AS count FROM portal_bootstrap_state").first("count"),
      0,
    );
    await ensureVersionedSeed(DB, identity, seed);
    assert.equal(calls, 2);
  });
});
