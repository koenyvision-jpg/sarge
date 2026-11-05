import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scheduledSessions, unexplainedMisses, accountability, recordPath, fallbackOrders, timeline, detectMisses, missedRecord, history } from './schedule.js'
import { diffSession, adaptToEnvironment, swapExercise, removeBlock, moveBlock, updateBlock } from './adjust.js'
const addOne = d => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10) }
import { buildSamplePlan, sampleIsStale, DEFAULT_ENVIRONMENTS } from './samplePlan.js'

const plan = buildSamplePlan('2026-10-12') // Mon 12 Oct … Sun 8 Nov
const today = '2026-10-15' // Thursday

test('statuses: done, excused, missed, today, upcoming', () => {
  const records = [
    { type: 'workout', id: 'w1', sessionId: 's-2026-10-12', date: '2026-10-12' },
    { type: 'excuse', id: 'x1', sessionId: 's-2026-10-13', sessionDate: '2026-10-13', category: 'tired' },
  ]
  const s = scheduledSessions(plan, records, today)
  const by = id => s.find(x => x.id === id)
  assert.equal(by('s-2026-10-12').status, 'done')
  assert.equal(by('s-2026-10-13').status, 'excused')
  assert.equal(by('s-2026-10-14').status, 'missed')
  assert.equal(by('s-2026-10-15').status, 'today')
  assert.equal(by('s-2026-10-16').status, 'upcoming')
})

test('legacy reschedules only apply until the coach rewrites that session', () => {
  const records = [
    { type: 'reschedule', id: 'a', sessionId: 's-2026-10-14', fromDate: '2026-10-14', toDate: '2026-10-15', createdAt: 1 },
    { type: 'reschedule', id: 'b', sessionId: 's-2026-10-14', fromDate: '2026-10-15', toDate: '2026-10-19', createdAt: 2 },
  ]
  const moved = scheduledSessions(plan, records, today).find(x => x.id === 's-2026-10-14')
  assert.equal(moved.date, '2026-10-19', 'latest move wins while the plan still has the original date')
  assert.equal(moved.status, 'upcoming')

  const rewritten = { ...plan, sessions: plan.sessions.map(s => (s.id === 's-2026-10-14' ? { ...s, date: '2026-10-17' } : s)) }
  const coach = scheduledSessions(rewritten, records, today).find(x => x.id === 's-2026-10-14')
  assert.equal(coach.date, '2026-10-17', 'the coach\'s date wins')
  assert.equal(coach.moved, false)
})

test('an excuse covers only the date it was given for; a shifted session is live again', () => {
  const shifted = { ...plan, sessions: plan.sessions.map(s => (s.id === 's-2026-10-15' ? { ...s, date: '2026-10-16' } : s)) }
  const records = [{ type: 'excuse', id: 'x', sessionId: 's-2026-10-15', sessionName: 'Upper', sessionDate: '2026-10-15', when: 'ahead', category: 'sick' }]
  const s = scheduledSessions(shifted, records, today)
  assert.equal(s.find(x => x.id === 's-2026-10-15').status, 'upcoming')
  const t = timeline(s, records, shifted)
  const ghost = t.find(x => x.ghost)
  assert.equal(ghost.date, '2026-10-15')
  assert.equal(ghost.status, 'excused')
})

const real = { ...plan, sample: false }
const seen = [{ type: 'checkin', id: 'c', date: '2026-10-12' }]

test('detectMisses: past, unlogged, unexcused sessions — once per session', () => {
  const records = [...seen,
    { type: 'workout', id: 'w1', sessionId: 's-2026-10-12', date: '2026-10-12' },
    { type: 'excuse', id: 'x1', sessionId: 's-2026-10-13', sessionDate: '2026-10-13', category: 'tired' },
  ]
  const found = detectMisses(real, records, today)
  assert.deepEqual(found.map(s => s.id), ['s-2026-10-14'])
  const rec = missedRecord(found[0], today, 123)
  assert.deepEqual(rec, { type: 'missed', id: 'missed-s-2026-10-14', sessionId: 's-2026-10-14', sessionName: found[0].name, sessionDate: '2026-10-14', date: today, createdAt: 123 })
  assert.equal(recordPath(rec), `logs/${today}-missed-s-2026-10-14.json`)
  assert.deepEqual(detectMisses(real, [...records, rec], today), [], 'never a second one')
  assert.deepEqual(detectMisses(plan, records, today), [], 'not for the sample plan')
  assert.deepEqual(detectMisses(real, [], today), [], 'not on a device with no data yet')
  assert.deepEqual(detectMisses(real, [{ type: 'checkin', id: 'c', date: '2026-10-14' }], today).map(s => s.id), ['s-2026-10-14'], 'only from the device\'s first record on')
})

test('a logged miss survives the coach shifting the plan, and is not a rest day', () => {
  const miss = missedRecord({ id: 's-2026-10-14', name: 'Engine', date: '2026-10-14' }, today, 1)
  // Coach shifts everything from the 14th one day forward.
  const shifted = { ...real, sessions: real.sessions.map(s => (s.date >= '2026-10-14' ? { ...s, date: addOne(s.date) } : s)) }
  const records = [...seen, { type: 'workout', id: 'w1', sessionId: 's-2026-10-12', date: '2026-10-12' }, miss]
  const s = scheduledSessions(shifted, records, today)
  assert.equal(s.find(x => x.id === 's-2026-10-14').date, '2026-10-15')
  assert.equal(s.find(x => x.id === 's-2026-10-14').status, 'today')
  const t = timeline(s, records, shifted)
  const onDay = t.filter(x => x.date === '2026-10-14')
  assert.deepEqual(onDay.map(x => [x.name, x.status, x.ghost]), [['Engine', 'missed', true]])
  assert.deepEqual(unexplainedMisses(records, today), [{ id: 's-2026-10-14', name: 'Engine', date: '2026-10-14' }])
  const explained = [...records, { type: 'excuse', id: 'x', sessionId: 's-2026-10-14', sessionDate: '2026-10-14', category: 'tired', when: 'after' }]
  assert.deepEqual(unexplainedMisses(explained, today), [])
  const a = accountability(timeline(scheduledSessions(shifted, explained, today), explained, shifted), shifted, today)
  assert.equal(a.missedInBlock, 2, 'the logged miss on the 14th plus the 13th, still in the plan and missed')
})

test('history shows workouts without a plan session, misses on their planned date, and old moves', () => {
  const records = [
    { type: 'workout', id: 'w-old', sessionId: 'gone', date: '2026-10-01', name: 'Old block day', startedAt: 5, blocks: [] },
    { type: 'missed', id: 'missed-s1', sessionId: 's1', sessionName: 'Legs', sessionDate: '2026-10-10', date: '2026-10-11', createdAt: 1 },
    { type: 'excuse', id: 'x1', sessionId: 's1', sessionDate: '2026-10-10', category: 'sick', when: 'after' },
    { type: 'excuse', id: 'x2', sessionId: 's2', sessionName: 'Run', sessionDate: '2026-10-12', category: 'travel', when: 'ahead' },
    { type: 'reschedule', id: 'r1', sessionId: 's3', fromDate: '2026-10-03', toDate: '2026-10-04', date: '2026-10-02', createdAt: 9 },
  ]
  const h = history(records, null)
  assert.deepEqual(h.map(e => [e.kind, e.date, e.name ?? e.workout.name]), [
    ['excused', '2026-10-12', 'Run'],
    ['missed', '2026-10-10', 'Legs'],
    ['moved', '2026-10-02', 'Session'],
    ['workout', '2026-10-01', 'Old block day'],
  ])
  assert.equal(h[1].excuse.id, 'x1', 'the explanation rides along with the miss')
})

test('accountability: streak breaks on a miss, compliance counts only due sessions', () => {
  const records = [
    { type: 'workout', id: 'w1', sessionId: 's-2026-10-12' },
    { type: 'workout', id: 'w3', sessionId: 's-2026-10-14' },
  ]
  const s = timeline(scheduledSessions(plan, records, today), records, plan)
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
