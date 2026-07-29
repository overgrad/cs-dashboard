// Educator account + login stats — sourced from OverGrad's internal product database.
//
// STATUS: NOT YET CONNECTED. This is a placeholder for engineering to wire up.
//
// What's needed:
//   1. A connection to the product DB (new env var, e.g. PRODUCT_DB_URL — see .env.example).
//   2. A query that, for a given set of school IDs, returns:
//        - educatorAccountCount: total educator accounts provisioned for that school
//        - educatorLoginPct: % of those educator accounts that have logged in at least once
//   3. Join key: Account.overgradId (already populated via the HubSpot sync — see
//      lib/hubspot.ts). Other syncs in this codebase (e.g. lib/freshdesk.ts) join the
//      same way, so overgradId is the established cross-system key.
//
// Until implemented, getEducatorAccountStats() returns an empty map, and the health tab
// renders these columns as "—" via app/health/page.tsx.

export interface EducatorAccountStats {
  educatorAccountCount: number
  educatorLoginPct: number
}

export async function getEducatorAccountStats(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- will key the real query once connected
  overgradIds: string[],
): Promise<Map<string, EducatorAccountStats>> {
  // TODO(eng): replace with a real query against the product DB, keyed by overgradId.
  return new Map()
}
