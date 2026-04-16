ALTER TABLE "squishes-checkers_game" ADD COLUMN "isPrivate" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "squishes-checkers_game" ADD COLUMN "inviteCode" varchar(8);