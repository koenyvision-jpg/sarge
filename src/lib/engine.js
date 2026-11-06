// Workout engine: turns a planned session into a linear list of timed steps,
// estimates durations, and tracks pace during the workout. Pure functions only,
// so the whole state can be persisted and resumed after iOS kills the app.

import { getExercise } from './exercises.js'

export const DEFAULT_TRANSITION_SEC = 90
export const NAG_EVERY_SEC = 15
const SEC_PER_REP = 4
const SET_SETUP_SEC = 15
const MIN_SET_SEC = 25

/** '8-10' → 10, '5' → 5, 'AMRAP' → 12. Upper bound so estimates aren't optimistic. */
export function parseReps(reps) {
  if (typeof reps === 'number') return reps
  const nums = String(reps ?? '').match(/\d+/g)
  return nums ? Math.max(...nums.map(Number)) : 12
}

export function expectedSetSec(reps) {
  return Math.max(MIN_SET_SEC, parseReps(reps) * SEC_PER_REP + SET_SETUP_SEC)
}

const AUTO_KINDS = new Set(['rest', 'transition', 'timed'])
export const autoAdvances = step => AUTO_KINDS.has(step.kind)

export function blockTitle(block) {
  if (block.label) return block.label
  switch (block.type) {
    case 'superset': return 'Superset'
    case 'circuit': return 'Circuit'
    case 'interval': return `Intervals · ${getExercise(block.exerciseId).name}`
    case 'hold': return 'Mobility'
    case 'cardio': return getExercise(block.exerciseId).name
    default: return getExercise(block.exercises?.[0]?.exerciseId).name
  }
}

/** Done one side at a time: the plan's `perSide`, else the exercise's own `sided` flag. */
export const isPerSide = e => e?.perSide ?? !!getExercise(e?.exerciseId).sided

/** Compile a session into steps. Each block is preceded by a transition (except the first). */
export function compileSession(session) {
  const steps = []
  const transitionSec = session.transitionSec ?? DEFAULT_TRANSITION_SEC
  ;(session.blocks || []).forEach((block, blockIndex) => {
    let n = 0
    const id = () => `${block.id}:${n++}`
    const base = { blockId: block.id, blockIndex }
    const rest = (durationSec, label = 'Rest') => {
      if (durationSec > 0) steps.push({ ...base, id: id(), kind: 'rest', durationSec, label })
    }
    // One set of an exercise; with `perSide` that's the left side, a short switch, then the right side.
    const sets = (e, setNo, setsTotal, exIndex, extra = {}) => {
      if (!isPerSide(e)) return steps.push({ ...setStep(base, id(), e, setNo, setsTotal, exIndex), ...extra })
      steps.push({ ...setStep(base, id(), e, setNo, setsTotal, exIndex), ...extra, side: 'Left' })
      rest(e.switchSec ?? 10, 'Switch sides')
      steps.push({ ...setStep(base, id(), e, setNo, setsTotal, exIndex), ...extra, side: 'Right' })
    }

    if (blockIndex > 0 && transitionSec > 0) {
      steps.push({ ...base, id: id(), kind: 'transition', durationSec: transitionSec, label: 'Next up' })
    }

    switch (block.type) {
      case 'superset':
      case 'circuit': {
        const rounds = block.rounds || 3
        const between = block.restBetweenSec ?? (block.type === 'circuit' ? 10 : 15)
        const exs = block.exercises || []
        for (let r = 1; r <= rounds; r++) {
          exs.forEach((e, i) => {
            sets(e, r, rounds, i)
            if (i < exs.length - 1) rest(between, 'Switch')
          })
          if (r < rounds) rest(block.restSec ?? 90)
        }
        break
      }
      case 'interval': {
        const rounds = block.rounds || 4
        for (let r = 1; r <= rounds; r++) {
          steps.push({
            ...base, id: id(), kind: 'timed', exerciseId: block.exerciseId,
            durationSec: block.workSec || 60, setNo: r, setsTotal: rounds,
            label: getExercise(block.exerciseId).name, target: block.target || 'Work',
          })
          if (r < rounds) rest(block.restSec ?? 60)
        }
        break
      }
      case 'hold': {
        const rounds = block.rounds || 1
        const items = block.items || []
        const holds = []
        for (let r = 1; r <= rounds; r++) {
          items.forEach(item => {
            for (const side of item.sides ? ['Left', 'Right'] : [null]) holds.push({ item, side, r })
          })
        }
        holds.forEach(({ item, side, r }, i) => {
          steps.push({
            ...base, id: id(), kind: 'timed', exerciseId: item.exerciseId,
            durationSec: item.holdSec || 30, side, setNo: r, setsTotal: rounds,
            label: getExercise(item.exerciseId).name, target: side ? `${side} side` : 'Hold',
          })
          if (i < holds.length - 1) rest(block.restBetweenSec ?? 10, 'Switch')
        })
        break
      }
      case 'cardio': {
        steps.push({
          ...base, id: id(), kind: 'cardio', exerciseId: block.exerciseId,
          durationSec: Math.round((block.durationMin || 20) * 60),
          label: getExercise(block.exerciseId).name, target: block.target || '',
        })
        break
      }
      default: { // 'single'
        const e = block.exercises?.[0]
        if (!e) break
        const warm = e.warmupSets || 0
        for (let k = 1; k <= warm; k++) {
          const reps = e.warmupReps ?? 5
          sets(e, k, warm, 0, { warmup: true, target: { reps, load: null, rpe: null }, expectedSec: expectedSetSec(reps) })
          rest(e.warmupRestSec ?? 60)
        }
        const total = e.sets || 3
        for (let k = 1; k <= total; k++) {
          sets(e, k, total, 0)
          if (k < total) rest(e.restSec ?? 90)
        }
      }
    }
  })
  return steps
}

function setStep(base, id, e, setNo, setsTotal, exIndex) {
  return {
    ...base, id, kind: 'set', exIndex, exerciseId: e.exerciseId,
    setNo, setsTotal, label: getExercise(e.exerciseId).name,
    target: { reps: e.reps, load: e.load ?? null, rpe: e.rpe ?? null },
    expectedSec: expectedSetSec(e.reps),
  }
}

/** Seconds a step is planned to take. Rests are scaled when the user asks to shorten them. */
export function stepDuration(step, restScale = 1) {
  if (step.kind === 'set') return step.expectedSec
  if (step.kind === 'rest') return Math.max(5, Math.round(step.durationSec * restScale))
  return step.durationSec
}

export function estimateSteps(steps, restScale = 1) {
  return steps.reduce((sum, s) => sum + stepDuration(s, restScale), 0)
}

export function estimateSessionSec(session) {
  return estimateSteps(compileSession(session))
}

/** Planned seconds per block id (transition into a block counts toward that block). */
export function estimateByBlock(session) {
  const out = {}
  for (const s of compileSession(session)) out[s.blockId] = (out[s.blockId] || 0) + stepDuration(s)
  return out
}

// ── Live workout state ────────────────────────────────────────────────────

export function startWorkout({ session, plannedSession, adjustments = [], environment, now }) {
  const steps = compileSession(session)
  return {
    id: `w${now.toString(36)}`,
    sessionId: plannedSession?.id ?? session.id ?? null,
    date: session.date,
    name: session.name,
    environment,
    session,
    adjustments,
    steps,
    plannedSec: estimateSteps(steps),
    index: 0,
    startedAt: now,
    stepStartedAt: now,
    pausedAt: null,
    pausedTotalMs: 0,
    restScale: 1,
    stepExtraSec: 0,
    results: {},
    finishedAt: null,
  }
}

const clockOf = (state, now) => state.pausedAt ?? now

export function stepElapsedSec(state, now) {
  return Math.max(0, (clockOf(state, now) - state.stepStartedAt) / 1000)
}

/** Planned length of the current step, including any "+30s" the user added. */
export function currentStepDuration(state) {
  const step = state.steps[state.index]
  return step ? stepDuration(step, state.restScale) + (state.stepExtraSec || 0) : 0
}

export function pace(state, now) {
  const clock = clockOf(state, now)
  const elapsedSec = Math.max(0, (clock - state.startedAt - state.pausedTotalMs) / 1000)
  const step = state.steps[state.index]
  const stepElapsed = stepElapsedSec(state, now)
  const stepPlanned = step ? stepDuration(step) : 0
  const plannedBefore = estimateSteps(state.steps.slice(0, state.index))
  const behindSec = elapsedSec - plannedBefore - Math.min(stepElapsed, stepPlanned)
  const stepRemaining = step ? Math.max(0, currentStepDuration(state) - stepElapsed) : 0
  const remainingSec = stepRemaining + estimateSteps(state.steps.slice(state.index + 1), state.restScale)
  return {
    elapsedSec,
    behindSec,
    remainingSec,
    projectedEndMs: clock + remainingSec * 1000,
    projectedTotalSec: elapsedSec + remainingSec,
    progress: state.steps.length ? state.index / state.steps.length : 1,
  }
}

/** Seconds past what this step should have taken (set taking too long, or rest overrun). */
export function overrunSec(state, now) {
  const step = state.steps[state.index]
  if (!step || step.kind === 'cardio') return 0
  return Math.max(0, stepElapsedSec(state, now) - currentStepDuration(state))
}

/** Finish the current step and move on. `result` holds logged reps/load etc. */
export function advance(state, now, result = {}) {
  const step = state.steps[state.index]
  if (!step) return state
  const actualSec = Math.round(stepElapsedSec(state, now))
  const over = step.kind === 'set' || step.kind === 'timed'
    ? Math.max(0, actualSec - currentStepDuration(state))
    : 0
  const results = {
    ...state.results,
    [step.id]: {
      ...result,
      actualSec,
      overSec: Math.round(over),
      extendedSec: Math.round(state.stepExtraSec || 0),
      endedAt: now,
    },
  }
  const index = state.index + 1
  return {
    ...state,
    results,
    index,
    stepStartedAt: now,
    stepExtraSec: 0,
    finishedAt: index >= state.steps.length ? now : null,
  }
}

/**
 * Advance through any auto steps (rest/transition/timed) whose time ran out —
 * e.g. while the phone was locked. Each step "ends" at its planned time, not `now`.
 */
export function catchUp(state, now) {
  let s = state
  while (!s.pausedAt && !s.finishedAt) {
    const step = s.steps[s.index]
    if (!step || !autoAdvances(step)) break
    const endsAt = s.stepStartedAt + currentStepDuration(s) * 1000
    if (endsAt > now) break
    s = advance(s, endsAt, step.kind === 'timed' ? { completed: true } : {})
  }
  return s
}

export function pause(state, now) {
  return state.pausedAt ? state : { ...state, pausedAt: now }
}

export function resume(state, now) {
  if (!state.pausedAt) return state
  const pausedMs = now - state.pausedAt
  return {
    ...state,
    pausedAt: null,
    pausedTotalMs: state.pausedTotalMs + pausedMs,
    stepStartedAt: state.stepStartedAt + pausedMs,
  }
}

export function extendStep(state, sec = 30) {
  return { ...state, stepExtraSec: (state.stepExtraSec || 0) + sec }
}

/** Add (+) or take off (−) seconds on the current timer. Never below what has already run:
 *  taking off more than is left ends the step (rests and holds then advance on their own). */
export function adjustStep(state, now, sec) {
  const step = state.steps[state.index]
  if (!step) return state
  const minExtra = stepElapsedSec(state, now) - stepDuration(step, state.restScale)
  return { ...state, stepExtraSec: Math.max(minExtra, (state.stepExtraSec || 0) + sec) }
}

/** Start the current step's timer over, dropping any time added or taken off. Stays paused if paused. */
export function restartStep(state, now) {
  return { ...state, stepStartedAt: clockOf(state, now), stepExtraSec: 0 }
}

/** Move on without logging. Skipped work is noted in the adjustments so the coach sees it. */
export function skipStep(state, now) {
  const step = state.steps[state.index]
  if (!step) return state
  const work = ['set', 'timed', 'cardio'].includes(step.kind)
  const next = advance(state, clockOf(state, now), { skipped: true })
  if (!work) return next
  return {
    ...next,
    adjustments: [...next.adjustments, {
      type: 'skip', at: 'during', exerciseId: step.exerciseId, kind: step.kind,
      ...(step.setNo ? { setNo: step.setNo } : {}), ...(step.side ? { side: step.side } : {}),
    }],
  }
}

export function shortenRests(state, factor = 0.75) {
  return {
    ...state,
    restScale: Math.max(0.4, state.restScale * factor),
    adjustments: [...state.adjustments, { type: 'shorten-rests', factor, at: 'during' }],
  }
}

/** Step back to the previous non-rest step (fixing a mis-tap). */
export function goBack(state, now) {
  let i = state.index - 1
  while (i > 0 && !['set', 'timed', 'cardio'].includes(state.steps[i].kind)) i--
  if (i < 0) return state
  const results = { ...state.results }
  for (let k = i; k < state.steps.length; k++) delete results[state.steps[k].id]
  return { ...state, index: i, stepStartedAt: clockOf(state, now), stepExtraSec: 0, results, finishedAt: null }
}

/** The last remaining working set of the session's last strength block, or -1. */
export function lastDroppableSetIndex(state) {
  for (let i = state.steps.length - 1; i > state.index; i--) {
    if (state.steps[i].kind === 'set') return i
  }
  return -1
}

/** Drop the last set of the session (plus the rest leading into it). A per-side set goes as a whole. */
export function dropLastSet(state) {
  const i = lastDroppableSetIndex(state)
  if (i < 0) return state
  let first = i
  const last = state.steps[i]
  if (last.side) {
    for (let k = i - 1; k > state.index; k--) {
      const s = state.steps[k]
      if (s.kind === 'set' && s.blockId === last.blockId && s.exerciseId === last.exerciseId && s.setNo === last.setNo) first = k
      else if (s.kind !== 'rest') break
    }
  }
  const removeFrom = state.steps[first - 1]?.kind === 'rest' && first - 1 > state.index ? first - 1 : first
  const dropped = state.steps[i]
  const steps = [...state.steps.slice(0, removeFrom), ...state.steps.slice(i + 1)]
  return {
    ...state,
    steps,
    adjustments: [...state.adjustments, {
      type: 'drop-set', exerciseId: dropped.exerciseId, setNo: dropped.setNo, at: 'during',
    }],
  }
}

/** End early: remaining steps are recorded as skipped. */
export function endEarly(state, now) {
  const s = state.steps[state.index] ? advance(state, now, { skipped: true }) : state
  return { ...s, index: s.steps.length, finishedAt: now, endedEarly: s.index < s.steps.length }
}

// ── Records & history ─────────────────────────────────────────────────────

/** Epley estimate of one-rep max. */
export function e1rm(load, reps) {
  if (!load || !reps) return 0
  return reps === 1 ? load : load * (1 + reps / 30)
}

export function buildWorkoutRecord(state, { sessionRpe = null, note = '' } = {}) {
  const blocks = []
  const byBlock = new Map()
  let overSec = 0
  let restOverSec = 0
  for (const step of state.steps) {
    const r = state.results[step.id]
    if (!byBlock.has(step.blockId)) {
      const block = state.session.blocks.find(b => b.id === step.blockId) || { id: step.blockId, type: 'single' }
      const entry = { blockId: step.blockId, type: block.type || 'single', title: blockTitle(block), actualSec: 0, exercises: [], timed: [] }
      byBlock.set(step.blockId, entry)
      blocks.push(entry)
    }
    const entry = byBlock.get(step.blockId)
    if (!r) continue
    entry.actualSec += r.actualSec || 0
    // Time added to a timer counts against you; time taken off doesn't cancel out slow sets.
    const extended = Math.max(0, r.extendedSec || 0)
    overSec += (r.overSec || 0) + extended
    restOverSec += step.kind === 'rest' || step.kind === 'transition' ? extended : 0
    if (step.kind === 'set' && !r.skipped) {
      let ex = entry.exercises.find(e => e.exerciseId === step.exerciseId)
      if (!ex) entry.exercises.push(ex = { exerciseId: step.exerciseId, sets: [] })
      ex.sets.push({
        reps: r.reps, load: r.load ?? null, ...(r.rpe ? { rpe: r.rpe } : {}),
        ...(step.side ? { side: step.side } : {}), ...(step.warmup ? { warmup: true } : {}),
      })
    } else if (step.kind === 'timed') {
      entry.timed.push({ exerciseId: step.exerciseId, side: step.side || undefined, plannedSec: step.durationSec, completed: !r.skipped })
    } else if (step.kind === 'cardio' && !r.skipped) {
      entry.cardio = { exerciseId: step.exerciseId, durationSec: r.actualSec, distanceKm: r.distanceKm ?? null, avgHr: r.avgHr ?? null }
    }
  }
  const finishedAt = state.finishedAt ?? Date.now()
  return {
    type: 'workout',
    id: state.id,
    sessionId: state.sessionId,
    date: state.date,
    name: state.name,
    environment: state.environment,
    startedAt: state.startedAt,
    finishedAt,
    plannedSec: state.plannedSec,
    actualSec: Math.round((finishedAt - state.startedAt - state.pausedTotalMs) / 1000),
    pausedSec: Math.round(state.pausedTotalMs / 1000),
    overSec: Math.round(overSec),
    restOverSec: Math.round(restOverSec),
    endedEarly: !!state.endedEarly,
    sessionRpe,
    note,
    adjustments: state.adjustments,
    blocks: blocks.filter(b => b.exercises.length || b.timed.length || b.cardio),
  }
}

/** Best e1RM per exercise across workout records. */
export function bestLifts(records) {
  const best = {}
  for (const rec of records) {
    if (rec.type !== 'workout') continue
    for (const b of rec.blocks || []) {
      for (const ex of b.exercises || []) {
        for (const set of ex.sets) {
          if (set.warmup) continue
          const v = e1rm(set.load, set.reps)
          if (v > (best[ex.exerciseId]?.e1rm || 0)) {
            best[ex.exerciseId] = { e1rm: v, load: set.load, reps: set.reps, date: rec.date }
          }
        }
      }
    }
  }
  return best
}

/** Exercises in `record` that beat every earlier record (first-ever lifts don't count). */
export function findPRs(record, history) {
  const before = bestLifts(history.filter(r => r.id !== record.id))
  const now = bestLifts([record])
  return Object.entries(now)
    .filter(([id, v]) => before[id] && v.e1rm > before[id].e1rm + 0.01)
    .map(([exerciseId, v]) => ({ exerciseId, ...v, previous: before[exerciseId].e1rm }))
}

/** Most recent logged sets for an exercise. */
export function lastPerformance(exerciseId, records, excludeId) {
  const sorted = records
    .filter(r => r.type === 'workout' && r.id !== excludeId)
    .sort((a, b) => b.startedAt - a.startedAt)
  for (const rec of sorted) {
    for (const b of rec.blocks || []) {
      const ex = (b.exercises || []).find(e => e.exerciseId === exerciseId)
      const work = ex?.sets.filter(st => !st.warmup) || []
      if (work.length) return { date: rec.date, sets: work }
    }
  }
  return null
}

export function summarizeSets(allSets) {
  const sets = (allSets || []).filter(st => !st.warmup)
  if (!sets.length) return ''
  // Per-side sets: summarise one side and say "each side" when both match, else list both.
  if (sets.some(st => st.side)) {
    const left = sets.filter(st => st.side === 'Left'), right = sets.filter(st => st.side === 'Right')
    const strip = list => list.map(st => ({ reps: st.reps, load: st.load }))
    const l = summarizeSets(strip(left)), r = summarizeSets(strip(right))
    if (l === r) return `${l} each side`
    return [l && `L ${l}`, r && `R ${r}`].filter(Boolean).join(' · ')
  }
  const same = sets.every(s => s.reps === sets[0].reps && s.load === sets[0].load)
  const fmt = s => (s.load ? `${s.load}×${s.reps}` : `${s.reps}`)
  if (same) return sets[0].load ? `${sets.length}×${sets[0].reps} @ ${sets[0].load} kg` : `${sets.length}×${sets[0].reps}`
  return sets.map(fmt).join(', ')
}
