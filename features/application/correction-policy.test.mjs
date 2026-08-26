import assert from "node:assert/strict";
import test from "node:test";

import {
  applicationEditMode,
  correctionAttachmentId,
  correctionAuditEventId,
} from "./correction-policy.ts";

test("kun nye kladder og afviste sager kan redigeres", () => {
  assert.equal(applicationEditMode("draft"), "draft");
  assert.equal(applicationEditMode("changes_requested"), "correction");
  for (const status of [
    "submitted",
    "awaiting_leader",
    "under_review",
    "approved",
    "rejected",
    "closed",
  ]) {
    assert.equal(applicationEditMode(status), null);
  }
});

test("kopierede bilag får stabile, versionsspecifikke id'er", async () => {
  const first = await correctionAttachmentId("version-1", "attachment-1");
  const repeated = await correctionAttachmentId("version-1", "attachment-1");
  const newerVersion = await correctionAttachmentId("version-2", "attachment-1");

  assert.equal(first, repeated);
  assert.notEqual(first, newerVersion);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("rettelsesmarkøren er unik pr. sag og kildeversion", () => {
  assert.equal(
    correctionAuditEventId("application-1", "version-1"),
    "correction-started:application-1:version-1",
  );
  assert.notEqual(
    correctionAuditEventId("application-1", "version-1"),
    correctionAuditEventId("application-1", "version-2"),
  );
});
