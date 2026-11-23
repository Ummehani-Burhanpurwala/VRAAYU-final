import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, type ModelMessage } from 'ai'
import { NextResponse } from 'next/server'
import { fallbackAssistant, defaultSuggestions } from '@/lib/assistant-fallback'
import { getNews, getWeather } from '@/lib/server/tools'
import type { AssistantAction, AssistantContext, AssistantResult, ChatTurn, Lang } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 30

const LANG_NAME: Record<Lang, string> = { en: 'English', hi: 'Hindi (Devanagari script)', mr: 'Marathi (Devanagari script)' }

/** Gemini models are tried in order; the first one that works is remembered. Override with GEMINI_MODEL. */
const MODEL_CANDIDATES = [process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'].filter(
  (m, i, a): m is string => Boolean(m) && a.indexOf(m) === i
)
let workingModel: string | null = null
const badModels = new Set<string>()

function getSystemPrompt(lang: Lang, ctx: AssistantContext): string {
  return `You are VRAAYU (वायु), a warm, patient, voice-first AI life assistant and companion for an older adult who may live alone.
You are NOT only a health bot: you help with ANYTHING a senior may ask by voice — reminders, medicines, calling or messaging family, weather, news, music and bhajans, daily routine, remembering things for them, relaxation, company and conversation, emergencies.

THE ELDER'S REAL DATA (use it; never invent medicines, contacts, times or notes):
${JSON.stringify(ctx)}
"notes" are things the elder asked you to remember. If they ask where something is or what they told you, answer ONLY from notes; if it is not there, say you do not have it yet.

HOW TO ANSWER
- Reply in ${LANG_NAME[lang]} unless the elder clearly speaks English, Hindi or Marathi — then answer in that language and set "language" accordingly.
- Speak like a caring grandchild: respectful ("आप"/"तुम्ही"), simple words, short sentences, at most 45 words. No markdown, no lists, no emojis.
- Be conversational and natural: answer what was actually asked, remember earlier turns, never repeat the same sentence twice. End with a gentle follow-up question when it keeps the chat going.
- SAFETY: never diagnose, prescribe, or change a dose. For comfort advice (rest, water, warm compress) add that a doctor should be consulted if it persists. Chest pain, a fall, severe breathlessness, confusion, or "help"/"emergency" => include the EMERGENCY action and calmly reassure.
- If they sound sad, lonely or anxious: comfort them warmly, add a MOOD action ("low") and offer a song, a chat, a breathing exercise or a call to family.
- Only promise what the actions below can really do.

OUTPUT: return ONLY one JSON object, no code fences, exactly:
{"reply": string, "language": "en"|"hi"|"mr", "actions": Action[], "suggestedReplies": string[]}
"suggestedReplies": 2-4 short things the elder might say next, in the reply language.

Action (use zero or more) is one of:
{"type":"NAVIGATE","section":"Home"|"Dashboard"|"Healthcare"|"Live Connect"|"Reports"|"Settings"}
{"type":"EMERGENCY"}                                  // alerts family by WhatsApp and opens the SOS screen
{"type":"CALL_CONTACT","name":"<exact contact name from data>"}   // opens the phone dialer
{"type":"MESSAGE_FAMILY","to":"<contact name or all>","text":"<WhatsApp text written as from ${ctx.name}>"}
{"type":"ADD_REMINDER","title":string,"time":"HH:MM 24h","kind":"medicine"|"meal"|"walk"|"water"|"task"}
{"type":"MARK_DONE","title":"<exact reminder title from data>"}  // elder says they took a tablet or finished a task
{"type":"LOG_READING","kind":"bp"|"sugar"|"weight"|"pulse"|"temp","value":"128/82"}
{"type":"CHECK_IN"}                                   // elder says they are fine today
{"type":"REMEMBER","text":"<short note, e.g. House keys are in the kitchen drawer>"}   // "remember that ..."
{"type":"MOOD","mood":"good"|"okay"|"low"}
{"type":"BREATHE"}                                    // starts a guided breathing exercise
{"type":"PLAY_MUSIC","query":"<search words, e.g. morning bhajan>"}   // starts calm in-app devotional music
{"type":"STOP_MUSIC"}
{"type":"SET_FONT","size":"Comfortable"|"Large"|"Extra Large"}
{"type":"SET_LANGUAGE","language":"en"|"hi"|"mr"}
{"type":"WEATHER","city":"<city, default ${ctx.city}>"}  // live data is fetched for you, then you answer
{"type":"NEWS"}                                         // live headlines are fetched for you, then you answer
When you use WEATHER or NEWS, set "reply" to a short placeholder; you will receive the data next.`
}

function sanitizeHistory(history: unknown): ChatTurn[] {
  const arr = Array.isArray(history) ? history : []
  const clean: ChatTurn[] = arr
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 800) }))
    .slice(-12)
  while (clean.length && clean[0].role !== 'user') clean.shift()
  return clean
}

interface Parsed {
  reply: string
  language?: Lang
  actions: AssistantAction[]
  suggestedReplies: string[]
}

function parseModelJson(text: string): Parsed | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const obj = JSON.parse(text.slice(start, end + 1))
    if (typeof obj.reply !== 'string' || !obj.reply.trim()) return null
    return {
      reply: obj.reply.replace(/\*\*/g, '').trim(),
      language: ['en', 'hi', 'mr'].includes(obj.language) ? obj.language : undefined,
      actions: Array.isArray(obj.actions) ? obj.actions.filter((a: any) => a && typeof a.type === 'string') : [],
      suggestedReplies: Array.isArray(obj.suggestedReplies) ? obj.suggestedReplies.filter((s: any) => typeof s === 'string').slice(0, 4) : [],
    }
  } catch {
    return null
  }
}

/** Google Gemini via the Vercel AI SDK. Fast: no retries, hard timeouts, "thinking" off for 2.5 models. */
async function callGemini(apiKey: string, system: string, messages: ModelMessage[]): Promise<string> {
  const google = createGoogleGenerativeAI({ apiKey })
  const all = workingModel ? [workingModel, ...MODEL_CANDIDATES.filter((m) => m !== workingModel)] : MODEL_CANDIDATES
  const started = Date.now()
  let lastError = 'no model available'
  for (const modelId of all.filter((m) => !badModels.has(m))) {
    if (Date.now() - started > 9000) break
    try {
      const result = await generateText({
        model: google(modelId),
        system,
        messages,
        maxOutputTokens: 500,
        temperature: 0.7,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(8000),
        ...(modelId.includes('2.5') ? { providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } } } : {}),
      })
      if (result.text?.trim()) {
        workingModel = modelId
        return result.text
      }
      lastError = `${modelId}: empty reply`
    } catch (e: any) {
      const msg = String(e?.message || e)
      lastError = `${modelId}: ${msg.slice(0, 160)}`
      console.warn('[VRAAYU] Gemini attempt failed ->', lastError)
      if (/not found|404|not supported|invalid model/i.test(msg)) badModels.add(modelId)
      if (/api key|API_KEY|permission|403|401|429|quota|exhausted|rate/i.test(msg)) break
    }
  }
  throw new Error(lastError)
}

/** Free backup brain: Groq (OpenAI-compatible REST, Llama 3.3). Used when Gemini is missing, rate-limited or down. */
async function callGroq(apiKey: string, system: string, messages: ModelMessage[]): Promise<string> {
  const model = process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile'
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, ...messages.map((m) => ({ role: m.role, content: String(m.content) }))],
    }),
  })
  const j: any = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Groq ${res.status}: ${String(j?.error?.message || '').slice(0, 140)}`)
  const text = j?.choices?.[0]?.message?.content
  if (!text) throw new Error('Groq: empty reply')
  return text
}

/** Gemini first, Groq second. Returns which one answered. */
async function callLLM(system: string, messages: ModelMessage[], notes: string[]): Promise<{ text: string; provider: 'gemini' | 'groq' }> {
  const gKey = process.env.GEMINI_API_KEY?.trim()
  const qKey = process.env.GROQ_API_KEY?.trim()
  if (gKey) {
    try {
      return { text: await callGemini(gKey, system, messages), provider: 'gemini' }
    } catch (e: any) {
      notes.push(String(e?.message || e).slice(0, 160))
    }
  } else {
    notes.push('GEMINI_API_KEY is not set on the server (add it in Vercel → Settings → Environment Variables, then Redeploy).')
  }
  if (qKey) {
    try {
      return { text: await callGroq(qKey, system, messages), provider: 'groq' }
    } catch (e: any) {
      notes.push(String(e?.message || e).slice(0, 160))
    }
  }
  throw new Error(notes.join(' | '))
}

export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 600) : ''
  if (!message) return NextResponse.json({ error: 'Please provide a message.' }, { status: 400 })
  const lang: Lang = ['en', 'hi', 'mr'].includes(body?.language) ? body.language : /[\u0900-\u097F]/.test(message) ? 'hi' : 'en'
  const ctx: AssistantContext = {
    name: String(body?.context?.name || 'friend').slice(0, 60),
    city: String(body?.context?.city || 'Pune').slice(0, 60),
    nowLocal: String(body?.context?.nowLocal || new Date().toLocaleString('en-IN')),
    contacts: Array.isArray(body?.context?.contacts) ? body.context.contacts.slice(0, 10) : [],
    reminders: Array.isArray(body?.context?.reminders) ? body.context.reminders.slice(0, 25) : [],
    readings: Array.isArray(body?.context?.readings) ? body.context.readings.slice(0, 8) : [],
    appointments: Array.isArray(body?.context?.appointments) ? body.context.appointments.slice(0, 4) : [],
    notes: Array.isArray(body?.context?.notes) ? body.context.notes.slice(0, 15).map((n: any) => String(n).slice(0, 300)) : [],
  }
  const history = sanitizeHistory(body?.history)
  const issues: string[] = []

  if (process.env.GEMINI_API_KEY?.trim() || process.env.GROQ_API_KEY?.trim()) {
    try {
      let system = getSystemPrompt(lang, ctx)
      let prefetched = false
      const wantsWeather = /weather|rain|temperature|मौसम|बारिश|हवामान|पाऊस|तापमान/i.test(message)
      const wantsNews = /\bnews\b|headline|समाचार|खबर|ख़बर|बातम्या/i.test(message)
      if (wantsWeather || wantsNews) {
        const live: string[] = []
        await Promise.all([
          wantsWeather ? getWeather(ctx.city).then((w) => live.push(w)).catch(() => {}) : null,
          wantsNews ? getNews(lang).then((n) => live.push(n)).catch(() => {}) : null,
        ])
        if (live.length) {
          prefetched = true
          system += `\n\nLIVE DATA FETCHED JUST NOW (use it to answer, speak the facts naturally, do NOT use WEATHER or NEWS actions):\n${live.join('\n')}`
        }
      }
      const messages: ModelMessage[] = [...history, { role: 'user', content: message }]
      const first = await callLLM(system, messages, issues)
      let parsed = parseModelJson(first.text)
      if (!parsed) parsed = { reply: first.text.replace(/```[a-z]*|```/g, '').replace(/\*\*/g, '').trim().slice(0, 500), actions: [], suggestedReplies: [] }

      const toolCalls = parsed.actions.filter((a: any) => a.type === 'WEATHER' || a.type === 'NEWS') as any[]
      if (toolCalls.length && !prefetched) {
        const facts: string[] = []
        for (const call of toolCalls) {
          try {
            facts.push(call.type === 'WEATHER' ? await getWeather(String(call.city || ctx.city)) : await getNews(parsed.language || lang))
          } catch (e: any) {
            facts.push(`(${call.type} lookup failed: ${String(e?.message || e)})`)
          }
        }
        try {
          const second = await callLLM(system, [...messages, { role: 'assistant', content: first.text }, { role: 'user', content: `TOOL RESULT (real, live data):\n${facts.join('\n')}\n\nNow give the final JSON reply for the elder using this data. Under 60 words, speak the facts naturally, no WEATHER or NEWS actions.` }], issues)
          parsed = parseModelJson(second.text) || { ...parsed, reply: facts.join(' ') }
        } catch {
          parsed = { ...parsed, reply: facts.join(' ') }
        }
      }

      const finalLang = parsed.language || lang
      const result: AssistantResult = {
        reply: parsed.reply,
        actions: parsed.actions.filter((a: any) => a.type !== 'WEATHER' && a.type !== 'NEWS'),
        suggestedReplies: parsed.suggestedReplies.length ? parsed.suggestedReplies : defaultSuggestions(finalLang),
        source: first.provider,
        language: finalLang,
        note: first.provider === 'groq' ? `Gemini unavailable, answered by Groq backup. ${issues.join(' | ')}`.slice(0, 220) : undefined,
      }
      return NextResponse.json(result)
    } catch (e: any) {
      console.error('[VRAAYU] AI unavailable, using fallback engine:', String(e?.message || e))
    }
  } else {
    issues.push('No AI key set (GEMINI_API_KEY or GROQ_API_KEY).')
  }

  const fb = await fallbackAssistant(message, lang, ctx)
  return NextResponse.json({ ...fb, note: issues.join(' | ').slice(0, 220) })
}
