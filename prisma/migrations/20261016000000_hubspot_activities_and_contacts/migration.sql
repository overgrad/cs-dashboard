-- Every HubSpot contact on the company (shown on the account page), plus the primary contact's ID
-- so the champion can deep-link to their HubSpot record.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "primary_contact_id" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "contacts" JSONB;

-- CS activity logged from the dashboard and written to HubSpot as an engagement.
CREATE TABLE IF NOT EXISTS "activities" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "contact_id" TEXT,
    "contact_name" TEXT,
    "hubspot_id" TEXT,
    "author" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "activities_account_id_created_at_idx" ON "activities"("account_id", "created_at");

DO $$ BEGIN
    ALTER TABLE "activities" ADD CONSTRAINT "activities_account_id_fkey"
        FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
