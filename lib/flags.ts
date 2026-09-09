import { THRESHOLDS } from './config'

// Activity conditions shown on account and queue pages. These mirror the activity alerts
// (no CS activity / no product usage / champion gone dark) so CS sees them in the app even
// when Slack delivery for those alerts is turned off via ALERTS_DISABLED.
export interface ActivityFlags {
  noCsActivityDays: number | null   // set when past THRESHOLDS.NO_ACTIVITY_ALERT_DAYS
  noProductUsageDays: number | null // set when past THRESHOLDS.NO_USAGE_ALERT_DAYS
  championDark: boolean
}

const daysSince = (d: Date | null, now: number) =>
  d ? Math.floor((now - d.getTime()) / (1000 * 60 * 60 * 24)) : null

export function activityFlags(
  account: { lastCsTouchpoint: Date | null; lastEducatorActivity: Date | null; championStatus: string | null },
  now: Date,
): ActivityFlags {
  const t = now.getTime()
  const cs = daysSince(account.lastCsTouchpoint, t)
  const usage = daysSince(account.lastEducatorActivity, t)
  return {
    noCsActivityDays: cs !== null && cs >= THRESHOLDS.NO_ACTIVITY_ALERT_DAYS ? cs : null,
    noProductUsageDays: usage !== null && usage >= THRESHOLDS.NO_USAGE_ALERT_DAYS ? usage : null,
    championDark: account.championStatus === 'gone_dark',
  }
}

// Account lifecycle as the dashboard sees it. 'churned' accounts are hidden from every page
// and skipped by scoring and alerts (CS decision 2026-09-09: don't show stale usage for
// accounts whose license lapsed).
export type AccountStatus = 'active' | 'lapsed' | 'churned'
export const CHURN_GRACE_DAYS = 90

export function accountStatus(
  a: { arr: number | null; latestContractEnd: Date | null; renewalDate: Date | null },
  now: Date,
): AccountStatus {
  if ((a.arr ?? 0) > 0) return 'active'
  if (!a.latestContractEnd) return 'active' // no contract data — don't hide on a guess
  const daysLapsed = (now.getTime() - a.latestContractEnd.getTime()) / (1000 * 60 * 60 * 24)
  const renewalInMotion = !!a.renewalDate && a.renewalDate > now
  if (daysLapsed > CHURN_GRACE_DAYS && !renewalInMotion) return 'churned'
  return daysLapsed > 0 ? 'lapsed' : 'active'
}
