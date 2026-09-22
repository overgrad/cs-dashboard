-- One row per week the #customer_success queue reminder was posted (week_start = Monday 00:00 UTC).
-- The primary key keeps overlapping or repeated cron runs to one post per week.
CREATE TABLE IF NOT EXISTS "weekly_reminders" (
    "week_start" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slack_message_ts" TEXT,

    CONSTRAINT "weekly_reminders_pkey" PRIMARY KEY ("week_start")
);
