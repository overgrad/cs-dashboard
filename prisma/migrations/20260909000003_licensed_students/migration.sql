-- Seats bought (from per-student license line items) vs rostered students (from the product).
-- Replaces total_licensed_seats, which read a HubSpot deal property that never existed.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "licensed_students" INTEGER;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "licensed_middle_school" INTEGER;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "rostered_students" INTEGER;
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "total_licensed_seats";
