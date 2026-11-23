'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { AlertTriangle, BarChart3, Bell, Check, HeartPulse, Home, Menu, Phone, Settings, Sun, UsersRound, Volume2, X, CircleUserRound, type LucideIcon } from 'lucide-react'
import type { AppState, AssistantAction, AssistantResult, Contact, Lang, Mood, ReadingKind, Reminder, Section } from '@/lib/types'
import {
  addMood, addNote, addReading, addReminder, buildContext, dateStr, defaultState, findContact, fmt12, hhmm, isDoneToday, loadState, minutes, normalizePhone,
  publicState, readingIsHigh, readingLabel, saveState, toggleReminderDone, upsertContact, waLink, withEvent,
} from '@/lib/store'
import { AppLogo, tr } from '@/components/vraayu/common'
import FaceLock from '@/components/vraayu/face-lock'
import BreatheExercise from '@/components/vraayu/breathe'
import HomeView, { type AssistantState } from '@/components/vraayu/home'
import { DashboardView, RightRail } from '@/components/vraayu/dashboard'
import HealthcareView from '@/components/vraayu/healthcare'
import ConnectView from '@/components/vraayu/connect'
import ReportsView from '@/components/vraayu/reports'
import SettingsView from '@/components/vraayu/settings'

const navItems: { label: Section; icon: LucideIcon }[] = [
  { label: 'Home', icon: Home },
  { label: 'Dashboard', icon: BarChart3 },
  { label: 'Healthcare', icon: HeartPulse },
  { label: 'Live Connect', icon: UsersRound },
  { label: 'Reports', icon: BarChart3 },
  { label: 'Settings', icon: Settings },
]

const greeting = (lang: Lang, name: string) =>
  tr(
    lang,
    `Namaste ${name}! I am VRAAYU, your voice assistant. Tap the orb and tell me what you need: medicines, calls to family, reminders, weather, news or music.`,
    `नमस्ते ${name} जी! मैं VRAAYU हूँ, आपका आवाज़ वाला साथी। ऑर्ब दबाकर बताइए: दवा, परिवार को फोन, रिमाइंडर, मौसम, समाचार या संगीत।`,
    `नमस्कार ${name}! मी VRAAYU, तुमचा आवाजाचा साथीदार. ऑर्ब दाबून सांगा: औषध, कुटुंबाला फोन, आठवण, हवामान, बातम्या किंवा संगीत.`
  )

const defaultPrompts = (lang: Lang) =>
  ({
    en: ['What are my medicines today?', 'Call my daughter', 'What is the weather?', 'Play a bhajan'],
    hi: ['आज की मेरी दवाइयाँ?', 'बेटी को फोन करो', 'आज का मौसम?', 'भजन सुनाओ'],
    mr: ['आजची माझी औषधे?', 'मुलीला फोन करा', 'आजचे हवामान?', 'भजन लावा'],
  })[lang]

interface Msg { id: string; role: 'user' | 'assistant'; content: string; timestamp: string }
type NotifyResult = { ok: boolean; configured?: boolean; error?: string; results?: { name: string; whatsapp: string; call?: string; link: string; error?: string }[]; noPhone?: boolean }

export default function Page() {
  const [state, setState] = useState<AppState | null>(null)
  const [locked, setLocked] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [activeSection, setActiveSection] = useState<Section>('Home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [assistantState, setAssistantState] = useState<AssistantState>('idle')
  const [command, setCommand] = useState('')
  const [interimText, setInterimText] = useState('')
  const [lastResponse, setLastResponse] = useState('')
  const [source, setSource] = useState<'gemini' | 'groq' | 'engine' | null>(null)
  const [note, setNote] = useState('')
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(defaultPrompts('en'))
  const [messages, setMessages] = useState<Msg[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [media, setMedia] = useState<{ label: string; url: string } | null>(null)
  const [handsFree, setHandsFree] = useState(false)
  const [converse, setConverse] = useState(false)
  const [breathing, setBreathing] = useState(false)
  const [musicOn, setMusicOn] = useState(false)
  const [syncMode, setSyncMode] = useState('not synced yet')
  const [alertItem, setAlertItem] = useState<Reminder | null>(null)
  const [callTarget, setCallTarget] = useState<Contact | null>(null)
  const [callPhone, setCallPhone] = useState('')
  const [sos, setSos] = useState<{ phase: 'idle' | 'confirm' | 'sending' | 'done'; count: number; result?: NotifyResult | null; mapLink?: string }>({ phase: 'idle', count: 10 })
  const [, startTransition] = useTransition()

  const recognitionRef = useRef<any>(null)
  const wakeRef = useRef<any>(null)
  const converseRef = useRef(false)
  const breathingRef = useRef(false)
  const noSpeechCount = useRef(0)
  const prevAssistant = useRef<AssistantState>('idle')
  const stateRef = useRef<AppState | null>(null)
  const msgsRef = useRef<Msg[]>([])
  const askRef = useRef<(t: string) => void>(() => {})
  const listenRef = useRef<() => void>(() => {})
  const stateTick = useRef<() => void>(() => {})
  stateRef.current = state
  converseRef.current = converse
  breathingRef.current = breathing
  msgsRef.current = messages

  const lang: Lang = state?.settings.language ?? 'en'
  const langRef = useRef<Lang>(lang)
  langRef.current = lang

  const update = useCallback((fn: (s: AppState) => AppState) => setState((prev) => (prev ? fn(prev) : prev)), [])

  // ---------- load, persist, sync ----------
  useEffect(() => {
    const s = loadState()
    setState(s)
    setLocked(Boolean(s.profile.faceEnabled && s.profile.faceDescriptor?.length))
    const text = greeting(s.settings.language, s.profile.name.split(' ')[0])
    setLastResponse(text)
    setSuggestedPrompts(defaultPrompts(s.settings.language))
    setMessages([{ id: 'init', role: 'assistant', content: text, timestamp: 'Just now' }])
  }, [])

  useEffect(() => {
    if (!state) return
    saveState(state)
    const t = setTimeout(() => {
      fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: state.profile.familyCode, state: publicState(state) }) })
        .then((r) => r.json())
        .then((j) => setSyncMode(j.ok ? `${j.persistence}${j.warning ? ' (' + j.warning + ')' : ''}` : 'failed'))
        .catch(() => setSyncMode('offline'))
    }, 1200)
    return () => clearTimeout(t)
  }, [state])

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const load = () => window.speechSynthesis.getVoices()
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  // ---------- speech out ----------
  const speakReply = useCallback((text: string, langOverride?: Lang) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const voices = window.speechSynthesis.getVoices()
    const l = langOverride || langRef.current
    const pref = stateRef.current?.settings.voicePreference ?? 'Auto'
    let v: SpeechSynthesisVoice | null = null
    if (l === 'hi') v = voices.find((x) => x.lang.toLowerCase().startsWith('hi')) || null
    else if (l === 'mr') v = voices.find((x) => x.lang.toLowerCase().startsWith('mr')) || voices.find((x) => x.lang.toLowerCase().startsWith('hi')) || null
    if (!v && pref !== 'Auto' && l === 'en') v = voices.find((x) => x.name.toLowerCase().includes(pref.toLowerCase())) || null
    if (!v && l === 'en') v = voices.find((x) => x.lang === 'en-IN') || voices.find((x) => x.lang.startsWith('en')) || null
    if (v) {
      u.voice = v
      u.lang = v.lang
    } else u.lang = l === 'hi' ? 'hi-IN' : l === 'mr' ? 'mr-IN' : 'en-IN'
    u.rate = 0.88
    u.onstart = () => setAssistantState('speaking')
    u.onend = () => setAssistantState('idle')
    u.onerror = () => setAssistantState('idle')
    window.speechSynthesis.speak(u)
  }, [])

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setAssistantState('idle')
  }, [])

  // ---------- family alerts (WhatsApp via /api/notify) ----------
  const notifyFamily = useCallback(async (text: string, opts?: { callFirst?: boolean; only?: string }): Promise<NotifyResult> => {
    const s = stateRef.current
    if (!s) return { ok: false }
    const targets = s.contacts.filter((c) => c.phone && (!opts?.only || opts.only === 'all' || c.name === opts.only)).map((c) => ({ name: c.name, phone: c.phone }))
    if (targets.length === 0) return { ok: false, noPhone: true }
    try {
      const res = await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, targets, callFirst: opts?.callFirst }) })
      return (await res.json()) as NotifyResult
    } catch {
      return { ok: false, error: 'network', results: targets.map((t) => ({ name: t.name, whatsapp: 'failed', link: waLink(t.phone, text) })) }
    }
  }, [])

  const getLocation = (): Promise<string> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve('')
      const timer = setTimeout(() => resolve(''), 4000)
      navigator.geolocation.getCurrentPosition(
        (p) => { clearTimeout(timer); resolve(`https://maps.google.com/?q=${p.coords.latitude},${p.coords.longitude}`) },
        () => { clearTimeout(timer); resolve('') },
        { timeout: 3500, maximumAge: 60000 }
      )
    })

  // ---------- SOS ----------
  const openSOS = useCallback(() => setSos({ phase: 'confirm', count: 10 }), [])

  const sendSOS = useCallback(async () => {
    const s = stateRef.current
    if (!s) return
    setSos((p) => ({ ...p, phase: 'sending' }))
    const mapLink = await getLocation()
    const time = new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    const text = `🚨 EMERGENCY from VRAAYU: ${s.profile.name} pressed the SOS button at ${time}. ${mapLink ? 'Location: ' + mapLink : 'Location not available.'} Please call ${s.profile.name.split(' ')[0]} immediately.`
    update((st) => withEvent(st, 'sos', 'SOS pressed — family alerted'))
    const result = await notifyFamily(text, { callFirst: true })
    setSos({ phase: 'done', count: 0, result, mapLink })
    const msg = tr(langRef.current, 'Your emergency alert has been sent. Help is on the way. Please stay calm.', 'आपातकालीन सूचना भेज दी गई है। मदद आ रही है। शांत रहें।', 'आपत्कालीन सूचना पाठवली आहे. मदत येत आहे. शांत राहा.')
    setLastResponse(msg)
    speakReply(msg)
  }, [notifyFamily, speakReply, update])

  useEffect(() => {
    if (sos.phase !== 'confirm') return
    if (sos.count <= 0) { void sendSOS(); return }
    const t = setTimeout(() => setSos((p) => (p.phase === 'confirm' ? { ...p, count: p.count - 1 } : p)), 1000)
    return () => clearTimeout(t)
  }, [sos.phase, sos.count, sendSOS])

  // ---------- calling ----------
  const startCall = useCallback((c: Contact) => {
    setCallTarget(c)
    setCallPhone('')
    if (c.phone && /Android|iPhone|iPad/i.test(navigator.userAgent)) setTimeout(() => { window.location.href = `tel:${c.phone}` }, 900)
  }, [])

  const messageContact = useCallback(async (c: Contact, text?: string) => {
    const s = stateRef.current
    if (!s) return
    const body = text || `Thinking of you! Message from ${s.profile.name} via VRAAYU.`
    if (!c.phone) {
      setLastResponse(tr(langRef.current, `Please add ${c.name}'s phone number first (Live Connect).`, `पहले ${c.name} का नंबर जोड़ें (लाइव कनेक्ट)।`, `आधी ${c.name} यांचा नंबर जोडा (लाइव्ह कनेक्ट).`))
      setActiveSection('Live Connect')
      return
    }
    update((st) => withEvent(st, 'message', `Messaged ${c.name}`))
    const r = await notifyFamily(body, { only: c.name })
    const sent = r.results?.some((x) => x.whatsapp === 'sent')
    if (!sent && r.results?.[0]?.link) {
      window.open(r.results[0].link, '_blank', 'noopener')
      setLastResponse(tr(langRef.current, 'WhatsApp is open with your message ready. Press send.', 'WhatsApp आपके संदेश के साथ खुला है। भेजें दबाइए।', 'WhatsApp संदेशासह उघडले आहे. पाठवा दाबा.'))
    } else if (sent) {
      setLastResponse(tr(langRef.current, `Message sent to ${c.name} on WhatsApp.`, `${c.name} को WhatsApp पर संदेश भेज दिया।`, `${c.name} यांना WhatsApp वर संदेश पाठवला.`))
    }
  }, [notifyFamily, update])

  // ---------- check-in ----------
  const doCheckIn = useCallback(async () => {
    const s = stateRef.current
    if (!s) return
    update((st) => withEvent(st, 'checkin', 'Daily check-in: feeling fine'))
    const msg = tr(langRef.current, 'Thank you. Your check-in is saved and your family will know you are fine.', 'धन्यवाद। आपका चेक-इन दर्ज हो गया, परिवार को पता चल जाएगा।', 'धन्यवाद. तुमचा चेक-इन नोंदवला, कुटुंबाला कळेल.')
    setLastResponse(msg)
    speakReply(msg)
    if (s.settings.notifyFamily) void notifyFamily(`✅ ${s.profile.name} checked in on VRAAYU: feeling fine today.`)
  }, [notifyFamily, speakReply, update])

  // ---------- readings ----------
  const logReading = useCallback((kind: ReadingKind, value: string) => {
    const s = stateRef.current
    update((st) => addReading(st, kind, value))
    if (s && readingIsHigh(kind, value) && s.settings.notifyFamily) {
      void notifyFamily(`⚠️ ${s.profile.name}'s ${readingLabel(kind)} reading is ${value}, outside the usual range. Please check on them.`)
    }
  }, [notifyFamily, update])

  // ---------- mood ----------
  const doMood = useCallback((mood: Mood, speak: boolean) => {
    const s = stateRef.current
    if (!s) return
    const lowToday = s.events.some((e) => e.type === 'mood' && e.text.endsWith('low') && new Date(e.at).toDateString() === new Date().toDateString())
    update((st) => addMood(st, mood))
    if (speak) {
      const L = langRef.current
      const msg =
        mood === 'good'
          ? tr(L, 'Wonderful! I am so glad you are feeling good today.', 'बहुत बढ़िया! यह सुनकर अच्छा लगा कि आप आज अच्छा महसूस कर रहे हैं।', 'छान! तुम्हाला आज चांगले वाटत आहे हे ऐकून आनंद झाला.')
          : mood === 'okay'
          ? tr(L, 'Thank you for telling me. A little walk or a chat with family can lift the day.', 'बताने के लिए धन्यवाद। थोड़ी सैर या परिवार से बात दिन अच्छा कर सकती है।', 'सांगितल्याबद्दल धन्यवाद. थोडी फेरी किंवा कुटुंबाशी गप्पा दिवस छान करतील.')
          : tr(L, 'I am sorry you feel low. I am right here with you. Would you like music, a chat, a breathing exercise, or a call with family?', 'आप उदास हैं, यह जानकर दुख हुआ। मैं आपके साथ हूँ। संगीत, बातचीत, साँस का अभ्यास या परिवार को फोन?', 'तुम्ही उदास आहात याचे वाईट वाटते. मी सोबत आहे. संगीत, गप्पा, श्वासाचा सराव की कुटुंबाला फोन?')
      setLastResponse(msg)
      speakReply(msg)
    }
    if (mood === 'low' && !lowToday && s.settings.notifyFamily) {
      void notifyFamily(`💛 ${s.profile.name} said they are feeling low today. A call or message from you would help.`)
    }
  }, [notifyFamily, speakReply, update])

  // ---------- execute AI actions ----------
  const runActions = useCallback((actions: AssistantAction[]) => {
    const s = stateRef.current
    if (!s) return
    for (const a of actions) {
      switch (a.type) {
        case 'NAVIGATE':
          startTransition(() => setActiveSection(a.section))
          break
        case 'EMERGENCY':
          openSOS()
          break
        case 'CALL_CONTACT': {
          const c = findContact(s, a.name)
          if (c) startCall(c)
          break
        }
        case 'MESSAGE_FAMILY': {
          const targets = a.to === 'all' ? s.contacts : [findContact(s, a.to)].filter(Boolean) as Contact[]
          targets.forEach((c) => void messageContact(c, a.text))
          break
        }
        case 'ADD_REMINDER':
          if (/^\d{2}:\d{2}$/.test(a.time) && a.title) update((st) => addReminder(st, a.title, a.time, a.kind ?? 'task'))
          break
        case 'MARK_DONE': {
          const q = a.title.toLowerCase()
          const r = s.reminders.find((x) => !isDoneToday(x) && (x.title.toLowerCase() === q || x.title.toLowerCase().includes(q) || q.includes(x.title.toLowerCase())))
          if (r) update((st) => toggleReminderDone(st, r.id, true))
          break
        }
        case 'LOG_READING':
          if (a.value) logReading(a.kind, a.value)
          break
        case 'CHECK_IN':
          void doCheckIn()
          break
        case 'REMEMBER':
          if (a.text?.trim()) update((st) => addNote(st, a.text))
          break
        case 'MOOD':
          doMood(a.mood, false)
          break
        case 'BREATHE':
          setBreathing(true)
          break
        case 'STOP_MUSIC':
          setMusicOn(false)
          break
        case 'PLAY_MUSIC':
          setMusicOn(true)
          setMedia({ label: tr(langRef.current, 'More on YouTube', 'YouTube पर और सुनें', 'YouTube वर आणखी ऐका'), url: `https://www.youtube.com/results?search_query=${encodeURIComponent(a.query || 'bhajan')}` })
          break
        case 'SET_FONT':
          update((st) => ({ ...st, settings: { ...st.settings, fontSize: a.size } }))
          break
        case 'SET_LANGUAGE':
          update((st) => ({ ...st, settings: { ...st.settings, language: a.language } }))
          break
      }
    }
  }, [doCheckIn, doMood, logReading, messageContact, openSOS, startCall, update])

  // ---------- talk to the assistant ----------
  const askAssistant = useCallback(async (input: string) => {
    const text = input.trim()
    const s = stateRef.current
    if (!text || !s || assistantState === 'thinking') return
    if (converseRef.current && text.length < 30 && !/music|song|bhajan|गाना|संगीत|भजन|गाणे|गाणं/i.test(text) && /\b(stop|bye|goodbye|quiet|enough|that'?s all)\b|बस|रुको|बंद करो|अलविदा|थांबा|बंद करा/i.test(text)) {
      setConverse(false)
      const L = langRef.current
      const msg = tr(L, 'Okay, I will wait quietly. Tap the orb whenever you need me.', 'ठीक है, मैं शांत रहूँगा। ज़रूरत हो तो ऑर्ब दबाइए।', 'ठीक आहे, मी शांत राहीन. गरज असेल तेव्हा ऑर्ब दाबा.')
      setLastResponse(msg)
      speakReply(msg)
      return
    }
    stopSpeaking()
    setCommand('')
    setInterimText('')
    setMedia(null)
    setAssistantState('thinking')
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const history = msgsRef.current.filter((m) => m.id !== 'init').slice(-12).map((m) => ({ role: m.role, content: m.content }))
    setMessages((p) => [...p, { id: `u${Date.now()}`, role: 'user', content: text, timestamp: now }])
    try {
      const res = await fetch('/api/gemini', {
        signal: AbortSignal.timeout(20000),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, language: langRef.current, context: buildContext(s) }),
      })
      const data = (await res.json()) as AssistantResult
      if (!data.reply) throw new Error('empty')
      setLastResponse(data.reply)
      setSource(data.source)
      setNote(data.note || '')
      if (data.suggestedReplies?.length) setSuggestedPrompts(data.suggestedReplies)
      setMessages((p) => [...p, { id: `a${Date.now()}`, role: 'assistant', content: data.reply, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])
      setAssistantState('idle')
      if (data.actions?.length) runActions(data.actions)
      speakReply(data.reply, data.language)
    } catch {
      const msg = tr(langRef.current, 'I could not reach my server just now. Please check your internet and try again. I am still here with you.', 'अभी सर्वर से जुड़ नहीं पाया। कृपया इंटरनेट जाँचकर फिर कहें। मैं आपके साथ हूँ।', 'आत्ता सर्व्हरशी जोडले गेले नाही. कृपया इंटरनेट तपासून पुन्हा सांगा. मी सोबत आहे.')
      setLastResponse(msg)
      setAssistantState('idle')
      speakReply(msg)
    }
  }, [assistantState, runActions, speakReply, stopSpeaking])
  askRef.current = (t) => void askAssistant(t)

  // ---------- speech in ----------
  const getSR = () => (typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null)
  const srLang = (l: Lang) => (l === 'hi' ? 'hi-IN' : l === 'mr' ? 'mr-IN' : 'en-IN')

  const toggleListening = useCallback(() => {
    if (assistantState === 'listening') {
      recognitionRef.current?.stop()
      setAssistantState('idle')
      setInterimText('')
      return
    }
    stopSpeaking()
    if (wakeRef.current) {
      wakeRef.current._stop = true
      try { wakeRef.current.abort() } catch { /* ignore */ }
      wakeRef.current = null
    }
    const SR = getSR()
    if (!SR) {
      setLastResponse(tr(langRef.current, 'Voice input works best in Google Chrome or Edge. For now, please type your message below.', 'आवाज़ इनपुट Chrome या Edge में बेहतर चलता है। अभी नीचे लिखें।', 'आवाज इनपुट Chrome किंवा Edge मध्ये चांगला चालतो. आता खाली लिहा.'))
      return
    }
    try {
      const rec = new SR()
      rec.lang = srLang(langRef.current)
      rec.interimResults = true
      rec.continuous = false
      rec.onstart = () => {
        setAssistantState('listening')
        setInterimText(tr(langRef.current, 'Listening to your voice...', 'सुन रहा हूँ... बोलिए...', 'ऐकत आहे... बोला...'))
      }
      rec.onresult = (e: any) => {
        let interim = ''
        let final = ''
        for (let i = e.resultIndex; i < e.results.length; ++i) (e.results[i].isFinal ? (final += e.results[i][0].transcript) : (interim += e.results[i][0].transcript))
        if (interim) setInterimText(interim)
        if (final) {
          noSpeechCount.current = 0
          setInterimText('')
          setAssistantState('idle')
          askRef.current(final)
        }
      }
      rec.onerror = (e: any) => {
        setAssistantState('idle')
        setInterimText('')
        const L = langRef.current
        const err = e?.error
        const msg =
          err === 'not-allowed' || err === 'service-not-allowed'
            ? tr(L, 'Microphone is blocked. Click the lock icon next to the web address, allow Microphone, then try again.', 'माइक्रोफ़ोन बंद है। पता-पट्टी के लॉक आइकन पर क्लिक करके माइक्रोफ़ोन की अनुमति दें।', 'मायक्रोफोन बंद आहे. पत्त्याजवळील लॉक आयकॉनवर क्लिक करून मायक्रोफोनला परवानगी द्या.')
            : err === 'no-speech'
            ? tr(L, 'I did not hear anything. Tap the orb and speak a little closer.', 'कुछ सुनाई नहीं दिया। ऑर्ब दबाकर थोड़ा पास से बोलें।', 'काही ऐकू आले नाही. ऑर्ब दाबून थोडे जवळून बोला.')
            : err === 'audio-capture'
            ? tr(L, 'No microphone was found on this device.', 'इस डिवाइस में माइक्रोफ़ोन नहीं मिला।', 'या डिव्हाइसवर मायक्रोफोन सापडला नाही.')
            : err === 'network'
            ? tr(L, 'Voice recognition needs the internet. Please check your connection.', 'आवाज़ पहचान के लिए इंटरनेट चाहिए।', 'आवाज ओळखण्यासाठी इंटरनेट हवे.')
            : err === 'aborted'
            ? ''
            : tr(L, 'Voice input had a problem. Please try again or type your message.', 'आवाज़ इनपुट में दिक्कत हुई। फिर कोशिश करें या लिखें।', 'आवाज इनपुटमध्ये अडचण आली. पुन्हा प्रयत्न करा किंवा लिहा.')
        if (converseRef.current && err === 'no-speech') {
          noSpeechCount.current += 1
          if (noSpeechCount.current >= 2) {
            setConverse(false)
            noSpeechCount.current = 0
            setLastResponse(tr(L, 'I will wait quietly now. Tap the orb or press Live conversation when you want to talk again.', 'अब मैं शांत रहूँगा। फिर बात करनी हो तो ऑर्ब दबाइए।', 'आता मी शांत राहीन. पुन्हा बोलायचे तेव्हा ऑर्ब दाबा.'))
          } else setTimeout(() => listenRef.current(), 400)
          return
        }
        if (msg) setLastResponse(msg)
      }
      rec.onend = () => { setAssistantState((p) => (p === 'listening' ? 'idle' : p)); setInterimText('') }
      recognitionRef.current = rec
      rec.start()
    } catch {
      setAssistantState('idle')
    }
  }, [assistantState, stopSpeaking])
  listenRef.current = toggleListening

  // ---------- live conversation: after VRAAYU finishes speaking, listen again ----------
  useEffect(() => {
    const prev = prevAssistant.current
    prevAssistant.current = assistantState
    if (converse && prev === 'speaking' && assistantState === 'idle' && !locked && !breathing && sos.phase === 'idle' && !callTarget) {
      const t = setTimeout(() => { if (converseRef.current && !breathingRef.current) listenRef.current() }, 700)
      return () => clearTimeout(t)
    }
  }, [assistantState, converse, locked, breathing, sos.phase, callTarget])

  function toggleConverse() {
    if (converse) {
      setConverse(false)
      recognitionRef.current?.stop()
      stopSpeaking()
      return
    }
    noSpeechCount.current = 0
    setConverse(true)
    const L = langRef.current
    const msg = tr(L, 'Live chat is on. I am listening. Just talk to me, and say stop when you are done.', 'लाइव चैट चालू है। मैं सुन रहा हूँ। बोलिए, और पूरा होने पर "बस" कहिए।', 'लाइव्ह चॅट चालू आहे. मी ऐकत आहे. बोला, आणि झाल्यावर "बस" म्हणा.')
    setLastResponse(msg)
    speakReply(msg) // when this ends, the effect above starts listening
  }

  // ---------- hands-free "Hello Vraayu" ----------
  useEffect(() => {
    if (!handsFree || assistantState !== 'idle' || locked) return
    const SR = getSR()
    if (!SR) { setHandsFree(false); return }
    let stopped = false
    const rec = new SR()
    wakeRef.current = rec
    rec.continuous = true
    rec.interimResults = false
    rec.lang = srLang(lang)
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue
        const heard: string = e.results[i][0].transcript
        const m = heard.match(/(vraayu|vrayu|vayu|vaayu|varayu|viayu|वायु|वरायु|व्रायु|वराऊ|वाऊ|वायू)/i)
        if (m) {
          stopped = true
          try { rec.abort() } catch { /* ignore */ }
          const rest = heard.slice((m.index ?? 0) + m[0].length).replace(/^[\s,।.!?]+/, '')
          if (rest.length > 2) askRef.current(rest)
          else { setInterimText(tr(langRef.current, 'Yes, I am listening...', 'जी, मैं सुन रहा हूँ...', 'होय, मी ऐकत आहे...')); setTimeout(() => listenRef.current(), 250) }
          return
        }
      }
    }
    rec.onend = () => { if (!stopped && !rec._stop) try { rec.start() } catch { /* ignore */ } }
    rec.onerror = (e: any) => { if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') { stopped = true; setHandsFree(false) } }
    try { rec.start() } catch { /* ignore */ }
    return () => { stopped = true; rec._stop = true; try { rec.abort() } catch { /* ignore */ } }
  }, [handsFree, assistantState, lang, locked])

  // ---------- reminder scheduler + missed-dose family alerts ----------
  stateTick.current = () => {
    const s = stateRef.current
    if (!s || locked) return
    const now = new Date()
    const today = dateStr(now)
    const nowMin = minutes(hhmm(now))
    let toAlert: Reminder | null = null
    const missed: Reminder[] = []
    for (const r of s.reminders) {
      if (r.doneDate === today) continue
      const diff = nowMin - minutes(r.time)
      if (diff >= 0 && diff <= 180 && r.alertedDate !== today && !toAlert) toAlert = r
      if (r.kind === 'medicine' && diff >= 20 && diff <= 240 && r.missedDate !== today) missed.push(r)
    }
    if (!toAlert && missed.length === 0) return
    const alertId = (toAlert as Reminder | null)?.id
    const missedIds = missed.map((m) => m.id)
    update((st) => {
      let next: AppState = { ...st, reminders: st.reminders.map((r) => ({ ...r, ...(r.id === alertId ? { alertedDate: today } : {}), ...(missedIds.includes(r.id) ? { missedDate: today } : {}) })) }
      for (const m of missed) next = withEvent(next, 'missed', `Missed ${m.title} (due ${fmt12(m.time)})`)
      return next
    })
    if (toAlert) {
      const a = toAlert as Reminder
      setAlertItem(a)
      if (s.settings.notifications) speakReply(tr(langRef.current, `${s.profile.name.split(' ')[0]}, it is time for ${a.title}.`, `${s.profile.name.split(' ')[0]} जी, ${a.title} का समय हो गया है।`, `${s.profile.name.split(' ')[0]}, ${a.title} ची वेळ झाली आहे.`))
    }
    if (missed.length && s.settings.notifyFamily) {
      void notifyFamily(`⚠️ ${s.profile.name} has not marked ${missed.map((m) => m.title).join(', ')} as taken yet (due ${fmt12(missed[0].time)}). Please remind them.`)
    }
  }
  useEffect(() => {
    if (!state) return
    const id = setInterval(() => stateTick.current(), 15000)
    const first = setTimeout(() => stateTick.current(), 2500)
    return () => { clearInterval(id); clearTimeout(first) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state !== null])

  // ---------- language ----------
  function handleLanguageChange(l: Lang) {
    update((st) => ({ ...st, settings: { ...st.settings, language: l } }))
    setSuggestedPrompts(defaultPrompts(l))
    const g = greeting(l, (stateRef.current?.profile.name || '').split(' ')[0])
    setLastResponse(g)
    setSource(null)
    speakReply(g, l)
  }

  function previewVoice() {
    speakReply(tr(lang, 'Hello! This is how VRAAYU sounds. I hope it feels clear and pleasant.', 'नमस्ते! यह VRAAYU की आवाज़ है। उम्मीद है यह स्पष्ट और अच्छी लग रही है।', 'नमस्कार! हा VRAAYU चा आवाज आहे. स्पष्ट आणि छान वाटेल अशी आशा.'))
  }

  const fontClass = useMemo(() => `font-${(state?.settings.fontSize ?? 'Comfortable').toLowerCase().replace(' ', '-')}`, [state?.settings.fontSize])

  if (!state) return <main className="vraayu-app" aria-busy="true" />

  if (locked) {
    return <FaceLock mode="unlock" lang={lang} descriptor={state.profile.faceDescriptor} pin={state.profile.pin} onUnlocked={() => setLocked(false)} />
  }

  const pendingCount = state.reminders.filter((r) => !isDoneToday(r)).length

  return (
    <main className={`vraayu-app ${fontClass}`}>
      {alertItem && (
        <div className="reminder-banner" role="alertdialog" aria-live="assertive">
          <Bell />
          <div>
            <strong>{alertItem.title}</strong>
            <small>{fmt12(alertItem.time)} · {alertItem.detail || tr(lang, 'It is time', 'समय हो गया', 'वेळ झाली')}</small>
          </div>
          <div className="actions">
            <button className="mini-btn" onClick={() => { update((s) => toggleReminderDone(s, alertItem.id, true)); setAlertItem(null); stopSpeaking() }}>
              <Check size={16} /> {alertItem.kind === 'medicine' ? tr(lang, 'I took it', 'ले ली', 'घेतले') : tr(lang, 'Done', 'हो गया', 'झाले')}
            </button>
            <button className="mini-btn ghost" onClick={() => { setAlertItem(null); stopSpeaking() }}>{tr(lang, 'Later', 'बाद में', 'नंतर')}</button>
          </div>
        </div>
      )}

      {menuOpen && <div className="sidebar-backdrop" role="presentation" onClick={() => setMenuOpen(false)} />}

      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <button className="mobile-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X /></button>
        <div className="sidebar-top"><AppLogo /></div>
        <nav aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activeSection === label ? 'active' : ''}`} onClick={() => { setActiveSection(label); setMenuOpen(false) }}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="couple-illustration" aria-hidden="true"><div className="person person-one" /><div className="person person-two" /></div>
          <p>A Safer<br />Kinder<br />Brighter Tomorrow <span>♡</span></p>
        </div>
      </aside>

      <section className="app-main">
        <header className="topbar">
          <div className="topbar-title">
            <button className="menu-button" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu /></button>
            <h1>{activeSection}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="lang-selector-group" role="radiogroup" aria-label="Select Language">
              <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => handleLanguageChange('en')} aria-label="English">EN</button>
              <button className={`lang-btn ${lang === 'hi' ? 'active' : ''}`} onClick={() => handleLanguageChange('hi')} aria-label="हिंदी (Hindi)">हिंदी</button>
              <button className={`lang-btn ${lang === 'mr' ? 'active' : ''}`} onClick={() => handleLanguageChange('mr')} aria-label="मराठी (Marathi)">मराठी</button>
            </div>
            <div className="welcome">
              <Sun aria-hidden="true" />
              <div>
                <strong>{tr(lang, 'Good Day,', 'शुभ दिन,', 'शुभ दिवस,')}</strong>
                <span>{state.profile.name.split(' ')[0]}</span>
              </div>
              <div className="avatar"><CircleUserRound aria-hidden="true" /></div>
            </div>
          </div>
        </header>

        <div className="content-grid">
          <div className="center-column">
            {activeSection === 'Home' && (
              <HomeView
                state={state}
                assistantState={assistantState}
                command={command}
                setCommand={setCommand}
                interimText={interimText}
                lastResponse={lastResponse}
                source={source}
                note={note}
                suggestedPrompts={suggestedPrompts}
                media={media}
                handsFree={handsFree}
                onToggleHandsFree={() => setHandsFree((v) => !v)}
                converse={converse}
                musicOn={musicOn}
                onToggleMusic={() => setMusicOn((v) => !v)}
                onToggleConverse={toggleConverse}
                onBreathe={() => setBreathing(true)}
                onCommand={(t) => void askAssistant(t)}
                onListen={toggleListening}
                onStopSpeaking={stopSpeaking}
                onReplay={() => speakReply(lastResponse)}
                onOpenHistory={() => setShowHistory(true)}
                setActiveSection={setActiveSection}
              />
            )}
            {activeSection === 'Dashboard' && <DashboardView state={state} update={update} onSOS={openSOS} onCheckIn={doCheckIn} onMood={(m) => doMood(m, true)} />}
            {activeSection === 'Healthcare' && <HealthcareView state={state} update={update} onReading={logReading} />}
            {activeSection === 'Live Connect' && <ConnectView state={state} update={update} onCall={startCall} onMessage={(c) => void messageContact(c)} />}
            {activeSection === 'Reports' && <ReportsView state={state} />}
            {activeSection === 'Settings' && (
              <SettingsView
                state={state}
                update={update}
                onLanguageChange={handleLanguageChange}
                onPreviewVoice={previewVoice}
                onEnrollFace={() => setEnrolling(true)}
                onResetDemo={() => { const d = defaultState(); setState({ ...d, profile: { ...d.profile, familyCode: state.profile.familyCode } }) }}
                syncMode={syncMode}
              />
            )}
          </div>

          {(activeSection === 'Home' || activeSection === 'Dashboard') && <RightRail state={state} update={update} onSOS={openSOS} onCheckIn={doCheckIn} onMood={(m) => doMood(m, true)} />}
        </div>
      </section>

      {breathing && (
        <BreatheExercise
          lang={lang}
          onSpeak={(t) => speakReply(t)}
          onClose={() => { setBreathing(false); stopSpeaking() }}
          onFinished={() => update((st) => withEvent(st, 'task', 'Completed a breathing exercise'))}
        />
      )}

      {enrolling && (
        <FaceLock
          mode="enroll"
          lang={lang}
          pin={state.profile.pin}
          onCancel={() => setEnrolling(false)}
          onUnlocked={() => setEnrolling(false)}
          onEnrolled={(d) => {
            update((st) => ({ ...st, profile: { ...st.profile, faceEnabled: true, faceDescriptor: d } }))
            setEnrolling(false)
            speakReply(tr(lang, 'Face unlock is ready.', 'फेस अनलॉक तैयार है।', 'फेस अनलॉक तयार आहे.'))
          }}
        />
      )}

      {/* SOS modal: countdown -> sending -> result with one-tap fallbacks */}
      {sos.phase !== 'idle' && (
        <div className="modal-backdrop" role="presentation">
          <div className="emergency-modal" role="dialog" aria-modal="true" aria-labelledby="sos-title" onClick={(e) => e.stopPropagation()}>
            <div className="danger-icon"><AlertTriangle /></div>
            {sos.phase === 'confirm' && (
              <>
                <h2 id="sos-title">{tr(lang, 'Sending emergency alert in', 'आपातकालीन सूचना भेजी जाएगी', 'आपत्कालीन सूचना पाठवली जाईल')}</h2>
                <div className="countdown">{sos.count}</div>
                <p>{tr(lang, 'Your family gets a WhatsApp message with your location. Press “I am okay” to cancel.', 'परिवार को आपकी लोकेशन के साथ WhatsApp संदेश जाएगा। रद्द करने के लिए “मैं ठीक हूँ” दबाएँ।', 'कुटुंबाला तुमच्या लोकेशनसह WhatsApp संदेश जाईल. रद्द करण्यासाठी “मी ठीक आहे” दाबा.')}</p>
                <div className="modal-actions">
                  <button className="button-secondary" onClick={() => setSos({ phase: 'idle', count: 10 })}>{tr(lang, 'I am okay', 'मैं ठीक हूँ', 'मी ठीक आहे')}</button>
                  <button className="button-danger" onClick={() => void sendSOS()}><Phone /> {tr(lang, 'Send help now', 'अभी मदद भेजें', 'आत्ताच मदत पाठवा')}</button>
                </div>
              </>
            )}
            {sos.phase === 'sending' && <h2 id="sos-title">{tr(lang, 'Alerting your family…', 'परिवार को सूचित कर रहा हूँ…', 'कुटुंबाला कळवत आहे…')}</h2>}
            {sos.phase === 'done' && (
              <>
                <h2 id="sos-title">{tr(lang, 'Alert sent. Stay calm.', 'सूचना भेज दी गई। शांत रहें।', 'सूचना पाठवली. शांत राहा.')}</h2>
                {sos.result?.noPhone || !sos.result?.results?.length ? (
                  <p>{tr(lang, 'No family phone numbers are saved yet. Please add them in Live Connect. For now, call emergency services on 112.', 'अभी कोई नंबर सहेजा नहीं है। लाइव कनेक्ट में जोड़ें। अभी 112 पर कॉल करें।', 'अजून नंबर जतन केलेले नाहीत. लाइव्ह कनेक्टमध्ये जोडा. आता 112 वर कॉल करा.')}</p>
                ) : (
                  <div className="sos-list">
                    {sos.result.results.map((r) => (
                      <div className="sos-row" key={r.name}>
                        <span>{r.name}: {r.whatsapp === 'sent' ? '✅ WhatsApp sent' : 'tap to send →'}{r.call === 'placed' ? ' · 📞 calling' : ''}</span>
                        {r.whatsapp !== 'sent' && <a href={r.link} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                      </div>
                    ))}
                  </div>
                )}
                <div className="modal-actions" style={{ marginTop: 16 }}>
                  <a className="button-danger" href="tel:112" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}><Phone /> {tr(lang, 'Call 112', '112 पर कॉल करें', '112 वर कॉल करा')}</a>
                  <button className="button-secondary" onClick={() => setSos({ phase: 'idle', count: 10 })}>{tr(lang, 'Close', 'बंद करें', 'बंद करा')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Real phone call */}
      {callTarget && (
        <div className="modal-backdrop" role="presentation" onClick={() => setCallTarget(null)}>
          <div className="call-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="call-avatar-wrapper"><div className="call-ring" /><div className="call-avatar">{callTarget.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}</div></div>
            <h3>{callTarget.name}</h3>
            <div className="call-status"><span>{callTarget.relation}{callTarget.phone ? ` · ${callTarget.phone}` : ''}</span></div>
            {callTarget.phone ? (
              <div className="call-links">
                <a className="tel" href={`tel:${callTarget.phone}`} onClick={() => update((s) => withEvent(s, 'call', `Called ${callTarget.name}`))}>📞 {tr(lang, 'Call now', 'अभी कॉल करें', 'आता कॉल करा')}</a>
                <a href={waLink(callTarget.phone, `Hello ${callTarget.name.split(' ')[0]}, please call me when you are free.`)} target="_blank" rel="noopener noreferrer" onClick={() => update((s) => withEvent(s, 'message', `WhatsApp to ${callTarget.name}`))}>💬 WhatsApp</a>
                <button className="close" onClick={() => setCallTarget(null)}>{tr(lang, 'Close', 'बंद करें', 'बंद करा')}</button>
              </div>
            ) : (
              <div className="call-links">
                <small>{tr(lang, 'Save this person’s phone number to call:', 'कॉल के लिए नंबर सहेजें:', 'कॉलसाठी नंबर जतन करा:')}</small>
                <input value={callPhone} onChange={(e) => setCallPhone(e.target.value)} inputMode="tel" placeholder="+91XXXXXXXXXX" style={{ padding: 12, borderRadius: 12, border: '1px solid #d5dce8', fontSize: 16 }} aria-label="Phone number" />
                <button onClick={() => { const p = normalizePhone(callPhone); if (p.length >= 11) { const c = { ...callTarget, phone: p }; update((s) => upsertContact(s, c)); setCallTarget(c) } }}>{tr(lang, 'Save number', 'नंबर सहेजें', 'नंबर जतन करा')}</button>
                <button className="close" onClick={() => setCallTarget(null)}>{tr(lang, 'Close', 'बंद करें', 'बंद करा')}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showHistory && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowHistory(false)}>
          <div className="conversation-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="conversation-header">
              <h3>{tr(lang, 'Conversation with VRAAYU', 'VRAAYU के साथ बातचीत', 'VRAAYU सोबतचे संभाषण')}</h3>
              <button className="text-button" onClick={() => setShowHistory(false)} aria-label="Close history"><X /></button>
            </div>
            <div className="conversation-messages">
              {messages.map((m) => (
                <div key={m.id} className={`message-bubble ${m.role}`}>
                  <div>{m.content}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                    <small style={{ opacity: 0.7, fontSize: '11px' }}>{m.timestamp}</small>
                    {m.role === 'assistant' && <button className="message-speaker-btn" onClick={() => speakReply(m.content)} aria-label="Replay audio"><Volume2 size={14} /></button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <span className="sr-only" aria-live="polite">{pendingCount} tasks remaining</span>
    </main>
  )
}
