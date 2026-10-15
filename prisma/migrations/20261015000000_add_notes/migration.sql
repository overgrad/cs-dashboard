-- Free-text CS notes per account, shown on the Customer 360 Notes tab.
CREATE TABLE IF NOT EXISTS "notes" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "notes" ADD CONSTRAINT "notes_account_id_fkey"
        FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
