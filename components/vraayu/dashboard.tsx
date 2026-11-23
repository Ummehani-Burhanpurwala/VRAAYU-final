'use client'

import { useState } from 'react'
import { AlertTriangle, Check, HeartHandshake, Leaf, Phone, Plus, Trash2 } from 'lucide-react'
import type { AppState, Lang, Mood, TaskKind } from '@/lib/types'
import { addNote, addReminder, fmt12, isDoneToday, removeNote, removeReminder, toggleReminderDone } from '@/lib/store'
import { kindMeta, tr } from './common'

interface Props {
  state: AppState
  update: (fn: (s: AppState) => AppState) => void
  onSOS: () => void
  onCheckIn: () => void
  onMood: (m: Mood) => void
}

export function DashboardView({ state, update, onSOS, onMood }: Props) {
  const [noteText, setNoteText] = useState('')
  const lang: Lang = state.settings.language
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('09:00')
  const [kind, setKind] = useState<TaskKind>('task')
  const sorted = [...state.reminders].sort((a, b) => a.time.localeCompare(b.time))
  const done = sorted.filter(isDoneToday).length

  return (
    <div className="page-view">
      <div className="section-intro">
        <div>
          <p className="eyebrow">{tr(lang, 'Daily Schedule & Routine', 'दैनिक कार्यक्रम', 'दैनिक वेळापत्रक')}</p>
          <h2>{tr(lang, 'Your daily overview', 'आज का आपका दिन', 'तुमचा आजचा दिवस')}</h2>
          <p>{tr(lang, 'Tap a task when it is done. Just say “remind me to … at 5 PM” to add one by voice.', 'काम पूरा होने पर टैप करें। बोलकर जोड़ें: “शाम 5 बजे … याद दिलाओ”।', 'काम झाल्यावर टॅप करा. बोलून जोडा: “5 वाजता … आठवण करा”.')}</p>
        </div>
        <span className="completion-badge"><Check /> {done}/{sorted.length} {tr(lang, 'completed', 'पूर्ण', 'पूर्ण')}</span>
      </div>

      <div className="emergency-card">
        <AlertTriangle />
        <div>
          <strong>{tr(lang, 'EMERGENCY ASSISTANCE', 'आपातकालीन सहायता', 'आपत्कालीन मदत')}</strong>
          <span>{tr(lang, 'Need immediate help or feeling unwell?', 'तुरंत मदद चाहिए या तबीयत ठीक नहीं?', 'तातडीची मदत हवी किंवा बरे वाटत नाही?')}</span>
        </div>
        <button onClick={onSOS}><Phone /> {tr(lang, 'Call for Help', 'मदद बुलाएँ', 'मदत बोलवा')}</button>
      </div>

      <div className="activity-card">
        <div className="card-heading">
          <h3>{tr(lang, "Today's Checklist", 'आज की सूची', 'आजची यादी')}</h3>
          <span>{tr(lang, 'Interactive', 'इंटरैक्टिव', 'परस्परसंवादी')}</span>
        </div>
        <div className="activity-list">
          {sorted.length === 0 && <p className="empty-note">{tr(lang, 'Nothing scheduled. Add a reminder below.', 'कुछ तय नहीं है। नीचे जोड़ें।', 'काही ठरलेले नाही. खाली जोडा.')}</p>}
          {sorted.map((r) => {
            const Icon = kindMeta[r.kind].icon
            const color = kindMeta[r.kind].color
            const isDone = isDoneToday(r)
            return (
              <div className="row-wrap" key={r.id}>
                <button className="activity-row" onClick={() => update((s) => toggleReminderDone(s, r.id))} aria-label={`Toggle ${r.title}`}>
                  <span className={`activity-dot ${color}`} />
                  <span className="activity-time">{fmt12(r.time)}</span>
                  <span className={`activity-icon ${color}`}><Icon /></span>
                  <span className="activity-copy">
                    <strong style={{ textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.75 : 1 }}>{r.title}</strong>
                    <small>{r.detail || kindLabel(r.kind)}</small>
                  </span>
                  {isDone ? <span className="done-check"><Check /></span> : <span style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid #d0d7e5' }} />}
                </button>
                <button className="icon-mini" aria-label={`Delete ${r.title}`} onClick={() => update((s) => removeReminder(s, r.id))}><Trash2 /></button>
              </div>
            )
          })}
        </div>

        <form
          className="mini-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim()) return
            update((s) => addReminder(s, title, time, kind))
            setTitle('')
          }}
        >
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr(lang, 'New reminder (e.g. Drink water)', 'नया रिमाइंडर (जैसे पानी पीना)', 'नवीन आठवण (उदा. पाणी पिणे)')} aria-label="Reminder title" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Reminder time" style={{ flex: '0 0 130px' }} />
          <select value={kind} onChange={(e) => setKind(e.target.value as TaskKind)} aria-label="Type" style={{ flex: '0 0 120px' }}>
            <option value="task">Task</option>
            <option value="medicine">Medicine</option>
            <option value="meal">Meal</option>
            <option value="walk">Walk</option>
            <option value="water">Water</option>
          </select>
          <button className="mini-btn" type="submit"><Plus size={16} /> {tr(lang, 'Add', 'जोड़ें', 'जोडा')}</button>
        </form>
      </div>

      <div className="activity-card" style={{ marginTop: 18 }}>
        <div className="card-heading"><h3>{tr(lang, 'How are you feeling today?', 'आज आप कैसा महसूस कर रहे हैं?', 'आज तुम्हाला कसे वाटत आहे?')}</h3></div>
        <div className="mood-row">
          <button className="mood-btn" onClick={() => onMood('good')}><span>😊</span>{tr(lang, 'Good', 'अच्छा', 'छान')}</button>
          <button className="mood-btn" onClick={() => onMood('okay')}><span>😐</span>{tr(lang, 'Okay', 'ठीक-ठाक', 'ठीक')}</button>
          <button className="mood-btn" onClick={() => onMood('low')}><span>😔</span>{tr(lang, 'Low', 'उदास', 'उदास')}</button>
        </div>
      </div>

      <div className="activity-card" style={{ marginTop: 18 }}>
        <div className="card-heading">
          <h3>{tr(lang, 'Yaad Rakho — my notes', 'याद रखो — मेरे नोट्स', 'लक्षात ठेवा — माझ्या नोंदी')}</h3>
          <span>{tr(lang, 'Say “remember that…”', 'बोलिए “याद रखना…”', 'म्हणा “लक्षात ठेव…”')}</span>
        </div>
        <div className="list-stack">
          {(state.notes ?? []).length === 0 && <p className="empty-note">{tr(lang, 'Nothing saved yet. Try: “Remember that my spectacles are on the table.”', 'अभी कुछ नहीं। बोलिए: “याद रखना चश्मा मेज़ पर है।”', 'अजून काही नाही. म्हणा: “लक्षात ठेव चष्मा टेबलावर आहे.”')}</p>}
          {[...(state.notes ?? [])].reverse().slice(0, 8).map((n) => (
            <div className="note-row" key={n.id}>
              <span>{n.text}<small>{new Date(n.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small></span>
              <button className="icon-mini" aria-label="Delete note" onClick={() => update((s) => removeNote(s, n.id))}><Trash2 /></button>
            </div>
          ))}
        </div>
        <form className="mini-form" onSubmit={(e) => { e.preventDefault(); if (!noteText.trim()) return; update((s) => addNote(s, noteText)); setNoteText('') }}>
          <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={tr(lang, 'Type a note…', 'नोट लिखें…', 'नोंद लिहा…')} aria-label="Note" />
          <button className="mini-btn" type="submit"><Plus size={16} /> {tr(lang, 'Save', 'सहेजें', 'जतन करा')}</button>
        </form>
      </div>
    </div>
  )
}

function kindLabel(k: TaskKind) {
  return { medicine: 'Medicine', meal: 'Meal', walk: 'Walk', water: 'Hydration', task: 'Task' }[k]
}

export function RightRail({ state, onSOS, onCheckIn }: Props) {
  const lang: Lang = state.settings.language
  const sorted = [...state.reminders].sort((a, b) => a.time.localeCompare(b.time))
  const pending = sorted.filter((r) => !isDoneToday(r)).slice(0, 4)
  const done = sorted.filter(isDoneToday).length
  const today = new Date().toDateString()
  const checked = state.events.some((e) => e.type === 'checkin' && new Date(e.at).toDateString() === today)

  return (
    <aside className="right-rail">
      <div className="quote-strip">
        <Leaf />
        <span>{tr(lang, '“Small steps every day bring great health.”', '“रोज़ के छोटे कदम बड़ी सेहत लाते हैं।”', '“रोजची छोटी पावले मोठे आरोग्य देतात.”')}</span>
      </div>

      <div className="rail-card dashboard-mini">
        <div className="card-heading">
          <h2>{tr(lang, 'Overview', 'सारांश', 'आढावा')}</h2>
          <span>{done}/{sorted.length} {tr(lang, 'Done', 'पूर्ण', 'पूर्ण')}</span>
        </div>
        <button className="mini-emergency" onClick={onSOS}>
          <AlertTriangle />
          <span><strong>{tr(lang, 'EMERGENCY', 'आपातकाल', 'आपत्काल')}</strong><small>{tr(lang, 'Alerts your family instantly', 'परिवार को तुरंत सूचना', 'कुटुंबाला त्वरित सूचना')}</small></span>
          <Phone />
        </button>
        <div className="mini-activity">
          <div className="card-heading"><h3>{tr(lang, 'Upcoming', 'आगामी', 'आगामी')}</h3></div>
          {pending.length === 0 && <p className="empty-note">{tr(lang, 'All done for today 🎉', 'आज सब पूरा 🎉', 'आज सर्व पूर्ण 🎉')}</p>}
          {pending.map((r) => (
            <div className="mini-row" key={r.id}>
              <span className={`activity-dot ${kindMeta[r.kind].color}`} />
              <span>{fmt12(r.time)}</span>
              <strong>{r.title}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="rail-card mood-card">
        <div className="card-heading">
          <h3>{tr(lang, 'Daily check-in', 'दैनिक चेक-इन', 'दैनिक चेक-इन')}</h3>
          <span className={`badge-soft ${checked ? 'ok' : ''}`}>{checked ? tr(lang, 'Done today', 'आज हो गया', 'आज झाले') : tr(lang, 'Pending', 'बाकी', 'बाकी')}</span>
        </div>
        <p style={{ margin: '8px 0 14px', color: 'var(--muted-navy)' }}>
          {tr(lang, 'Let your family know you are doing well today.', 'परिवार को बताएँ कि आप आज ठीक हैं।', 'आज तुम्ही ठीक आहात हे कुटुंबाला कळवा.')}
        </p>
        <button className="mini-btn" onClick={onCheckIn} disabled={checked} style={{ opacity: checked ? 0.6 : 1 }}>
          <HeartHandshake size={18} /> {tr(lang, "I'm doing fine today", 'मैं आज ठीक हूँ', 'मी आज ठीक आहे')}
        </button>
      </div>
    </aside>
  )
}
