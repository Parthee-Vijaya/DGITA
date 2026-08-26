// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
export {};
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const applicationDrafts = sqliteTable(
  "application_drafts",
  {
    id: text("id").primaryKey(),
    schemaVersion: text("schema_version").notNull(),
    stateJson: text("state_json").notNull(),
    status: text("status", { enum: ["draft", "submitted"] }).notNull().default("draft"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    submittedAt: text("submitted_at"),
  },
  (table) => [index("application_drafts_status_idx").on(table.status)],
);

export const applicationAttachments = sqliteTable(
  "application_attachments",
  {
    id: text("id").primaryKey(),
    draftId: text("draft_id")
      .notNull()
      .references(() => applicationDrafts.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    size: integer("size").notNull(),
    contentType: text("content_type").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("application_attachments_draft_idx").on(table.draftId)],
);
