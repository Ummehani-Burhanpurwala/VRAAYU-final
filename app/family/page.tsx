'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, HeartPulse, Pill, RefreshCw } from 'lucide-react'
import type { AppState } from '@/lib/types'
import { dateStr, fmt12, readingIsHigh, readingLabel } from '@/lib/store'

const ICON: Record<string, string> = { sos: '🚨', dose: '💊', missed: '⚠️', reading: '🩺', call: '📞', message: '💬', checkin: '✅', task: '☑️', voice: '🎙️', mood: '🙂', note: '📝' }

export default function FamilyPage() {
  const [code, setCode] = useState('')
  const [input, setInput] = useState('')
  const [data, setData] = useState<{ state: AppState; updatedAt: string; persistence: string } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (c: string) => {
    if (!/^[A-Z0-9]{6}$/.test(c)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/state?code=${c}`, { cache: 'no-store' })
      const j = await res.json()
      if (j.ok) {
        setData({ state: j.state, updatedAt: j.updatedAt, persistence: j.persistence })
        setError('')
      } else {
        setData(null)
        setError(j.error || 'Could not load.')
      }
    } catch {
      setError('Network problem. Retrying…')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('code')?.toUpperCase()
    const saved = localStorage.getItem('vraayu.familyCode')
    const c = fromUrl || saved || ''
    if (c) {
      setCode(c)
      setInput(c)
      localStorage.setItem('vraayu.familyCode', c)
    }
  }, [])

  useEffect(() => {
    if (!code) return
    void load(code)
    const id = setInterval(() => void load(code), 8000)
    return () => clearInterval(id)
  }, [code, load])

  const s = data?.state
  const today = dateStr()
  const meds = s?.reminders.filter((r) => r.kind === 'medicine') ?? []
  const sosRecent = s?.events.filter((e) => e.type === 'sos' && Date.now() - +new Date(e.at) < 24 * 3600 * 1000).slice(-1)[0]
  const missedToday = s?.events.filter((e) => e.type === 'missed' && e.at.slice(0, 10) === today).length ?? 0
  const lastCheckin = s?.events.filter((e) => e.type === 'checkin').slice(-1)[0]
  const checkedToday = lastCheckin ? new Date(lastCheckin.at).toDateString() === new Date().toDateString() : false
  const lastMood = s?.events.filter((e) => e.type === 'mood').slice(-1)[0]
  const recent = s ? [...s.events].reverse().slice(0, 30) : []
  const bp = s?.readings.filter((r) => r.kind === 'bp').slice(-6) ?? []

  return (
    <main className="family-wrap">
      <div className="brand-lockup" style={{ marginBottom: 6 }}>
        <div className="brand-mark" aria-hidden="true"><span /><span /></div>
        <div><div className="brand-name">VRAAYU · Family</div><div className="brand-tagline">Caregiver dashboard — always with them</div></div>
      </div>

      <form className="mini-form" onSubmit={(e) => { e.preventDefault(); const c = input.trim().toUpperCase(); setCode(c); localStorage.setItem('vraayu.familyCode', c) }}>
        <input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} placeholder="Enter 6-character family code" maxLength={6} aria-label="Family code" style={{ letterSpacing: 4, fontWeight: 700, fontSize: 18 }} />
        <button className="mini-btn" type="submit"><RefreshCw size={16} /> {loading ? 'Loading…' : 'Connect'}</button>
      </form>
      {error && <p className="empty-note" style={{ color: 'var(--danger)' }}>{error}</p>}
      <p className="empty-note">Find the code in VRAAYU on the elder’s device: Settings → Family dashboard.</p>

      {s && (
        <>
          <h2 style={{ marginBottom: 4 }}>{s.profile.name}</h2>
          <small style={{ color: 'var(--muted-navy)' }}>Last update {new Date(data!.updatedAt).toLocaleString('en-IN')} · stored in {data!.persistence} · refreshes automatically</small>

          {sosRecent && (
            <div className="sos-alert"><AlertTriangle /> SOS pressed at {new Date(sosRecent.at).toLocaleString('en-IN')} — please call {s.profile.name.split(' ')[0]} now!</div>
          )}

          <div className="family-grid">
            <div className="info-card">
              <div className="card-heading"><h3>Today’s status</h3><HeartPulse /></div>
              <div className="list-stack">
                <div className="sos-row"><span>Daily check-in</span><span className={`badge-soft ${checkedToday ? 'ok' : 'warn'}`}>{checkedToday ? 'Done' : 'Not yet'}</span></div>
                <div className="sos-row"><span>Latest mood</span><span className={`badge-soft ${lastMood?.text.endsWith('low') ? 'warn' : 'ok'}`}>{lastMood ? lastMood.text.replace('Mood today: ', '') : '—'}</span></div>
                <div className="sos-row"><span>Medicines taken</span><span className="badge-soft ok">{meds.filter((m) => m.doneDate === today).length} / {meds.length}</span></div>
                <div className="sos-row"><span>Missed doses today</span><span className={`badge-soft ${missedToday ? 'warn' : 'ok'}`}>{missedToday}</span></div>
              </div>
            </div>

            <div className="info-card">
              <div className="card-heading"><h3>Medicines</h3><Pill /></div>
              <div className="list-stack">
                {meds.map((m) => (
                  <div className="sos-row" key={m.id}>
                    <span><strong>{m.title}</strong><br /><small>{fmt12(m.time)} · {m.detail}</small></span>
                    <span className={`badge-soft ${m.doneDate === today ? 'ok' : ''}`}>{m.doneDate === today ? <><Check size={13} /> Taken</> : 'Pending'}</span>
                  </div>
                ))}
                {meds.length === 0 && <p className="empty-note">No medicines set.</p>}
              </div>
            </div>

            <div className="info-card">
              <div className="card-heading"><h3>Health readings</h3><HeartPulse /></div>
              <div>
                {bp.map((r) => <span key={r.id} className={`reading-chip ${readingIsHigh('bp', r.value) ? 'high' : ''}`}>{new Date(r.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} <b>{r.value}</b></span>)}
                {s.readings.filter((r) => r.kind !== 'bp').slice(-4).map((r) => <span key={r.id} className={`reading-chip ${readingIsHigh(r.kind, r.value) ? 'high' : ''}`}>{readingLabel(r.kind)} <b>{r.value}</b></span>)}
                {s.readings.length === 0 && <p className="empty-note">No readings yet.</p>}
              </div>
            </div>

            <div className="info-card">
              <div className="card-heading"><h3>Emergency contacts</h3></div>
              <div className="list-stack">
                {s.contacts.map((c) => <div className="sos-row" key={c.id}><span><strong>{c.name}</strong> · {c.relation}</span>{c.phone && <a className="tel" href={`tel:${c.phone}`}>Call</a>}</div>)}
              </div>
            </div>
          </div>

          <div className="info-card" style={{ marginTop: 18 }}>
            <div className="card-heading"><h3>Activity timeline</h3></div>
            <div className="timeline">
              {recent.map((e) => (
                <div key={e.id}><span>{ICON[e.type] ?? '•'}</span><time>{new Date(e.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</time><span>{e.text}</span></div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  )
}
