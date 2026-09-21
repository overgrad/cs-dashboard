import { sendToChannel } from './slack'
import { CS_TEAM_CHANNEL, OG_SUCCESS_GROUP_ID } from './config'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Weekly reminder to #cs-team — replaces the per-account alerts that used to
// post to the channel directly. Individual signal now lives in the dashboard
// queue instead.
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
  return sendToChannel(CS_TEAM_CHANNEL, text, blocks)
}
