-- hubspot_id stopped being unique in 20260529210000_company_centric_accounts (it holds the
-- primary deal ID; company_id is the sync key). That migration used DROP CONSTRAINT, but init
-- created the uniqueness as an index, so the index survived. Two companies sharing a primary
-- deal would fail the sync on it.
DROP INDEX IF EXISTS "accounts_hubspot_id_key";
