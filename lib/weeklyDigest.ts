import { sendToChannel } from './slack'
import { CUSTOMER_SUCCESS_CHANNEL, OG_SUCCESS_GROUP_ID } from './config'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Weekly reminder to #customer_success, sent by the Monday run of /api/cron/daily.
// Replaces the per-account alerts that used to post to #cs-team — that signal now
// lives in the dashboard queue.
export async function sendWeeklyDigest() {
  const mention = `<!subteam^${OG_SUCCESS_GROUP_ID}>`
  const text = `reminder for ${mention} — log into the hub and check your queue for the week`
  const blocks = [
    {
      type: 'section' as const,
      text: {
        type: 'mrkdwn' as const,
        text: `reminder for ${mention} — log into <${APP_URL}|the hub> and check your queue for the week`,
      },
    },
  ]
  return sendToChannel(CUSTOMER_SUCCESS_CHANNEL, text, blocks)
}
