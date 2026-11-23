import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'
import { twilioConfigured, voiceConfigured } from '@/lib/server/twilio'

export const runtime = 'nodejs'
export const maxDuration = 30

/** GET /api/health — shows exactly what is (and is not) configured. Never reveals secret values. */
export async function GET() {
  const key = process.env.GEMINI_API_KEY?.trim()
  const groq = process.env.GROQ_API_KEY?.trim()
  const status: any = {
    geminiKey: key ? 'set' : 'MISSING',
    gemini: 'not tested',
    groqBackup: groq ? 'set' : 'not set (optional free backup)',
    twilioWhatsApp: twilioConfigured() ? 'configured' : 'not configured (wa.me links used instead)',
    twilioVoiceCall: voiceConfigured() ? 'configured' : 'not configured',
    database: process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'server memory (demo)',
  }
  if (key) {
    const google = createGoogleGenerativeAI({ apiKey: key })
    const tried: string[] = []
    for (const m of [process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash']) {
      if (!m || tried.includes(m)) continue
      tried.push(m)
      try {
        const r = await generateText({ model: google(m), prompt: 'Reply with the single word OK', maxOutputTokens: 20, maxRetries: 0, abortSignal: AbortSignal.timeout(8000) })
        if (r.text) {
          status.gemini = `working with model "${m}"`
          break
        }
      } catch (e: any) {
        status.gemini = `failed (${m}): ${String(e?.message || e).slice(0, 140)}`
      }
    }
  }
  if (groq) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${groq}` }, signal: AbortSignal.timeout(6000) })
      status.groqBackup = res.ok ? 'working' : `failed (HTTP ${res.status})`
    } catch (e: any) {
      status.groqBackup = `failed (${String(e?.message || e).slice(0, 80)})`
    }
  }
  return NextResponse.json(status)
}
