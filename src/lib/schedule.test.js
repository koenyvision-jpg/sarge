import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scheduledSessions, unexplainedMisses, accountability, recordPath, fallbackOrders } from './schedule.js'
import { diffSession, adaptToEnvironment, swapExercise, removeBlock, moveBlock, updateBlock } from './adjust.js'
import { buildSamplePlan, sampleIsStale, DEFAULT_ENVIRONMENTS } from './samplePlan.js'

const plan = buildSamplePlan('2026-10-12') // Mon 12 Oct … Sun 8 Nov
const today = '2026-10-15' // Thursday

test('statuses: done, excused, missed, today, upcoming; reschedules move sessions', () => {
  const records = [
    { type: 'workout', id: 'w1', sessionId: 's-2026-10-12', date: '2026-10-12' },
    { type: 'excuse', id: 'x1', sessionId: 's-2026-10-13', sessionDate: '2026-10-13', category: 'tired' },
    { type: 'reschedule', id: 'r1', sessionId: 's-2026-10-16', fromDate: '2026-10-16', toDate: '2026-10-18', createdAt: 1 },
  ]
  const s = scheduledSessions(plan, records, today)
  const by = id => s.find(x => x.id === id)
  assert.equal(by('s-2026-10-12').status, 'done')
  assert.equal(by('s-2026-10-13').status, 'excused')
  assert.equal(by('s-2026-10-14').status, 'missed')
  assert.equal(by('s-2026-10-15').status, 'today')
  assert.equal(by('s-2026-10-16').date, '2026-10-18')
  assert.equal(by('s-2026-10-16').moved, true)
  assert.deepEqual(unexplainedMisses(s, today).map(x => x.id), ['s-2026-10-14'])
})

test('latest reschedule wins, and a missed session made up later is no longer missed', () => {
  const records = [
    { type: 'reschedule', id: 'a', sessionId: 's-2026-10-14', toDate: '2026-10-15', createdAt: 1 },
    { type: 'reschedule', id: 'b', sessionId: 's-2026-10-14', toDate: '2026-10-19', createdAt: 2 },
  ]
  const s = scheduledSessions(plan, records, today)
  const moved = s.find(x => x.id === 's-2026-10-14')
  assert.equal(moved.date, '2026-10-19')
  assert.equal(moved.status, 'upcoming')
})

test('accountability: streak breaks on a miss, compliance counts only due sessions', () => {
  const records = [
    { type: 'workout', id: 'w1', sessionId: 's-2026-10-12' },
    { type: 'workout', id: 'w3', sessionId: 's-2026-10-14' },
  ]
  const s = scheduledSessions(plan, records, today)
  const a = accountability(s, plan, today)
  assert.equal(a.streak, 1, 'Tue missed breaks the streak behind Wed')
  assert.equal(a.doneThisWeek, 2)
  assert.equal(a.plannedThisWeek, 6)
  assert.equal(a.weekCompliance, 2 / 3, 'Mon, Tue, Wed due; today not counted until done')
  assert.equal(a.missedInBlock, 1)
})

test('fallback orders call out yesterday', () => {
  const s = scheduledSessions(plan, [], today)
  const msg = fallbackOrders({ todaySessions: s.filter(x => x.date === today), sessions: s, today, checkedIn: true })
  assert.match(msg, /Yesterday didn't happen/)
})

test('record paths match the repo contract', () => {
  assert.equal(recordPath({ type: 'workout', id: 'w1', date: '2026-10-12' }), 'logs/2026-10-12-workout-w1.json')
  assert.equal(recordPath({ type: 'checkin', id: 'c', date: '2026-10-12' }), 'logs/2026-10-12-checkin.json')
  assert.match(recordPath({ type: 'excuse', id: 'x1', createdAt: Date.UTC(2026, 9, 12, 7, 30) }), /^inbox\/20261012T073000Z-excuse-x1\.json$/)
})

test('sample plan goes stale when it ends', () => {
  assert.equal(sampleIsStale(plan, '2026-11-08'), false)
  assert.equal(sampleIsStale(plan, '2026-11-09'), true)
  assert.equal(sampleIsStale({ ...plan, sample: false }, '2030-01-01'), false)
})

test('diffSession reports swaps, removals, reorders, prescription changes and location', () => {
  const original = plan.sessions[0] // Lower Strength
  let edited = swapExercise(original, 'b2', 0, 'db-rdl')
  edited = updateBlock(edited, 'b1', b => { b.exercises[0].sets = 3 })
  edited = removeBlock(edited, 'b4')
  edited = moveBlock(edited, 'b3', -1)
  const types = diffSession(original, edited, { fromEnv: 'gym', toEnv: 'home' }).map(a => a.type).sort()
  assert.deepEqual(types, ['environment', 'remove', 'reorder', 'sets', 'swap'])
  assert.deepEqual(diffSession(original, structuredClone(original)), [])
})

test('adaptToEnvironment swaps everything travel equipment cannot support', () => {
  const travel = DEFAULT_ENVIRONMENTS.find(e => e.id === 'travel').equipment
  const { session, unresolved } = adaptToEnvironment(plan.sessions[0], travel)
  const ids = session.blocks.flatMap(b => b.exercises?.map(e => e.exerciseId) || [b.exerciseId])
  assert.ok(!ids.includes('back-squat') && !ids.includes('rdl'))
  assert.ok(Array.isArray(unresolved))
})
