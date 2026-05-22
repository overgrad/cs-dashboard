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
  HS_PROPS.STUDENTS_COMPLETED_SETUP_PCT,
  HS_PROPS.MILESTONE_COMPLETION_PCT,
  HS_PROPS.LAST_DATA_UPLOAD_DATE,
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

// Fetch overgrad_id from associated companies for a batch of deal IDs
// Returns Map<dealId, overgradId>
export async function getCompanyOvergradIds(dealIds: string[]): Promise<Map<string, string>> {
  const dealToOvergradId = new Map<string, string>()
  const chunkSize = 100

  // Step 1: deal → company associations (normalize IDs to strings)
  const dealToCompanyId = new Map<string, string>()
  for (let i = 0; i < dealIds.length; i += chunkSize) {
    const chunk = dealIds.slice(i, i + chunkSize)
    try {
      const response = await hubspotClient.crm.associations.v4.batchApi.getPage(
        'deals',
        'companies',
        { inputs: chunk.map((id) => ({ id })) }
      )
      for (const result of response.results) {
        if (result.to && result.to.length > 0) {
          dealToCompanyId.set(result._from.id, String(result.to[0].toObjectId))
        }
      }
    } catch {
      // skip chunk on error
    }
  }

  // Step 2: batch fetch company overgrad_id; build reverse map companyId → overgradId
  const companyIds = [...new Set(dealToCompanyId.values())]
  const companyOvergradMap = new Map<string, string>()
  for (let i = 0; i < companyIds.length; i += chunkSize) {
    const chunk = companyIds.slice(i, i + chunkSize)
    try {
      const response = await hubspotClient.crm.companies.batchApi.read({
        inputs: chunk.map((id) => ({ id })),
        properties: [HS_PROPS.OVERGRAD_ID],
        propertiesWithHistory: [],
      })
      for (const company of response.results) {
        const overgradId = company.properties?.[HS_PROPS.OVERGRAD_ID]
        if (overgradId) companyOvergradMap.set(String(company.id), overgradId)
      }
    } catch {
      // skip chunk on error
    }
  }

  // Step 3: combine — deal → company → overgradId
  for (const [dealId, companyId] of dealToCompanyId) {
    const overgradId = companyOvergradMap.get(companyId)
    if (overgradId) dealToOvergradId.set(dealId, overgradId)
  }

  return dealToOvergradId
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
