import assert from "node:assert/strict";
import test from "node:test";

import { getCronAuthorizationStatus } from "./cron-auth.ts";

test("cron afvises lukket, når CRON_SECRET mangler eller er tom", () => {
  assert.equal(getCronAuthorizationStatus(null, undefined), "not_configured");
  assert.equal(getCronAuthorizationStatus("Bearer undefined", undefined), "not_configured");
  assert.equal(getCronAuthorizationStatus("Bearer ", "   "), "not_configured");
  assert.equal(getCronAuthorizationStatus("Bearer short", "short"), "not_configured");
  assert.equal(
    getCronAuthorizationStatus(`Bearer ${"a".repeat(32)} `, `${"a".repeat(32)} `),
    "not_configured",
  );
});

test("cron kræver et eksakt Bearer-match", () => {
  const secret = "production-cron-secret-with-32-chars";
  assert.equal(
    getCronAuthorizationStatus(`Bearer ${secret}`, secret),
    "authorized",
  );
  assert.equal(
    getCronAuthorizationStatus(`bearer ${secret}`, secret),
    "unauthorized",
  );
  assert.equal(
    getCronAuthorizationStatus(`Bearer  ${secret}`, secret),
    "unauthorized",
  );
  assert.equal(
    getCronAuthorizationStatus("Bearer wrong-secret", secret),
    "unauthorized",
  );
  assert.equal(getCronAuthorizationStatus(null, secret), "unauthorized");
});
