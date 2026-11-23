// Free, key-less live data tools (Open-Meteo weather, Google News RSS).
import type { Lang } from '../types'

const WEATHER_CODES: Record<number, string> = {
  0: 'clear sky', 1: 'mostly clear', 2: 'partly cloudy', 3: 'cloudy', 45: 'foggy', 48: 'foggy',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 80: 'rain showers', 81: 'rain showers', 82: 'heavy showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail',
}

async function fetchJson(url: string, ms = 6000): Promise<any> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctl.signal, cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

export async function getWeather(city: string): Promise<string> {
  const geo = await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city || 'Pune')}&count=1`
  )
  const place = geo?.results?.[0]
  if (!place) throw new Error('city not found')
  const w = await fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`
  )
  const c = w.current
  const d = w.daily
  const desc = WEATHER_CODES[c.weather_code] ?? 'mixed weather'
  return (
    `Weather in ${place.name}: ${Math.round(c.temperature_2m)}°C now, ${desc}, humidity ${c.relative_humidity_2m}%. ` +
    `Today's high ${Math.round(d.temperature_2m_max[0])}°C, low ${Math.round(d.temperature_2m_min[0])}°C, ` +
    `chance of rain ${d.precipitation_probability_max[0] ?? 0}%.`
  )
}

export async function getNews(lang: Lang): Promise<string> {
  const edition = lang === 'hi' ? 'hl=hi&gl=IN&ceid=IN:hi' : lang === 'mr' ? 'hl=mr&gl=IN&ceid=IN:mr' : 'hl=en-IN&gl=IN&ceid=IN:en'
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 6000)
  try {
    const res = await fetch(`https://news.google.com/rss?${edition}`, { signal: ctl.signal, cache: 'no-store' })
    const xml = await res.text()
    const titles = [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/g)]
      .map((m) => m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim())
      .map((s) => s.replace(/\s+-\s+[^-]+$/, '')) // drop " - Publisher"
      .slice(0, 4)
    if (!titles.length) throw new Error('no headlines')
    return 'Top headlines: ' + titles.map((s, i) => `${i + 1}. ${s}`).join(' ')
  } finally {
    clearTimeout(t)
  }
}
