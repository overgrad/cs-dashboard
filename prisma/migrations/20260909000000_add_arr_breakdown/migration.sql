-- ARR now follows Finance's definition (lib/arr.ts); store the breakdown for the account page.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "latest_contract_arr" DOUBLE PRECISION;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "latest_contract_end" TIMESTAMP(3);
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "arr_breakdown" JSONB;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "arr_as_of" TIMESTAMP(3);
