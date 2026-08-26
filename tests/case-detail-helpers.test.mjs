import assert from "node:assert/strict";
import test from "node:test";

import { initialApplicationState } from "../features/application/engine.ts";
import {
  CaseDetailError,
  normalizeApplicationSnapshotJson,
  ownerScopeUserId,
  withSafeDraftAttachments,
} from "../features/cases/detail-helpers.ts";

test("brugeradgang afgrænses til brugerens ejer-id", () => {
  assert.equal(ownerScopeUserId("user", "user-1"), "user-1");
  assert.equal(ownerScopeUserId("consultant", "consultant-1"), null);
  assert.equal(ownerScopeUserId("admin", "admin-1"), null);
});

test("et lagret snapshot udleverer kun kendte formularfelter", () => {
  const snapshot = normalizeApplicationSnapshotJson(
    JSON.stringify({
      ...initialApplicationState,
      purpose: "Digital understøttelse",
      internalComments: "må ikke udleveres",
      auditEvents: [{ type: "internal" }],
      storageKey: "tenants/secret/document.pdf",
      attachments: {
        contract: [{
          id: "file-1",
          kind: "contract",
          name: "kontrakt.pdf",
          size: 42,
          type: "application/pdf",
          status: "uploaded",
          storageKey: "secret/key",
        }],
      },
    }),
    initialApplicationState,
  );

  assert.equal(snapshot.purpose, "Digital understøttelse");
  assert.equal(snapshot.attachments.contract.length, 1);
  assert.deepEqual(snapshot.attachments.contract[0], {
    id: "file-1",
    kind: "contract",
    name: "kontrakt.pdf",
    size: 42,
    type: "application/pdf",
    status: "uploaded",
  });
  assert.equal("internalComments" in snapshot, false);
  assert.equal("auditEvents" in snapshot, false);
  assert.equal("storageKey" in snapshot, false);
});

test("sparse demo-snapshots normaliseres til formularens kontrakt", () => {
  const snapshot = normalizeApplicationSnapshotJson(
    JSON.stringify({ _demo: { leader: "Test Leder", approval: "Afventer" } }),
    initialApplicationState,
    "Demo System",
  );
  assert.equal(snapshot.schemaVersion, "dgita-v1");
  assert.equal(snapshot.catalogQuery, "Demo System");
  assert.equal(snapshot.approvingLeader, "Test Leder");
  assert.equal(snapshot.hasDpa, "nej");
  assert.equal(snapshot.contactPerson, "");
  assert.equal("_demo" in snapshot, false);
});

test("kladdebilag hydreres uden interne lagernøgler", () => {
  const snapshot = withSafeDraftAttachments(initialApplicationState, [
    {
      id: "file-2",
      kind: "architecture",
      original_name: "arkitektur.pdf",
      size_bytes: 120,
      content_type: "application/pdf",
    },
    {
      id: "ignored",
      kind: "unknown",
      original_name: "ukendt.bin",
      size_bytes: 1,
      content_type: "application/octet-stream",
    },
  ]);
  assert.equal(snapshot.attachments.architecture.length, 1);
  assert.equal(snapshot.attachments.architecture[0].name, "arkitektur.pdf");
});

test("ødelagt snapshot afvises kontrolleret", () => {
  assert.throws(
    () => normalizeApplicationSnapshotJson("{", initialApplicationState),
    (error) => error instanceof CaseDetailError && error.status === 409,
  );
});
