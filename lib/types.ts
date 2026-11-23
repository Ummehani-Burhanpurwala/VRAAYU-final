// Shared types used by the browser UI and the API routes.

export type Lang = 'en' | 'hi' | 'mr'
export type Section = 'Home' | 'Dashboard' | 'Healthcare' | 'Live Connect' | 'Reports' | 'Settings'
export type FontSize = 'Comfortable' | 'Large' | 'Extra Large'
export type TaskKind = 'medicine' | 'meal' | 'walk' | 'water' | 'task'
export type ReadingKind = 'bp' | 'sugar' | 'weight' | 'pulse' | 'temp'
export type EventType = 'sos' | 'dose' | 'missed' | 'reading' | 'call' | 'message' | 'checkin' | 'task' | 'voice' | 'mood' | 'note'
export type Mood = 'good' | 'okay' | 'low'

export interface Contact {
  id: string
  name: string
  relation: string
  phone: string // E.164, e.g. +919175590920 (empty until the family adds it)
}

export interface Reminder {
  id: string
  kind: TaskKind
  title: string
  detail: string
  time: string // 24h "HH:MM"
  doneDate?: string // YYYY-MM-DD the task was last completed
  alertedDate?: string // YYYY-MM-DD the spoken reminder was last fired
  missedDate?: string // YYYY-MM-DD the family was told it was missed
}

export interface Reading {
  id: string
  kind: ReadingKind
  value: string // "128/82", "110", ...
  at: string // ISO time
}

export interface Appointment {
  id: string
  doctor: string
  date: string // YYYY-MM-DD
  time: string // "10:30"
  note: string
}

export interface Note {
  id: string
  text: string
  at: string // ISO time
}

export interface VEvent {
  id: string
  at: string // ISO time
  type: EventType
  text: string
}

export interface Profile {
  name: string
  city: string
  familyCode: string
  pin: string
  faceEnabled: boolean
  faceDescriptor?: number[] // numbers only, never a photo
}

export interface AppSettings {
  language: Lang
  fontSize: FontSize
  notifications: boolean
  voicePreference: string
  notifyFamily: boolean
}

export interface AppState {
  profile: Profile
  contacts: Contact[]
  reminders: Reminder[]
  readings: Reading[]
  appointments: Appointment[]
  events: VEvent[]
  notes: Note[]
  settings: AppSettings
}

// ---- Assistant contract (browser <-> /api/gemini) ----

export type AssistantAction =
  | { type: 'NAVIGATE'; section: Section }
  | { type: 'EMERGENCY' }
  | { type: 'CALL_CONTACT'; name: string }
  | { type: 'MESSAGE_FAMILY'; to: string; text: string }
  | { type: 'ADD_REMINDER'; title: string; time: string; kind?: TaskKind }
  | { type: 'MARK_DONE'; title: string }
  | { type: 'LOG_READING'; kind: ReadingKind; value: string }
  | { type: 'CHECK_IN' }
  | { type: 'REMEMBER'; text: string }
  | { type: 'MOOD'; mood: Mood }
  | { type: 'BREATHE' }
  | { type: 'PLAY_MUSIC'; query: string }
  | { type: 'STOP_MUSIC' }
  | { type: 'SET_FONT'; size: FontSize }
  | { type: 'SET_LANGUAGE'; language: Lang }

export interface AssistantContext {
  name: string
  city: string
  nowLocal: string // e.g. "Sunday 22 Nov 2026, 7:45 PM"
  contacts: { name: string; relation: string }[]
  reminders: { title: string; time: string; kind: TaskKind; doneToday: boolean }[]
  readings: { kind: ReadingKind; value: string; at: string }[]
  appointments: { doctor: string; date: string; time: string }[]
  notes: string[]
}

export interface AssistantResult {
  reply: string
  actions: AssistantAction[]
  suggestedReplies: string[]
  source: 'gemini' | 'groq' | 'engine'
  language: Lang
  note?: string // why Gemini was not used (for the status screen)
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}
