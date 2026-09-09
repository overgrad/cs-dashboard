import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAllDeals, getOwner, getContact, getCompanyContacts, getRenewalsPipelineInfo, getDealsWithLineItems, getCompanyData, getUnpaidInvoices, type CompanyData, type ContactInfo } from '@/lib/hubspot'
import { HS_PROPS, THRESHOLDS } from '@/lib/config'
import { computeArrForCompanies } from '@/lib/arr-hubspot'

type Deal = Awaited<ReturnType<typeof getAllDeals>>[number]

// Pick the deal closest to today, preferring upcoming over past renewals
function pickPrimaryDeal(deals: Deal[]): Deal {
  const now = Date.now()
  return deals.reduce((best, deal) => {
    const bestMs = best.properties[HS_PROPS.CLOSE_DATE]
      ? new Date(best.properties[HS_PROPS.CLOSE_DATE]!).getTime() : null
    const dealMs = deal.properties[HS_PROPS.CLOSE_DATE]
      ? new Date(deal.properties[HS_PROPS.CLOSE_DATE]!).getTime() : null
    const bestUpcoming = bestMs !== null && bestMs > now
    const dealUpcoming = dealMs !== null && dealMs > now
    if (dealUpcoming && !bestUpcoming) return deal
    if (!dealUpcoming && bestUpcoming) return best
    const bestDist = bestMs !== null ? Math.abs(bestMs - now) : Infinity
    const dealDist = dealMs !== null ? Math.abs(dealMs - now) : Infinity
    return dealDist < bestDist ? deal : best
  })
}

const EMPTY_COMPANY: Omit<CompanyData, 'companyId'> = {
  companyName: null,
  lifecycleStage: null,
  overgradId: null,
  wauEducators: null,
  studentsCompletedSetupPct: null,
  careerMilestoneCompletionPct: null,
  collegeMilestoneCompletionPct: null,
  commonAppLinking: null,
  lastDataUploadDate: null,
  onboardingCompletionDate: null,
  domain: null,
}

// Pick the best champion among a company's contacts: a counselor/director/principal-type
// title first, then whoever was most recently active in the product.
const CHAMPION_TITLE = /counsel|director|principal|coordinator|dean|superintendent|head/i
function pickCompanyContact(contacts: ContactInfo[]): ContactInfo | null {
  if (contacts.length === 0) return null
  const ts = (c: ContactInfo) => c.lastOvergradActivity?.getTime() ?? 0
  const titled = contacts.filter((c) => c.title && CHAMPION_TITLE.test(c.title)).sort((a, b) => ts(b) - ts(a))
  if (titled.length > 0) return titled[0]
  return [...contacts].sort((a, b) => ts(b) - ts(a))[0]
}

function championStatusFor(contact: ContactInfo | null, now: Date): string | null {
  if (!contact?.lastOvergradActivity) return null
  const days = (now.getTime() - contact.lastOvergradActivity.getTime()) / (1000 * 60 * 60 * 24)
  return days > THRESHOLDS.CHAMPION_DARK_DAYS ? 'gone_dark' : 'stable'
}

// POST /api/sync/hubspot — pulls all deals, groups by company, upserts one row per company
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const pipelineInfo = await getRenewalsPipelineInfo()
    const deals = await getAllDeals(pipelineInfo?.pipelineId)
    const dealIds = deals.map((d) => d.id)

    const [dealsWithLineItems, companyDataMap, unpaidInvoicesMap] = await Promise.all([
      getDealsWithLineItems(dealIds),
      getCompanyData(dealIds),
      getUnpaidInvoices(dealIds),
    ])

    // Group deals by company ID (orphan deals use their own deal ID as key)
    const companiesMap = new Map<string, { companyData: CompanyData; deals: Deal[] }>()
    for (const deal of deals) {
      const cd = companyDataMap.get(deal.id)
      const key = cd?.companyId ?? `deal_${deal.id}`
      if (!companiesMap.has(key)) {
        companiesMap.set(key, {
          companyData: cd ?? { companyId: key, ...EMPTY_COMPANY },
          deals: [],
        })
      }
      companiesMap.get(key)!.deals.push(deal)
    }

    // ARR per company, Finance definition (see lib/arr.ts)
    const customerCompanyIds = [...companiesMap.entries()]
      .filter(([, v]) => v.companyData.lifecycleStage === 'customer')
      .map(([id]) => id)
    const [arrByCompany, contactsByCompany] = await Promise.all([
      computeArrForCompanies(customerCompanyIds),
      getCompanyContacts(customerCompanyIds),
    ])
    const unmatchedProducts = new Set<string>()
    for (const a of arrByCompany.values()) for (const u of a.unmatchedProducts) unmatchedProducts.add(u)
    if (unmatchedProducts.size > 0) {
      console.warn(`[sync/hubspot] line items not in Finance product catalog (treated as non-ARR): ${[...unmatchedProducts].join(' | ')}`)
    }

    const ownerCache = new Map<string, { name: string; email: string | undefined } | null>()
    const syncedCompanyIds: string[] = []
    let synced = 0
    let skipped = 0
    let errors = 0
    const errorSamples: { company: string; error: string }[] = []

    for (const [companyId, { companyData, deals }] of companiesMap) {
      // Only sync confirmed customers — orphan deals and non-customers are excluded
      if (companyData.lifecycleStage !== 'customer') {
        skipped++
        continue
      }
      try {
        const primary = pickPrimaryDeal(deals)
        const p = primary.properties

        const ownerId = p[HS_PROPS.OWNER_ID] ?? ''
        if (!ownerCache.has(ownerId)) {
          ownerCache.set(ownerId, ownerId ? await getOwner(ownerId) : null)
        }
        const owner = ownerCache.get(ownerId) ?? null

        // Primary contact: the deal's contact, else the best contact on the company
        const companyContacts = contactsByCompany.get(companyId) ?? []
        const contactId = primary.associations?.contacts?.results?.[0]?.id
        const dealContact = contactId ? await getContact(contactId) : null
        const contact = dealContact ?? pickCompanyContact(companyContacts)

        // Educator activity comes from the product writing last_overgrad_activity onto contacts
        const now = new Date()
        const activityDates = [...companyContacts, ...(dealContact ? [dealContact] : [])]
          .map((c) => c.lastOvergradActivity)
          .filter((d): d is Date => !!d)
        const lastEducatorActivity = activityDates.length > 0
          ? new Date(Math.max(...activityDates.map((d) => d.getTime())))
          : null
        const championStatus = championStatusFor(contact, now)

        // Onboarding: 8-week grace window after the company's onboarding completion date
        const onboardingDate = companyData.onboardingCompletionDate
        const isOnboarding = onboardingDate
          ? now < new Date(onboardingDate.getTime() + 8 * 7 * 24 * 60 * 60 * 1000)
          : false

        const seatsRaw = p[HS_PROPS.TOTAL_LICENSED_SEATS]

        const companyUnpaid = deals
          .map((d) => unpaidInvoicesMap.get(d.id))
          .filter((u): u is NonNullable<typeof u> => !!u)
        const unpaidInvoiceCount = companyUnpaid.reduce((sum, u) => sum + u.count, 0)
        const unpaidInvoiceBalance = companyUnpaid.reduce((sum, u) => sum + u.balance, 0)
        const unpaidInvoiceDueDate = companyUnpaid.reduce<Date | null>((oldest, u) => {
          if (!u.oldestDueDate) return oldest
          if (!oldest || u.oldestDueDate < oldest) return u.oldestDueDate
          return oldest
        }, null)

        const arrInfo = arrByCompany.get(companyId) ?? null

        const fields = {
          hubspotId: primary.id,
          overgradId: companyData.overgradId,
          name: companyData.companyName ?? p[HS_PROPS.DEAL_NAME] ?? 'Unnamed',
          domain: companyData.domain,
          owner: owner?.name ?? null,
          ownerEmail: owner?.email ?? null,
          renewalDate: p[HS_PROPS.CLOSE_DATE] ? new Date(p[HS_PROPS.CLOSE_DATE]!) : null,
          dealStage: pipelineInfo?.stageMap.get(p[HS_PROPS.DEAL_STAGE] ?? '') ?? p[HS_PROPS.DEAL_STAGE] ?? null,
          arr: arrInfo ? arrInfo.currentArr : null,
          latestContractArr: arrInfo?.latestContractArr ?? null,
          latestContractEnd: arrInfo?.latestContractEnd ? new Date(arrInfo.latestContractEnd) : null,
          arrBreakdown: arrInfo ? JSON.parse(JSON.stringify(arrInfo)) : undefined,
          arrAsOf: arrInfo ? new Date() : null,
          primaryContact: contact?.name ?? null,
          contactEmail: contact?.email ?? null,
          hasLineItems: deals.some((d) => dealsWithLineItems.has(d.id)),
          unpaidInvoiceCount,
          unpaidInvoiceBalance,
          unpaidInvoiceDueDate,
          onboardingDate,
          isOnboarding,
          championStatus,
          lastEducatorActivity,
          totalLicensedSeats: seatsRaw ? parseInt(seatsRaw) : null,
          wauEducators: companyData.wauEducators,
          studentsCompletedSetupPct: companyData.studentsCompletedSetupPct,
          careerMilestoneCompletionPct: companyData.careerMilestoneCompletionPct,
          collegeMilestoneCompletionPct: companyData.collegeMilestoneCompletionPct,
          commonAppLinking: companyData.commonAppLinking,
          lastDataUploadDate: companyData.lastDataUploadDate,
        }

        const existing = await prisma.account.findUnique({ where: { companyId } })
        if (existing) {
          await prisma.account.update({ where: { companyId }, data: fields })
        } else {
          await prisma.account.create({ data: { companyId, ...fields } })
        }
        syncedCompanyIds.push(companyId)
        synced++
      } catch (err) {
        errors++
        const message = err instanceof Error ? err.message : String(err)
        const label = companyData.companyName ?? companyId
        console.error(`[sync/hubspot] ${label}: ${message}`)
        if (errorSamples.length < 10) errorSamples.push({ company: label, error: message.slice(0, 300) })
      }
    }

    // Remove companies no longer in the renewals pipeline, plus any old deal-keyed rows
    const deleted = await prisma.account.deleteMany({
      where: {
        OR: [
          { companyId: { notIn: syncedCompanyIds } },
          { companyId: null },
        ],
      },
    })

    return NextResponse.json({
      synced,
      skipped,
      errors,
      errorSamples,
      deleted: deleted.count,
      total: deals.length,
      companies: companiesMap.size,
      debug: {
        pipelineFound: !!pipelineInfo,
        pipelineId: pipelineInfo?.pipelineId ?? null,
        stageCount: pipelineInfo?.stageMap.size ?? 0,
        dealsWithCompany: companyDataMap.size,
        dealsWithOvergradId: [...companyDataMap.values()].filter((c) => c.overgradId).length,
        companiesWithCustomerLifecycle: [...companiesMap.values()].filter(
          (c) => c.companyData.lifecycleStage === 'customer',
        ).length,
        arrComputed: arrByCompany.size,
        arrUnmatchedProducts: [...unmatchedProducts],
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
