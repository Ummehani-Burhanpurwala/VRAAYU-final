'use client'

import { useState } from 'react'
import { CalendarDays, Check, HeartPulse, Pill, Plus, Sparkles, Trash2 } from 'lucide-react'
import type { AppState, Lang, ReadingKind } from '@/lib/types'
import { addAppointment, addReading, addReminder, dateStr, fmt12, isDoneToday, readingIsHigh, readingLabel, readingUnit, removeAppointment, removeReminder, toggleReminderDone } from '@/lib/store'
import { tr } from './common'

interface Props {
  state: AppState
  update: (fn: (s: AppState) => AppState) => void
  onReading: (kind: ReadingKind, value: string) => void
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <p className="empty-note">Add at least two readings to see a trend.</p>
  const min = Math.min(...values) - 5
  const max = Math.max(...values) + 5
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 300},${70 - ((v - min) / (max - min)) * 60}`)
  return (
    <svg className="spark" viewBox="0 0 300 80" preserveAspectRatio="none" role="img" aria-label="Trend chart">
      <polyline points={pts.join(' ')} fill="none" stroke="#dda43b" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={i} cx={p.split(',')[0]} cy={p.split(',')[1]} r="3.5" fill="#3d9f68" />)}
    </svg>
  )
}

export default function HealthcareView({ state, update, onReading }: Props) {
  const lang: Lang = state.settings.language
  const meds = state.reminders.filter((r) => r.kind === 'medicine').sort((a, b) => a.time.localeCompare(b.time))
  const takenCount = meds.filter(isDoneToday).length
  const score = meds.length ? Math.round((takenCount / meds.length) * 100) : 100

  const [mName, setMName] = useState('')
  const [mDose, setMDose] = useState('')
  const [mTime, setMTime] = useState('09:00')
  const [rKind, setRKind] = useState<ReadingKind>('bp')
  const [rValue, setRValue] = useState('')
  const [aDoc, setADoc] = useState('')
  const [aDate, setADate] = useState(dateStr())
  const [aTime, setATime] = useState('10:00')

  const bpReadings = state.readings.filter((r) => r.kind === 'bp')
  const systolic = bpReadings.slice(-8).map((r) => Number(r.value.split('/')[0])).filter((n) => !Number.isNaN(n))
  const latestOf = (k: ReadingKind) => [...state.readings].reverse().find((r) => r.kind === k)
  const upcoming = state.appointments.filter((a) => a.date >= dateStr())

  return (
    <div className="page-view">
      <div className="section-intro">
        <div>
          <p className="eyebrow">{tr(lang, 'Care Plan & Wellbeing', 'देखभाल योजना', 'काळजी योजना')}</p>
          <h2>{tr(lang, 'Your healthcare', 'आपका स्वास्थ्य', 'तुमचे आरोग्य')}</h2>
          <p>{tr(lang, 'Medicines, readings and appointments, all in one place and all by voice.', 'दवाइयाँ, रीडिंग और अपॉइंटमेंट, सब एक जगह और आवाज़ से।', 'औषधे, नोंदी आणि भेटी, सर्व एका जागी आणि आवाजाने.')}</p>
        </div>
        <div className="health-score">
          <HeartPulse />
          <div><strong>{score}</strong><span> / 100 {tr(lang, "Today's medicine score", 'आज का दवा स्कोर', 'आजचा औषध स्कोअर')}</span></div>
        </div>
      </div>

      <div className="health-grid">
        {/* Medicines */}
        <div className="info-card">
          <div className="card-heading"><h3>{tr(lang, 'Medication schedule', 'दवा का समय', 'औषधांचे वेळापत्रक')}</h3><Pill /></div>
          <div className="list-stack">
            {meds.length === 0 && <p className="empty-note">{tr(lang, 'No medicines added yet.', 'अभी कोई दवा नहीं जोड़ी।', 'अजून औषध जोडलेले नाही.')}</p>}
            {meds.map((m) => (
              <div className="med-row" key={m.id}>
                <span className="time-pill">{fmt12(m.time)}</span>
                <span><strong>{m.title}</strong><small>{m.detail || '1 tablet with water'}</small></span>
                <button className={`med-toggle-btn ${isDoneToday(m) ? 'taken' : ''}`} onClick={() => update((s) => toggleReminderDone(s, m.id))}>
                  <Check size={16} /> {isDoneToday(m) ? tr(lang, 'Taken', 'ली', 'घेतले') : tr(lang, 'Mark as Taken', 'ले ली', 'घेतले')}
                </button>
                <button className="icon-mini" aria-label={`Delete ${m.title}`} onClick={() => update((s) => removeReminder(s, m.id))}><Trash2 /></button>
              </div>
            ))}
          </div>
          <form className="mini-form" onSubmit={(e) => { e.preventDefault(); if (!mName.trim()) return; update((s) => addReminder(s, mName, mTime, 'medicine', mDose)); setMName(''); setMDose('') }}>
            <input value={mName} onChange={(e) => setMName(e.target.value)} placeholder={tr(lang, 'Medicine name', 'दवा का नाम', 'औषधाचे नाव')} aria-label="Medicine name" />
            <input value={mDose} onChange={(e) => setMDose(e.target.value)} placeholder={tr(lang, 'Dose (e.g. 5mg)', 'मात्रा (जैसे 5mg)', 'मात्रा (उदा. 5mg)')} aria-label="Dose" />
            <input type="time" value={mTime} onChange={(e) => setMTime(e.target.value)} style={{ flex: '0 0 130px' }} aria-label="Time" />
            <button className="mini-btn" type="submit"><Plus size={16} /> {tr(lang, 'Add', 'जोड़ें', 'जोडा')}</button>
          </form>
        </div>

        {/* Readings */}
        <div className="info-card">
          <div className="card-heading"><h3>{tr(lang, 'Health readings', 'स्वास्थ्य रीडिंग', 'आरोग्य नोंदी')}</h3><HeartPulse /></div>
          <div>
            {(['bp', 'sugar', 'pulse', 'weight', 'temp'] as ReadingKind[]).map((k) => {
              const r = latestOf(k)
              if (!r) return null
              const high = readingIsHigh(k, r.value)
              return <span key={k} className={`reading-chip ${high ? 'high' : ''}`}>{readingLabel(k)} <b>{r.value}</b> <small>{readingUnit(k)}</small></span>
            })}
          </div>
          <Spark values={systolic} />
          <small style={{ color: 'var(--muted-navy)' }}>{tr(lang, 'Blood pressure trend (top number)', 'ब्लड प्रेशर का रुझान (ऊपर की संख्या)', 'रक्तदाबाचा कल (वरचा आकडा)')}</small>
          <form className="mini-form" onSubmit={(e) => { e.preventDefault(); if (!rValue.trim()) return; onReading(rKind, rValue); setRValue('') }}>
            <select value={rKind} onChange={(e) => setRKind(e.target.value as ReadingKind)} aria-label="Reading type" style={{ flex: '0 0 140px' }}>
              {(['bp', 'sugar', 'pulse', 'weight', 'temp'] as ReadingKind[]).map((k) => <option key={k} value={k}>{readingLabel(k)}</option>)}
            </select>
            <input value={rValue} onChange={(e) => setRValue(e.target.value)} placeholder={rKind === 'bp' ? '128/82' : readingUnit(rKind)} aria-label="Value" />
            <button className="mini-btn" type="submit"><Plus size={16} /> {tr(lang, 'Save', 'सहेजें', 'जतन करा')}</button>
          </form>
        </div>

        {/* Appointments */}
        <div className="info-card">
          <div className="card-heading"><h3>{tr(lang, 'Appointments', 'अपॉइंटमेंट', 'भेटी')}</h3><CalendarDays /></div>
          <div className="list-stack">
            {upcoming.length === 0 && <p className="empty-note">{tr(lang, 'No upcoming appointments.', 'कोई अपॉइंटमेंट नहीं।', 'कोणतीही भेट नाही.')}</p>}
            {upcoming.map((a) => {
              const d = new Date(a.date + 'T00:00')
              return (
                <div className="appointment" key={a.id} style={{ margin: 0 }}>
                  <div className="date-box"><strong>{d.getDate()}</strong><span>{d.toLocaleString('en', { month: 'short' }).toUpperCase()}</span></div>
                  <span><strong>{a.doctor}</strong><small>{d.toLocaleString('en', { weekday: 'long' })} · {fmt12(a.time)}{a.note ? ` · ${a.note}` : ''}</small></span>
                  <button className="icon-mini" aria-label="Delete appointment" onClick={() => update((s) => removeAppointment(s, a.id))}><Trash2 /></button>
                </div>
              )
            })}
          </div>
          <form className="mini-form" onSubmit={(e) => { e.preventDefault(); if (!aDoc.trim()) return; update((s) => addAppointment(s, { doctor: aDoc.trim(), date: aDate, time: aTime, note: '' })); setADoc('') }}>
            <input value={aDoc} onChange={(e) => setADoc(e.target.value)} placeholder={tr(lang, 'Doctor / clinic', 'डॉक्टर / क्लिनिक', 'डॉक्टर / क्लिनिक')} aria-label="Doctor" />
            <input type="date" value={aDate} min={dateStr()} onChange={(e) => setADate(e.target.value)} aria-label="Date" style={{ flex: '0 0 150px' }} />
            <input type="time" value={aTime} onChange={(e) => setATime(e.target.value)} aria-label="Time" style={{ flex: '0 0 120px' }} />
            <button className="mini-btn" type="submit"><Plus size={16} /> {tr(lang, 'Add', 'जोड़ें', 'जोडा')}</button>
          </form>
        </div>

        <div className="info-card care-tip">
          <Sparkles />
          <div>
            <strong>{tr(lang, "Today's care tip", 'आज की सलाह', 'आजचा सल्ला')}</strong>
            <p>{tr(lang, 'A glass of water before each tablet helps it settle gently. VRAAYU shares general wellbeing tips only and never replaces your doctor.', 'हर गोली से पहले एक गिलास पानी पिएँ। VRAAYU केवल सामान्य सलाह देता है, डॉक्टर का विकल्प नहीं है।', 'प्रत्येक गोळीपूर्वी एक ग्लास पाणी प्या. VRAAYU फक्त सर्वसाधारण सल्ला देतो, डॉक्टरांचा पर्याय नाही.')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
