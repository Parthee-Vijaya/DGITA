import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { portalSchemaStatements } from "../../db/persistence.ts";

function databaseWithRejectedVersion() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const statement of portalSchemaStatements) db.exec(statement);
  db.exec(`
    INSERT INTO portal_tenants
      (id, slug, name, status, created_at, updated_at)
    VALUES ('tenant-1', 'tenant-1', 'Testkommune', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO portal_users
      (id, tenant_id, identity_provider, external_subject, email, display_name,
       status, created_at, updated_at)
    VALUES ('owner-1', 'tenant-1', 'dev', 'owner-1', 'owner@example.test',
            'Owner', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO portal_applications
      (id, tenant_id, owner_user_id, case_number, title, system_name, status,
       phase, draft_schema_version, draft_state_json, row_version,
       current_version_number, current_version_id, created_at, updated_at,
       submitted_at)
    VALUES ('application-1', 'tenant-1', 'owner-1', 'ITA-12345678', 'System',
            'System', 'changes_requested', 'Indsendt', 'dgita-v1', '{}', 5,
            1, 'version-1', '2026-01-01', '2026-01-01', '2026-01-01');
    INSERT INTO portal_application_versions
      (id, tenant_id, application_id, version_number, schema_version,
       snapshot_json, snapshot_sha256, attachment_manifest_sha256,
       submitted_by_user_id, created_at, submitted_at)
    VALUES ('version-1', 'tenant-1', 'application-1', 1, 'dgita-v1',
            '{"purpose":"oprindelig"}', 'snapshot-1', 'manifest-1',
            'owner-1', '2026-01-01', '2026-01-01');
    INSERT INTO portal_attachments
      (id, tenant_id, application_id, application_version_id, owner_user_id,
       kind, original_name, size_bytes, content_type, storage_key,
       checksum_sha256, status, scan_status, uploaded_by_user_id, created_at,
       immutable_at)
    VALUES ('attachment-1', 'tenant-1', 'application-1', 'version-1', 'owner-1',
            'contract', 'kontrakt.pdf', 100, 'application/pdf', 'old/key',
            'checksum-1', 'ready', 'clean', 'owner-1', '2026-01-01',
            '2026-01-01');
  `);
  return db;
}

test("genindsendelse bruger CAS, og versionsnummeret er entydigt", () => {
  const db = databaseWithRejectedVersion();
  db.exec("BEGIN IMMEDIATE");
  const winner = db.prepare(`
    UPDATE portal_applications
    SET status = 'submitted', current_version_number = 2,
        current_version_id = 'version-2', row_version = row_version + 1
    WHERE id = 'application-1' AND tenant_id = 'tenant-1'
      AND owner_user_id = 'owner-1' AND status = 'changes_requested'
      AND row_version = 5
  `).run();
  assert.equal(winner.changes, 1);
  db.exec(`
    INSERT INTO portal_application_versions
      (id, tenant_id, application_id, version_number, schema_version,
       snapshot_json, snapshot_sha256, attachment_manifest_sha256,
       submitted_by_user_id, created_at, submitted_at)
    VALUES ('version-2', 'tenant-1', 'application-1', 2, 'dgita-v1',
            '{"purpose":"rettet"}', 'snapshot-2', 'manifest-2',
            'owner-1', '2026-01-02', '2026-01-02')
  `);
  db.exec("COMMIT");

  const stale = db.prepare(`
    UPDATE portal_applications
    SET current_version_number = 2, current_version_id = 'version-2-stale',
        row_version = row_version + 1
    WHERE id = 'application-1' AND tenant_id = 'tenant-1'
      AND owner_user_id = 'owner-1' AND status = 'changes_requested'
      AND row_version = 5
  `).run();
  assert.equal(stale.changes, 0);
  assert.throws(() => db.exec(`
    INSERT INTO portal_application_versions
      (id, tenant_id, application_id, version_number, schema_version,
       snapshot_json, snapshot_sha256, submitted_by_user_id, created_at, submitted_at)
    VALUES ('version-2-stale', 'tenant-1', 'application-1', 2, 'dgita-v1',
            '{}', 'stale', 'owner-1', '2026-01-02', '2026-01-02')
  `), /UNIQUE constraint failed/);
  assert.equal(
    db.prepare("SELECT current_version_id FROM portal_applications WHERE id = 'application-1'")
      .get().current_version_id,
    "version-2",
  );
  db.close();
});

test("tidligere version og dens bilag forbliver uforanderlige", () => {
  const db = databaseWithRejectedVersion();
  assert.throws(
    () => db.exec("UPDATE portal_application_versions SET snapshot_json = '{}' WHERE id = 'version-1'"),
    /submitted application versions are immutable/,
  );
  assert.throws(
    () => db.exec("UPDATE portal_attachments SET status = 'deleted' WHERE id = 'attachment-1'"),
    /versioned attachments are immutable/,
  );
  assert.throws(
    () => db.exec("DELETE FROM portal_attachments WHERE id = 'attachment-1'"),
    /versioned attachments are immutable/,
  );
  db.close();
});

test("kladde og audit rulles samlet tilbage, hvis audit ikke kan gemmes", () => {
  const db = databaseWithRejectedVersion();
  db.exec(`
    CREATE TRIGGER reject_test_audit
    BEFORE INSERT ON portal_audit_events
    WHEN NEW.event_type = 'application.correction_saved'
    BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END;
  `);

  assert.throws(() => {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(`
        UPDATE portal_applications
        SET draft_state_json = ?, updated_at = ?, row_version = row_version + 1
        WHERE id = ? AND tenant_id = ? AND owner_user_id = ?
          AND status = 'changes_requested' AND row_version = ?
      `).run(
        '{"purpose":"rettet"}',
        "2026-01-02T00:00:00.000Z",
        "application-1",
        "tenant-1",
        "owner-1",
        5,
      );
      db.prepare(`
        INSERT INTO portal_audit_events
          (id, tenant_id, application_id, actor_user_id, actor_subject, event_type,
           entity_type, entity_id, payload_json, ip_hash, occurred_at)
        VALUES (?, ?, ?, ?, ?, 'application.correction_saved', 'application', ?, ?, NULL, ?)
      `).run(
        "audit-save-1",
        "tenant-1",
        "application-1",
        "owner-1",
        "owner-1",
        "application-1",
        "{}",
        "2026-01-02T00:00:00.000Z",
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }, /audit unavailable/u);

  const application = db.prepare(`
    SELECT draft_state_json, row_version FROM portal_applications
    WHERE id = 'application-1'
  `).get();
  assert.equal(application.draft_state_json, "{}");
  assert.equal(application.row_version, 5);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM portal_audit_events").get().count,
    0,
  );
  db.close();
});

test("ny ansøgning oprettes ikke uden sit første auditevent", () => {
  const db = databaseWithRejectedVersion();
  db.exec(`
    CREATE TRIGGER reject_created_audit
    BEFORE INSERT ON portal_audit_events
    WHEN NEW.event_type = 'application.created'
    BEGIN SELECT RAISE(ABORT, 'created audit unavailable'); END;
  `);

  assert.throws(() => {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(`
        INSERT INTO portal_applications
          (id, tenant_id, owner_user_id, case_number, title, system_name, status,
           phase, draft_schema_version, draft_state_json, row_version,
           current_version_number, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'draft', 'Kladde', 'dgita-v1', ?, 1, 0, ?, ?)
      `).run(
        "application-new",
        "tenant-1",
        "owner-1",
        "ITA-87654321",
        "Nyt system",
        "Nyt system",
        "{}",
        "2026-01-02T00:00:00.000Z",
        "2026-01-02T00:00:00.000Z",
      );
      db.prepare(`
        INSERT INTO portal_audit_events
          (id, tenant_id, application_id, actor_user_id, actor_subject, event_type,
           entity_type, entity_id, payload_json, ip_hash, occurred_at)
        VALUES (?, ?, ?, ?, ?, 'application.created', 'application', ?, ?, NULL, ?)
      `).run(
        "audit-created-1",
        "tenant-1",
        "application-new",
        "owner-1",
        "owner-1",
        "application-new",
        "{}",
        "2026-01-02T00:00:00.000Z",
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }, /created audit unavailable/u);

  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM portal_applications WHERE id = 'application-new'")
      .get().count,
    0,
  );
  db.close();
});
