// Minimal Twilio REST client (no SDK needed). Works with the free trial + WhatsApp sandbox.

export function twilioConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
}

export function voiceConfigured() {
  return twilioConfigured() && Boolean(process.env.TWILIO_PHONE_NUMBER)
}

async function twilioPost(path: string, params: Record<string, string>) {
  const sid = process.env.TWILIO_ACCOUNT_SID!
  const token = process.env.TWILIO_AUTH_TOKEN!
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || `Twilio error ${res.status}`)
  return data
}

export async function sendWhatsApp(to: string, body: string) {
  const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886' // Twilio sandbox number
  return twilioPost('Messages.json', { From: from, To: `whatsapp:${to}`, Body: body })
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function placeVoiceCall(to: string, message: string) {
  const twiml = `<Response><Pause length="1"/><Say voice="alice" language="en-IN">${esc(message)}</Say><Pause length="1"/><Say voice="alice" language="en-IN">${esc(message)}</Say></Response>`
  return twilioPost('Calls.json', { From: process.env.TWILIO_PHONE_NUMBER!, To: to, Twiml: twiml })
}

// Tiny in-memory rate limiter (per server instance) to stop accidental message storms.
const hits = new Map<string, number[]>()
export function rateLimited(key: string, max = 12, windowMs = 60_000): boolean {
  const now = Date.now()
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs)
  list.push(now)
  hits.set(key, list)
  return list.length > max
}
