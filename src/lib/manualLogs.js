// Workout logs that don't come from the in-app workout flow: a run done outside the app,
// and a corrected copy of a wrong log (which `supersedes` the old one — see liveRecords).

import { blockTitle, findPRs } from './engine.js'

/** The session's first cardio block, if it has one ("Done outside the app" logs against it). */
export function cardioBlockOf(session) {
  return session?.blocks?.find(b => b.type === 'cardio') || null
}

/**
 * A normal workout log for cardio done outside the app: one cardio block, no adjustments or skips.
 * Logged on the session's date if that has passed (you're catching up), otherwise today.
 */
export function outsideWorkoutRecord(session, { durationSec, distanceKm = null, sessionRpe = null, note = '' }, { id, today, now }) {
  const block = cardioBlockOf(session)
  const date = session.date && session.date < today ? session.date : today
  const plannedSec = block?.durationMin ? block.durationMin * 60 : durationSec
  return {
    type: 'workout',
    id,
    sessionId: session.id,
    date,
    name: session.name,
    environment: session.environment,
    source: 'outside',
    startedAt: now - durationSec * 1000,
    finishedAt: now,
    plannedSec,
    actualSec: durationSec,
    pausedSec: 0,
    overSec: 0,
    restOverSec: 0,
    endedEarly: false,
    sessionRpe,
    note,
    adjustments: [],
    blocks: [{
      blockId: block?.id || 'cardio', type: 'cardio', title: block ? blockTitle(block) : 'Cardio', actualSec: durationSec,
      exercises: [], timed: [],
      cardio: { exerciseId: block?.exerciseId || 'run', durationSec, distanceKm, avgHr: null },
    }],
    prs: [],
  }
}

/**
 * A corrected copy of `old` with `edits` applied, under a new id, pointing back at it with `supersedes`.
 * `records` should be the live records; the old log is left out when PRs are recomputed.
 */
export function replacementRecord(old, edits, records, { id, now }) {
  const next = structuredClone(old)
  Object.assign(next, { id, supersedes: old.id, createdAt: now })
  delete next.prs
  if (edits.date) next.date = edits.date
  if (edits.actualSec != null) next.actualSec = edits.actualSec
  if ('sessionRpe' in edits) next.sessionRpe = edits.sessionRpe
  if ('note' in edits) next.note = edits.note
  for (const b of next.blocks || []) {
    const e = edits.blocks?.[b.blockId]
    if (!e) continue
    if (b.cardio && e.cardio) {
      b.cardio = { ...b.cardio, ...e.cardio }
      b.actualSec = b.cardio.durationSec ?? b.actualSec
    }
    for (const ex of b.exercises || []) {
      const sets = e.sets?.[ex.exerciseId]
      if (sets) ex.sets = ex.sets.map((s, i) => ({ ...s, ...sets[i] }))
    }
  }
  // A single-block outside log has nothing else to time, so its duration follows the cardio.
  if (old.source === 'outside' && edits.actualSec == null) {
    next.actualSec = next.blocks?.[0]?.cardio?.durationSec ?? next.actualSec
  }
  next.prs = findPRs(next, records.filter(r => r.id !== old.id))
  return next
}

/** "45" → 45 min, "45:30" → 45 min 30 s, "1:05:00" → 1 h 5 min. Returns seconds, or null if unreadable. */
export function parseDuration(text) {
  const parts = String(text ?? '').trim().replace(/[.,]/g, ':').split(':')
  if (!parts[0] || parts.length > 3 || parts.some(p => !/^\d+$/.test(p))) return null
  const n = parts.map(Number)
  const sec = parts.length === 1 ? n[0] * 60 : parts.length === 2 ? n[0] * 60 + n[1] : n[0] * 3600 + n[1] * 60 + n[2]
  return sec > 0 ? sec : null
}

/** Seconds → "45:30" / "1:05:00", the format parseDuration reads back. */
export function durationText(sec) {
  if (!sec) return ''
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60)
  const pad = v => String(v).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s)}` : s ? `${m}:${pad(s)}` : String(m)
}
