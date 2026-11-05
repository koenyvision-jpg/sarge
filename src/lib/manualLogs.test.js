import { test } from 'node:test'
import assert from 'node:assert/strict'
import { durationText, outsideWorkoutRecord, parseDuration, replacementRecord } from './manualLogs.js'
import { accountability, history, liveRecords, scheduledSessions, timeline, unexplainedMisses } from './schedule.js'
import { bestLifts } from './engine.js'
import { buildSamplePlan } from './samplePlan.js'

const plan = buildSamplePlan('2026-10-12')
const run = plan.sessions.find(s => s.blocks.some(b => b.type === 'cardio') && s.blocks.some(b => b.type === 'hold'))

test('parseDuration reads minutes, m:ss and h:mm:ss; durationText round-trips', () => {
  assert.equal(parseDuration('40'), 2400)
  assert.equal(parseDuration('38:30'), 2310)
  assert.equal(parseDuration('38.30'), 2310)
  assert.equal(parseDuration('1:05:00'), 3900)
  for (const bad of ['', 'abc', '0', '1:2:3:4', '-5']) assert.equal(parseDuration(bad), null, bad)
  for (const sec of [2400, 2310, 3900]) assert.equal(parseDuration(durationText(sec)), sec)
})

test('outside log is a normal workout log: the run, warm-up/cool-down ticked, no skips', () => {
  const rec = outsideWorkoutRecord(run, { durationSec: 2310, distanceKm: 6.4, sessionRpe: 4 }, { id: 'w1', today: run.date, now: 10_000_000 })
  const block = run.blocks.find(b => b.type === 'cardio')
  const holds = run.blocks.filter(b => b.type === 'hold')
  assert.ok(holds.length > 0, 'sample run session has a mobility block')
  assert.equal(rec.type, 'workout')
  assert.equal(rec.source, 'outside')
  assert.equal(rec.sessionId, run.id)
  assert.equal(rec.date, run.date)
  assert.equal(rec.sessionRpe, 4)
  assert.deepEqual(rec.adjustments, [])
  assert.deepEqual(rec.blocks.map(b => b.blockId), run.blocks.map(b => b.id), 'planned order')
  const cardio = rec.blocks.find(b => b.cardio)
  assert.deepEqual(cardio.cardio, { exerciseId: block.exerciseId, durationSec: 2310, distanceKm: 6.4, avgHr: null })
  const hold = rec.blocks.find(b => b.type === 'hold')
  assert.ok(hold.timed.length > 0 && hold.timed.every(t => t.completed), 'holds ticked by default')
  assert.equal(rec.actualSec, 2310 + hold.actualSec)
  assert.equal(scheduledSessions(plan, [rec], run.date).find(s => s.id === run.id).status, 'done')
})

test('un-ticked warm-up/cool-down is logged as not done', () => {
  const rec = outsideWorkoutRecord(run, { durationSec: 2310, distanceKm: 6.4, doneBlockIds: [] }, { id: 'w1', today: run.date, now: 10_000_000 })
  const hold = rec.blocks.find(b => b.type === 'hold')
  assert.ok(hold.timed.every(t => !t.completed))
  assert.equal(hold.actualSec, 0)
  assert.equal(rec.actualSec, 2310)
  assert.deepEqual(rec.adjustments, [])
})

test('a per-side hold in the warm-up logs both sides', () => {
  const s = { id: 's', name: 'Run', date: '2026-11-05', blocks: [
    { id: 'w', type: 'hold', label: 'Warm-up', items: [{ exerciseId: 'leg-swing', holdSec: 30, sides: true }] },
    { id: 'r', type: 'cardio', exerciseId: 'run', durationMin: 30 },
  ] }
  const rec = outsideWorkoutRecord(s, { durationSec: 1800, distanceKm: 5 }, { id: 'x', today: '2026-11-05', now: 1 })
  assert.deepEqual(rec.blocks[0].timed.map(t => t.side), ['Left', 'Right'])
  assert.equal(rec.blocks[0].title, 'Warm-up')
})

test('outside log is dated on a past session date, otherwise today', () => {
  const opts = { durationSec: 1800, distanceKm: 5 }
  assert.equal(outsideWorkoutRecord(run, opts, { id: 'a', today: '2030-01-01', now: 1 }).date, run.date)
  assert.equal(outsideWorkoutRecord(run, opts, { id: 'b', today: '2026-01-01', now: 1 }).date, '2026-01-01')
})

test('a run logged afterwards clears the matching missed log from history and the explain prompt', () => {
  const miss = { type: 'missed', id: `missed-${run.id}`, sessionId: run.id, sessionName: run.name, sessionDate: run.date, date: '2030-01-01' }
  const rec = outsideWorkoutRecord(run, { durationSec: 1800, distanceKm: 5 }, { id: 'w', today: '2030-01-01', now: 1 })
  const today = run.date.replace(/\d\d$/, d => String(Number(d) + 2).padStart(2, '0'))
  assert.equal(unexplainedMisses([miss], today).length, 1)
  assert.equal(unexplainedMisses([miss, rec], today).length, 0)
  assert.deepEqual(history([miss, rec], plan).map(e => e.kind), ['workout'])
})

test('supersedes: the corrected log replaces the old one everywhere, chains included', () => {
  const a = { type: 'workout', id: 'A', sessionId: 's-2026-10-12', date: '2026-10-12', name: 'Lower', startedAt: 1, actualSec: 3000, plannedSec: 3000,
    blocks: [{ blockId: 'b1', type: 'single', title: 'Squat', actualSec: 900, exercises: [{ exerciseId: 'back-squat', sets: [{ reps: 5, load: 1000 }, { reps: 5, load: 100 }] }], timed: [] }] }
  const b = replacementRecord(a, { blocks: { b1: { sets: { 'back-squat': [{ reps: 5, load: 100 }] } } } }, [a], { id: 'B', now: 5 })
  assert.equal(b.supersedes, 'A')
  assert.equal(b.id, 'B')
  assert.deepEqual(b.blocks[0].exercises[0].sets, [{ reps: 5, load: 100 }, { reps: 5, load: 100 }])
  assert.equal(a.blocks[0].exercises[0].sets[0].load, 1000, 'old log untouched')

  const live = liveRecords([a, b])
  assert.deepEqual(live.map(r => r.id), ['B'])
  assert.ok(Math.round(bestLifts(live)['back-squat'].e1rm) < 200, 'typo no longer a PR')
  const s = timeline(scheduledSessions(plan, live, '2026-10-13'), live, plan)
  assert.equal(accountability(s, plan, '2026-10-13').doneThisWeek, 1, 'counted once')
  assert.equal(history(live, plan).filter(e => e.kind === 'workout').length, 1)

  const c = replacementRecord(b, { sessionRpe: 7, date: '2026-10-13' }, live, { id: 'C', now: 6 })
  assert.deepEqual(liveRecords([a, b, c]).map(r => r.id), ['C'])
  assert.equal(c.date, '2026-10-13')
  assert.equal(c.sessionRpe, 7)
})

test('fixing an outside run keeps its duration in step with the cardio block', () => {
  const rec = outsideWorkoutRecord(run, { durationSec: 1800, distanceKm: 5 }, { id: 'w', today: run.date, now: 1 })
  const cardioId = rec.blocks.find(b => b.cardio).blockId
  const holdSec = rec.blocks.filter(b => !b.cardio).reduce((t, b) => t + b.actualSec, 0)
  const fixed = replacementRecord(rec, { blocks: { [cardioId]: { cardio: { durationSec: 2400, distanceKm: 8 } } } }, [rec], { id: 'w2', now: 2 })
  assert.equal(fixed.actualSec, 2400 + holdSec)
  const c = fixed.blocks.find(b => b.cardio)
  assert.equal(c.actualSec, 2400)
  assert.equal(c.cardio.distanceKm, 8)
  assert.equal(fixed.source, 'outside')
})

test('run fields: any two give the third', async () => {
  const { linkRunFields, paceText } = await import('./manualLogs.js')
  const blank = { distance: '', duration: '', pace: '' }
  let f = linkRunFields(blank, 'distance', '6,4')
  f = linkRunFields(f, 'duration', '38.30')
  assert.equal(f.pace, '6:01')
  f = linkRunFields(f, 'pace', '5:30')
  assert.equal(f.duration, '35:12', 'pace with a distance changes the time')
  let g = linkRunFields(blank, 'duration', '30')
  g = linkRunFields(g, 'pace', '6')
  assert.equal(g.distance, '5', 'pace with only a time gives the distance')
  let h = linkRunFields(blank, 'pace', '5.00')
  h = linkRunFields(h, 'distance', '10')
  assert.equal(h.duration, '50', 'distance with only a pace gives the time')
  assert.equal(paceText(361), '6:01')
})

test('a skipped run can be put back when correcting, and its skip is dropped', async () => {
  const { missingCardioBlocks } = await import('./manualLogs.js')
  const session = { id: 's-run', name: 'Run', blocks: [
    { id: 'b0', type: 'hold', items: [] },
    { id: 'b1', type: 'cardio', exerciseId: 'run', durationMin: 35 },
    { id: 'b2', type: 'hold', items: [] },
  ] }
  const w = { type: 'workout', id: 'A', sessionId: 's-run', date: '2026-11-05', name: 'Run', actualSec: 8, plannedSec: 2205,
    adjustments: [{ type: 'skip', at: 'during', exerciseId: 'leg-swing', kind: 'timed' }, { type: 'skip', at: 'during', exerciseId: 'run', kind: 'cardio' }],
    blocks: [{ blockId: 'b0', type: 'hold', title: 'Warm-up', actualSec: 4, exercises: [], timed: [] }, { blockId: 'b2', type: 'hold', title: 'Cool-down', actualSec: 1, exercises: [], timed: [] }] }
  const missing = missingCardioBlocks(w, { sessions: [session] })
  assert.deepEqual(missing.map(m => [m.blockId, m.exerciseId, m.index]), [['b1', 'run', 1]])
  assert.deepEqual(missingCardioBlocks(w, { sessions: [] }).map(m => m.exerciseId), ['run'], 'falls back to the skip when the session is gone')

  const fixed = replacementRecord(w, { actualSec: 2160, blocks: { b1: { add: missing[0], cardio: { durationSec: 2100, distanceKm: 6 } } } }, [w], { id: 'B', now: 1 })
  assert.deepEqual(fixed.blocks.map(b => b.blockId), ['b0', 'b1', 'b2'])
  assert.deepEqual(fixed.blocks[1].cardio, { exerciseId: 'run', durationSec: 2100, distanceKm: 6, avgHr: null })
  assert.deepEqual(fixed.adjustments.map(a => a.exerciseId), ['leg-swing'], 'the run is no longer a skip')
  assert.deepEqual(missingCardioBlocks(fixed, { sessions: [session] }), [])
})
