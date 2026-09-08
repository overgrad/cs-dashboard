import { AsyncLocalStorage } from 'node:async_hooks'
import { WebClient, type Block, type KnownBlock } from '@slack/web-api'

const client = process.env.SLACK_BOT_TOKEN
  ? new WebClient(process.env.SLACK_BOT_TOKEN)
  : null

// When run with { silent: true }, alerts are evaluated and recorded (so the
// cooldown still applies) but nothing is posted to Slack.
export const alertContext = new AsyncLocalStorage<{ silent: boolean }>()
const isSilent = () => alertContext.getStore()?.silent ?? false

// Sends a message to a channel. Falls back to console.log when no token is set or in silent mode.
export async function sendToChannel(
  channel: string,
  text: string,
  blocks?: (KnownBlock | Block)[]
) {
  if (!client || isSilent()) {
    console.log(`[Slack${isSilent() ? ' silent' : ''}→${channel}] ${text}`)
    return null
  }
  const result = await client.chat.postMessage({ channel, text, blocks })
  return result.ts ?? null
}

// Sends a DM to a user identified by email.
export async function sendDm(
  email: string,
  text: string,
  blocks?: (KnownBlock | Block)[]
): Promise<string | null> {
  if (!client || isSilent()) {
    console.log(`[Slack${isSilent() ? ' silent' : ''} DM→${email}] ${text}`)
    return null
  }
  try {
    const result = await client.users.lookupByEmail({ email })
    const userId = result.user?.id
    if (!userId) return null
    const msg = await client.chat.postMessage({ channel: userId, text, blocks })
    return msg.ts ?? null
  } catch (err) {
    console.error(`[Slack] DM to ${email} failed:`, err)
    return null
  }
}

// ─── Message builders ─────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function accountLink(accountId: string, name: string) {
  return `<${APP_URL}/accounts/${accountId}|${name}>`
}

function ownerMention(ownerEmail: string | null, ownerName: string | null) {
  // Returns <@USER_ID> if we can resolve it; falls back to display name
  return ownerName ?? ownerEmail ?? 'Unassigned'
}

export function buildRenewalAlert(opts: {
  accountId: string
  accountName: string
  ownerName: string | null
  ownerEmail: string | null
  daysUntil: number
  arr: number | null
}) {
  const { accountId, accountName, ownerName, ownerEmail, daysUntil, arr } = opts
  const arrStr = arr ? ` ($${(arr / 1000).toFixed(0)}K ARR)` : ''
  const text = `Renewal in ${daysUntil} days: ${accountName}${arrStr} — owner: ${ownerMention(ownerEmail, ownerName)}`
  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🔔 *Renewal in ${daysUntil} days*\n*Account:* ${accountLink(accountId, accountName)}${arrStr}\n*Owner:* ${ownerMention(ownerEmail, ownerName)}`,
      },
    },
  ]
  return { text, blocks }
}

export function buildMissingDataAlert(opts: {
  accountId: string
  accountName: string
  ownerName: string | null
  ownerEmail: string | null
  missing: string[]
}) {
  const { accountId, accountName, ownerName, ownerEmail, missing } = opts
  const missingStr = missing.join(', ')
  const text = `Missing data for ${accountName}: ${missingStr}`
  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚠️ *Missing deal data*\n*Account:* ${accountLink(accountId, accountName)}\n*Missing:* ${missingStr}\n*Owner:* ${ownerMention(ownerEmail, ownerName)}`,
      },
    },
  ]
  return { text, blocks }
}

export function buildScoreDropAlert(opts: {
  accountId: string
  accountName: string
  ownerName: string | null
  ownerEmail: string | null
  scoreType: 'usage' | 'interactions'
  previousScore: number
  currentScore: number
}) {
  const { accountId, accountName, ownerName, ownerEmail, scoreType, previousScore, currentScore } =
    opts
  const drop = previousScore - currentScore
  const label = scoreType === 'usage' ? 'Usage' : 'Interactions'
  const text = `${label} score dropped ${drop} pts for ${accountName}: ${previousScore} → ${currentScore}`
  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📉 *${label} score drop (${drop} pts)*\n*Account:* ${accountLink(accountId, accountName)}\n*Score:* ${previousScore} → ${currentScore}\n*Owner:* ${ownerMention(ownerEmail, ownerName)}`,
      },
    },
  ]
  return { text, blocks }
}

export function buildDivergenceAlert(opts: {
  accountId: string
  accountName: string
  ownerName: string | null
  ownerEmail: string | null
  usageScore: number
  interactionsScore: number
}) {
  const { accountId, accountName, ownerName, ownerEmail, usageScore, interactionsScore } = opts
  const text = `Score divergence for ${accountName}: Usage ${usageScore} but Interactions ${interactionsScore}`
  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚡ *Score divergence*\n*Account:* ${accountLink(accountId, accountName)}\n*Usage:* ${usageScore} | *Interactions:* ${interactionsScore}\n*Owner:* ${ownerMention(ownerEmail, ownerName)}`,
      },
    },
  ]
  return { text, blocks }
}

export function buildInactivityAlert(opts: {
  accountId: string
  accountName: string
  ownerName: string | null
  ownerEmail: string | null
  daysSinceActivity: number
  kind: 'cs_activity' | 'product_usage' | 'champion_dark'
}) {
  const { accountId, accountName, ownerName, ownerEmail, daysSinceActivity, kind } = opts
  const label =
    kind === 'cs_activity'
      ? `No CS activity in ${daysSinceActivity} days`
      : kind === 'product_usage'
        ? `No product usage in ${daysSinceActivity} days`
        : `Champion contact gone dark (${daysSinceActivity}+ days)`
  const emoji = kind === 'champion_dark' ? '👻' : '😶'
  const text = `${label}: ${accountName}`
  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *${label}*\n*Account:* ${accountLink(accountId, accountName)}\n*Owner:* ${ownerMention(ownerEmail, ownerName)}`,
      },
    },
  ]
  return { text, blocks }
}
