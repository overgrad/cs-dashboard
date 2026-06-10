import type { Account } from '@/app/generated/prisma/client'
import { THRESHOLDS } from './config'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DimScore = 'green' | 'yellow' | 'red' | 'na'

export interface ScoreDimension {
  label: string
  score: DimScore
  weight: number
  value?: string
}

export interface ScoreResult {
  score: number | null
  components: ScoreDimension[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dimPoints(s: DimScore): number {
  return s === 'green' ? 3 : s === 'yellow' ? 2 : s === 'red' ? 1 : 0
}

// Normalize a set of scored dimensions to 0–100.
// N/A dimensions are excluded from both numerator and denominator.
// Returns null if all dimensions are N/A.
function normalizeScore(dims: ScoreDimension[]): number | null {
  const applicable = dims.filter((d) => d.score !== 'na')
  if (applicable.length === 0) return null

  const totalWeight = applicable.reduce((s, d) => s + d.weight, 0)
  const weightedSum = applicable.reduce((s, d) => s + d.weight * dimPoints(d.score), 0)
  return Math.round((weightedSum / (3 * totalWeight)) * 100)
}

// ─── Usage Score dimensions ───────────────────────────────────────────────────

function scoreWAU(wau: number | null, label: string): ScoreDimension {
  const weight = 0.25
  if (wau === null) return { label, score: 'na', weight, value: 'no data' }
  const pct = wau * 100
  const score =
    pct > THRESHOLDS.WAU_PCT_GREEN
      ? 'green'
      : pct >= THRESHOLDS.WAU_PCT_YELLOW
        ? 'yellow'
        : 'red'
  return { label, score, weight, value: `${pct.toFixed(0)}%` }
}

function scoreCompletion80(pct: number | null, label: string, weight: number): ScoreDimension {
  if (pct === null) return { label, score: 'na', weight, value: 'no data' }
  const score =
    pct > THRESHOLDS.COMPLETION_PCT_GREEN
      ? 'green'
      : pct >= THRESHOLDS.COMPLETION_PCT_YELLOW
        ? 'yellow'
        : 'red'
  return { label, score, weight, value: `${pct.toFixed(0)}%` }
}

function scoreLastUpload(date: Date | null): ScoreDimension {
  const label = 'Last data upload'
  const weight = 0.15
  if (!date) return { label, score: 'na', weight, value: 'no data' }
  const ageDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
  const ageMonths = ageDays / 30
  const score =
    ageMonths < THRESHOLDS.RECENCY_GREEN_MONTHS
      ? 'green'
      : ageMonths <= THRESHOLDS.RECENCY_YELLOW_MONTHS
        ? 'yellow'
        : 'red'
  return { label, score, weight, value: `${ageDays} day${ageDays !== 1 ? 's' : ''} ago` }
}

// ─── Interactions Score dimensions ────────────────────────────────────────────

function scoreRecency(date: Date | null, label: string, weight: number): ScoreDimension {
  if (!date) return { label, score: 'na', weight, value: 'no data' }
  const ageDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
  const ageMonths = ageDays / 30
  const score =
    ageMonths < THRESHOLDS.RECENCY_GREEN_MONTHS
      ? 'green'
      : ageMonths <= THRESHOLDS.RECENCY_YELLOW_MONTHS
        ? 'yellow'
        : 'red'
  return { label, score, weight, value: `${ageDays} day${ageDays !== 1 ? 's' : ''} ago` }
}

function scoreTicketTrend(trend: string | null): ScoreDimension {
  const label = 'Ticket volume trend'
  const weight = 0.15
  if (!trend) return { label, score: 'na', weight, value: 'no data' }
  const score =
    trend === 'down' || trend === 'stable'
      ? 'green'
      : trend === 'up'
        ? 'red'
        : 'yellow'
  return { label, score, weight, value: trend }
}

function scoreSentiment(sentiment: string | null, label: string, weight: number): ScoreDimension {
  if (!sentiment) return { label, score: 'na', weight, value: 'no data' }
  const score =
    sentiment === 'positive' ? 'green' : sentiment === 'neutral' ? 'yellow' : 'red'
  return { label, score, weight, value: sentiment }
}

function scoreChampion(status: string | null): ScoreDimension {
  const label = 'Champion stability'
  const weight = 0.1
  if (!status) return { label, score: 'na', weight, value: 'not set' }
  const score =
    status === 'stable' ? 'green' : status === 'changed' ? 'yellow' : 'red'
  return { label, score, weight, value: status.replace(/_/g, ' ') }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeUsageScore(account: Account): ScoreResult {
  const dims: ScoreDimension[] = [
    scoreWAU(account.wauEducators, 'WAU educators'),
    scoreCompletion80(account.studentsCompletedSetupPct, '% students completed setup', 0.2),
    scoreCompletion80(account.careerMilestoneCompletionPct, 'Career milestone completion', 0.15),
    scoreCompletion80(account.collegeMilestoneCompletionPct, 'College milestone completion', 0.15),
    scoreCompletion80(account.commonAppLinking, 'Common App linking', 0.1),
    scoreLastUpload(account.lastDataUploadDate),
  ]
  return { score: normalizeScore(dims), components: dims }
}

export function computeInteractionsScore(account: Account): ScoreResult {
  const dims: ScoreDimension[] = [
    scoreRecency(account.lastCsTouchpoint, 'Last CS-initiated touchpoint', 0.2),
    scoreRecency(account.lastCustomerContact, 'Last customer contact', 0.2),
    scoreTicketTrend(account.ticketVolumeTrend),
    scoreSentiment(account.ticketSentiment, 'Ticket sentiment', 0.15),
    scoreSentiment(account.meetingSentiment, 'Meeting sentiment', 0.2),
    scoreChampion(account.championStatus),
  ]
  return { score: normalizeScore(dims), components: dims }
}
