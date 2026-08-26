CREATE TABLE `portal_approval_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`application_id` text NOT NULL,
	`application_version_id` text NOT NULL,
	`approver_email` text NOT NULL,
	`approver_name` text NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`decision_comment` text,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL,
	`decided_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `portal_tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`application_id`) REFERENCES `portal_applications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`application_version_id`) REFERENCES `portal_application_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_approval_requests_token_hash_uidx` ON `portal_approval_requests` (`token_hash`);--> statement-breakpoint
CREATE INDEX `portal_approval_requests_application_idx` ON `portal_approval_requests` (`tenant_id`,`application_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `portal_approval_requests_expiry_idx` ON `portal_approval_requests` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `portal_mail_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`application_id` text,
	`recipient_user_id` text,
	`recipient_email` text NOT NULL,
	`recipient_name` text,
	`template_key` text NOT NULL,
	`subject` text NOT NULL,
	`text_body` text NOT NULL,
	`html_body` text NOT NULL,
	`attachments_json` text DEFAULT '[]' NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text,
	`provider` text DEFAULT 'microsoft_graph' NOT NULL,
	`provider_message_id` text,
	`last_error` text,
	`created_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`sent_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `portal_tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`application_id`) REFERENCES `portal_applications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_mail_outbox_tenant_idempotency_uidx` ON `portal_mail_outbox` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `portal_mail_outbox_queue_idx` ON `portal_mail_outbox` (`tenant_id`,`status`,`next_attempt_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `portal_mail_outbox_application_idx` ON `portal_mail_outbox` (`tenant_id`,`application_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `portal_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`recipient_user_id` text NOT NULL,
	`application_id` text,
	`source_event_id` text,
	`event_type` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`link_path` text,
	`status` text DEFAULT 'unread' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`read_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `portal_tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`application_id`) REFERENCES `portal_applications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_event_id`) REFERENCES `portal_audit_events`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_notifications_recipient_event_uidx` ON `portal_notifications` (`recipient_user_id`,`source_event_id`);--> statement-breakpoint
CREATE INDEX `portal_notifications_recipient_status_idx` ON `portal_notifications` (`tenant_id`,`recipient_user_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `portal_notifications_application_idx` ON `portal_notifications` (`tenant_id`,`application_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `portal_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`application_id` text NOT NULL,
	`application_version_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'generating' NOT NULL,
	`storage_key` text NOT NULL,
	`checksum_sha256` text,
	`size_bytes` integer,
	`content_type` text DEFAULT 'application/pdf' NOT NULL,
	`created_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`generated_at` text,
	`failure_reason` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `portal_tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`application_id`) REFERENCES `portal_applications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`application_version_id`) REFERENCES `portal_application_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_receipts_version_kind_uidx` ON `portal_receipts` (`tenant_id`,`application_version_id`,`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `portal_receipts_storage_key_uidx` ON `portal_receipts` (`storage_key`);--> statement-breakpoint
CREATE INDEX `portal_receipts_application_idx` ON `portal_receipts` (`tenant_id`,`application_id`,`created_at`);