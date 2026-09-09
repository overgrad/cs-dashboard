// HubSpot custom property names — update these to match your HubSpot setup.
// These are the API names (snake_case), not the display labels.
// Find them in HubSpot → Settings → Properties → Deals.
export const HS_PROPS = {
  DEAL_NAME: 'dealname',
  CLOSE_DATE: 'closedate',
  DEAL_STAGE: 'dealstage',
  AMOUNT: 'amount',
  OWNER_ID: 'hubspot_owner_id',
  LINE_ITEM_IDS: 'hs_line_item_ids',
  OVERGRAD_ID: 'overgrad_id',

  // Invoice properties (HubSpot Commerce Invoices object — native, not custom)
  INVOICE_STATUS: 'hs_invoice_status',           // draft | open | paid | voided
  INVOICE_DUE_DATE: 'hs_due_date',
  INVOICE_BALANCE_DUE: 'hs_balance_due',

  // Company-level properties
  ONBOARDING_COMPLETION_DATE: 'onboarding_completion_date',
  COMPANY_LAST_EDUCATOR_ACTIVITY: 'last_educator_activity',
  ROSTER_GRADE_COUNTS: ['grade_9_count', 'grade_10_count', 'grade_11_count', 'grade_12_count'], // active HS students by grade, written daily by the product

  // Contact-level properties (product writes last_overgrad_activity daily for educators)
  CONTACT_LAST_ACTIVITY: 'last_overgrad_activity',
  CONTACT_JOB_TITLE: 'jobtitle',

  // Company-level properties (Admin Console data synced into HubSpot)
  WAU_EDUCATORS: 'wau',
  STUDENTS_COMPLETED_SETUP_PCT: 'of_students_that_setup_accounts',
  CAREER_MILESTONE_PCT: 'career_milestone_completion',
  COLLEGE_MILESTONE_PCT: 'college_milestone_completion',
  COMMON_APP_LINKING: 'common_app_linking',
  LAST_DATA_UPLOAD_DATE: 'date_of_last_data_upload',
} as const

// Alert thresholds can be tuned without a deploy via config vars, e.g. CHAMPION_DARK_DAYS=60
const envInt = (name: string, fallback: number) => {
  const v = process.env[name]
  const n = v ? parseInt(v, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : fallback
}

// Scoring thresholds — calibrated against ~95% renewal baseline
export const THRESHOLDS = {
  WAU_PCT_GREEN: 30,
  WAU_PCT_YELLOW: 15,
  COMPLETION_PCT_GREEN: 70,   // was 80 — 80 is aspirational, 70 is healthy adoption
  COMPLETION_PCT_YELLOW: 40,  // was 50
  RECENCY_GREEN_MONTHS: 2,    // was 1 — quarterly CS cadence is normal for healthy accounts
  RECENCY_YELLOW_MONTHS: 9,   // was 6 — 9 months without contact = genuinely at risk
  SCORE_DROP_ALERT_PTS: 10,
  NO_ACTIVITY_ALERT_DAYS: envInt('NO_ACTIVITY_ALERT_DAYS', 90),  // no CS touchpoint (meeting, email, note, call, task)
  NO_USAGE_ALERT_DAYS: envInt('NO_USAGE_ALERT_DAYS', 30),        // no educator activity in the product
  CHAMPION_DARK_DAYS: envInt('CHAMPION_DARK_DAYS', 60),          // primary contact inactive in the product
}

// Alert types that should not fire at all. Comma-separated config var, e.g.
// ALERTS_DISABLED=no_product_usage,champion_gone_dark
// Names: renewal, missing_data, usage_score_drop, interactions_score_drop, score_divergence,
//        no_cs_activity, no_product_usage, champion_gone_dark
export const ALERTS_DISABLED = new Set(
  (process.env.ALERTS_DISABLED ?? '').split(',').map((s) => s.trim()).filter(Boolean),
)

// Alert deduplication window — won't resend the same alert within this many hours
export const ALERT_COOLDOWN_HOURS = 7 * 24
