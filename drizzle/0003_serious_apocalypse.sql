CREATE TABLE `portal_bootstrap_state` (
	`tenant_id` text NOT NULL,
	`scope` text NOT NULL,
	`version` text NOT NULL,
	`completed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`tenant_id`, `scope`),
	FOREIGN KEY (`tenant_id`) REFERENCES `portal_tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
