import { buildTranscriptParsePrompt, parseTranscriptResponse } from '../src/lib/transcriptParse.js'

interface VercelRequest {
  method?: string
  body?: { pdfBase64: string; knownCourseCodes: string[] }
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
    return
  }

  const body = req.body
  if (!body?.pdfBase64 || !body?.knownCourseCodes?.length) {
    res.status(400).json({ error: 'pdfBase64 and knownCourseCodes required' })
    return
  }

  const prompt = buildTranscriptParsePrompt(body.knownCourseCodes)

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: body.pdfBase64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })

  if (!upstream.ok) {
    // Pass the real reason through. Swallowing it here meant every failure — an oversized PDF, a
    // scanned page image, an expired key — surfaced to the student as the same shrug.
    const detail = await upstream.text().catch(() => '')
    console.error(`anthropic ${upstream.status}: ${detail.slice(0, 500)}`)
    res.status(502).json({
      error: 'upstream error',
      status: upstream.status,
      detail: detail.slice(0, 300),
    })
    return
  }

  const data = await upstream.json()
  const textBlock = data?.content?.find((block: { type: string }) => block.type === 'text')
  const text = textBlock?.text ?? ''
  const completedCourses = parseTranscriptResponse(text, body.knownCourseCodes)

  // A readable PDF with no recognisable courses is a different problem from an unreadable one, and
  // the student needs to be told which.
  res.status(200).json({ completedCourses, sawText: text.trim().length > 0 })
}
