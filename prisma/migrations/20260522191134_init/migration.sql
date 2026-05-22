-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "hubspot_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner" TEXT,
    "owner_email" TEXT,
    "renewal_date" TIMESTAMP(3),
    "deal_stage" TEXT,
    "arr" DOUBLE PRECISION,
    "primary_contact" TEXT,
    "contact_email" TEXT,
    "has_line_items" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_date" TIMESTAMP(3),
    "is_onboarding" BOOLEAN NOT NULL DEFAULT false,
    "champion_status" TEXT,
    "students_completed_setup_pct" DOUBLE PRECISION,
    "milestone_completion_pct" DOUBLE PRECISION,
    "last_data_upload_date" TIMESTAMP(3),
    "total_licensed_seats" INTEGER,
    "wau_educators" INTEGER,
    "wau_students" INTEGER,
    "last_cs_touchpoint" TIMESTAMP(3),
    "last_customer_contact" TIMESTAMP(3),
    "ticket_volume_trend" TEXT,
    "ticket_sentiment" TEXT,
    "meeting_sentiment" TEXT,
    "ai_sentiment_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_history" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "week" TIMESTAMP(3) NOT NULL,
    "usage_score" DOUBLE PRECISION,
    "interactions_score" DOUBLE PRECISION,
    "usage_components" JSONB,
    "interactions_components" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissed_at" TIMESTAMP(3),
    "snoozed_until" TIMESTAMP(3),
    "slack_message_ts" TEXT,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_hubspot_id_key" ON "accounts"("hubspot_id");

-- CreateIndex
CREATE UNIQUE INDEX "score_history_account_id_week_key" ON "score_history"("account_id", "week");

-- AddForeignKey
ALTER TABLE "score_history" ADD CONSTRAINT "score_history_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
