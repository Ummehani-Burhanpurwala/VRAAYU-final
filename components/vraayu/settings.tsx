'use client'

import { useState } from 'react'
import { Bell, Copy, Globe2, LockKeyhole, ScanFace, ShieldCheck, Sparkles, Users, Volume2, Moon, Activity } from 'lucide-react'
import type { AppState, FontSize, Lang } from '@/lib/types'
import { tr } from './common'

interface Props {
  state: AppState
  update: (fn: (s: AppState) => AppState) => void
  onLanguageChange: (l: Lang) => void
  onPreviewVoice: () => void
  onEnrollFace: () => void
  onResetDemo: () => void
  syncMode: string
}

export default function SettingsView({ state, update, onLanguageChange, onPreviewVoice, onEnrollFace, onResetDemo, syncMode }: Props) {
  const lang = state.settings.language
  const s = state.settings
  const [status, setStatus] = useState('')
  const [copied, setCopied] = useState(false)
  const familyLink = typeof window !== 'undefined' ? `${window.location.origin}/family?code=${state.profile.familyCode}` : ''
  const set = (patch: Partial<AppState['settings']>) => update((st) => ({ ...st, settings: { ...st.settings, ...patch } }))

  async function checkStatus() {
    setStatus('Checking…')
    try {
      const j = await (await fetch('/api/health', { cache: 'no-store' })).json()
      setStatus(
        `Gemini key:   ${j.geminiKey}\nGemini AI:    ${j.gemini}\nGroq backup:  ${j.groqBackup}\nWhatsApp:     ${j.twilioWhatsApp}\nVoice calls:  ${j.twilioVoiceCall}\nDatabase:     ${j.database}\nFamily sync:  ${syncMode}`
      )
    } catch {
      setStatus('Could not reach the server.')
    }
  }

  return (
    <div className="page-view">
      <div className="section-intro">
        <div>
          <p className="eyebrow">{tr(lang, 'Personal Preferences', 'व्यक्तिगत पसंद', 'वैयक्तिक पसंती')}</p>
          <h2>{tr(lang, 'Settings', 'सेटिंग्स', 'सेटिंग्ज')}</h2>
          <p>{tr(lang, 'Make VRAAYU comfortable and connect your family.', 'VRAAYU को अपने अनुसार बनाएँ और परिवार को जोड़ें।', 'VRAAYU तुमच्या सोयीचे करा आणि कुटुंबाला जोडा.')}</p>
        </div>
      </div>

      <div className="settings-list">
        <div className="setting-row">
          <span className="setting-icon"><Users /></span>
          <span><strong>{tr(lang, 'Your name & city', 'आपका नाम और शहर', 'तुमचे नाव आणि शहर')}</strong><small>{tr(lang, 'Used for greetings and local weather', 'अभिवादन और मौसम के लिए', 'अभिवादन आणि हवामानासाठी')}</small></span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={state.profile.name} onChange={(e) => update((st) => ({ ...st, profile: { ...st.profile, name: e.target.value } }))} aria-label="Name" style={{ padding: 8, border: '1px solid #d5dce8', borderRadius: 10, width: 160 }} />
            <input value={state.profile.city} onChange={(e) => update((st) => ({ ...st, profile: { ...st.profile, city: e.target.value } }))} aria-label="City" style={{ padding: 8, border: '1px solid #d5dce8', borderRadius: 10, width: 110 }} />
          </div>
        </div>

        <label className="setting-row">
          <span className="setting-icon"><Globe2 /></span>
          <span><strong>Primary language / भाषा</strong><small>English, हिंदी, मराठी</small></span>
          <select value={lang} onChange={(e) => onLanguageChange(e.target.value as Lang)} aria-label="Language">
            <option value="en">English (India)</option><option value="hi">हिंदी (Hindi)</option><option value="mr">मराठी (Marathi)</option>
          </select>
        </label>

        <label className="setting-row">
          <span className="setting-icon"><Sparkles /></span>
          <span><strong>{tr(lang, 'Display text size', 'अक्षरों का आकार', 'अक्षरांचा आकार')}</strong><small>{tr(lang, 'Choose what is easiest on your eyes', 'जो आँखों को आसान लगे', 'डोळ्यांना सोपा वाटेल तो')}</small></span>
          <select value={s.fontSize} onChange={(e) => set({ fontSize: e.target.value as FontSize })}>
            <option>Comfortable</option><option>Large</option><option>Extra Large</option>
          </select>
        </label>

        <div className="setting-row">
          <span className="setting-icon"><Bell /></span>
          <span><strong>{tr(lang, 'Spoken reminders', 'बोलकर याद दिलाना', 'बोलून आठवण')}</strong><small>{tr(lang, 'VRAAYU speaks when a medicine or task is due', 'दवा/काम का समय होने पर बोलेगा', 'औषध/काम वेळ झाल्यावर बोलेल')}</small></span>
          <button className={`toggle ${s.notifications ? 'on' : ''}`} role="switch" aria-checked={s.notifications} onClick={() => set({ notifications: !s.notifications })}><span /></button>
        </div>

        <div className="setting-row">
          <span className="setting-icon"><Users /></span>
          <span><strong>{tr(lang, 'Alert family on missed medicine', 'दवा छूटने पर परिवार को सूचना', 'औषध चुकल्यास कुटुंबाला सूचना')}</strong><small>{tr(lang, 'Sends a WhatsApp message if a tablet is 20+ minutes late', 'गोली 20+ मिनट देर पर WhatsApp संदेश', 'गोळी 20+ मिनिटे उशिरा झाल्यास WhatsApp संदेश')}</small></span>
          <button className={`toggle ${s.notifyFamily ? 'on' : ''}`} role="switch" aria-checked={s.notifyFamily} onClick={() => set({ notifyFamily: !s.notifyFamily })}><span /></button>
        </div>

        <div className="setting-row">
          <span className="setting-icon"><Volume2 /></span>
          <span><strong>{tr(lang, 'Voice selection', 'आवाज़ का चयन', 'आवाज निवड')}</strong><small>{tr(lang, 'Pick the speaking voice for VRAAYU', 'VRAAYU की आवाज़ चुनें', 'VRAAYU चा आवाज निवडा')}</small></span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={s.voicePreference} onChange={(e) => set({ voicePreference: e.target.value })} aria-label="Voice">
              <option>Auto</option><option>David</option><option>Zira</option><option>Samantha</option><option>Google</option>
            </select>
            <button type="button" className="setting-action-btn" onClick={onPreviewVoice}><Volume2 size={15} /> Test Voice</button>
          </div>
        </div>

        <div className="setting-row">
          <span className="setting-icon"><ScanFace /></span>
          <span><strong>{tr(lang, 'Face unlock', 'फेस अनलॉक', 'फेस अनलॉक')}</strong><small>{state.profile.faceEnabled ? tr(lang, 'ON — VRAAYU opens when it sees your face (no photo is stored).', 'चालू — चेहरा पहचानकर खुलेगा (फोटो सेव नहीं होती)।', 'चालू — चेहरा ओळखून उघडेल (फोटो जतन होत नाही).') : tr(lang, 'Open VRAAYU just by looking at the camera.', 'कैमरे को देखकर ही VRAAYU खोलें।', 'कॅमेऱ्याकडे पाहून VRAAYU उघडा.')}</small></span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="setting-action-btn" onClick={onEnrollFace}><ScanFace size={15} /> {state.profile.faceEnabled ? 'Re-register' : 'Set up'}</button>
            {state.profile.faceEnabled && <button className="setting-action-btn" onClick={() => update((st) => ({ ...st, profile: { ...st.profile, faceEnabled: false, faceDescriptor: undefined } }))}>Turn off</button>}
          </div>
        </div>

        <div className="setting-row">
          <span className="setting-icon"><LockKeyhole /></span>
          <span><strong>{tr(lang, 'Family PIN (backup unlock)', 'पारिवारिक PIN (बैकअप)', 'कौटुंबिक PIN (बॅकअप)')}</strong><small>{tr(lang, 'Used if the camera cannot recognise you', 'कैमरा न पहचाने तो', 'कॅमेरा ओळखू न शकल्यास')}</small></span>
          <input value={state.profile.pin} inputMode="numeric" maxLength={8} onChange={(e) => update((st) => ({ ...st, profile: { ...st.profile, pin: e.target.value.replace(/\D/g, '') } }))} aria-label="PIN" style={{ padding: 8, border: '1px solid #d5dce8', borderRadius: 10, width: 100, textAlign: 'center', letterSpacing: 3 }} />
        </div>

        <div className="setting-row" style={{ flexWrap: 'wrap' }}>
          <span className="setting-icon"><Users /></span>
          <span><strong>{tr(lang, 'Family dashboard', 'परिवार डैशबोर्ड', 'कुटुंब डॅशबोर्ड')}</strong><small>{tr(lang, 'Share this code or link. Family sees medicines, readings and alerts live.', 'यह कोड या लिंक परिवार को दें। वे दवा, रीडिंग और अलर्ट लाइव देखेंगे।', 'हा कोड किंवा लिंक कुटुंबाला द्या. ते औषध, नोंदी आणि अलर्ट लाइव्ह पाहतील.')}</small></span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ fontSize: 20, letterSpacing: 3, fontWeight: 800 }}>{state.profile.familyCode}</code>
            <button className="setting-action-btn" onClick={() => { navigator.clipboard?.writeText(familyLink); setCopied(true); setTimeout(() => setCopied(false), 1800) }}><Copy size={15} /> {copied ? 'Copied' : 'Copy link'}</button>
          </div>
        </div>

        <div className="setting-row" style={{ flexWrap: 'wrap' }}>
          <span className="setting-icon"><Activity /></span>
          <span><strong>System status</strong><small>Checks Gemini AI, WhatsApp, database and family sync</small></span>
          <button className="setting-action-btn" onClick={checkStatus}>Run check</button>
          {status && <pre className="status-box" style={{ width: '100%' }}>{status}</pre>}
        </div>

        <div className="setting-row">
          <span className="setting-icon"><ShieldCheck /></span>
          <span><strong>{tr(lang, 'Privacy & data', 'गोपनीयता और डेटा', 'गोपनीयता आणि डेटा')}</strong><small>{tr(lang, 'Audio is never stored. Face unlock saves numbers only, not photos. Your face signature and PIN never leave this device.', 'ऑडियो कभी सेव नहीं होता। फेस अनलॉक केवल संख्याएँ रखता है, फोटो नहीं। चेहरे का सिग्नेचर और PIN इसी डिवाइस में रहते हैं।', 'ऑडिओ कधीही जतन होत नाही. फेस अनलॉक फक्त आकडे ठेवतो, फोटो नाही. चेहऱ्याची ओळख आणि PIN याच डिव्हाइसवर राहतात.')}</small></span>
          <button className="setting-action-btn" onClick={() => { if (confirm('Reset all data to the demo data?')) onResetDemo() }}>Reset demo data</button>
        </div>
      </div>

      <div className="settings-footer"><Moon /> VRAAYU — Designed with love and care for every generation.</div>
    </div>
  )
}
