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
  ONBOARDING_DATE: 'onboarding_date',
  OVERGRAD_ID: 'overgrad_id',

  // Deal-level properties
  TOTAL_LICENSED_SEATS: 'total_licensed_seats',

  // Invoice properties (HubSpot Commerce Invoices object — native, not custom)
  INVOICE_STATUS: 'hs_invoice_status',           // draft | open | paid | voided
  INVOICE_DUE_DATE: 'hs_due_date',
  INVOICE_BALANCE_DUE: 'hs_balance_due',

  // Company-level properties (Admin Console data synced into HubSpot)
  STUDENTS_COMPLETED_SETUP_PCT: 'of_students_that_setup_accounts',
  CAREER_MILESTONE_PCT: 'career_milestone_completion',
  COLLEGE_MILESTONE_PCT: 'college_milestone_completion',
  COMMON_APP_LINKING: 'common_app_linking',
  LAST_DATA_UPLOAD_DATE: 'date_of_last_data_upload',
} as const

// Scoring thresholds — calibrated against ~95% renewal baseline
export const THRESHOLDS = {
  WAU_PCT_GREEN: 30,
  WAU_PCT_YELLOW: 15,
  COMPLETION_PCT_GREEN: 70,   // was 80 — 80 is aspirational, 70 is healthy adoption
  COMPLETION_PCT_YELLOW: 40,  // was 50
  RECENCY_GREEN_MONTHS: 2,    // was 1 — quarterly CS cadence is normal for healthy accounts
  RECENCY_YELLOW_MONTHS: 9,   // was 6 — 9 months without contact = genuinely at risk
  SCORE_DROP_ALERT_PTS: 10,
  NO_ACTIVITY_ALERT_DAYS: 60,
  NO_USAGE_ALERT_DAYS: 30,
  CHAMPION_DARK_DAYS: 30,
} as const

// Alert deduplication window — won't resend the same alert within this many hours
export const ALERT_COOLDOWN_HOURS = 7 * 24
