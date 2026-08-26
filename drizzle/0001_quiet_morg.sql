CREATE TABLE `portal_application_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`application_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`schema_version` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`snapshot_sha256` text NOT NULL,
	`attachment_manifest_sha256` text,
	`submitted_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`submitted_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `portal_tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`application_id`) REFERENCES `portal_applications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`submitted_by_user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_application_versions_application_number_uidx` ON `portal_application_versions` (`application_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `portal_application_versions_tenant_application_idx` ON `portal_application_versions` (`tenant_id`,`application_id`,`submitted_at`);--> statement-breakpoint
CREATE TABLE `portal_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`case_number` text NOT NULL,
	`title` text DEFAULT 'Ny ansøgning' NOT NULL,
	`system_name` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`phase` text DEFAULT 'draft' NOT NULL,
	`assigned_consultant_user_id` text,
	`draft_schema_version` text NOT NULL,
	`draft_state_json` text NOT NULL,
	`row_version` integer DEFAULT 1 NOT NULL,
	`current_version_number` integer DEFAULT 0 NOT NULL,
	`current_version_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`submitted_at` text,
	`closed_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `portal_tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`owner_user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`assigned_consultant_user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_applications_tenant_case_uidx` ON `portal_applications` (`tenant_id`,`case_number`);--> statement-breakpoint
CREATE INDEX `portal_applications_owner_status_idx` ON `portal_applications` (`tenant_id`,`owner_user_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `portal_applications_queue_idx` ON `portal_applications` (`tenant_id`,`status`,`phase`,`updated_at`);--> statement-breakpoint
CREATE INDEX `portal_applications_assignee_idx` ON `portal_applications` (`tenant_id`,`assigned_consultant_user_id`,`status`);--> statement-breakpoint
CREATE TABLE `portal_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`application_id` text NOT NULL,
	`application_version_id` text,
	`owner_user_id` text NOT NULL,
	`kind` text NOT NULL,
	`original_name` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`content_type` text NOT NULL,
	`storage_key` text NOT NULL,
	`checksum_sha256` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`scan_status` text DEFAULT 'pending' NOT NULL,
	`uploaded_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`immutable_at` text,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `portal_tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`application_id`) REFERENCES `portal_applications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`application_version_id`) REFERENCES `portal_application_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`owner_user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_attachments_storage_key_uidx` ON `portal_attachments` (`storage_key`);--> statement-breakpoint
CREATE INDEX `portal_attachments_owner_idx` ON `portal_attachments` (`tenant_id`,`owner_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `portal_attachments_application_idx` ON `portal_attachments` (`tenant_id`,`application_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `portal_attachments_version_idx` ON `portal_attachments` (`application_version_id`);--> statement-breakpoint
CREATE TABLE `portal_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`application_id` text,
	`actor_user_id` text,
	`actor_subject` text NOT NULL,
	`event_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`ip_hash` text,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `portal_tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`application_id`) REFERENCES `portal_applications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`actor_user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `portal_audit_events_application_idx` ON `portal_audit_events` (`tenant_id`,`application_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `portal_audit_events_entity_idx` ON `portal_audit_events` (`tenant_id`,`entity_type`,`entity_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `portal_audit_events_actor_idx` ON `portal_audit_events` (`tenant_id`,`actor_user_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `portal_case_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`application_id` text NOT NULL,
	`application_version_id` text,
	`author_user_id` text NOT NULL,
	`visibility` text DEFAULT 'shared' NOT NULL,
	`category` text DEFAULT 'comment' NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`parent_comment_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`edited_at` text,
	`resolved_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `portal_tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`application_id`) REFERENCES `portal_applications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`application_version_id`) REFERENCES `portal_application_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`author_user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `portal_case_comments_case_idx` ON `portal_case_comments` (`tenant_id`,`application_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `portal_case_comments_visibility_idx` ON `portal_case_comments` (`tenant_id`,`application_id`,`visibility`);--> statement-breakpoint
CREATE TABLE `portal_content_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`key` text NOT NULL,
	`locale` text DEFAULT 'da-DK' NOT NULL,
	`page_path` text NOT NULL,
	`content_type` text NOT NULL,
	`value_json` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`published_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `portal_tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_content_entries_tenant_key_locale_uidx` ON `portal_content_entries` (`tenant_id`,`key`,`locale`);--> statement-breakpoint
CREATE INDEX `portal_content_entries_page_status_idx` ON `portal_content_entries` (`tenant_id`,`page_path`,`status`);--> statement-breakpoint
CREATE TABLE `portal_dgita_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`application_id` text NOT NULL,
	`application_version_id` text,
	`reviewer_user_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`internal_fields_json` text DEFAULT '{}' NOT NULL,
	`decision_comment` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`decided_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `portal_tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`application_id`) REFERENCES `portal_applications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`application_version_id`) REFERENCES `portal_application_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reviewer_user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `portal_dgita_approvals_queue_idx` ON `portal_dgita_approvals` (`tenant_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `portal_dgita_approvals_tenant_application_uidx` ON `portal_dgita_approvals` (`tenant_id`,`application_id`);--> statement-breakpoint
CREATE INDEX `portal_dgita_approvals_application_idx` ON `portal_dgita_approvals` (`tenant_id`,`application_id`,`application_version_id`);--> statement-breakpoint
CREATE TABLE `portal_field_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`application_id` text NOT NULL,
	`application_version_id` text,
	`field_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`visibility` text DEFAULT 'applicant' NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`parent_comment_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`edited_at` text,
	`resolved_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `portal_tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`application_id`) REFERENCES `portal_applications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`application_version_id`) REFERENCES `portal_application_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`author_user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `portal_field_comments_field_idx` ON `portal_field_comments` (`tenant_id`,`application_id`,`field_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `portal_field_comments_visibility_idx` ON `portal_field_comments` (`tenant_id`,`application_id`,`visibility`);--> statement-breakpoint
CREATE TABLE `portal_images` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`content_entry_id` text,
	`storage_key` text NOT NULL,
	`original_name` text NOT NULL,
	`alt_text` text DEFAULT '' NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`checksum_sha256` text NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`uploaded_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `portal_tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`content_entry_id`) REFERENCES `portal_content_entries`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_images_storage_key_uidx` ON `portal_images` (`storage_key`);--> statement-breakpoint
CREATE INDEX `portal_images_tenant_status_idx` ON `portal_images` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `portal_images_content_entry_idx` ON `portal_images` (`content_entry_id`);--> statement-breakpoint
CREATE TABLE `portal_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`provider` text NOT NULL,
	`provider_session_id` text,
	`roles_snapshot_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`revoked_at` text,
	`ip_hash` text,
	`user_agent_hash` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `portal_tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_sessions_token_hash_uidx` ON `portal_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `portal_sessions_user_active_idx` ON `portal_sessions` (`tenant_id`,`user_id`,`revoked_at`,`expires_at`);--> statement-breakpoint
CREATE INDEX `portal_sessions_expiry_idx` ON `portal_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `portal_tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`authority_code` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_tenants_slug_uidx` ON `portal_tenants` (`slug`);--> statement-breakpoint
CREATE INDEX `portal_tenants_status_idx` ON `portal_tenants` (`status`);--> statement-breakpoint
CREATE TABLE `portal_user_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by_user_id` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `portal_tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_user_roles_tenant_user_role_uidx` ON `portal_user_roles` (`tenant_id`,`user_id`,`role`);--> statement-breakpoint
CREATE INDEX `portal_user_roles_tenant_role_idx` ON `portal_user_roles` (`tenant_id`,`role`);--> statement-breakpoint
CREATE TABLE `portal_users` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`identity_provider` text NOT NULL,
	`external_subject` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_login_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `portal_tenants`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_users_tenant_provider_subject_uidx` ON `portal_users` (`tenant_id`,`identity_provider`,`external_subject`);--> statement-breakpoint
CREATE INDEX `portal_users_tenant_email_idx` ON `portal_users` (`tenant_id`,`email`);--> statement-breakpoint
CREATE INDEX `portal_users_tenant_status_idx` ON `portal_users` (`tenant_id`,`status`);
--> statement-breakpoint
CREATE TRIGGER `portal_application_versions_no_update`
BEFORE UPDATE ON `portal_application_versions`
BEGIN SELECT RAISE(ABORT, 'submitted application versions are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `portal_application_versions_no_delete`
BEFORE DELETE ON `portal_application_versions`
BEGIN SELECT RAISE(ABORT, 'submitted application versions are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `portal_versioned_attachments_no_update`
BEFORE UPDATE ON `portal_attachments`
WHEN OLD.application_version_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'versioned attachments are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `portal_versioned_attachments_no_delete`
BEFORE DELETE ON `portal_attachments`
WHEN OLD.application_version_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'versioned attachments are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `portal_audit_events_no_update`
BEFORE UPDATE ON `portal_audit_events`
BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `portal_audit_events_no_delete`
BEFORE DELETE ON `portal_audit_events`
BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
