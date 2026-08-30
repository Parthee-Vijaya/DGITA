CREATE TABLE `portal_auth_rate_limits` (
	`scope` text NOT NULL,
	`subject_hash` text NOT NULL,
	`window_started_at` integer NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`scope`, `subject_hash`)
);
--> statement-breakpoint
CREATE INDEX `portal_auth_rate_limits_updated_idx` ON `portal_auth_rate_limits` (`updated_at`);