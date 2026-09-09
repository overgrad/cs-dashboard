// Sentiment analysis via Claude API.
// Returns 'positive' | 'neutral' | 'negative' and a short summary.
// Requires ANTHROPIC_API_KEY env var; returns null if not configured.

export interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative'
  summary: string
}

export async function analyzeSentiment(
  accountName: string,
  notes: string[],
  kind: 'meeting' | 'ticket' = 'meeting',
): Promise<SentimentResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || notes.length === 0) return null

  const combinedText = notes
    .slice(0, 5) // cap at 5 most recent notes to stay within context
    .join('\n\n---\n\n')

  const source = kind === 'ticket' ? 'support tickets' : 'meeting notes'
  const prompt = `You are analyzing customer success ${source} for ${accountName}.

Based on the following ${source}, determine the overall customer sentiment and write a 1–2 sentence summary of the account health from a CS perspective.

${kind === 'ticket' ? 'Support tickets' : 'Meeting notes'}:
${combinedText}

Respond with JSON only, in this exact format:
{"sentiment": "positive" | "neutral" | "negative", "summary": "..."}

Sentiment definitions:
- positive: customer is engaged, happy, seeing value, expanding usage
- neutral: relationship is fine but not particularly engaged; routine check-ins
- negative: customer is frustrated, at risk, seeing problems, or disengaged`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) return null

    const data = await response.json()
    const text: string = data.content?.[0]?.text ?? ''
    // Claude often wraps the JSON in a ```json fence — extract the object itself
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end === -1) return null
    const parsed = JSON.parse(text.slice(start, end + 1)) as SentimentResult
    if (!['positive', 'neutral', 'negative'].includes(parsed.sentiment)) return null
    return parsed
  } catch {
    return null
  }
}
