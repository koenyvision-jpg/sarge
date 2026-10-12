// Turns the plan + the app's records into "what's scheduled when, and did you do it".
// Records are the app's append-only log (see recordPath for where each lands in the repo).

import { addDays, daysBetween, startOfWeek } from './dates.js'
import { bestLifts } from './engine.js'

const stamp = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')

export function recordPath(rec) {
  switch (rec.type) {
    case 'workout': return `logs/${rec.date}-workout-${rec.id}.json`
    case 'checkin': return `logs/${rec.date}-checkin.json`
    case 'reschedule': return `logs/${rec.date}-reschedule-${rec.id}.json`
    case 'excuse': return `inbox/${stamp(rec.createdAt)}-excuse-${rec.id}.json`
    case 'message': return `inbox/${stamp(rec.createdAt)}-message-${rec.id}.json`
    default: return `logs/${rec.date}-${rec.type}-${rec.id}.json`
  }
}

/** Latest reschedule per session id. */
function overrides(records) {
  const out = {}
  for (const r of records) {
    if (r.type !== 'reschedule') continue
    if (!out[r.sessionId] || r.createdAt > out[r.sessionId].createdAt) out[r.sessionId] = r
  }
  return out
}

/** Plan sessions with reschedules applied and a status for each. Sorted by date. */
export function scheduledSessions(plan, records, today) {
  if (!plan?.sessions) return []
  const moved = overrides(records)
  const doneBy = new Map()
  const excusedBy = new Map()
  for (const r of records) {
    if (r.type === 'workout' && r.sessionId) doneBy.set(r.sessionId, r)
    if (r.type === 'excuse' && r.sessionId) excusedBy.set(r.sessionId, r)
  }
  return plan.sessions
    .map(s => {
      const o = moved[s.id]
      const date = o?.toDate || s.date
      const workout = doneBy.get(s.id)
      const excuse = excusedBy.get(s.id)
      let status
      if (workout) status = 'done'
      else if (excuse) status = 'excused'
      else if (date < today) status = 'missed'
      else if (date === today) status = 'today'
      else status = 'upcoming'
      return { ...s, date, time: o?.toTime || s.time, originalDate: s.date, moved: !!o, status, workout, excuse }
    })
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
}

export function sessionsOn(sessions, date) {
  return sessions.filter(s => s.date === date)
}

/** Missed sessions in the last 14 days that you haven't explained yet. */
export function unexplainedMisses(sessions, today) {
  return sessions.filter(s => s.status === 'missed' && daysBetween(s.date, today) <= 14)
}

export function accountability(sessions, plan, today) {
  // Streak: consecutive completed sessions, newest first. Today only counts once done.
  let streak = 0
  const past = sessions.filter(s => s.date < today || (s.date === today && s.status === 'done')).reverse()
  for (const s of past) {
    if (s.status === 'done') streak++
    else break
  }

  const weekStart = startOfWeek(today)
  const dueThisWeek = sessions.filter(s => s.date >= weekStart && (s.date < today || s.status === 'done'))
  const doneThisWeek = dueThisWeek.filter(s => s.status === 'done').length
  const plannedThisWeek = sessions.filter(s => s.date >= weekStart && s.date <= addDays(weekStart, 6)).length

  const inBlock = sessions.filter(s => (!plan?.startDate || s.date >= plan.startDate) && s.date <= today)
  const dueInBlock = inBlock.filter(s => s.date < today || s.status === 'done')
  const doneInBlock = dueInBlock.filter(s => s.status === 'done').length
  const missedInBlock = dueInBlock.filter(s => s.status === 'missed' || s.status === 'excused').length

  return {
    streak,
    doneThisWeek,
    plannedThisWeek,
    weekCompliance: dueThisWeek.length ? doneThisWeek / dueThisWeek.length : null,
    blockCompliance: dueInBlock.length ? doneInBlock / dueInBlock.length : null,
    missedInBlock,
  }
}

/** One line from the sergeant when the coach hasn't written today's orders yet. */
export function fallbackOrders({ todaySessions, sessions, today, checkedIn }) {
  const yesterday = sessions.filter(s => s.date === addDays(today, -1))
  const skippedYesterday = yesterday.some(s => s.status === 'missed' || s.status === 'excused')
  const t = todaySessions[0]
  if (t?.status === 'done') return 'Done for today. Good. Eat, sleep, and don\'t get comfortable.'
  if (t?.status === 'excused') return 'You called it off today. That\'s logged. Tomorrow there are no excuses.'
  if (t && skippedYesterday) return `Yesterday didn't happen. Today does: ${t.name}, ${t.targetDurationMin || 60} minutes. Move.`
  if (t) return `Today: ${t.name}. ${t.targetDurationMin || 60} minutes. No negotiations.${checkedIn ? '' : ' Check in first.'}`
  if (skippedYesterday) return 'Rest day — one you didn\'t earn. Walk, stretch, sleep. Tomorrow you pay it back.'
  return 'Rest day. Walk, stretch, eat protein, sleep 8 hours. Tomorrow we work.'
}

export function checkinFor(records, date) {
  return records.find(r => r.type === 'checkin' && r.date === date) || null
}

export function workouts(records) {
  return records.filter(r => r.type === 'workout').sort((a, b) => b.startedAt - a.startedAt)
}

/** Count of workouts per day for the last `weeks` weeks (Monday-aligned). */
export function heatmap(records, today, weeks = 12) {
  const start = addDays(startOfWeek(today), -7 * (weeks - 1))
  const counts = {}
  for (const r of records) if (r.type === 'workout' && r.date >= start) counts[r.date] = (counts[r.date] || 0) + 1
  const days = []
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i)
    days.push({ date: d, count: counts[d] || 0, future: d > today })
  }
  return days
}

export function prBoard(records) {
  return Object.entries(bestLifts(records))
    .map(([exerciseId, v]) => ({ exerciseId, ...v }))
    .sort((a, b) => b.e1rm - a.e1rm)
}
