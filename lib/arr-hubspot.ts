import { getAllStageLabels, getDealsForCompanies, getLineItemsForDeals } from './hubspot'
import { computeCompanyArr, isClosedWonStage, type CompanyArr } from './arr'

// Compute Finance-definition ARR for a set of HubSpot company IDs.
export async function computeArrForCompanies(companyIds: string[]): Promise<Map<string, CompanyArr>> {
  const result = new Map<string, CompanyArr>()
  if (companyIds.length === 0) return result

  const [stageLabels, dealsByCompany] = await Promise.all([
    getAllStageLabels(),
    getDealsForCompanies(companyIds),
  ])

  // Only fetch line items for deals that can count (closed-won, amount > 0)
  const candidateDealIds = [...dealsByCompany.values()]
    .flat()
    .filter((d) => isClosedWonStage(d.stageId, d.stageId ? stageLabels.get(d.stageId) : null) && (d.amount ?? 0) > 0)
    .map((d) => d.id)
  const lineItemsByDeal = await getLineItemsForDeals([...new Set(candidateDealIds)])

  const asOf = new Date()
  for (const companyId of companyIds) {
    const deals = dealsByCompany.get(companyId) ?? []
    result.set(companyId, computeCompanyArr(deals, lineItemsByDeal, stageLabels, asOf))
  }
  return result
}
