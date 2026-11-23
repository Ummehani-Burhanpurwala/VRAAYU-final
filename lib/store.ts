import type {
  Mood,
  Note,
  AppState,
  Appointment,
  Contact,
  Lang,
  Reading,
  ReadingKind,
  Reminder,
  TaskKind,
  VEvent,
  EventType,
} from './types'

export const STORAGE_KEY = 'vraayu.state.v2'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export const pad = (n: number) => String(n).padStart(2, '0')

export function dateStr(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function hhmm(d = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function minutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function fmt12(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${pad(m || 0)} ${suffix}`
}

function makeFamilyCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function daysAgo(n: number, h = 9, m = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

function inDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return dateStr(d)
}

/** Demo data so the app looks alive on first launch. Everything here is editable in the UI. */
export function defaultState(): AppState {
  const events: VEvent[] = []
  for (let i = 6; i >= 1; i--) {
    events.push({ id: uid(), at: daysAgo(i, 8, 5), type: 'dose', text: 'Took Morning vitamins' })
    events.push({ id: uid(), at: daysAgo(i, 9, 30), type: 'checkin', text: 'Daily check-in: feeling fine' })
    if (i !== 3) events.push({ id: uid(), at: daysAgo(i, 20, 10), type: 'dose', text: 'Took Blood pressure tablet' })
    if (i % 2 === 0) events.push({ id: uid(), at: daysAgo(i, 18, 20), type: 'call', text: 'Called Ananya Mehta' })
  }
  const readings: Reading[] = [
    { id: uid(), kind: 'bp', value: '132/86', at: daysAgo(5, 9, 0) },
    { id: uid(), kind: 'bp', value: '128/82', at: daysAgo(4, 9, 0) },
    { id: uid(), kind: 'bp', value: '134/88', at: daysAgo(3, 9, 0) },
    { id: uid(), kind: 'bp', value: '126/80', at: daysAgo(2, 9, 0) },
    { id: uid(), kind: 'bp', value: '124/80', at: daysAgo(1, 9, 0) },
    { id: uid(), kind: 'sugar', value: '112', at: daysAgo(2, 8, 0) },
    { id: uid(), kind: 'sugar', value: '108', at: daysAgo(1, 8, 0) },
  ]
  return {
    profile: {
      name: 'Kamala Mehta',
      city: 'Pune',
      familyCode: makeFamilyCode(),
      pin: '1234',
      faceEnabled: false,
    },
    contacts: [
      { id: uid(), name: 'Ananya Mehta', relation: 'Daughter', phone: '' },
      { id: uid(), name: 'Rohan Mehta', relation: 'Son', phone: '' },
    ],
    reminders: [
      { id: uid(), kind: 'medicine', title: 'Morning vitamins', detail: 'Vitamin D & calcium · after breakfast', time: '08:00' },
      { id: uid(), kind: 'meal', title: 'Lunch', detail: 'Balanced meal and some rest', time: '13:00' },
      { id: uid(), kind: 'walk', title: 'Gentle walk', detail: '20 minutes in fresh air', time: '16:30' },
      { id: uid(), kind: 'medicine', title: 'Blood pressure tablet', detail: 'Amlodipine 5mg · with water', time: '20:00' },
    ],
    readings,
    appointments: [
      { id: uid(), doctor: 'Dr. Priya Sharma', date: inDays(3), time: '10:30', note: 'Routine check-up (video visit)' },
    ],
    events,
    notes: [],
    settings: {
      language: 'en',
      fontSize: 'Comfortable',
      notifications: true,
      voicePreference: 'Auto',
      notifyFamily: true,
    },
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      const base = defaultState()
      return {
        ...base,
        ...parsed,
        profile: { ...base.profile, ...parsed.profile },
        settings: { ...base.settings, ...parsed.settings },
      }
    }
  } catch {
    /* ignore corrupted storage */
  }
  return defaultState()
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* storage may be full or blocked */
  }
}

/** What the family dashboard may see: everything except the face signature. */
export function publicState(state: AppState): AppState {
  return { ...state, profile: { ...state.profile, faceDescriptor: undefined, pin: '' } }
}

// ---------- pure update helpers (state in -> new state out) ----------

export function withEvent(state: AppState, type: EventType, text: string): AppState {
  const ev: VEvent = { id: uid(), at: new Date().toISOString(), type, text }
  return { ...state, events: [...state.events, ev].slice(-300) }
}

export function isDoneToday(r: Reminder): boolean {
  return r.doneDate === dateStr()
}

export function toggleReminderDone(state: AppState, id: string, done?: boolean): AppState {
  const r = state.reminders.find((x) => x.id === id)
  if (!r) return state
  const nextDone = done ?? !isDoneToday(r)
  const reminders = state.reminders.map((x) => (x.id === id ? { ...x, doneDate: nextDone ? dateStr() : undefined } : x))
  let next: AppState = { ...state, reminders }
  if (nextDone) {
    next = withEvent(next, r.kind === 'medicine' ? 'dose' : 'task', `${r.kind === 'medicine' ? 'Took' : 'Completed'} ${r.title}`)
  }
  return next
}

export function addReminder(state: AppState, title: string, time: string, kind: TaskKind = 'task', detail = ''): AppState {
  const r: Reminder = { id: uid(), kind, title: title.trim(), detail, time }
  return { ...state, reminders: [...state.reminders, r].sort((a, b) => a.time.localeCompare(b.time)) }
}

export function removeReminder(state: AppState, id: string): AppState {
  return { ...state, reminders: state.reminders.filter((r) => r.id !== id) }
}

export function addReading(state: AppState, kind: ReadingKind, value: string): AppState {
  const r: Reading = { id: uid(), kind, value: value.trim(), at: new Date().toISOString() }
  return withEvent({ ...state, readings: [...state.readings, r].slice(-200) }, 'reading', `Logged ${readingLabel(kind)} ${value.trim()}`)
}

export function addAppointment(state: AppState, a: Omit<Appointment, 'id'>): AppState {
  return { ...state, appointments: [...state.appointments, { ...a, id: uid() }].sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time)) }
}

export function removeAppointment(state: AppState, id: string): AppState {
  return { ...state, appointments: state.appointments.filter((a) => a.id !== id) }
}

export function upsertContact(state: AppState, c: Contact): AppState {
  const exists = state.contacts.some((x) => x.id === c.id)
  return { ...state, contacts: exists ? state.contacts.map((x) => (x.id === c.id ? c : x)) : [...state.contacts, c] }
}

export function removeContact(state: AppState, id: string): AppState {
  return { ...state, contacts: state.contacts.filter((c) => c.id !== id) }
}

export function addNote(state: AppState, text: string): AppState {
  const n: Note = { id: uid(), text: text.trim().slice(0, 300), at: new Date().toISOString() }
  return withEvent({ ...state, notes: [...(state.notes ?? []), n].slice(-60) }, 'note', 'Saved a note')
}

export function removeNote(state: AppState, id: string): AppState {
  return { ...state, notes: (state.notes ?? []).filter((n) => n.id !== id) }
}

export function addMood(state: AppState, mood: Mood): AppState {
  return withEvent(state, 'mood', `Mood today: ${mood}`)
}

/** How many of the last 3 days (including today) had a "low" mood entry. */
export function lowMoodDays(state: AppState): number {
  const days = new Set<string>()
  for (const e of state.events) {
    if (e.type === 'mood' && e.text.endsWith('low') && Date.now() - +new Date(e.at) < 3 * 86400000) days.add(dateStr(new Date(e.at)))
  }
  return days.size
}

// ---------- lookups & formatting ----------

export function readingLabel(kind: ReadingKind): string {
  return { bp: 'Blood pressure', sugar: 'Blood sugar', weight: 'Weight', pulse: 'Pulse', temp: 'Temperature' }[kind]
}

export function readingUnit(kind: ReadingKind): string {
  return { bp: 'mmHg', sugar: 'mg/dL', weight: 'kg', pulse: 'bpm', temp: '°F' }[kind]
}

/** Gentle, non-diagnostic range check used to alert the family. */
export function readingIsHigh(kind: ReadingKind, value: string): boolean {
  if (kind === 'bp') {
    const m = value.match(/(\d{2,3})\s*[/ ]\s*(\d{2,3})/)
    if (!m) return false
    return Number(m[1]) >= 160 || Number(m[2]) >= 100 || Number(m[1]) < 90
  }
  const n = parseFloat(value)
  if (Number.isNaN(n)) return false
  if (kind === 'sugar') return n >= 250 || n < 70
  if (kind === 'pulse') return n > 110 || n < 50
  if (kind === 'temp') return n >= 100.4
  return false
}

export function findContact(state: AppState, name: string): Contact | undefined {
  const q = name.toLowerCase().trim()
  if (!q) return undefined
  const rel: Record<string, string[]> = {
    daughter: ['daughter', 'beti', 'बेटी', 'मुलगी', 'मुलीला'],
    son: ['son', 'beta', 'बेटा', 'मुलगा', 'मुलाला'],
  }
  return (
    state.contacts.find((c) => c.name.toLowerCase() === q) ||
    state.contacts.find((c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase().split(' ')[0])) ||
    state.contacts.find((c) => {
      const r = c.relation.toLowerCase()
      return r === q || (rel[r]?.some((w) => q.includes(w)) ?? false)
    })
  )
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '')
  if (!digits) return ''
  if (digits.startsWith('+')) return digits
  if (digits.length === 10) return '+91' + digits
  if (digits.length === 12 && digits.startsWith('91')) return '+' + digits
  return '+' + digits
}

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(text)}`
}

export function langName(l: Lang): string {
  return { en: 'English', hi: 'Hindi', mr: 'Marathi' }[l]
}

/** Snapshot of the real data that is sent to Gemini so answers are never invented. */
export function buildContext(state: AppState) {
  const now = new Date()
  const nowLocal = now.toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  return {
    name: state.profile.name,
    city: state.profile.city,
    nowLocal,
    contacts: state.contacts.map((c) => ({ name: c.name, relation: c.relation })),
    reminders: state.reminders.map((r) => ({ title: r.title, time: r.time, kind: r.kind, doneToday: isDoneToday(r) })),
    readings: state.readings.slice(-6).map((r) => ({ kind: r.kind, value: r.value, at: r.at })),
    appointments: state.appointments.filter((a) => a.date >= dateStr()).slice(0, 3).map((a) => ({ doctor: a.doctor, date: a.date, time: a.time })),
    notes: (state.notes ?? []).slice(-15).map((n) => `${n.text} (saved ${new Date(n.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`),
  }
}
