CREATE TABLE `shared_profiles` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`payload` text NOT NULL,
	`previous_payload` text,
	`updated_at` text NOT NULL
);
