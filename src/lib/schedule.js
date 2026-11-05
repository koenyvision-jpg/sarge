// Turns the plan + the app's records into "what's scheduled when, and did you do it".
// Records are the app's append-only log (see recordPath for where each lands in the repo).

import { addDays, daysBetween, startOfWeek } from './dates.js'
import { bestLifts } from './engine.js'

const stamp = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')

export function recordPath(rec) {
  switch (rec.type) {
    case 'workout': return `logs/${rec.date}-workout-${rec.id}.json`
    case 'checkin': return `logs/${rec.date}-checkin.json`
    case 'missed': return `logs/${rec.date}-missed-${rec.sessionId}.json`
    case 'reschedule': return `logs/${rec.date}-reschedule-${rec.id}.json` // legacy, no longer written
    case 'excuse': return `inbox/${stamp(rec.createdAt)}-excuse-${rec.id}.json`
    case 'message': return `inbox/${stamp(rec.createdAt)}-message-${rec.id}.json`
    default: return `logs/${rec.date}-${rec.type}-${rec.id}.json`
  }
}

const keyOf = (sessionId, date) => `${sessionId}|${date}`

/**
 * Legacy: the app used to let the user move sessions (logs/*-reschedule-*.json). The coach owns the
 * schedule now, so an old move only still applies while the plan has that session on the date it
 * was originally moved away from. Once the coach has rewritten the plan, the plan wins.
 */
function legacyMoves(plan, records) {
  const bySession = {}
  for (const r of records) if (r.type === 'reschedule' && r.sessionId) (bySession[r.sessionId] ||= []).push(r)
  const out = {}
  for (const s of plan.sessions) {
    const list = bySession[s.id]?.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    if (!list) continue
    const first = list[0], latest = list[list.length - 1]
    if (!first.fromDate || first.fromDate === s.date) out[s.id] = latest
  }
  return out
}

/**
 * Plan sessions with a status each. Sorted by date.
 * A date with no session is a rest day. Workouts count by sessionId (doing a session early or late
 * still counts); an excuse only covers the session on the date it was given for, because the coach
 * may shift a skipped session forward under the same id.
 */
export function scheduledSessions(plan, records, today) {
  if (!plan?.sessions) return []
  const moved = legacyMoves(plan, records)
  const doneBy = new Map()
  const excuses = new Map()
  for (const r of records) {
    if (r.type === 'workout' && r.sessionId) doneBy.set(r.sessionId, r)
    if (r.type === 'excuse' && r.sessionId) excuses.set(keyOf(r.sessionId, r.sessionDate), r)
  }
  return plan.sessions
    .map(s => {
      const o = moved[s.id]
      const date = o?.toDate || s.date
      const workout = doneBy.get(s.id)
      const excuse = excuses.get(keyOf(s.id, date)) || excuses.get(keyOf(s.id, undefined))
      let status
      if (workout) status = 'done'
      else if (excuse) status = 'excused'
      else if (date < today) status = 'missed'
      else if (date === today) status = 'today'
      else status = 'upcoming'
      return { ...s, date, time: o?.toTime || s.time, originalDate: s.date, moved: !!o, status, workout, excuse }
    })
    .sort(byDate)
}

const byDate = (a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))

/**
 * Plan sessions plus the misses and skips that no longer have a session on their date
 * (the coach shifted the plan after them). Those come back as `ghost` entries so they keep
 * counting in history and compliance instead of looking like rest days.
 */
export function timeline(sessions, records, plan) {
  const nameOf = id => plan?.sessions?.find(s => s.id === id)?.name
  const taken = new Set(sessions.map(s => keyOf(s.id, s.date)))
  const excuses = new Map()
  for (const r of records) if (r.type === 'excuse' && r.sessionId && r.sessionDate) excuses.set(keyOf(r.sessionId, r.sessionDate), r)
  const ghosts = []
  const add = (r, status) => {
    if (!r.sessionId || !r.sessionDate) return
    const k = keyOf(r.sessionId, r.sessionDate)
    if (taken.has(k)) return
    taken.add(k)
    ghosts.push({
      id: r.sessionId, date: r.sessionDate, name: r.sessionName || nameOf(r.sessionId) || 'Session',
      status, ghost: true, excuse: excuses.get(k) || null, blocks: [],
    })
  }
  for (const r of records) if (r.type === 'missed') add(r, 'missed')
  for (const r of records) if (r.type === 'excuse') add(r, 'excused')
  return ghosts.length ? [...sessions, ...ghosts].sort(byDate) : sessions
}

export function sessionsOn(sessions, date) {
  return sessions.filter(s => s.date === date)
}

/**
 * Sessions to log as missed now: in the plan, dated before today, no workout and no excuse,
 * and not logged as missed before. Only for dates this device has data for (its oldest record),
 * so a freshly connected phone doesn't flag sessions it simply hasn't restored yet.
 */
export function detectMisses(plan, records, today) {
  if (!plan?.sessions || plan.sample) return []
  let since = null
  for (const r of records) if (r.date && (!since || r.date < since)) since = r.date
  if (!since) return []
  const logged = new Set(records.filter(r => r.type === 'missed').map(r => r.sessionId))
  return scheduledSessions(plan, records, today)
    .filter(s => s.status === 'missed' && s.date >= since && !logged.has(s.id))
}

export function missedRecord(session, today, now) {
  return {
    type: 'missed', id: `missed-${session.id}`, sessionId: session.id, sessionName: session.name,
    sessionDate: session.date, date: today, createdAt: now,
  }
}

/** Logged misses from the last 14 days that you haven't explained yet (oldest first). */
export function unexplainedMisses(records, today) {
  const explained = new Set(records.filter(r => r.type === 'excuse').map(r => keyOf(r.sessionId, r.sessionDate)))
  return records
    .filter(r => r.type === 'missed' && r.sessionDate < today && daysBetween(r.sessionDate, today) <= 14
      && !explained.has(keyOf(r.sessionId, r.sessionDate)))
    .map(r => ({ id: r.sessionId, name: r.sessionName || 'Session', date: r.sessionDate }))
    .sort(byDate)
}

/** Streak and compliance over `timeline(...)` (plan sessions + misses the plan no longer shows). */
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

/**
 * Everything that happened, newest first: workouts (from the log itself, so they show even when the
 * session is gone from the plan), misses and skips on the date they were planned for, and old moves.
 */
export function history(records, plan) {
  const nameOf = id => plan?.sessions?.find(s => s.id === id)?.name
  const excuses = new Map()
  const missed = new Set()
  const doneOn = new Set()
  for (const r of records) {
    if (r.type === 'excuse' && r.sessionId) excuses.set(keyOf(r.sessionId, r.sessionDate), r)
    if (r.type === 'missed') missed.add(keyOf(r.sessionId, r.sessionDate))
    if (r.type === 'workout') doneOn.add(keyOf(r.sessionId, r.date))
  }
  const out = []
  for (const r of records) {
    const k = keyOf(r.sessionId, r.sessionDate)
    if (r.type === 'workout') out.push({ kind: 'workout', key: r.id, date: r.date, at: r.startedAt || 0, workout: r })
    else if (r.type === 'missed') {
      out.push({ kind: 'missed', key: r.id, date: r.sessionDate, at: 0, name: r.sessionName || nameOf(r.sessionId) || 'Session', excuse: excuses.get(k) || null })
    } else if (r.type === 'excuse' && r.sessionId && r.sessionDate && !missed.has(k) && !doneOn.has(k)) {
      out.push({ kind: 'excused', key: r.id, date: r.sessionDate, at: 0, name: r.sessionName || nameOf(r.sessionId) || 'Session', excuse: r })
    } else if (r.type === 'reschedule') {
      out.push({ kind: 'moved', key: r.id, date: r.date, at: r.createdAt || 0, name: nameOf(r.sessionId) || 'Session', from: r.fromDate, to: r.toDate })
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at)
}

/** Workouts per day for the last `weeks` weeks (Monday-aligned), plus days with a missed session. */
export function heatmap(records, today, weeks = 12, events = []) {
  const start = addDays(startOfWeek(today), -7 * (weeks - 1))
  const counts = {}
  for (const r of records) if (r.type === 'workout' && r.date >= start) counts[r.date] = (counts[r.date] || 0) + 1
  const missed = new Set(events.filter(e => e.status === 'missed').map(e => e.date))
  const days = []
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i)
    days.push({ date: d, count: counts[d] || 0, missed: missed.has(d), future: d > today })
  }
  return days
}

export function prBoard(records) {
  return Object.entries(bestLifts(records))
    .map(([exerciseId, v]) => ({ exerciseId, ...v }))
    .sort((a, b) => b.e1rm - a.e1rm)
}
