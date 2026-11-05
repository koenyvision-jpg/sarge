// Pre-workout edits to a session, and a diff of what changed so the coach can
// see patterns ("you cut the last RDL set three weeks running").

import { alternativesFor, getExercise, isAvailable } from './exercises.js'

const clone = v => structuredClone(v)

export function updateBlock(session, blockId, fn) {
  const next = clone(session)
  const i = next.blocks.findIndex(b => b.id === blockId)
  if (i >= 0) {
    const res = fn(next.blocks[i])
    if (res) next.blocks[i] = res
  }
  return next
}

export function removeBlock(session, blockId) {
  return { ...session, blocks: session.blocks.filter(b => b.id !== blockId) }
}

export function moveBlock(session, blockId, dir) {
  const blocks = [...session.blocks]
  const i = blocks.findIndex(b => b.id === blockId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= blocks.length) return session
  ;[blocks[i], blocks[j]] = [blocks[j], blocks[i]]
  return { ...session, blocks }
}

/** Exercise ids used by a block, with a path to update each one. */
export function blockExercises(block) {
  if (block.type === 'interval' || block.type === 'cardio') return [{ exerciseId: block.exerciseId, key: 'self' }]
  if (block.type === 'hold') return (block.items || []).map((it, i) => ({ exerciseId: it.exerciseId, key: i }))
  return (block.exercises || []).map((e, i) => ({ exerciseId: e.exerciseId, key: i }))
}

export function swapExercise(session, blockId, key, toId) {
  return updateBlock(session, blockId, b => {
    if (key === 'self') b.exerciseId = toId
    else if (b.type === 'hold') b.items[key].exerciseId = toId
    else b.exercises[key] = { ...b.exercises[key], exerciseId: toId, load: null }
  })
}

export function removeExercise(session, blockId, key) {
  const block = session.blocks.find(b => b.id === blockId)
  const list = block.type === 'hold' ? block.items : block.exercises
  if (!list || list.length <= 1) return removeBlock(session, blockId)
  return updateBlock(session, blockId, b => {
    if (b.type === 'hold') b.items.splice(key, 1)
    else b.exercises.splice(key, 1)
  })
}

export function addExerciseBlock(session, exerciseId) {
  const ex = getExercise(exerciseId)
  const id = `x${Date.now().toString(36)}`
  let block
  if (ex.kind === 'cardio') block = { id, type: 'cardio', exerciseId, durationMin: 15, target: '' }
  else if (ex.kind === 'mobility') block = { id, type: 'hold', rounds: 1, restBetweenSec: 10, items: [{ exerciseId, holdSec: 45, sides: false }] }
  else block = { id, type: 'single', exercises: [{ exerciseId, sets: 3, reps: 10, restSec: 90, load: null }] }
  return { ...session, blocks: [...session.blocks, block] }
}

/** Every exercise in the session the environment can't support. */
export function unavailableExercises(session, equipment) {
  const out = []
  for (const b of session.blocks) {
    for (const e of blockExercises(b)) {
      if (!isAvailable(e.exerciseId, equipment)) out.push({ blockId: b.id, ...e })
    }
  }
  return out
}

/** Swap everything unavailable for the best alternative. Returns { session, unresolved }. */
export function adaptToEnvironment(session, equipment) {
  let next = session
  const unresolved = []
  for (const u of unavailableExercises(session, equipment)) {
    const alt = alternativesFor(u.exerciseId, equipment)[0]
    if (alt) next = swapExercise(next, u.blockId, u.key, alt.id)
    else unresolved.push(u.exerciseId)
  }
  return { session: next, unresolved }
}

const FIELDS = {
  single: [],
  superset: ['rounds', 'restSec', 'restBetweenSec'],
  circuit: ['rounds', 'restSec', 'restBetweenSec'],
  interval: ['rounds', 'workSec', 'restSec'],
  hold: ['rounds', 'restBetweenSec'],
  cardio: ['durationMin'],
}
const EX_FIELDS = ['warmupSets', 'sets', 'reps', 'load', 'restSec']
const TYPE_FOR = { warmupSets: 'sets', sets: 'sets', reps: 'reps', load: 'load', restSec: 'rest', restBetweenSec: 'rest', rounds: 'sets', workSec: 'reps', durationMin: 'reps', holdSec: 'reps' }

/** List of adjustments between the planned session and the edited one. */
export function diffSession(original, edited, { fromEnv, toEnv } = {}) {
  const out = []
  if (fromEnv && toEnv && fromEnv !== toEnv) out.push({ type: 'environment', from: fromEnv, to: toEnv, at: 'before' })
  const origById = new Map(original.blocks.map(b => [b.id, b]))
  const editIds = new Set(edited.blocks.map(b => b.id))

  for (const b of original.blocks) {
    if (!editIds.has(b.id)) out.push({ type: 'remove', blockId: b.id, exerciseIds: blockExercises(b).map(e => e.exerciseId), at: 'before' })
  }
  const commonOrig = original.blocks.filter(b => editIds.has(b.id)).map(b => b.id)
  const commonEdit = edited.blocks.filter(b => origById.has(b.id)).map(b => b.id)
  if (commonOrig.join() !== commonEdit.join()) out.push({ type: 'reorder', from: commonOrig, to: commonEdit, at: 'before' })

  for (const b of edited.blocks) {
    const o = origById.get(b.id)
    if (!o) {
      out.push({ type: 'add', blockId: b.id, exerciseIds: blockExercises(b).map(e => e.exerciseId), at: 'before' })
      continue
    }
    for (const f of FIELDS[b.type] || []) {
      if (o[f] !== b[f]) out.push({ type: TYPE_FOR[f], blockId: b.id, field: f, from: o[f] ?? null, to: b[f] ?? null, at: 'before' })
    }
    if (b.type === 'interval' || b.type === 'cardio') {
      if (o.exerciseId !== b.exerciseId) out.push({ type: 'swap', blockId: b.id, from: o.exerciseId, to: b.exerciseId, at: 'before' })
      continue
    }
    const oList = (b.type === 'hold' ? o.items : o.exercises) || []
    const eList = (b.type === 'hold' ? b.items : b.exercises) || []
    const matched = new Set()
    eList.forEach((e, i) => {
      // Match by exercise id first, else by position (= a swap).
      let j = oList.findIndex((x, k) => !matched.has(k) && x.exerciseId === e.exerciseId)
      if (j < 0 && i < oList.length && !matched.has(i) && !eList.some(x => x.exerciseId === oList[i].exerciseId)) j = i
      if (j < 0) {
        out.push({ type: 'add', blockId: b.id, exerciseIds: [e.exerciseId], at: 'before' })
        return
      }
      matched.add(j)
      const ox = oList[j]
      if (ox.exerciseId !== e.exerciseId) out.push({ type: 'swap', blockId: b.id, from: ox.exerciseId, to: e.exerciseId, at: 'before' })
      for (const f of b.type === 'hold' ? ['holdSec'] : EX_FIELDS) {
        if ((ox[f] ?? null) !== (e[f] ?? null) && !(f === 'load' && ox.exerciseId !== e.exerciseId)) {
          out.push({ type: TYPE_FOR[f], blockId: b.id, exerciseId: e.exerciseId, field: f, from: ox[f] ?? null, to: e[f] ?? null, at: 'before' })
        }
      }
    })
    oList.forEach((x, j) => {
      if (!matched.has(j)) out.push({ type: 'remove', blockId: b.id, exerciseIds: [x.exerciseId], at: 'before' })
    })
  }
  return out
}

export function describeAdjustment(a) {
  const name = id => getExercise(id).name
  switch (a.type) {
    case 'swap': return `Swapped ${name(a.from)} → ${name(a.to)}`
    case 'remove': return `Removed ${a.exerciseIds.map(name).join(', ')}`
    case 'add': return `Added ${a.exerciseIds.map(name).join(', ')}`
    case 'reorder': return 'Changed the order'
    case 'environment': return `Switched location ${a.from} → ${a.to}`
    case 'shorten-rests': return 'Shortened rests mid-workout'
    case 'drop-set': return `Dropped set ${a.setNo} of ${name(a.exerciseId)}`
    case 'skip': return a.kind === 'set'
      ? `Skipped set ${a.setNo} of ${name(a.exerciseId)}`
      : `Skipped ${name(a.exerciseId)}${a.side ? ` (${a.side.toLowerCase()} side)` : ''}${a.kind === 'timed' && a.setNo ? `, round ${a.setNo}` : ''}`
    default: return `${a.exerciseId ? name(a.exerciseId) + ' ' : ''}${a.field}: ${a.from ?? '—'} → ${a.to ?? '—'}`
  }
}
