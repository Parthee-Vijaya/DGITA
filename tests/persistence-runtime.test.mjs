import assert from "node:assert/strict";
import test from "node:test";

import { getPersistenceBindings } from "../db/persistence.ts";

test("persistensadapteren fejler kontrolleret uden Cloudflare D1/R2", async () => {
  await assert.rejects(getPersistenceBindings(), (error) => {
    assert.equal(error.code, "PERSISTENCE_UNAVAILABLE");
    return true;
  });
});
