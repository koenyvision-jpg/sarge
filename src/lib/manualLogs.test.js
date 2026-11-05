import { test } from 'node:test'
import assert from 'node:assert/strict'
import { durationText, outsideWorkoutRecord, parseDuration, replacementRecord } from './manualLogs.js'
import { accountability, history, liveRecords, scheduledSessions, timeline, unexplainedMisses } from './schedule.js'
import { bestLifts } from './engine.js'
import { buildSamplePlan } from './samplePlan.js'

const plan = buildSamplePlan('2026-10-12')
const run = plan.sessions.find(s => s.blocks.some(b => b.type === 'cardio'))

test('parseDuration reads minutes, m:ss and h:mm:ss; durationText round-trips', () => {
  assert.equal(parseDuration('40'), 2400)
  assert.equal(parseDuration('38:30'), 2310)
  assert.equal(parseDuration('38.30'), 2310)
  assert.equal(parseDuration('1:05:00'), 3900)
  for (const bad of ['', 'abc', '0', '1:2:3:4', '-5']) assert.equal(parseDuration(bad), null, bad)
  for (const sec of [2400, 2310, 3900]) assert.equal(parseDuration(durationText(sec)), sec)
})

test('outside log is a normal workout log with one cardio block and no skips', () => {
  const rec = outsideWorkoutRecord(run, { durationSec: 2310, distanceKm: 6.4, sessionRpe: 4 }, { id: 'w1', today: run.date, now: 10_000_000 })
  const block = run.blocks.find(b => b.type === 'cardio')
  assert.equal(rec.type, 'workout')
  assert.equal(rec.source, 'outside')
  assert.equal(rec.sessionId, run.id)
  assert.equal(rec.date, run.date)
  assert.equal(rec.actualSec, 2310)
  assert.equal(rec.plannedSec, block.durationMin * 60)
  assert.equal(rec.sessionRpe, 4)
  assert.deepEqual(rec.adjustments, [])
  assert.equal(rec.blocks.length, 1)
  assert.deepEqual(rec.blocks[0].cardio, { exerciseId: block.exerciseId, durationSec: 2310, distanceKm: 6.4, avgHr: null })
  assert.equal(rec.blocks[0].blockId, block.id)
  // It marks the session done.
  assert.equal(scheduledSessions(plan, [rec], run.date).find(s => s.id === run.id).status, 'done')
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
  const fixed = replacementRecord(rec, { blocks: { [rec.blocks[0].blockId]: { cardio: { durationSec: 2400, distanceKm: 8 } } } }, [rec], { id: 'w2', now: 2 })
  assert.equal(fixed.actualSec, 2400)
  assert.equal(fixed.blocks[0].actualSec, 2400)
  assert.equal(fixed.blocks[0].cardio.distanceKm, 8)
  assert.equal(fixed.source, 'outside')
})
