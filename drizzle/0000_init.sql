CREATE TABLE `daily_todos` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`locked_at` integer,
	`auto_locked` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_todos_date_unique` ON `daily_todos` (`date`);--> statement-breakpoint
CREATE TABLE `labels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `labels_name_unique` ON `labels` (`name`);--> statement-breakpoint
CREATE TABLE `progress_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`date` text NOT NULL,
	`before` integer NOT NULL,
	`after` integer NOT NULL,
	`description` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `progress_logs_task_idx` ON `progress_logs` (`task_id`);--> statement-breakpoint
CREATE INDEX `progress_logs_date_idx` ON `progress_logs` (`date`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`team` text DEFAULT '[]' NOT NULL,
	`links` text DEFAULT '[]' NOT NULL,
	`color` text NOT NULL,
	`completed_early_at` integer,
	`canceled_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`goals` text DEFAULT '' NOT NULL,
	`canceled_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_project_idx` ON `sessions` (`project_id`);--> statement-breakpoint
CREATE INDEX `sessions_range_idx` ON `sessions` (`start_date`,`end_date`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`session_id` text,
	`label_id` text,
	`deadline_date` text NOT NULL,
	`deadline_time` text,
	`difficulty` integer NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`done_at` integer,
	`canceled_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tasks_deadline_idx` ON `tasks` (`deadline_date`);--> statement-breakpoint
CREATE INDEX `tasks_session_idx` ON `tasks` (`session_id`);--> statement-breakpoint
CREATE INDEX `tasks_label_idx` ON `tasks` (`label_id`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`done_at`,`canceled_at`);--> statement-breakpoint
CREATE TABLE `todo_items` (
	`id` text PRIMARY KEY NOT NULL,
	`todo_id` text NOT NULL,
	`task_id` text NOT NULL,
	`order` integer NOT NULL,
	`checked` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`todo_id`) REFERENCES `daily_todos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `todo_items_unique` ON `todo_items` (`todo_id`,`task_id`);--> statement-breakpoint
CREATE INDEX `todo_items_task_idx` ON `todo_items` (`task_id`);