// Sentiment analysis via Claude API.
// Returns 'positive' | 'neutral' | 'negative' and a short summary.
// Requires ANTHROPIC_API_KEY env var; returns null if not configured.

export interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative'
  summary: string
}

export async function analyzeSentiment(
  accountName: string,
  notes: string[]
): Promise<SentimentResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || notes.length === 0) return null

  const combinedText = notes
    .slice(0, 5) // cap at 5 most recent notes to stay within context
    .join('\n\n---\n\n')

  const prompt = `You are analyzing customer success meeting notes for ${accountName}.

Based on the following meeting notes, determine the overall customer sentiment and write a 1–2 sentence summary of the account health from a CS perspective.

Meeting notes:
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
    const text = data.content?.[0]?.text ?? ''
    const parsed = JSON.parse(text) as SentimentResult
    if (!['positive', 'neutral', 'negative'].includes(parsed.sentiment)) return null
    return parsed
  } catch {
    return null
  }
}
