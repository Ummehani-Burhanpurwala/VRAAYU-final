'use client'

import { Activity, Bell, Coffee, Pill, Utensils, type LucideIcon } from 'lucide-react'
import type { Lang, TaskKind } from '@/lib/types'

/** Pick the right sentence for the current language. */
export const tr = (lang: Lang, en: string, hi: string, mr: string) => (lang === 'hi' ? hi : lang === 'mr' ? mr : en)

export function AppLogo() {
  return (
    <div className="brand-lockup">
      <div className="brand-mark" aria-hidden="true"><span /><span /></div>
      <div>
        <div className="brand-name">VRAAYU</div>
        <div className="brand-tagline">Always With You</div>
      </div>
    </div>
  )
}

export const kindMeta: Record<TaskKind, { icon: LucideIcon; color: string }> = {
  medicine: { icon: Pill, color: 'pink' },
  meal: { icon: Utensils, color: 'gold' },
  walk: { icon: Activity, color: 'green' },
  water: { icon: Coffee, color: 'mint' },
  task: { icon: Bell, color: 'purple' },
}
