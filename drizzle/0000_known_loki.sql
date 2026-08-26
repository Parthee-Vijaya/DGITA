CREATE TABLE `application_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`content_type` text NOT NULL,
	`storage_key` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `application_drafts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_attachments_storage_key_unique` ON `application_attachments` (`storage_key`);--> statement-breakpoint
CREATE INDEX `application_attachments_draft_idx` ON `application_attachments` (`draft_id`);--> statement-breakpoint
CREATE TABLE `application_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`schema_version` text NOT NULL,
	`state_json` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`submitted_at` text
);
--> statement-breakpoint
CREATE INDEX `application_drafts_status_idx` ON `application_drafts` (`status`);