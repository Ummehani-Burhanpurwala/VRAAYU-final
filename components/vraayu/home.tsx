'use client'

import { Wind, MessagesSquare, ChevronRight, HeartPulse, Leaf, MessageSquare, Mic, MicOff, Pill, Play, RotateCcw, ShieldCheck, Sparkles, UsersRound, Volume2, VolumeX, Ear } from 'lucide-react'
import type { AppState, Lang, Section } from '@/lib/types'
import { fmt12, isDoneToday } from '@/lib/store'
import { tr } from './common'
import BhajanPlayer from './bhajan-player'

export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface Props {
  state: AppState
  assistantState: AssistantState
  command: string
  setCommand: (v: string) => void
  interimText: string
  lastResponse: string
  source: 'gemini' | 'groq' | 'engine' | null
  note: string
  suggestedPrompts: string[]
  media: { label: string; url: string } | null
  handsFree: boolean
  onToggleHandsFree: () => void
  converse: boolean
  musicOn: boolean
  onToggleMusic: () => void
  onToggleConverse: () => void
  onBreathe: () => void
  onCommand: (v: string) => void
  onListen: () => void
  onStopSpeaking: () => void
  onReplay: () => void
  onOpenHistory: () => void
  setActiveSection: (s: Section) => void
}

export default function HomeView(p: Props) {
  const lang: Lang = p.state.settings.language
  const isListening = p.assistantState === 'listening'
  const isSpeaking = p.assistantState === 'speaking'
  const isThinking = p.assistantState === 'thinking'
  const next = p.state.reminders.filter((r) => !isDoneToday(r)).sort((a, b) => a.time.localeCompare(b.time))[0]
  const first = p.state.contacts[0]

  const status = isListening
    ? tr(lang, 'Listening closely to you...', 'ध्यान से सुन रहा हूँ...', 'लक्षपूर्वक ऐकत आहे...')
    : isThinking
    ? tr(lang, 'Thinking warmly...', 'सोच रहा हूँ...', 'विचार करत आहे...')
    : isSpeaking
    ? tr(lang, 'Speaking with you...', 'बोल रहा हूँ...', 'बोलत आहे...')
    : tr(lang, 'Speak freely... I am listening', 'बेझिझक बोलिए... मैं सुन रहा हूँ', 'मोकळेपणाने बोला... मी ऐकत आहे')

  return (
    <div className="home-view">
      <div className="medical-supporter-badge">
        <Sparkles />
        <span>{tr(lang, 'Your Voice-Controlled Life Assistant', 'आपका आवाज़ से चलने वाला जीवन साथी', 'तुमचा आवाजावर चालणारा जीवन साथीदार')}</span>
      </div>

      <div className="quote-strip">
        <Leaf />
        <span>{tr(lang, '“Just say what you need. I will take care of the rest.”', '“बस बोलिए, बाकी मैं सँभाल लूँगा।”', '“फक्त बोला, बाकी मी सांभाळतो.”')}</span>
      </div>

      <div className={`voice-hero ${isListening ? 'is-listening' : ''} ${isSpeaking ? 'is-speaking' : ''} ${isThinking ? 'is-thinking' : ''}`}>
        <div className="voice-orb-container">
          <button
            className="voice-orb"
            aria-label={isListening ? 'Stop listening' : isSpeaking ? 'Stop speaking' : 'Tap to speak to VRAAYU'}
            onClick={isSpeaking ? p.onStopSpeaking : p.onListen}
          >
            <div className="orb-core">
              {isSpeaking ? (
                <div className="orb-soundwave"><span /><span /><span /><span /><span /></div>
              ) : isThinking ? (
                <Sparkles />
              ) : (
                <Mic />
              )}
            </div>
          </button>
        </div>

        <h2>{tr(lang, `Hello ${p.state.profile.name.split(' ')[0]}, I'm VRAAYU`, `नमस्ते ${p.state.profile.name.split(' ')[0]} जी, मैं VRAAYU हूँ`, `नमस्कार ${p.state.profile.name.split(' ')[0]}, मी VRAAYU आहे`)}</h2>
        <p>{status}</p>

        <div className="pill-actions">
          <button className={`hands-free live ${p.converse ? 'on' : ''}`} onClick={p.onToggleConverse} aria-pressed={p.converse}>
            <MessagesSquare size={16} />
            {p.converse
              ? tr(lang, 'Live chat ON — I keep listening', 'लाइव चैट चालू — मैं सुनता रहूँगा', 'लाइव्ह चॅट चालू — मी ऐकत राहीन')
              : tr(lang, 'Start live conversation', 'लाइव बातचीत शुरू करें', 'लाइव्ह संभाषण सुरू करा')}
          </button>
          <button className={`hands-free ${p.musicOn ? 'on' : ''}`} onClick={p.onToggleMusic} aria-pressed={p.musicOn}>
            🎵 {p.musicOn ? tr(lang, 'Stop music', 'संगीत बंद करें', 'संगीत बंद करा') : tr(lang, 'Devotional music', 'भक्ति संगीत', 'भक्तिसंगीत')}
          </button>
          <button className="hands-free" onClick={p.onBreathe}>
            <Wind size={16} /> {tr(lang, 'Relax / Breathe', 'आराम / साँस', 'शांत / श्वास')}
          </button>
          <button className={`hands-free ${p.handsFree ? 'on' : ''}`} onClick={p.onToggleHandsFree} aria-pressed={p.handsFree}>
            <Ear size={16} />
            {p.handsFree
              ? tr(lang, '“Hello Vraayu” ON', '“हेलो वायु” चालू', '“हॅलो वायु” चालू')
              : tr(lang, '“Hello Vraayu” hands-free', '“हेलो वायु” हैंड्स-फ़्री', '“हॅलो वायु” हँड्स-फ्री')}
          </button>
        </div>

        <BhajanPlayer playing={p.musicOn} lang={lang} onStop={p.onToggleMusic} />

        {p.interimText && (
          <div className="interim-speech" role="status">
            <Mic size={16} />
            <span>&ldquo;{p.interimText}&rdquo;</span>
          </div>
        )}

        {p.lastResponse && (
          <div className="voice-response" role="status">
            <div className="voice-response-icon">{isSpeaking ? <Volume2 /> : <HeartPulse />}</div>
            <div className="voice-response-body">
              <div>{p.lastResponse}</div>
              {p.media && (
                <a className="media-pill" href={p.media.url} target="_blank" rel="noopener noreferrer">
                  <Play size={16} /> {p.media.label}
                </a>
              )}
              <div className="voice-response-actions">
                <button className="voice-action-pill" onClick={p.onReplay} aria-label="Replay voice audio">
                  <RotateCcw size={14} /> {tr(lang, 'Listen again', 'फिर से सुनें', 'पुन्हा ऐका')}
                </button>
                {isSpeaking && (
                  <button className="voice-action-pill" onClick={p.onStopSpeaking} aria-label="Stop audio">
                    <VolumeX size={14} /> {tr(lang, 'Stop', 'रोकें', 'थांबवा')}
                  </button>
                )}
              </div>
              {p.source && (
                <div className={`source-tag ${p.source === 'engine' ? 'offline' : ''}`}>
                  {p.source === 'gemini' ? '✦ Gemini AI' : p.source === 'groq' ? '✦ Groq AI (free backup)' : `Offline assistant${p.note ? ' — AI not connected (see Settings → System status)' : ''}`}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="command-box">
        <button className={`input-mic ${isListening ? 'active' : ''}`} onClick={p.onListen} aria-label={isListening ? 'Stop listening' : 'Start voice input'}>
          {isListening ? <MicOff /> : <Mic />}
        </button>
        <input
          value={p.command}
          disabled={isThinking}
          onChange={(e) => p.setCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) p.onCommand(p.command)
          }}
          placeholder={
            isThinking
              ? tr(lang, 'VRAAYU is preparing an answer...', 'VRAAYU उत्तर तैयार कर रहा है...', 'VRAAYU उत्तर तयार करत आहे...')
              : tr(lang, 'Ask anything, or tap the mic to speak...', 'कुछ भी पूछें, या बोलने के लिए माइक दबाएँ...', 'काहीही विचारा, किंवा बोलण्यासाठी माइक दाबा...')
          }
          aria-label="Message VRAAYU"
        />
        <button className="send-button" disabled={isThinking || !p.command.trim()} onClick={() => p.onCommand(p.command)} aria-label="Send message">
          <Play />
        </button>
      </div>

      <div className="quick-prompts">
        {p.suggestedPrompts.map((prompt) => (
          <button key={prompt} onClick={() => p.onCommand(prompt)}>{prompt}</button>
        ))}
      </div>

      <div className="history-toggle-row">
        <button className="history-toggle-btn" onClick={p.onOpenHistory}>
          <MessageSquare size={16} /> {tr(lang, 'View Conversation History', 'बातचीत का इतिहास देखें', 'संभाषणाचा इतिहास पहा')}
        </button>
      </div>

      <div className="trust-row">
        <div><ShieldCheck /><span>Private &amp; Secure</span></div>
        <div><HeartPulse /><span>Always With You</span></div>
        <div><Volume2 /><span>Trilingual Voice</span></div>
      </div>

      <div className="home-cards">
        <button onClick={() => p.setActiveSection('Dashboard')}>
          <Pill />
          <span>
            <strong>{tr(lang, 'Up next', 'अगला काम', 'पुढचे काम')}</strong>
            <small>{next ? `${fmt12(next.time)} · ${next.title}` : tr(lang, 'All done for today 🎉', 'आज के सभी काम पूरे 🎉', 'आजची सर्व कामे पूर्ण 🎉')}</small>
          </span>
          <ChevronRight />
        </button>
        <button onClick={() => p.setActiveSection('Live Connect')}>
          <UsersRound />
          <span>
            <strong>{tr(lang, 'Family time', 'परिवार से बातचीत', 'कुटुंबियांसोबत वेळ')}</strong>
            <small>{first ? `${first.name} · ${tr(lang, 'Tap to call', 'कॉल करने के लिए टैप करें', 'कॉल करण्यासाठी टॅप करा')}` : tr(lang, 'Add your family', 'परिवार जोड़ें', 'कुटुंब जोडा')}</small>
          </span>
          <ChevronRight />
        </button>
      </div>
    </div>
  )
}
