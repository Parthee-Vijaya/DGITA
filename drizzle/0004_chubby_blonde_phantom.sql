CREATE TABLE `portal_attachment_upload_locks` (
	`attachment_id` text PRIMARY KEY NOT NULL,
	`authoritative_storage_key` text NOT NULL,
	`lease_token` text NOT NULL,
	`acquired_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`attachment_id`) REFERENCES `portal_attachments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_attachment_upload_locks_storage_key_uidx` ON `portal_attachment_upload_locks` (`authoritative_storage_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `portal_attachment_upload_locks_token_uidx` ON `portal_attachment_upload_locks` (`lease_token`);--> statement-breakpoint
CREATE INDEX `portal_attachment_upload_locks_expiry_idx` ON `portal_attachment_upload_locks` (`expires_at`);--> statement-breakpoint
CREATE TRIGGER `portal_attachment_upload_locks_insert_guard`
BEFORE INSERT ON `portal_attachment_upload_locks`
WHEN NOT EXISTS (
	SELECT 1 FROM `portal_attachments`
	WHERE `id` = NEW.`attachment_id` AND `application_version_id` IS NULL
		AND `status` IN ('pending', 'verifying')
)
BEGIN SELECT RAISE(ABORT, 'upload locks require a mutable pending attachment'); END;--> statement-breakpoint
CREATE TRIGGER `portal_attachment_upload_locks_update_guard`
BEFORE UPDATE ON `portal_attachment_upload_locks`
WHEN NOT EXISTS (
	SELECT 1 FROM `portal_attachments`
	WHERE `id` = NEW.`attachment_id` AND `application_version_id` IS NULL
		AND `status` IN ('pending', 'verifying')
)
BEGIN SELECT RAISE(ABORT, 'upload locks require a mutable pending attachment'); END;
