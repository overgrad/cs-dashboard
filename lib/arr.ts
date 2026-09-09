// ARR calculation — mirrors Finance's method in cashflow-qbo so the dashboard's ARR
// matches Finance's customer_master.current_arr by construction.
//
// Definition (cashflow-qbo/src/build_saas_revenue_registry_hubspot.py +
// build_customer_master_from_hubspot.py):
//   1. Take every closed-won deal on the company (any pipeline), amount > 0,
//      close date >= 2020-01-01. Deduplicate by lowercased deal name, keeping the
//      highest deal ID.
//   2. Classify each line item against Finance's product catalog. Licenses count
//      toward ARR; services, training, implementation and fees do not. A deal with
//      no line items contributes $0 ARR (Finance treats the bare deal amount as non-ARR).
//   3. A deal is active when its contract window covers today: Contract Start Date
//      (falling back to the close date when missing) is on or before today AND Contract
//      End Date is today or later. Deals with no Contract End Date are never active.
//      (Rule agreed with Finance 2026-09-09 — the previous end-date-only rule pulled in
//      future-year multi-year components, e.g. NYCPS R1657 Years 2–5.)
//   4. Current ARR = sum of ARR line items across active deals. No proration.
import { PRODUCT_CLASSIFICATION, type ProductClassification } from './product-classification'

export const ARR_METHOD_VERSION = '2026-09-09b'

// Stage IDs Finance treats as closed-won, plus any stage whose label contains "closed" and "won".
export const CLOSED_WON_STAGE_IDS = new Set(['closedwon', '110452794', '110452793', '110583424'])
const MIN_CLOSE_DATE = new Date('2020-01-01T00:00:00Z')

export interface ArrDealInput {
  id: string
  name: string
  amount: number | null
  closeDate: Date | null
  stageId: string | null
  pipelineId: string | null
  contractStart: Date | null
  contractEnd: Date | null
  ownerId?: string | null
}

export interface ArrLineItemInput {
  id: string
  name: string | null
  sku: string | null
  productId: string | null
  amount: number | null
  quantity: number | null
}

export interface ArrLineItem {
  name: string
  amount: number
  quantity: number | null
  countsTowardArr: boolean
  product: string | null // matched catalog item name, null if unmatched
}

export interface ArrDeal {
  dealId: string
  dealName: string
  closeDate: string | null
  contractStart: string | null
  contractEnd: string | null
  ownerId: string | null
  active: boolean
  arrAmount: number
  nonArrAmount: number
  dealAmount: number
  hasLineItems: boolean
  lineItems: ArrLineItem[]
  licensedStudents: number | null      // HS student seats on this deal (see LICENSED_STUDENTS_HS_PRODUCTS)
  licensedMiddleSchool: number | null  // middle-school seats, a separate population
}

export interface CompanyArr {
  asOf: string
  methodVersion: string
  currentArr: number
  latestContractArr: number | null
  latestContractEnd: string | null
  latestContractDealName: string | null
  deals: ArrDeal[]
  unmatchedProducts: string[]
  licensedStudents: number | null      // sum over active deals
  licensedMiddleSchool: number | null
}

// Per-student license products. Access / Success / Complete / Success Data-Only cover the SAME
// high-school students on a deal (e.g. Access + Success both at qty 7,595), so within a deal we
// take the largest product quantity rather than summing. Middle School is a separate population
// and is added on top. Site licenses, NSC reports and CBO deals are not per-student and are ignored.
export const LICENSED_STUDENTS_HS_PRODUCTS = new Set([
  'Student Licenses:Access',
  'Student Licenses:Success',
  'Student Licenses:Complete',
  'Student Licenses:Success Data-Only Add On',
])
export const LICENSED_STUDENTS_MS_PRODUCTS = new Set(['Student Licenses:Overgrad for Middle School'])

// Same matching strategy as Finance: exact match on the part after "Category:", then
// substring, then SKU (exact, then partial), then product ID.
export function classifyLineItem(item: ArrLineItemInput): ProductClassification | null {
  const name = (item.name ?? '').toLowerCase().trim()
  const suffix = name.includes(':') ? name.split(':').slice(1).join(':').trim() : name
  const catalog = PRODUCT_CLASSIFICATION

  if (name) {
    for (const c of catalog) {
      const cn = c.itemName.toLowerCase()
      if (c.itemName.includes(':')) {
        const part = c.itemName.split(':').pop()!.trim().toLowerCase()
        if (part === name || part === suffix) return c
      } else if (cn === name || cn === suffix) {
        return c
      }
    }
    for (const c of catalog) {
      const cn = c.itemName.toLowerCase()
      if (cn.includes(name) || cn.includes(suffix)) return c
    }
  }
  if (item.sku) {
    const sku = item.sku.toLowerCase()
    const exact = catalog.find((c) => c.sku.toLowerCase() === sku)
    if (exact) return exact
    for (const c of catalog) {
      const cs = c.sku.toLowerCase()
      if (cs && (sku.includes(cs) || cs.includes(sku))) return c
    }
  }
  if (item.productId) {
    const byId = catalog.find((c) => c.productId === String(item.productId))
    if (byId) return byId
  }
  return null
}

const dateOnly = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

export function isClosedWonStage(stageId: string | null, stageLabel?: string | null): boolean {
  if (stageId && CLOSED_WON_STAGE_IDS.has(stageId)) return true
  const label = (stageLabel ?? '').toLowerCase()
  return label.includes('closed') && label.includes('won')
}

export function computeCompanyArr(
  deals: ArrDealInput[],
  lineItemsByDeal: Map<string, ArrLineItemInput[]>,
  stageLabels: Map<string, string>,
  asOf: Date = new Date(),
): CompanyArr {
  const today = dateOnly(asOf)

  // Filter + dedupe by name (keep highest ID), as Finance does
  const kept = new Map<string, ArrDealInput>()
  for (const d of deals) {
    if (!isClosedWonStage(d.stageId, d.stageId ? stageLabels.get(d.stageId) : null)) continue
    if (!d.amount || d.amount <= 0) continue
    if (!d.closeDate || d.closeDate < MIN_CLOSE_DATE) continue
    const key = d.name.toLowerCase().trim()
    const existing = kept.get(key)
    if (!existing || Number(d.id) > Number(existing.id)) kept.set(key, d)
  }

  const unmatched = new Set<string>()
  const result: ArrDeal[] = []
  for (const d of kept.values()) {
    const items = lineItemsByDeal.get(d.id) ?? []
    let arrAmount = 0
    let nonArrAmount = 0
    const hsSeatsByProduct = new Map<string, number>()
    let msSeats = 0
    const lineItems: ArrLineItem[] = items.map((it) => {
      const cls = classifyLineItem(it)
      const amount = it.amount ?? 0
      const counts = cls?.countsTowardArr ?? false
      if (!cls) unmatched.add(it.name ?? `line item ${it.id}`)
      if (counts) arrAmount += amount
      else nonArrAmount += amount
      if (cls && it.quantity) {
        if (LICENSED_STUDENTS_HS_PRODUCTS.has(cls.itemName)) {
          hsSeatsByProduct.set(cls.itemName, (hsSeatsByProduct.get(cls.itemName) ?? 0) + it.quantity)
        } else if (LICENSED_STUDENTS_MS_PRODUCTS.has(cls.itemName)) {
          msSeats += it.quantity
        }
      }
      return { name: it.name ?? 'Unnamed', amount, quantity: it.quantity, countsTowardArr: counts, product: cls?.itemName ?? null }
    })
    const hsSeats = hsSeatsByProduct.size > 0 ? Math.max(...hsSeatsByProduct.values()) : null
    const start = d.contractStart ?? d.closeDate
    const active =
      !!d.contractEnd && dateOnly(d.contractEnd) >= today && !!start && dateOnly(start) <= today
    result.push({
      dealId: d.id,
      dealName: d.name,
      closeDate: iso(d.closeDate),
      contractStart: iso(d.contractStart),
      contractEnd: iso(d.contractEnd),
      ownerId: d.ownerId ?? null,
      active,
      arrAmount: Math.round(arrAmount * 100) / 100,
      nonArrAmount: Math.round(nonArrAmount * 100) / 100,
      dealAmount: d.amount ?? 0,
      hasLineItems: items.length > 0,
      lineItems,
      licensedStudents: hsSeats !== null ? Math.round(hsSeats) : null,
      licensedMiddleSchool: msSeats > 0 ? Math.round(msSeats) : null,
    })
  }

  // Most recent contract first (by contract end, then close date)
  const sortKey = (d: ArrDeal) => d.contractEnd ?? d.closeDate ?? ''
  result.sort((a, b) => sortKey(b).localeCompare(sortKey(a)))

  const activeDeals = result.filter((d) => d.active)
  const currentArr = activeDeals.reduce((s, d) => s + d.arrAmount, 0)
  const sumOrNull = (vals: (number | null)[]) => {
    const present = vals.filter((v): v is number => v !== null)
    return present.length > 0 ? present.reduce((a, b) => a + b, 0) : null
  }
  const latest = result[0] ?? null

  return {
    asOf: iso(today)!,
    methodVersion: ARR_METHOD_VERSION,
    currentArr: Math.round(currentArr * 100) / 100,
    latestContractArr: latest ? latest.arrAmount : null,
    latestContractEnd: latest?.contractEnd ?? null,
    latestContractDealName: latest?.dealName ?? null,
    deals: result,
    unmatchedProducts: [...unmatched],
    licensedStudents: sumOrNull(activeDeals.map((d) => d.licensedStudents)),
    licensedMiddleSchool: sumOrNull(activeDeals.map((d) => d.licensedMiddleSchool)),
  }
}
