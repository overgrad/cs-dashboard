import type { Account } from '@/app/generated/prisma/client'
import { prisma } from './prisma'
import {
  alertContext,
  sendDm,
  buildRenewalAlert,
  buildMissingDataAlert,
  buildDivergenceAlert,
  buildInactivityAlert,
} from './slack'
import { THRESHOLDS, ALERT_COOLDOWN_HOURS, ALERTS_DISABLED } from './config'
import type { CompanyArr } from './arr'

// ─── Deduplication ────────────────────────────────────────────────────────────

async function hasRecentAlert(accountId: string, triggerType: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - ALERT_COOLDOWN_HOURS * 60 * 60 * 1000)
  const existing = await prisma.alert.findFirst({
    where: {
      accountId,
      triggerType,
      dismissedAt: null,
      triggeredAt: { gte: cutoff },
    },
  })
  return !!existing
}

async function recordAlert(
  accountId: string,
  triggerType: string,
  slackMessageTs: string | null
) {
  await prisma.alert.create({
    data: { accountId, triggerType, slackMessageTs },
  })
}

const isDisabled = (name: string) => ALERTS_DISABLED.has(name)

// ─── Individual alert checks ──────────────────────────────────────────────────

async function checkRenewalAlerts(account: Account) {
  if (isDisabled('renewal') || !account.renewalDate) return

  const daysUntil = Math.ceil(
    (account.renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  // DM the owner while the renewal is 31–90 days out, copying the CS manager inside 60 days.
  // The alert cooldown repeats that weekly within each tier. Renewals inside 30 days don't
  // get an individual alert — they're on the queue, and the weekly #customer_success
  // reminder points CS there.
  if (daysUntil <= 30 || daysUntil > 90) return

  const triggerType = daysUntil <= 60 ? 'renewal_60' : 'renewal_90'
  if (await hasRecentAlert(account.id, triggerType)) return

  const { text, blocks } = buildRenewalAlert({
    accountId: account.id,
    accountName: account.name,
    ownerName: account.owner,
    ownerEmail: account.ownerEmail,
    daysUntil,
    arr: account.arr,
  })

  // Unowned accounts still reach the manager inside 60 days.
  const ts = account.ownerEmail ? await sendDm(account.ownerEmail, text, blocks) : null
  if (triggerType === 'renewal_60' && process.env.SLACK_CS_MANAGER_EMAIL) {
    await sendDm(process.env.SLACK_CS_MANAGER_EMAIL, text, blocks)
  }

  await recordAlert(account.id, triggerType, ts)
}

async function checkMissingDataAlerts(account: Account) {
  if (isDisabled('missing_data')) return
  const latestDeal = (account.arrBreakdown as CompanyArr | null)?.deals?.[0]
  const missing = [
    !account.renewalDate && 'close date',
    !account.hasLineItems && 'line items',
    !account.primaryContact && 'contact',
    latestDeal && !latestDeal.contractEnd && 'contract end date',
  ].filter(Boolean) as string[]

  if (missing.length === 0) return

  const triggerType = `missing_data:${missing.join(',')}`
  if (await hasRecentAlert(account.id, triggerType)) return

  const { text, blocks } = buildMissingDataAlert({
    accountId: account.id,
    accountName: account.name,
    ownerName: account.owner,
    ownerEmail: account.ownerEmail,
    missing,
  })

  let ts: string | null = null
  if (account.ownerEmail) {
    ts = await sendDm(account.ownerEmail, text, blocks)
  }
  await recordAlert(account.id, triggerType, ts)
}

async function checkDivergenceAlert(
  account: Account,
  previousScores: { usageScore: number | null; interactionsScore: number | null } | null,
  currentUsage: number | null,
  currentInteractions: number | null
) {
  if (!previousScores || currentUsage === null || currentInteractions === null) return

  const usageUp =
    previousScores.usageScore !== null && currentUsage > previousScores.usageScore
  const interactionsDown =
    previousScores.interactionsScore !== null &&
    currentInteractions < previousScores.interactionsScore - THRESHOLDS.SCORE_DROP_ALERT_PTS

  if (!usageUp || !interactionsDown) return

  const triggerType = 'score_divergence'
  if (isDisabled(triggerType) || (await hasRecentAlert(account.id, triggerType))) return

  const { text, blocks } = buildDivergenceAlert({
    accountId: account.id,
    accountName: account.name,
    ownerName: account.owner,
    ownerEmail: account.ownerEmail,
    usageScore: currentUsage,
    interactionsScore: currentInteractions,
  })
  let ts: string | null = null
  if (account.ownerEmail) {
    ts = await sendDm(account.ownerEmail, text, blocks)
    if (process.env.SLACK_CS_MANAGER_EMAIL) {
      await sendDm(process.env.SLACK_CS_MANAGER_EMAIL, text, blocks)
    }
  }
  await recordAlert(account.id, triggerType, ts)
}

async function checkInactivityAlerts(account: Account) {
  const now = Date.now()

  // No CS activity isn't alerted per account. The account page shows it past
  // THRESHOLDS.NO_ACTIVITY_ALERT_DAYS; the queue lists the account once there's been no CS
  // touchpoint and no customer contact for that long.

  // No product usage: no educator at the account has been active in the product for N days.
  // (Previously keyed off the SIS roster upload date, which is a yearly event, not usage.)
  if (!isDisabled('no_product_usage') && account.lastEducatorActivity) {
    const daysSince = Math.floor(
      (now - account.lastEducatorActivity.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysSince >= THRESHOLDS.NO_USAGE_ALERT_DAYS) {
      const triggerType = 'no_product_usage_30d' // trigger name kept stable for the cooldown; threshold is configurable
      if (!(await hasRecentAlert(account.id, triggerType))) {
        const { text, blocks } = buildInactivityAlert({
          accountId: account.id,
          accountName: account.name,
          ownerName: account.owner,
          ownerEmail: account.ownerEmail,
          daysSinceActivity: daysSince,
          kind: 'product_usage',
        })
        if (account.ownerEmail) {
          const ts = await sendDm(account.ownerEmail, text, blocks)
          await recordAlert(account.id, triggerType, ts)
        }
      }
    }
  }

  // Champion gone dark
  if (!isDisabled('champion_gone_dark') && account.championStatus === 'gone_dark') {
    const triggerType = 'champion_gone_dark'
    if (!(await hasRecentAlert(account.id, triggerType))) {
      const { text, blocks } = buildInactivityAlert({
        accountId: account.id,
        accountName: account.name,
        ownerName: account.owner,
        ownerEmail: account.ownerEmail,
        daysSinceActivity: THRESHOLDS.CHAMPION_DARK_DAYS,
        kind: 'champion_dark',
      })
      if (account.ownerEmail) {
        const ts = await sendDm(account.ownerEmail, text, blocks)
        await recordAlert(account.id, triggerType, ts)
      }
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface AlertOptions {
  // Evaluate and record alerts but do not post to Slack (cooldown still applies)
  silent?: boolean
}

// Renewal alerts — call for every deal with an upcoming renewal (next 12 months)
export async function runRenewalAlerts(account: Account, opts: AlertOptions = {}) {
  await alertContext.run({ silent: !!opts.silent }, () =>
    Promise.allSettled([
      checkRenewalAlerts(account),
      checkMissingDataAlerts(account),
    ]),
  )
}

// Health/activity alerts — call once per company (primary deal only)
export async function runHealthAlerts(
  account: Account,
  previousScores: { usageScore: number | null; interactionsScore: number | null } | null,
  currentUsage: number | null,
  currentInteractions: number | null,
  opts: AlertOptions = {},
) {
  await alertContext.run({ silent: !!opts.silent }, () =>
    Promise.allSettled([
      checkDivergenceAlert(account, previousScores, currentUsage, currentInteractions),
      checkInactivityAlerts(account),
    ]),
  )
}
