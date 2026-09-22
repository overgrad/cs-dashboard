import { prisma } from './prisma'
import { sendToChannel } from './slack'
import { APP_URL, CUSTOMER_SUCCESS_CHANNEL, OG_SUCCESS_GROUP_ID } from './config'

// Weekly reminder to #customer_success, sent by /api/cron/daily. Replaces the per-account
// alerts that used to post to #cs-team — that signal now lives in the dashboard queue.

// Monday 00:00 UTC of the week containing `now`.
function weekStart(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d
}

function postReminder() {
  const mention = `<!subteam^${OG_SUCCESS_GROUP_ID}>`
  const text = `reminder for ${mention} — log into the hub and check your queue for the week`
  const blocks = [
    {
      type: 'section' as const,
      text: {
        type: 'mrkdwn' as const,
        text: `reminder for ${mention} — log into <${APP_URL}/queue|the hub> and check your queue for the week`,
      },
    },
  ]
  return sendToChannel(CUSTOMER_SUCCESS_CHANNEL, text, blocks)
}

export type WeeklyReminderResult = 'posted' | 'already_sent' | 'weekend'

// Posts the reminder on the first weekday run of the week (normally Monday's), so a missed
// Monday is made up the next day. The week's row is claimed before posting, so overlapping
// or repeated runs post at most once; a failed post releases the claim for the next run.
export async function sendWeeklyReminderIfDue(now = new Date()): Promise<WeeklyReminderResult> {
  const day = now.getUTCDay()
  if (day === 0 || day === 6) return 'weekend'

  const week = weekStart(now)
  const { count } = await prisma.weeklyReminder.createMany({
    data: [{ weekStart: week }],
    skipDuplicates: true,
  })
  if (count === 0) return 'already_sent'

  try {
    const ts = await postReminder()
    await prisma.weeklyReminder.update({ where: { weekStart: week }, data: { slackMessageTs: ts } })
    return 'posted'
  } catch (err) {
    await prisma.weeklyReminder.delete({ where: { weekStart: week } }).catch(() => {})
    throw err
  }
}
