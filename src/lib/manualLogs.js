// Workout logs that don't come from the in-app workout flow: a run done outside the app,
// and a corrected copy of a wrong log (which `supersedes` the old one — see liveRecords).

import { blockTitle, compileSession, estimateSteps, findPRs } from './engine.js'
import { getExercise } from './exercises.js'

/** The session's first cardio block, if it has one ("Done outside the app" logs against it). */
export function cardioBlockOf(session) {
  return session?.blocks?.find(b => b.type === 'cardio') || null
}

/** Blocks around the run that can be ticked off with it: the session's hold blocks (warm-up, cool-down). */
export function extraBlocksOf(session) {
  return (session?.blocks || []).filter(b => b.type === 'hold')
}

/** A hold block as a log entry, every hold marked done or not. */
function holdEntry(block, done) {
  const steps = compileSession({ blocks: [block], transitionSec: 0 })
  const planned = estimateSteps(steps)
  return {
    blockId: block.id, type: 'hold', title: blockTitle(block), actualSec: done ? planned : 0, plannedSec: planned,
    exercises: [],
    timed: steps.filter(st => st.kind === 'timed').map(st => ({
      exerciseId: st.exerciseId, ...(st.side ? { side: st.side } : {}), plannedSec: st.durationSec, completed: done,
    })),
  }
}

/**
 * A normal workout log for cardio done outside the app: the cardio block, plus the session's warm-up and
 * cool-down (hold blocks) marked done unless left out of `doneBlockIds`. No adjustments or skips.
 * Logged on the session's date if that has passed (you're catching up), otherwise today.
 */
export function outsideWorkoutRecord(session, { durationSec, distanceKm = null, sessionRpe = null, note = '', doneBlockIds }, { id, today, now }) {
  const block = cardioBlockOf(session)
  const date = session.date && session.date < today ? session.date : today
  const done = doneBlockIds ? new Set(doneBlockIds) : null
  const blocks = []
  let plannedSec = block?.durationMin ? block.durationMin * 60 : durationSec
  let actualSec = durationSec
  for (const b of session.blocks || []) {
    if (b === block) {
      blocks.push({
        blockId: block.id, type: 'cardio', title: blockTitle(block), actualSec: durationSec,
        exercises: [], timed: [],
        cardio: { exerciseId: block.exerciseId, durationSec, distanceKm, avgHr: null },
      })
    } else if (b.type === 'hold') {
      const { plannedSec: p, ...entry } = holdEntry(b, done ? done.has(b.id) : true)
      plannedSec += p
      actualSec += entry.actualSec
      blocks.push(entry)
    }
  }
  if (!block) {
    blocks.unshift({ blockId: 'cardio', type: 'cardio', title: 'Cardio', actualSec: durationSec, exercises: [], timed: [],
      cardio: { exerciseId: 'run', durationSec, distanceKm, avgHr: null } })
  }
  return {
    type: 'workout',
    id,
    sessionId: session.id,
    date,
    name: session.name,
    environment: session.environment,
    source: 'outside',
    startedAt: now - actualSec * 1000,
    finishedAt: now,
    plannedSec,
    actualSec,
    pausedSec: 0,
    overSec: 0,
    restOverSec: 0,
    endedEarly: false,
    sessionRpe,
    note,
    adjustments: [],
    blocks,
    prs: [],
  }
}

/** The run in a log (its first cardio block). */
export const cardioOf = workout => workout?.blocks?.find(b => b.cardio)?.cardio || null

/**
 * Cardio blocks a log could hold but doesn't: the planned session's cardio blocks missing from the log,
 * or (if the session is gone from the plan) one per cardio skip in its adjustments.
 * `index` is where the block sits in the planned session, to put it back in order.
 */
export function missingCardioBlocks(workout, plan) {
  const logged = new Set((workout.blocks || []).map(b => b.blockId))
  const session = plan?.sessions?.find(s => s.id === workout.sessionId)
  if (session) {
    return session.blocks
      .map((b, index) => ({ b, index }))
      .filter(({ b }) => b.type === 'cardio' && !logged.has(b.id))
      .map(({ b, index }) => ({ blockId: b.id, exerciseId: b.exerciseId, title: blockTitle(b), index }))
  }
  return (workout.adjustments || [])
    .filter(a => a.type === 'skip' && a.kind === 'cardio')
    .map((a, i) => ({ blockId: `cardio-${i + 1}`, exerciseId: a.exerciseId, title: getExercise(a.exerciseId).name }))
    .filter(x => !logged.has(x.blockId))
}

export function replacementRecord(old, edits, records, { id, now }) {
  const next = structuredClone(old)
  Object.assign(next, { id, supersedes: old.id, createdAt: now })
  delete next.prs
  if (edits.date) next.date = edits.date
  if (edits.actualSec != null) next.actualSec = edits.actualSec
  if ('sessionRpe' in edits) next.sessionRpe = edits.sessionRpe
  if ('note' in edits) next.note = edits.note
  // Cardio blocks the log is missing (skipped in the app, run anyway): add them back and drop the skip.
  for (const [blockId, e] of Object.entries(edits.blocks || {})) {
    if (!e.add || !e.cardio || (next.blocks || []).some(b => b.blockId === blockId)) continue
    const { durationSec, distanceKm = null } = e.cardio
    const block = {
      blockId, type: 'cardio', title: e.add.title || getExercise(e.add.exerciseId).name, actualSec: durationSec,
      exercises: [], timed: [], cardio: { exerciseId: e.add.exerciseId, durationSec, distanceKm, avgHr: null },
    }
    next.blocks = next.blocks || []
    next.blocks.splice(Math.min(e.add.index ?? next.blocks.length, next.blocks.length), 0, block)
    const skip = (next.adjustments || []).findIndex(a => a.type === 'skip' && a.kind === 'cardio' && a.exerciseId === e.add.exerciseId)
    if (skip >= 0) next.adjustments.splice(skip, 1)
  }
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
  // An outside log isn't timed by the app: its duration is the run plus the blocks ticked off with it.
  if (old.source === 'outside' && edits.actualSec == null) {
    next.actualSec = (next.blocks || []).reduce((sum, b) => sum + (b.cardio ? b.cardio.durationSec || 0 : b.actualSec || 0), 0)
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

/** Seconds per km → "6:01". */
export function paceText(secPerKm) {
  if (!secPerKm || !Number.isFinite(secPerKm)) return ''
  const t = Math.round(secPerKm)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

const readKm = text => {
  const v = Number(String(text ?? '').trim().replace(',', '.'))
  return String(text ?? '').trim() !== '' && Number.isFinite(v) && v > 0 ? v : null
}

/**
 * Distance / time / pace are linked: change one and the one that follows from the other two updates.
 * Pace changes the time if there's a distance (else the distance); distance or time changes the pace
 * if the other is there (else they're derived from the pace).
 */
export function linkRunFields(prev, field, value) {
  const next = { ...prev, [field]: value }
  const km = readKm(next.distance), sec = parseDuration(next.duration), pace = parseDuration(next.pace)
  if (field === 'pace') {
    if (pace && km) next.duration = durationText(Math.round(pace * km))
    else if (pace && sec) next.distance = String(Math.round((sec / pace) * 100) / 100)
  } else if (field === 'distance') {
    if (km && sec) next.pace = paceText(sec / km)
    else if (km && pace) next.duration = durationText(Math.round(pace * km))
  } else if (field === 'duration') {
    if (sec && km) next.pace = paceText(sec / km)
    else if (sec && pace) next.distance = String(Math.round((sec / pace) * 100) / 100)
  }
  return next
}

/** Starting values for the linked fields from a logged cardio entry. */
export function runFieldsFrom(cardio) {
  const sec = cardio?.durationSec, km = cardio?.distanceKm
  return { distance: km ? String(km) : '', duration: durationText(sec), pace: sec && km ? paceText(sec / km) : '' }
}
