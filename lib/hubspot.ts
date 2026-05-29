import hubspot from '@hubspot/api-client'
import { HS_PROPS } from './config'

export const hubspotClient = new hubspot.Client({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
})

export const DEAL_PROPERTIES = [
  HS_PROPS.DEAL_NAME,
  HS_PROPS.CLOSE_DATE,
  HS_PROPS.DEAL_STAGE,
  HS_PROPS.AMOUNT,
  HS_PROPS.OWNER_ID,
  HS_PROPS.LINE_ITEM_IDS,
  HS_PROPS.ONBOARDING_DATE,
  HS_PROPS.TOTAL_LICENSED_SEATS,
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

export interface CompanyData {
  overgradId: string | null
  studentsCompletedSetupPct: number | null
  careerMilestoneCompletionPct: number | null
  collegeMilestoneCompletionPct: number | null
  commonAppLinking: number | null
  lastDataUploadDate: Date | null
}

const COMPANY_PROPERTIES = [
  HS_PROPS.OVERGRAD_ID,
  HS_PROPS.STUDENTS_COMPLETED_SETUP_PCT,
  HS_PROPS.CAREER_MILESTONE_PCT,
  HS_PROPS.COLLEGE_MILESTONE_PCT,
  HS_PROPS.COMMON_APP_LINKING,
  HS_PROPS.LAST_DATA_UPLOAD_DATE,
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
        const p = company.properties ?? {}
        const parseFloat_ = (v: unknown) => (v ? parseFloat(String(v)) : null)
        const parseDate = (v: unknown) => (v ? new Date(String(v)) : null)
        companyDataMap.set(String(company.id), {
          overgradId: p[HS_PROPS.OVERGRAD_ID] ?? null,
          studentsCompletedSetupPct: parseFloat_(p[HS_PROPS.STUDENTS_COMPLETED_SETUP_PCT]),
          careerMilestoneCompletionPct: parseFloat_(p[HS_PROPS.CAREER_MILESTONE_PCT]),
          collegeMilestoneCompletionPct: parseFloat_(p[HS_PROPS.COLLEGE_MILESTONE_PCT]),
          commonAppLinking: parseFloat_(p[HS_PROPS.COMMON_APP_LINKING]),
          lastDataUploadDate: parseDate(p[HS_PROPS.LAST_DATA_UPLOAD_DATE]),
        })
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
export async function getContact(contactId: string) {
  try {
    const contact = await hubspotClient.crm.contacts.basicApi.getById(contactId, [
      'email',
      'firstname',
      'lastname',
    ])
    return {
      name: `${contact.properties.firstname ?? ''} ${contact.properties.lastname ?? ''}`.trim(),
      email: contact.properties.email ?? null,
    }
  } catch {
    return null
  }
}
