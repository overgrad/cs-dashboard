import type { Account } from '@/app/generated/prisma/client'
import { prisma } from './prisma'
import {
  sendToChannel,
  sendDm,
  buildRenewalAlert,
  buildMissingDataAlert,
  buildScoreDropAlert,
  buildDivergenceAlert,
  buildInactivityAlert,
} from './slack'
import { THRESHOLDS, ALERT_COOLDOWN_HOURS } from './config'

const CS_TEAM_CHANNEL = process.env.SLACK_CS_TEAM_CHANNEL ?? '#cs-team'

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

// ─── Individual alert checks ──────────────────────────────────────────────────

async function checkRenewalAlerts(account: Account) {
  if (!account.renewalDate) return

  const daysUntil = Math.ceil(
    (account.renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  // Only alert for renewals in the next 12 months; ignore old deals
  if (daysUntil < 0 || daysUntil > 365) return
  if (daysUntil > 90) return

  let triggerType: string
  let channel: string
  let sendToManager = false

  if (daysUntil <= 30) {
    triggerType = 'renewal_30'
    channel = CS_TEAM_CHANNEL
    sendToManager = true
  } else if (daysUntil <= 60) {
    triggerType = 'renewal_60'
    channel = 'dm'
    sendToManager = true
  } else {
    triggerType = 'renewal_90'
    channel = 'dm'
    sendToManager = false
  }

  if (await hasRecentAlert(account.id, triggerType)) return

  const { text, blocks } = buildRenewalAlert({
    accountId: account.id,
    accountName: account.name,
    ownerName: account.owner,
    ownerEmail: account.ownerEmail,
    daysUntil,
    arr: account.arr,
  })

  let ts: string | null = null
  if (channel === 'dm' && account.ownerEmail) {
    ts = await sendDm(account.ownerEmail, text, blocks)
    if (sendToManager && process.env.SLACK_CS_MANAGER_EMAIL) {
      await sendDm(process.env.SLACK_CS_MANAGER_EMAIL, text, blocks)
    }
  } else {
    ts = await sendToChannel(channel, text, blocks)
  }

  await recordAlert(account.id, triggerType, ts)
}

async function checkMissingDataAlerts(account: Account) {
  const missing = [
    !account.renewalDate && 'close date',
    !account.hasLineItems && 'line items',
    !account.primaryContact && 'contact',
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

async function checkScoreDropAlerts(
  account: Account,
  previousScores: { usageScore: number | null; interactionsScore: number | null } | null,
  currentUsage: number | null,
  currentInteractions: number | null
) {
  if (!previousScores) return

  const drop = THRESHOLDS.SCORE_DROP_ALERT_PTS

  if (
    previousScores.usageScore !== null &&
    currentUsage !== null &&
    previousScores.usageScore - currentUsage >= drop
  ) {
    const triggerType = 'usage_score_drop'
    if (!(await hasRecentAlert(account.id, triggerType))) {
      const { text, blocks } = buildScoreDropAlert({
        accountId: account.id,
        accountName: account.name,
        ownerName: account.owner,
        ownerEmail: account.ownerEmail,
        scoreType: 'usage',
        previousScore: previousScores.usageScore,
        currentScore: currentUsage,
      })
      const ts = await sendToChannel(CS_TEAM_CHANNEL, text, blocks)
      await recordAlert(account.id, triggerType, ts)
    }
  }

  if (
    previousScores.interactionsScore !== null &&
    currentInteractions !== null &&
    previousScores.interactionsScore - currentInteractions >= drop
  ) {
    const triggerType = 'interactions_score_drop'
    if (!(await hasRecentAlert(account.id, triggerType))) {
      const { text, blocks } = buildScoreDropAlert({
        accountId: account.id,
        accountName: account.name,
        ownerName: account.owner,
        ownerEmail: account.ownerEmail,
        scoreType: 'interactions',
        previousScore: previousScores.interactionsScore,
        currentScore: currentInteractions,
      })
      const ts = await sendToChannel(CS_TEAM_CHANNEL, text, blocks)
      await recordAlert(account.id, triggerType, ts)
    }
  }
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
  if (await hasRecentAlert(account.id, triggerType)) return

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

  // No CS activity in 60 days
  if (account.lastCsTouchpoint) {
    const daysSince = Math.floor(
      (now - account.lastCsTouchpoint.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysSince >= THRESHOLDS.NO_ACTIVITY_ALERT_DAYS) {
      const triggerType = 'no_cs_activity_60d'
      if (!(await hasRecentAlert(account.id, triggerType))) {
        const { text, blocks } = buildInactivityAlert({
          accountId: account.id,
          accountName: account.name,
          ownerName: account.owner,
          ownerEmail: account.ownerEmail,
          daysSinceActivity: daysSince,
          kind: 'cs_activity',
        })
        const ts = await sendToChannel(CS_TEAM_CHANNEL, text, blocks)
        await recordAlert(account.id, triggerType, ts)
      }
    }
  }

  // No product usage in 30 days (via lastDataUploadDate as proxy until PostHog is live)
  if (account.lastDataUploadDate) {
    const daysSince = Math.floor(
      (now - account.lastDataUploadDate.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysSince >= THRESHOLDS.NO_USAGE_ALERT_DAYS) {
      const triggerType = 'no_product_usage_30d'
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
  if (account.championStatus === 'gone_dark') {
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

// Renewal alerts — call for every deal with an upcoming renewal (next 12 months)
export async function runRenewalAlerts(account: Account) {
  await Promise.allSettled([
    checkRenewalAlerts(account),
    checkMissingDataAlerts(account),
  ])
}

// Health/activity alerts — call once per company (primary deal only)
export async function runHealthAlerts(
  account: Account,
  previousScores: { usageScore: number | null; interactionsScore: number | null } | null,
  currentUsage: number | null,
  currentInteractions: number | null
) {
  await Promise.allSettled([
    checkScoreDropAlerts(account, previousScores, currentUsage, currentInteractions),
    checkDivergenceAlert(account, previousScores, currentUsage, currentInteractions),
    checkInactivityAlerts(account),
  ])
}
