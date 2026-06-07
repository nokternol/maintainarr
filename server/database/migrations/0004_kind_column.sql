ALTER TABLE `automations` ADD COLUMN `kind` text NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE `automation_runs` ADD COLUMN `kind` text NOT NULL DEFAULT 'user';
