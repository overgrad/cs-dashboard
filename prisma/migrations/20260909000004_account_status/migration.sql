-- active | lapsed | churned (see lib/flags.ts accountStatus). Churned accounts are hidden.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
