import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Shares the elder's data with the family dashboard (/family).
 *  - With SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set -> stored in the vraayu_state table (permanent).
 *  - Otherwise -> kept in server memory (fine for a demo, resets when the server restarts).
 * The 6-character family code acts as the shared secret. The face signature and PIN are never sent here.
 */
const CODE = /^[A-Z0-9]{6}$/
const mem = (globalThis as any).__vraayuMem || ((globalThis as any).__vraayuMem = new Map<string, { data: any; at: string }>())

const supa = () => {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return url && key ? { url: url.replace(/\/$/, ''), key } : null
}

// Legacy keys (eyJ...) are JWTs and also go in Authorization. New keys (sb_secret_...) are not JWTs: apikey only.
const authHeaders = (key: string): Record<string, string> =>
  key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` }

export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const code = String(body?.code || '').toUpperCase()
  if (!CODE.test(code) || typeof body?.state !== 'object' || !body.state) {
    return NextResponse.json({ ok: false, error: 'bad request' }, { status: 400 })
  }
  const raw = JSON.stringify(body.state)
  if (raw.length > 400_000) return NextResponse.json({ ok: false, error: 'too large' }, { status: 413 })

  const at = new Date().toISOString()
  const s = supa()
  if (s) {
    try {
      const res = await fetch(`${s.url}/rest/v1/vraayu_state`, {
        method: 'POST',
        headers: {
          ...authHeaders(s.key),
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify([{ id: code, data: body.state, updated_at: at }]),
      })
      if (res.ok) return NextResponse.json({ ok: true, persistence: 'supabase' })
      const detail = (await res.text()).slice(0, 160)
      mem.set(code, { data: body.state, at })
      return NextResponse.json({ ok: true, persistence: 'memory', warning: `Supabase: ${detail}` })
    } catch (e: any) {
      mem.set(code, { data: body.state, at })
      return NextResponse.json({ ok: true, persistence: 'memory', warning: String(e?.message || e).slice(0, 120) })
    }
  }
  mem.set(code, { data: body.state, at })
  return NextResponse.json({ ok: true, persistence: 'memory' })
}

export async function GET(request: Request) {
  const code = (new URL(request.url).searchParams.get('code') || '').toUpperCase()
  if (!CODE.test(code)) return NextResponse.json({ ok: false, error: 'Invalid code' }, { status: 400 })

  const s = supa()
  if (s) {
    try {
      const res = await fetch(`${s.url}/rest/v1/vraayu_state?id=eq.${code}&select=data,updated_at`, {
        headers: authHeaders(s.key),
        cache: 'no-store',
      })
      if (res.ok) {
        const rows = await res.json()
        if (rows?.[0]) return NextResponse.json({ ok: true, state: rows[0].data, updatedAt: rows[0].updated_at, persistence: 'supabase' })
      }
    } catch {
      /* fall through to memory */
    }
  }
  const hit = mem.get(code)
  if (!hit) return NextResponse.json({ ok: false, error: 'No data yet for this code. Open VRAAYU on the elder’s device first.' }, { status: 404 })
  return NextResponse.json({ ok: true, state: hit.data, updatedAt: hit.at, persistence: 'memory' })
}
