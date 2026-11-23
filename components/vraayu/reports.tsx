'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, Printer } from 'lucide-react'
import type { AppState, Lang } from '@/lib/types'
import { dateStr, readingLabel } from '@/lib/store'
import { tr } from './common'

type Period = 'This week' | 'This month' | 'Last 3 months'
const DAYS: Record<Period, number> = { 'This week': 7, 'This month': 30, 'Last 3 months': 90 }

export default function ReportsView({ state }: { state: AppState }) {
  const lang: Lang = state.settings.language
  const [period, setPeriod] = useState<Period>('This week')

  const data = useMemo(() => {
    const days = DAYS[period]
    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - (days - 1))
    start.setHours(0, 0, 0, 0)
    const inWindow = state.events.filter((e) => new Date(e.at) >= start)
    const earliest = state.events.length ? new Date(Math.min(...state.events.map((e) => +new Date(e.at)))) : now
    const effStart = new Date(Math.max(+start, +new Date(earliest.getFullYear(), earliest.getMonth(), earliest.getDate())))
    const spanDays = Math.max(1, Math.round((+new Date(now.getFullYear(), now.getMonth(), now.getDate()) - +effStart) / 86400000) + 1)

    const medCount = state.reminders.filter((r) => r.kind === 'medicine').length
    const doses = inWindow.filter((e) => e.type === 'dose').length
    const expected = Math.max(1, medCount * spanDays)
    const adherence = Math.min(100, Math.round((doses / expected) * 100))
    const activeDays = new Set(inWindow.map((e) => dateStr(new Date(e.at)))).size
    const connections = inWindow.filter((e) => e.type === 'call' || e.type === 'message').length
    const sos = inWindow.filter((e) => e.type === 'sos').length
    const wellbeing = adherence >= 90 ? 'Excellent' : adherence >= 75 ? 'Good' : adherence >= 50 ? 'Fair' : 'Needs care'

    // Bars: 7 days for a week, 4 weeks for a month, 3 months for the long view.
    const buckets = period === 'This week' ? 7 : period === 'This month' ? 4 : 3
    const size = period === 'This week' ? 1 : period === 'This month' ? 7 : 30
    const counts = Array.from({ length: buckets }, (_, i) => {
      const to = new Date(now); to.setDate(to.getDate() - (buckets - 1 - i) * size); to.setHours(23, 59, 59, 999)
      const from = new Date(to); from.setDate(from.getDate() - (size - 1)); from.setHours(0, 0, 0, 0)
      const n = state.events.filter((e) => { const t = new Date(e.at); return t >= from && t <= to }).length
      const label = period === 'This week' ? to.toLocaleString('en', { weekday: 'short' }) : period === 'This month' ? `W${i + 1}` : `M${i + 1}`
      return { n, label }
    })
    const max = Math.max(1, ...counts.map((c) => c.n))
    return { adherence, activeDays, spanDays, connections, sos, wellbeing, doses, counts, max }
  }, [state, period])

  const bp = state.readings.filter((r) => r.kind === 'bp').slice(-5)

  return (
    <div className="page-view">
      <div className="section-intro">
        <div>
          <p className="eyebrow">{tr(lang, 'Your Health Journey', 'आपकी सेहत की यात्रा', 'तुमचा आरोग्य प्रवास')}</p>
          <h2>{tr(lang, 'Wellbeing reports', 'स्वास्थ्य रिपोर्ट', 'आरोग्य अहवाल')}</h2>
          <p>{tr(lang, 'Calculated from your real medicine, check-in and call records.', 'आपकी असली दवा, चेक-इन और कॉल के रिकॉर्ड से गणना।', 'तुमच्या खऱ्या औषध, चेक-इन आणि कॉल नोंदींवरून.')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label className="period-select">
            <CalendarDays />
            <span className="sr-only">Report period</span>
            <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Report period">
              <option>This week</option><option>This month</option><option>Last 3 months</option>
            </select>
          </label>
          <button className="mini-btn ghost no-print" onClick={() => window.print()}><Printer size={16} /> {tr(lang, 'Print / PDF', 'प्रिंट / PDF', 'प्रिंट / PDF')}</button>
        </div>
      </div>

      <div className="report-summary">
        <div><span>{tr(lang, 'Overall wellbeing', 'कुल स्वास्थ्य', 'एकूण आरोग्य')}</span><strong>{data.wellbeing}</strong><small>{tr(lang, 'Medicine adherence', 'दवा नियमितता', 'औषध नियमितता')} {data.adherence}%</small></div>
        <div><span>{tr(lang, 'Active days', 'सक्रिय दिन', 'सक्रिय दिवस')}</span><strong>{data.activeDays} / {data.spanDays}</strong><small>{data.doses} {tr(lang, 'doses logged', 'खुराकें दर्ज', 'मात्रा नोंदल्या')}</small></div>
        <div><span>{tr(lang, 'Family connections', 'परिवार से संपर्क', 'कुटुंबाशी संपर्क')}</span><strong>{data.connections}</strong><small>{data.sos > 0 ? `${data.sos} SOS alert(s)` : tr(lang, 'No emergencies', 'कोई आपातकाल नहीं', 'आपत्काल नाही')}</small></div>
      </div>

      <div className="chart-card">
        <div className="card-heading"><h3>{tr(lang, 'Activity trend', 'गतिविधि रुझान', 'हालचाल कल')}</h3><span>{tr(lang, 'Logged actions', 'दर्ज गतिविधियाँ', 'नोंदवलेल्या क्रिया')} ({period})</span></div>
        <div className="fake-chart" aria-label="Activity trend chart">
          <div className="chart-bars">
            {data.counts.map((c, i) => <i key={i} style={{ height: `${Math.max(8, (c.n / data.max) * 100)}%` }} title={`${c.n} actions`} />)}
          </div>
          <div className="chart-labels">{data.counts.map((c, i) => <span key={i}>{c.label}</span>)}</div>
        </div>
      </div>

      {bp.length > 0 && (
        <div className="chart-card" style={{ marginTop: 18 }}>
          <div className="card-heading"><h3>{readingLabel('bp')}</h3><span>{tr(lang, 'Latest readings', 'ताज़ा रीडिंग', 'ताज्या नोंदी')}</span></div>
          <div>{bp.map((r) => <span key={r.id} className="reading-chip">{new Date(r.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} <b>{r.value}</b></span>)}</div>
        </div>
      )}
    </div>
  )
}
