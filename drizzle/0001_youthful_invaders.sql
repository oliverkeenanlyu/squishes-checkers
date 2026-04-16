DROP TABLE "squishes-checkers_post" CASCADE;--> statement-breakpoint
ALTER TABLE "squishes-checkers_game" ADD COLUMN "gameMode" varchar(50) DEFAULT 'multiplayer' NOT NULL;--> statement-breakpoint
ALTER TABLE "squishes-checkers_game" ADD COLUMN "aiDifficulty" varchar(50) DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE "squishes-checkers_game" ADD COLUMN "aiPlayer" varchar(10) DEFAULT 'black';