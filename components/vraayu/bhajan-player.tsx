'use client'

import { useEffect, useRef } from 'react'
import { Music, Square } from 'lucide-react'
import type { Lang } from '@/lib/types'
import { tr } from './common'

/**
 * Free, offline devotional ambience: a soft tanpura drone (Sa + Pa) with gentle raga chimes,
 * generated live with the Web Audio API. No audio files, no ads, no internet needed.
 */
export default function BhajanPlayer({ playing, lang, onStop }: { playing: boolean; lang: Lang; onStop: () => void }) {
  const ctxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!playing) return
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    ctxRef.current = ctx

    const master = ctx.createGain()
    master.gain.setValueAtTime(0.001, ctx.currentTime)
    master.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 1.2)
    master.connect(ctx.destination)

    const sa = ctx.createOscillator()
    sa.type = 'sine'
    sa.frequency.value = 130.81
    sa.connect(master)
    sa.start()

    const pa = ctx.createOscillator()
    pa.type = 'triangle'
    pa.frequency.value = 196.0
    const paGain = ctx.createGain()
    paGain.gain.value = 0.35
    pa.connect(paGain)
    paGain.connect(master)
    pa.start()

    const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25]
    let step = 0
    const chime = () => {
      if (ctx.state === 'closed') return
      const now = ctx.currentTime
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = notes[step % notes.length]
      step += 1
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(0.07, now + 0.15)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4)
      o.connect(g)
      g.connect(ctx.destination)
      o.start(now)
      o.stop(now + 2.5)
    }
    chime()
    timerRef.current = window.setInterval(chime, 2800)

    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
      timerRef.current = null
      ctx.close().catch(() => {})
      ctxRef.current = null
    }
  }, [playing])

  if (!playing) return null
  return (
    <div className="media-player" role="status">
      <span className="media-icon"><Music size={20} /></span>
      <div>
        <strong>{tr(lang, 'Devotional music', 'भक्ति संगीत', 'भक्तिसंगीत')}</strong>
        <small>{tr(lang, 'Playing a calm tanpura and raga ambience', 'शांत तानपुरा और राग की धुन चल रही है', 'शांत तानपुरा आणि रागाची धून सुरू आहे')}</small>
      </div>
      <button className="mini-btn" onClick={onStop}><Square size={14} /> {tr(lang, 'Stop', 'बंद करें', 'बंद करा')}</button>
    </div>
  )
}
