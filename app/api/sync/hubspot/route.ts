import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAllDeals, getOwner, getContact, getRenewalsPipelineInfo, getDealsWithLineItems, getCompanyOvergradIds } from '@/lib/hubspot'
import { HS_PROPS } from '@/lib/config'

// POST /api/sync/hubspot — pulls all deals from HubSpot and upserts into accounts
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const pipelineInfo = await getRenewalsPipelineInfo()
    const deals = await getAllDeals(pipelineInfo?.pipelineId)
    const dealIds = deals.map((d) => d.id)
    const [dealsWithLineItems, companyOvergradIds] = await Promise.all([
      getDealsWithLineItems(dealIds),
      getCompanyOvergradIds(dealIds),
    ])
    const ownerCache = new Map<string, { name: string; email: string | undefined } | null>()

    const syncedHubspotIds: string[] = []
    let synced = 0
    let errors = 0

    for (const deal of deals) {
      try {
        const p = deal.properties
        const ownerId = p[HS_PROPS.OWNER_ID] ?? ''

        if (!ownerCache.has(ownerId)) {
          ownerCache.set(ownerId, ownerId ? await getOwner(ownerId) : null)
        }
        const owner = ownerCache.get(ownerId) ?? null

        const contactId = deal.associations?.contacts?.results?.[0]?.id
        const contact = contactId ? await getContact(contactId) : null

        const onboardingDateRaw = p[HS_PROPS.ONBOARDING_DATE]
        const onboardingDate = onboardingDateRaw ? new Date(onboardingDateRaw) : null
        const isOnboarding = onboardingDate
          ? new Date() < new Date(onboardingDate.getTime() + 8 * 7 * 24 * 60 * 60 * 1000)
          : false

        const lastDataUploadRaw = p[HS_PROPS.LAST_DATA_UPLOAD_DATE]
        const lastDataUploadDate = lastDataUploadRaw ? new Date(lastDataUploadRaw) : null

        const studentsSetupRaw = p[HS_PROPS.STUDENTS_COMPLETED_SETUP_PCT]
        const milestoneRaw = p[HS_PROPS.MILESTONE_COMPLETION_PCT]
        const seatsRaw = p[HS_PROPS.TOTAL_LICENSED_SEATS]

        const fields = {
          overgradId: companyOvergradIds.get(deal.id) ?? null,
          name: p[HS_PROPS.DEAL_NAME] ?? 'Unnamed',
          owner: owner?.name ?? null,
          ownerEmail: owner?.email ?? null,
          renewalDate: p[HS_PROPS.CLOSE_DATE] ? new Date(p[HS_PROPS.CLOSE_DATE]!) : null,
          dealStage: pipelineInfo?.stageMap.get(p[HS_PROPS.DEAL_STAGE] ?? '') ?? p[HS_PROPS.DEAL_STAGE] ?? null,
          arr: p[HS_PROPS.AMOUNT] ? parseFloat(p[HS_PROPS.AMOUNT]!) : null,
          primaryContact: contact?.name ?? null,
          contactEmail: contact?.email ?? null,
          hasLineItems: dealsWithLineItems.has(deal.id),
          onboardingDate,
          isOnboarding,
          lastDataUploadDate,
          studentsCompletedSetupPct: studentsSetupRaw ? parseFloat(studentsSetupRaw) : null,
          milestoneCompletionPct: milestoneRaw ? parseFloat(milestoneRaw) : null,
          totalLicensedSeats: seatsRaw ? parseInt(seatsRaw) : null,
        }

        await prisma.account.upsert({
          where: { hubspotId: deal.id },
          create: { hubspotId: deal.id, ...fields },
          update: fields,
        })
        syncedHubspotIds.push(deal.id)
        synced++
      } catch {
        errors++
      }
    }

    // Remove any accounts that are no longer in the Renewals Pipeline
    const deleted = await prisma.account.deleteMany({
      where: { hubspotId: { notIn: syncedHubspotIds } },
    })

    return NextResponse.json({
      synced,
      errors,
      deleted: deleted.count,
      total: deals.length,
      debug: {
        pipelineFound: !!pipelineInfo,
        pipelineId: pipelineInfo?.pipelineId ?? null,
        stageCount: pipelineInfo?.stageMap.size ?? 0,
        dealsWithCompany: companyOvergradIds.size,
        dealsWithOvergradId: [...companyOvergradIds.values()].filter(Boolean).length,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
