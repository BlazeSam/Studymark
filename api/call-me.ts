import { buildCallScript, buildCallTask, type CallContext } from '../src/lib/callScript.js'

interface VercelRequest {
  method?: string
  body?: { phoneNumber: string; context: CallContext }
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

const PHONE_RE = /^\+?[0-9()\-.\s]{7,20}$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }

  const apiKey = process.env.BLAND_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'BLAND_API_KEY not configured' })
    return
  }

  const body = req.body
  const phoneNumber = body?.phoneNumber?.trim()
  if (!phoneNumber || !PHONE_RE.test(phoneNumber)) {
    res.status(400).json({ error: 'valid phoneNumber required' })
    return
  }
  if (!body?.context?.specializationName) {
    res.status(400).json({ error: 'context required' })
    return
  }

  const script = buildCallScript(body.context)
  const task = buildCallTask(script)

  const upstream = await fetch('https://api.bland.ai/v1/calls', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: apiKey,
    },
    body: JSON.stringify({
      phone_number: phoneNumber,
      task,
      // A soft, warm preset rather than Bland's default. Override with BLAND_VOICE to try another
      // ("June", "Paige", "Nat", "Derek", "Josh", "Florian") without a code change.
      voice: process.env.BLAND_VOICE || 'maya',
      // The script is fixed, so there is nothing for the model to be creative about.
      temperature: 0.3,
      background_track: 'none',
      // Without an owned number Bland dials from its shared pool, so the caller ID differs call to
      // call. Set BLAND_FROM_NUMBER (E.164) to a number owned by the Bland account to pin it.
      ...(process.env.BLAND_FROM_NUMBER ? { from: process.env.BLAND_FROM_NUMBER } : {}),
      wait_for_greeting: false,
      max_duration: 2,
      record: false,
    }),
  })

  if (!upstream.ok) {
    res.status(502).json({ error: 'call provider error' })
    return
  }

  const data = await upstream.json()
  res.status(200).json({ success: true, callId: data?.call_id ?? null, script })
}
