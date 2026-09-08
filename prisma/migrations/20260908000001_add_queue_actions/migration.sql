-- Add queue_actions table introduced in schema.prisma (7d4b13e) without a migration.
-- IF NOT EXISTS keeps this safe on databases where it was created by hand.
CREATE TABLE IF NOT EXISTS "queue_actions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "suppress_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "queue_actions_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "queue_actions" ADD CONSTRAINT "queue_actions_account_id_fkey"
        FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
