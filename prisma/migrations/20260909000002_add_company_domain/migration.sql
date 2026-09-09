-- HubSpot company domain, used to match Freshdesk requesters to accounts.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "domain" TEXT;
