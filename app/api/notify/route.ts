import { NextResponse } from 'next/server'
import { placeVoiceCall, rateLimited, sendWhatsApp, twilioConfigured, voiceConfigured } from '@/lib/server/twilio'

export const runtime = 'nodejs'

interface Target {
  name: string
  phone: string
}

const PHONE = /^\+\d{10,15}$/

function waLink(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}

/**
 * POST { text, targets:[{name,phone}], callFirst?: boolean }
 * Sends a WhatsApp message to every target through Twilio. If Twilio is not configured (or a send
 * fails) the response carries ready-made wa.me links so the app can still help the user.
 */
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'local'
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: 'Too many alerts, please wait a minute.' }, { status: 429 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
  }

  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 600) : ''
  const targets: Target[] = (Array.isArray(body?.targets) ? body.targets : [])
    .map((t: any) => ({ name: String(t?.name || '').slice(0, 60), phone: String(t?.phone || '') }))
    .filter((t: Target) => PHONE.test(t.phone))
    .slice(0, 6)

  if (!text || targets.length === 0) {
    return NextResponse.json({ ok: false, error: 'No message or no valid phone numbers (use +91XXXXXXXXXX).', configured: twilioConfigured() })
  }

  const results: { name: string; whatsapp: 'sent' | 'failed' | 'not-configured'; call?: 'placed' | 'failed' | 'not-configured'; error?: string; link: string }[] = []

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]
    const row: (typeof results)[number] = { name: t.name, whatsapp: 'not-configured', link: waLink(t.phone, text) }
    if (twilioConfigured()) {
      try {
        await sendWhatsApp(t.phone, text)
        row.whatsapp = 'sent'
      } catch (e: any) {
        row.whatsapp = 'failed'
        row.error = String(e?.message || e).slice(0, 160)
      }
    }
    if (body?.callFirst && i === 0) {
      if (voiceConfigured()) {
        try {
          await placeVoiceCall(t.phone, text)
          row.call = 'placed'
        } catch (e: any) {
          row.call = 'failed'
          row.error = row.error || String(e?.message || e).slice(0, 160)
        }
      } else {
        row.call = 'not-configured'
      }
    }
    results.push(row)
  }

  return NextResponse.json({
    ok: results.some((r) => r.whatsapp === 'sent' || r.call === 'placed'),
    configured: twilioConfigured(),
    results,
  })
}
