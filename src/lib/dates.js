// Dates are local calendar days as 'YYYY-MM-DD' strings throughout the app.

const pad = n => String(n).padStart(2, '0')

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(now = new Date()) {
  return toISODate(now)
}

export function parseISODate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso, n) {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso) {
  const d = parseISODate(iso)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return toISODate(d)
}

export function daysBetween(a, b) {
  return Math.round((parseISODate(b) - parseISODate(a)) / 86400000)
}

export function weekdayShort(iso) {
  return parseISODate(iso).toLocaleDateString(undefined, { weekday: 'short' })
}

export function formatDay(iso, today = todayISO()) {
  const diff = daysBetween(today, iso)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return parseISODate(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatClock(ms) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** 75 → "1:15", 3725 → "1:02:05" */
export function formatDuration(totalSec) {
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

export function formatMinutes(totalSec) {
  return `${Math.round(totalSec / 60)} min`
}

/** Wall-clock ms (wrapped so event handlers don't trip the React purity lint). */
export const nowMs = () => Date.now()

export function uid(prefix = '') {
  const r = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36))
  return prefix + r.replace(/-/g, '').slice(0, 10)
}
