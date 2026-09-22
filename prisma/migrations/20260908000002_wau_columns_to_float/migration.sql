-- wau_educators / wau_students changed from Int to Float in schema.prisma (7d4b13e) without a migration.
-- HubSpot supplies WAU as a decimal ratio (e.g. 0.25), which the integer columns reject.
ALTER TABLE "accounts" ALTER COLUMN "wau_educators" TYPE DOUBLE PRECISION;
ALTER TABLE "accounts" ALTER COLUMN "wau_students" TYPE DOUBLE PRECISION;
