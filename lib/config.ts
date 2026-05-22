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

  // Admin Console data ported into HubSpot (update names to match your properties)
  STUDENTS_COMPLETED_SETUP_PCT: 'students_completed_setup_pct', // Number, 0–100
  MILESTONE_COMPLETION_PCT: 'milestone_completion_pct',          // Number, 0–100
  LAST_DATA_UPLOAD_DATE: 'last_data_upload_date',                // Date
  TOTAL_LICENSED_SEATS: 'total_licensed_seats',                  // Number
} as const

// Scoring thresholds — matches spec section 2a/2b exactly
export const THRESHOLDS = {
  WAU_PCT_GREEN: 30,
  WAU_PCT_YELLOW: 24,
  COMPLETION_PCT_GREEN: 80,
  COMPLETION_PCT_YELLOW: 50,
  RECENCY_GREEN_MONTHS: 1,
  RECENCY_YELLOW_MONTHS: 6,
  SCORE_DROP_ALERT_PTS: 10,
  NO_ACTIVITY_ALERT_DAYS: 60,
  NO_USAGE_ALERT_DAYS: 30,
  CHAMPION_DARK_DAYS: 30,
} as const

// Alert deduplication window — won't resend the same alert within this many hours
export const ALERT_COOLDOWN_HOURS = 7 * 24
