-- Most recent last_overgrad_activity across the company's HubSpot contacts.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "last_educator_activity" TIMESTAMP(3);
