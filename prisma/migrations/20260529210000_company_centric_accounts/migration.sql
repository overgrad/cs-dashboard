-- Add company_id as the new unique sync key (IF NOT EXISTS in case partial run)
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "company_id" TEXT;

-- Make hubspot_id nullable (now stores primary deal ID, not the unique key)
ALTER TABLE "accounts" ALTER COLUMN "hubspot_id" DROP NOT NULL;

-- Drop old unique constraint on hubspot_id
ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_hubspot_id_key";

-- Add unique constraint on company_id
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_company_id_key" ON "accounts"("company_id");
