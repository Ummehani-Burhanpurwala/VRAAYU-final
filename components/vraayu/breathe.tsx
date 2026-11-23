'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Lang } from '@/lib/types'
import { tr } from './common'

const ROUNDS = 5
type Phase = 'in' | 'hold' | 'out' | 'done'
const SECONDS: Record<Exclude<Phase, 'done'>, number> = { in: 4, hold: 4, out: 6 }

/** A calming guided-breathing exercise: inhale 4s, hold 4s, exhale 6s, five rounds, with spoken cues. */
export default function BreatheExercise({ lang, onSpeak, onClose, onFinished }: { lang: Lang; onSpeak: (t: string) => void; onClose: () => void; onFinished: () => void }) {
  const [phase, setPhase] = useState<Phase>('in')
  const [round, setRound] = useState(1)

  const label: Record<Phase, string> = {
    in: tr(lang, 'Breathe in…', 'साँस अंदर लें…', 'श्वास आत घ्या…'),
    hold: tr(lang, 'Hold gently…', 'रोकिए…', 'थांबा…'),
    out: tr(lang, 'Breathe out slowly…', 'धीरे-धीरे साँस छोड़ें…', 'हळूहळू श्वास सोडा…'),
    done: tr(lang, 'Well done. You are calm and safe.', 'बहुत बढ़िया। आप शांत और सुरक्षित हैं।', 'छान. तुम्ही शांत आणि सुरक्षित आहात.'),
  }

  useEffect(() => {
    onSpeak(label[phase])
    if (phase === 'done') {
      onFinished()
      return
    }
    const t = setTimeout(() => {
      if (phase === 'in') setPhase('hold')
      else if (phase === 'hold') setPhase('out')
      else if (round >= ROUNDS) setPhase('done')
      else {
        setRound((r) => r + 1)
        setPhase('in')
      }
    }, SECONDS[phase] * 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round])

  const scale = phase === 'in' ? 1.35 : phase === 'hold' ? 1.35 : 0.85
  const dur = phase === 'done' ? 1 : SECONDS[phase]

  return (
    <div className="lock-screen" role="dialog" aria-modal="true" aria-label="Breathing exercise">
      <div className="lock-card" style={{ textAlign: 'center' }}>
        <button className="lock-close" aria-label="Close" onClick={onClose}><X /></button>
        <h2>{tr(lang, 'Relax with me', 'मेरे साथ आराम करें', 'माझ्यासोबत शांत व्हा')}</h2>
        <div className="breathe-stage">
          <div className="breathe-orb" style={{ transform: `scale(${scale})`, transition: `transform ${dur}s ease-in-out` }} />
        </div>
        <p style={{ fontSize: '1.3em', color: 'var(--navy)', fontWeight: 700 }}>{label[phase]}</p>
        {phase !== 'done' && <small style={{ color: 'var(--muted-navy)' }}>{tr(lang, 'Round', 'चक्र', 'फेरी')} {round} / {ROUNDS}</small>}
        {phase === 'done' && <button className="mini-btn" onClick={onClose} style={{ marginTop: 14 }}>{tr(lang, 'Finish', 'समाप्त', 'पूर्ण')}</button>}
      </div>
    </div>
  )
}
