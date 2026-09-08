-- Add unpaid invoice fields introduced in schema.prisma (d75b9ca) without a migration.
-- IF NOT EXISTS keeps this safe on databases where they were added by hand.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "unpaid_invoice_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "unpaid_invoice_balance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "unpaid_invoice_due_date" TIMESTAMP(3);
