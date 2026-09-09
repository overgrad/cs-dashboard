import hubspot from '@hubspot/api-client'
import { HS_PROPS } from './config'

// Private apps are limited to ~100 requests per 10s. The syncs fan out batch reads in
// parallel, so throttle through the client's shared limiter and retry on 429/5xx
// (retry waits 10s × attempt on a rolling-window 429).
export const hubspotClient = new hubspot.Client({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
  numberOfApiCallRetries: 5,
  limiterOptions: { minTime: 125, maxConcurrent: 4, id: 'cs-dashboard-hubspot' },
})

export const DEAL_PROPERTIES = [
  HS_PROPS.DEAL_NAME,
  HS_PROPS.CLOSE_DATE,
  HS_PROPS.DEAL_STAGE,
  HS_PROPS.AMOUNT,
  HS_PROPS.OWNER_ID,
  HS_PROPS.LINE_ITEM_IDS,
  'pipeline',
]

export interface PipelineInfo {
  pipelineId: string
  stageMap: Map<string, string> // stageId → label
}

// Fetch pipeline ID and stage labels for the renewals pipeline
export async function getRenewalsPipelineInfo(): Promise<PipelineInfo | null> {
  try {
    const response = await hubspotClient.crm.pipelines.pipelinesApi.getAll('deals')
    const pipeline = response.results.find((p) =>
      p.label.toLowerCase().includes('renewal')
    )
    if (!pipeline) return null

    const stageMap = new Map<string, string>()
    for (const stage of pipeline.stages ?? []) {
      stageMap.set(stage.id, stage.label)
    }
    return { pipelineId: pipeline.id, stageMap }
  } catch {
    return null
  }
}

// Fetch all deals in the renewals pipeline with pagination
export async function getAllDeals(pipelineId?: string) {
  const deals: Awaited<ReturnType<typeof hubspotClient.crm.deals.basicApi.getPage>>['results'] = []
  let after: string | undefined = undefined

  do {
    const response = await hubspotClient.crm.deals.basicApi.getPage(
      100,
      after,
      DEAL_PROPERTIES,
      undefined,
      ['contacts', 'line_items']
    )
    const filtered = pipelineId
      ? response.results.filter((d) => d.properties.pipeline === pipelineId)
      : response.results
    deals.push(...filtered)
    after = response.paging?.next?.after
  } while (after)

  return deals
}

// Fetch owner details by ID
export async function getOwner(ownerId: string) {
  try {
    const owner = await hubspotClient.crm.owners.ownersApi.getById(parseInt(ownerId))
    return {
      name: `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim(),
      email: owner.email,
    }
  } catch {
    return null
  }
}

// Fetch which deal IDs have at least one line item, in batch
export async function getDealsWithLineItems(dealIds: string[]): Promise<Set<string>> {
  const withLineItems = new Set<string>()
  const chunkSize = 100

  for (let i = 0; i < dealIds.length; i += chunkSize) {
    const chunk = dealIds.slice(i, i + chunkSize)
    try {
      const response = await hubspotClient.crm.associations.v4.batchApi.getPage(
        'deals',
        'line_items',
        { inputs: chunk.map((id) => ({ id })) }
      )
      for (const result of response.results) {
        if (result.to && result.to.length > 0) {
          withLineItems.add(result._from.id)
        }
      }
    } catch {
      // If batch call fails, assume no line items for this chunk
    }
  }

  return withLineItems
}

const INVOICE_PROPERTIES = [
  HS_PROPS.INVOICE_STATUS,
  HS_PROPS.INVOICE_DUE_DATE,
  HS_PROPS.INVOICE_BALANCE_DUE,
]

export interface UnpaidInvoiceSummary {
  count: number
  balance: number
  oldestDueDate: Date | null
}

// Fetch unpaid invoice summaries (status=open with a balance due) for a batch of deal IDs.
// HubSpot Commerce Invoices associate to deals via a native association — a deal can have
// several invoices (e.g. multi-year payment plans), so this rolls them up per deal.
export async function getUnpaidInvoices(dealIds: string[]): Promise<Map<string, UnpaidInvoiceSummary>> {
  const result = new Map<string, UnpaidInvoiceSummary>()
  const chunkSize = 100

  // Step 1: deal → invoice associations
  const dealToInvoiceIds = new Map<string, string[]>()
  for (let i = 0; i < dealIds.length; i += chunkSize) {
    const chunk = dealIds.slice(i, i + chunkSize)
    try {
      const response = await hubspotClient.crm.associations.v4.batchApi.getPage(
        'deals',
        'invoices',
        { inputs: chunk.map((id) => ({ id })) }
      )
      for (const r of response.results) {
        if (r.to && r.to.length > 0) {
          dealToInvoiceIds.set(r._from.id, r.to.map((t) => String(t.toObjectId)))
        }
      }
    } catch {
      // skip chunk on error
    }
  }

  // Step 2: batch fetch invoice properties
  const allInvoiceIds = [...new Set([...dealToInvoiceIds.values()].flat())]
  const invoiceDataMap = new Map<string, { status: string | null; dueDate: Date | null; balance: number }>()
  for (let i = 0; i < allInvoiceIds.length; i += chunkSize) {
    const chunk = allInvoiceIds.slice(i, i + chunkSize)
    try {
      const response = await hubspotClient.crm.commerce.invoices.batchApi.read({
        inputs: chunk.map((id) => ({ id })),
        properties: INVOICE_PROPERTIES,
        propertiesWithHistory: [],
      })
      for (const invoice of response.results) {
        const p = invoice.properties ?? {}
        invoiceDataMap.set(String(invoice.id), {
          status: p[HS_PROPS.INVOICE_STATUS] ?? null,
          dueDate: p[HS_PROPS.INVOICE_DUE_DATE] ? new Date(p[HS_PROPS.INVOICE_DUE_DATE]!) : null,
          balance: p[HS_PROPS.INVOICE_BALANCE_DUE] ? parseFloat(p[HS_PROPS.INVOICE_BALANCE_DUE]!) : 0,
        })
      }
    } catch {
      // skip chunk on error
    }
  }

  // Step 3: combine — deal → unpaid invoice summary ("sent, not paid" = open status w/ balance > 0)
  for (const [dealId, invoiceIds] of dealToInvoiceIds) {
    const unpaid = invoiceIds
      .map((id) => invoiceDataMap.get(id))
      .filter((inv): inv is NonNullable<typeof inv> => !!inv && inv.status === 'open' && inv.balance > 0)

    if (unpaid.length > 0) {
      result.set(dealId, {
        count: unpaid.length,
        balance: unpaid.reduce((sum, inv) => sum + inv.balance, 0),
        oldestDueDate: unpaid.reduce<Date | null>((oldest, inv) => {
          if (!inv.dueDate) return oldest
          if (!oldest || inv.dueDate < oldest) return inv.dueDate
          return oldest
        }, null),
      })
    }
  }

  return result
}

export interface CompanyData {
  companyId: string
  companyName: string | null
  overgradId: string | null
  lifecycleStage: string | null
  wauEducators: number | null
  studentsCompletedSetupPct: number | null
  careerMilestoneCompletionPct: number | null
  collegeMilestoneCompletionPct: number | null
  commonAppLinking: number | null
  lastDataUploadDate: Date | null
  onboardingCompletionDate: Date | null
  domain: string | null
  lastEducatorActivity: Date | null  // written daily by the product for schools with active access
  rosteredStudents: number | null    // active HS students (grades 9–12) per the product's daily roster counts
}

const COMPANY_PROPERTIES = [
  'name',
  'domain',
  'lifecyclestage',
  HS_PROPS.OVERGRAD_ID,
  HS_PROPS.WAU_EDUCATORS,
  HS_PROPS.STUDENTS_COMPLETED_SETUP_PCT,
  HS_PROPS.CAREER_MILESTONE_PCT,
  HS_PROPS.COLLEGE_MILESTONE_PCT,
  HS_PROPS.COMMON_APP_LINKING,
  HS_PROPS.LAST_DATA_UPLOAD_DATE,
  HS_PROPS.ONBOARDING_COMPLETION_DATE,
  HS_PROPS.COMPANY_LAST_EDUCATOR_ACTIVITY,
  ...HS_PROPS.ROSTER_GRADE_COUNTS,
]

// Fetch company data for a batch of deal IDs
// Returns Map<dealId, CompanyData>
export async function getCompanyData(dealIds: string[]): Promise<Map<string, CompanyData>> {
  const result = new Map<string, CompanyData>()
  const chunkSize = 100

  // Step 1: deal → company associations
  const dealToCompanyId = new Map<string, string>()
  for (let i = 0; i < dealIds.length; i += chunkSize) {
    const chunk = dealIds.slice(i, i + chunkSize)
    try {
      const response = await hubspotClient.crm.associations.v4.batchApi.getPage(
        'deals',
        'companies',
        { inputs: chunk.map((id) => ({ id })) }
      )
      for (const r of response.results) {
        if (r.to && r.to.length > 0) {
          dealToCompanyId.set(r._from.id, String(r.to[0].toObjectId))
        }
      }
    } catch {
      // skip chunk on error
    }
  }

  // Step 2: batch fetch company properties
  const companyIds = [...new Set(dealToCompanyId.values())]
  const companyDataMap = new Map<string, CompanyData>()
  for (let i = 0; i < companyIds.length; i += chunkSize) {
    const chunk = companyIds.slice(i, i + chunkSize)
    try {
      const response = await hubspotClient.crm.companies.batchApi.read({
        inputs: chunk.map((id) => ({ id })),
        properties: COMPANY_PROPERTIES,
        propertiesWithHistory: [],
      })
      for (const company of response.results) {
        companyDataMap.set(String(company.id), parseCompany(String(company.id), company.properties ?? {}))
      }
    } catch {
      // skip chunk on error
    }
  }

  // Step 3: combine — deal → company → data
  for (const [dealId, companyId] of dealToCompanyId) {
    const data = companyDataMap.get(companyId)
    if (data) result.set(dealId, data)
  }

  return result
}

// Fetch primary contact email from contact ID (obtained from deal associations)
export interface ContactInfo {
  id: string
  name: string
  email: string | null
  title: string | null
  lastOvergradActivity: Date | null
}

const CONTACT_PROPERTIES = ['email', 'firstname', 'lastname', HS_PROPS.CONTACT_JOB_TITLE, HS_PROPS.CONTACT_LAST_ACTIVITY]

function toContactInfo(id: string, p: Record<string, string | null | undefined>): ContactInfo {
  return {
    id,
    name: `${p['firstname'] ?? ''} ${p['lastname'] ?? ''}`.trim(),
    email: p['email'] ?? null,
    title: p[HS_PROPS.CONTACT_JOB_TITLE] ?? null,
    lastOvergradActivity: p[HS_PROPS.CONTACT_LAST_ACTIVITY] ? new Date(String(p[HS_PROPS.CONTACT_LAST_ACTIVITY])) : null,
  }
}

export async function getContact(contactId: string): Promise<ContactInfo | null> {
  try {
    const contact = await hubspotClient.crm.contacts.basicApi.getById(contactId, CONTACT_PROPERTIES)
    return toContactInfo(String(contact.id), contact.properties)
  } catch {
    return null
  }
}

// All contacts associated to each company, with title and last product activity.
export async function getCompanyContacts(companyIds: string[]): Promise<Map<string, ContactInfo[]>> {
  const contactIdsByCompany = await batchAssociationIds('companies', 'contacts', companyIds)
  const allIds = [...new Set([...contactIdsByCompany.values()].flat())]
  const byId = new Map<string, ContactInfo>()
  const chunkSize = 100
  for (let i = 0; i < allIds.length; i += chunkSize) {
    const chunk = allIds.slice(i, i + chunkSize)
    try {
      const response = await hubspotClient.crm.contacts.batchApi.read({
        inputs: chunk.map((id) => ({ id })),
        properties: CONTACT_PROPERTIES,
        propertiesWithHistory: [],
      })
      for (const c of response.results) byId.set(String(c.id), toContactInfo(String(c.id), c.properties ?? {}))
    } catch (err) {
      console.error(`[hubspot] contacts batch read failed (${chunk.length} ids): ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  const result = new Map<string, ContactInfo[]>()
  for (const [companyId, ids] of contactIdsByCompany) {
    result.set(companyId, ids.map((id) => byId.get(id)).filter((c): c is ContactInfo => !!c))
  }
  return result
}

// ─── ARR inputs (all deals per company + their line items) ───────────────────

import type { ArrDealInput, ArrLineItemInput } from './arr'

const ARR_DEAL_PROPERTIES = [
  'dealname', 'amount', 'closedate', 'dealstage', 'pipeline', 'contract_start_date', 'contract_end_date', 'hubspot_owner_id',
]
const ARR_LINE_ITEM_PROPERTIES = ['name', 'hs_sku', 'hs_product_id', 'amount', 'quantity']

// Stage ID → label across all deal pipelines (used for the "closed won" label rule)
export async function getAllStageLabels(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const response = await hubspotClient.crm.pipelines.pipelinesApi.getAll('deals')
    for (const p of response.results) for (const s of p.stages ?? []) map.set(s.id, s.label)
  } catch (err) {
    console.error(`[hubspot] pipelines fetch failed: ${err instanceof Error ? err.message : String(err)}`)
  }
  return map
}

async function batchAssociationIds(fromType: string, toType: string, ids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  const chunkSize = 100
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    try {
      const response = await hubspotClient.crm.associations.v4.batchApi.getPage(
        fromType, toType, { inputs: chunk.map((id) => ({ id })) },
      )
      for (const r of response.results) {
        if (r.to && r.to.length > 0) map.set(r._from.id, r.to.map((t) => String(t.toObjectId)))
      }
    } catch (err) {
      console.error(`[hubspot] ${fromType}→${toType} associations failed (${chunk.length} ids): ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return map
}

// Every deal associated to each company (any pipeline), with the properties ARR needs.
export async function getDealsForCompanies(companyIds: string[]): Promise<Map<string, ArrDealInput[]>> {
  const dealIdsByCompany = await batchAssociationIds('companies', 'deals', companyIds)
  const allDealIds = [...new Set([...dealIdsByCompany.values()].flat())]
  const dealsById = new Map<string, ArrDealInput>()
  const chunkSize = 100
  const parseDate = (v: unknown) => (v ? new Date(String(v)) : null)
  for (let i = 0; i < allDealIds.length; i += chunkSize) {
    const chunk = allDealIds.slice(i, i + chunkSize)
    try {
      const response = await hubspotClient.crm.deals.batchApi.read({
        inputs: chunk.map((id) => ({ id })),
        properties: ARR_DEAL_PROPERTIES,
        propertiesWithHistory: [],
      })
      for (const d of response.results) {
        const p = d.properties ?? {}
        dealsById.set(String(d.id), {
          id: String(d.id),
          name: p['dealname'] ?? '',
          amount: p['amount'] ? parseFloat(p['amount']) : null,
          closeDate: parseDate(p['closedate']),
          stageId: p['dealstage'] ?? null,
          pipelineId: p['pipeline'] ?? null,
          contractStart: parseDate(p['contract_start_date']),
          contractEnd: parseDate(p['contract_end_date']),
          ownerId: p['hubspot_owner_id'] ?? null,
        })
      }
    } catch (err) {
      console.error(`[hubspot] deals batch read failed (${chunk.length} ids): ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  const result = new Map<string, ArrDealInput[]>()
  for (const [companyId, dealIds] of dealIdsByCompany) {
    result.set(companyId, dealIds.map((id) => dealsById.get(id)).filter((d): d is ArrDealInput => !!d))
  }
  return result
}

// Line items for a set of deals
export async function getLineItemsForDeals(dealIds: string[]): Promise<Map<string, ArrLineItemInput[]>> {
  const itemIdsByDeal = await batchAssociationIds('deals', 'line_items', dealIds)
  const allItemIds = [...new Set([...itemIdsByDeal.values()].flat())]
  const itemsById = new Map<string, ArrLineItemInput>()
  const chunkSize = 100
  for (let i = 0; i < allItemIds.length; i += chunkSize) {
    const chunk = allItemIds.slice(i, i + chunkSize)
    try {
      const response = await hubspotClient.crm.lineItems.batchApi.read({
        inputs: chunk.map((id) => ({ id })),
        properties: ARR_LINE_ITEM_PROPERTIES,
        propertiesWithHistory: [],
      })
      for (const it of response.results) {
        const p = it.properties ?? {}
        itemsById.set(String(it.id), {
          id: String(it.id),
          name: p['name'] ?? null,
          sku: p['hs_sku'] ?? null,
          productId: p['hs_product_id'] ?? null,
          amount: p['amount'] ? parseFloat(p['amount']) : null,
          quantity: p['quantity'] ? parseFloat(p['quantity']) : null,
        })
      }
    } catch (err) {
      console.error(`[hubspot] line items batch read failed (${chunk.length} ids): ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  const result = new Map<string, ArrLineItemInput[]>()
  for (const [dealId, itemIds] of itemIdsByDeal) {
    result.set(dealId, itemIds.map((id) => itemsById.get(id)).filter((x): x is ArrLineItemInput => !!x))
  }
  return result
}

// ─── Contact lookup by email (Freshdesk requester → HubSpot contact → company) ───

// Map lowercased email → first associated HubSpot company ID, for contacts that exist.
export async function getCompanyIdsByContactEmail(emails: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(emails.map((e) => e.toLowerCase().trim()).filter(Boolean))]
  const contactIdByEmail = new Map<string, string>()
  const chunkSize = 100
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    try {
      const response = await hubspotClient.crm.contacts.batchApi.read({
        idProperty: 'email',
        inputs: chunk.map((id) => ({ id })),
        properties: ['email'],
        propertiesWithHistory: [],
      })
      for (const c of response.results) {
        const email = (c.properties?.['email'] ?? '').toLowerCase()
        if (email) contactIdByEmail.set(email, String(c.id))
      }
    } catch (err) {
      // HubSpot 404s the whole batch only when no id matches; anything else is worth seeing
      const message = err instanceof Error ? err.message : String(err)
      if (!/404/.test(message)) console.error(`[hubspot] contacts by email failed (${chunk.length}): ${message}`)
    }
  }
  const companyByContact = await batchAssociationIds('contacts', 'companies', [...new Set(contactIdByEmail.values())])
  const result = new Map<string, string>()
  for (const [email, contactId] of contactIdByEmail) {
    const companies = companyByContact.get(contactId)
    if (companies && companies.length > 0) result.set(email, companies[0])
  }
  return result
}

// ─── All customer companies (lifecycle stage = customer), regardless of pipeline ───

function parseCompany(id: string, p: Record<string, string | null | undefined>): CompanyData {
  const parseFloat_ = (v: unknown) => (v ? parseFloat(String(v)) : null)
  const parseDate = (v: unknown) => (v ? new Date(String(v)) : null)
  return {
    companyId: id,
    companyName: p['name'] ?? null,
    lifecycleStage: p['lifecyclestage'] ?? null,
    overgradId: p[HS_PROPS.OVERGRAD_ID] ?? null,
    wauEducators: parseFloat_(p[HS_PROPS.WAU_EDUCATORS]),
    studentsCompletedSetupPct: parseFloat_(p[HS_PROPS.STUDENTS_COMPLETED_SETUP_PCT]),
    careerMilestoneCompletionPct: parseFloat_(p[HS_PROPS.CAREER_MILESTONE_PCT]),
    collegeMilestoneCompletionPct: parseFloat_(p[HS_PROPS.COLLEGE_MILESTONE_PCT]),
    commonAppLinking: parseFloat_(p[HS_PROPS.COMMON_APP_LINKING]),
    lastDataUploadDate: parseDate(p[HS_PROPS.LAST_DATA_UPLOAD_DATE]),
    onboardingCompletionDate: parseDate(p[HS_PROPS.ONBOARDING_COMPLETION_DATE]),
    domain: p['domain'] ?? null,
    lastEducatorActivity: parseDate(p[HS_PROPS.COMPANY_LAST_EDUCATOR_ACTIVITY]),
    rosteredStudents: rosterCount(p),
  }
}

function rosterCount(p: Record<string, string | null | undefined>): number | null {
  const counts = HS_PROPS.ROSTER_GRADE_COUNTS.map((k) => p[k]).filter((v): v is string => !!v)
  if (counts.length === 0) return null
  return counts.reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0)
}

// Every company at lifecycle stage "customer". New logos live only in the sales pipeline until a
// renewal deal exists, so the account list must be seeded from companies, not renewal deals.
export async function getAllCustomerCompanies(): Promise<Map<string, CompanyData>> {
  const result = new Map<string, CompanyData>()
  let after: string | undefined
  for (let page = 0; page < 50; page++) {
    try {
      const response = await hubspotClient.crm.companies.searchApi.doSearch({
        filterGroups: [{ filters: [{ propertyName: 'lifecyclestage', operator: 'EQ' as never, value: 'customer' }] }],
        properties: COMPANY_PROPERTIES,
        limit: 100,
        after,
        sorts: [],
      })
      for (const c of response.results) result.set(String(c.id), parseCompany(String(c.id), c.properties ?? {}))
      after = response.paging?.next?.after
      if (!after) break
    } catch (err) {
      console.error(`[hubspot] customer company search failed (page ${page}): ${err instanceof Error ? err.message : String(err)}`)
      break
    }
  }
  return result
}
