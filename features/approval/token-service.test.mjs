import assert from "node:assert/strict";
import test from "node:test";

import { approvalTokenForRequest } from "./token-service.ts";

test("godkendelsestoken afledes stabilt uden at gemme rå token i databasen", async () => {
  const firstId = "11111111-2222-4333-8444-555555555555";
  const secondId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const first = await approvalTokenForRequest(firstId, "http://localhost:3001");
  const repeated = await approvalTokenForRequest(firstId, "http://localhost:3001");
  const second = await approvalTokenForRequest(secondId, "http://localhost:3001");

  assert.match(first, /^[A-Za-z0-9_-]{43}$/u);
  assert.equal(first, repeated);
  assert.notEqual(first, second);
  assert.doesNotMatch(first, /11111111|dgita-local/u);
});

test("ugyldige request-id'er kan ikke bruges som tokenmateriale", async () => {
  await assert.rejects(
    approvalTokenForRequest("../approval", "http://localhost:3001"),
  );
});
