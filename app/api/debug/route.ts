import { NextResponse } from 'next/server'
import { hubspotClient, DEAL_PROPERTIES } from '@/lib/hubspot'

// GET /api/debug?dealName=Noble — inspect raw HubSpot associations for a deal
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const dealName = searchParams.get('dealName') ?? ''

  // Search for deal by name
  const searchResponse = await hubspotClient.crm.deals.searchApi.doSearch({
    filterGroups: [{
      filters: [{
        propertyName: 'dealname',
        operator: 'CONTAINS_TOKEN' as any,
        value: dealName,
      }]
    }],
    properties: DEAL_PROPERTIES,
    limit: 1,
    after: '0',
    sorts: [],
  })
  const deal = searchResponse.results[0]
  if (!deal) {
    return NextResponse.json({ error: `No deal found matching "${dealName}"` }, { status: 404 })
  }

  // Check line items via search
  let lineItemsForDeal = null
  try {
    const liSearch = await hubspotClient.crm.lineItems.searchApi.doSearch({
      filterGroups: [{
        filters: [{
          propertyName: 'associations.deal',
          operator: 'EQ' as any,
          value: deal.id,
        }]
      }],
      properties: ['name', 'amount'],
      limit: 5,
      after: '0',
      sorts: [],
    })
    lineItemsForDeal = { dealId: deal.id, count: liSearch.results.length, results: liSearch.results }
  } catch (e) {
    lineItemsForDeal = { error: String(e) }
  }

  // Check company associations + overgrad_id property
  let companyAssoc = null
  try {
    const assocRes = await hubspotClient.crm.associations.v4.batchApi.getPage(
      'deals',
      'companies',
      { inputs: [{ id: deal.id }] }
    )
    const companyId = assocRes.results?.[0]?.to?.[0]?.toObjectId
    let companyProps = null
    if (companyId) {
      try {
        const company = await hubspotClient.crm.companies.basicApi.getById(
          companyId,
          ['overgrad_id', 'name', 'domain']
        )
        companyProps = company.properties
      } catch (e2) {
        companyProps = { error: String(e2) }
      }
    }
    companyAssoc = { raw: assocRes.results, companyId, companyProps }
  } catch (e) {
    companyAssoc = { error: String(e) }
  }

  return NextResponse.json({
    id: deal.id,
    name: deal.properties.dealname,
    lineItemsForDeal,
    companyAssoc,
  })
}
