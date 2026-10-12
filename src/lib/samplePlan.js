// A starter block so the app is usable before the coach writes a real plan.
// Same format as plan/current.json (see contract/SCHEMA.md).

import { addDays, startOfWeek } from './dates.js'

const single = (id, exerciseId, sets, reps, restSec, { rpe = 8, warmupSets = 0 } = {}) =>
  ({ id, type: 'single', exercises: [{ exerciseId, sets, reps, rpe, restSec, load: null, ...(warmupSets ? { warmupSets } : {}) }] })

const warmup = (id, exerciseId = 'bike-erg') => ({ id, type: 'cardio', label: 'Warm-up', exerciseId, durationMin: 5, target: 'Easy — get warm, raise the heart rate' })

const TEMPLATES = {
  0: deload => ({
    name: 'Lower Strength', focus: 'Squat + posterior chain', environment: 'gym', targetDurationMin: deload ? 45 : 50,
    blocks: [
      warmup('b0'),
      single('b1', 'back-squat', deload ? 3 : 4, 5, 180, { warmupSets: 3 }),
      single('b2', 'rdl', 3, 8, 120, { warmupSets: 1 }),
      { id: 'b3', type: 'superset', rounds: deload ? 2 : 3, restBetweenSec: 15, restSec: 75, exercises: [
        { exerciseId: 'bulgarian-split-squat', reps: 10, rpe: 8 },
        { exerciseId: 'hanging-knee-raise', reps: 12 },
      ] },
      single('b4', 'calf-raise', 3, 12, 60),
    ],
  }),
  1: () => ({
    name: 'Zone 2 Run', focus: 'Aerobic base', environment: 'outdoor', targetDurationMin: 40,
    blocks: [
      { id: 'b1', type: 'cardio', exerciseId: 'run', durationMin: 35, target: 'Zone 2 — you can talk in full sentences' },
      { id: 'b2', type: 'hold', rounds: 1, restBetweenSec: 10, items: [
        { exerciseId: 'hip-flexor-stretch', holdSec: 45, sides: true },
        { exerciseId: 'hamstring-stretch', holdSec: 45, sides: true },
        { exerciseId: 'calf-raise-bw', holdSec: 30, sides: false },
      ] },
    ],
  }),
  2: deload => ({
    name: 'Upper Strength', focus: 'Press + pull', environment: 'gym', targetDurationMin: deload ? 45 : 55,
    blocks: [
      warmup('b0', 'row-erg'),
      single('b1', 'bench-press', deload ? 3 : 4, 6, 150, { warmupSets: 3 }),
      single('b2', 'pull-up', deload ? 3 : 4, '6-8', 120, { warmupSets: 1 }),
      { id: 'b3', type: 'superset', rounds: 3, restBetweenSec: 15, restSec: 90, exercises: [
        { exerciseId: 'overhead-press', reps: 8, rpe: 8 },
        { exerciseId: 'cable-row', reps: 10, rpe: 8 },
      ] },
      { id: 'b4', type: 'circuit', rounds: deload ? 1 : 2, restBetweenSec: 10, restSec: 60, exercises: [
        { exerciseId: 'lateral-raise', reps: 15 },
        { exerciseId: 'face-pull', reps: 15 },
        { exerciseId: 'db-curl', reps: 12 },
      ] },
    ],
  }),
  3: () => ({
    name: 'Mobility & Core', focus: 'Hips, T-spine, trunk', environment: 'home', targetDurationMin: 25,
    blocks: [
      { id: 'b1', type: 'hold', rounds: 2, restBetweenSec: 10, items: [
        { exerciseId: 'worlds-greatest', holdSec: 40, sides: true },
        { exerciseId: 'couch-stretch', holdSec: 60, sides: true },
        { exerciseId: 'thoracic-rotation', holdSec: 40, sides: true },
        { exerciseId: 'deep-squat-hold', holdSec: 60, sides: false },
      ] },
      { id: 'b2', type: 'hold', rounds: 3, restBetweenSec: 20, items: [
        { exerciseId: 'plank', holdSec: 45, sides: false },
        { exerciseId: 'side-plank', holdSec: 30, sides: true },
        { exerciseId: 'hollow-hold', holdSec: 30, sides: false },
      ] },
    ],
  }),
  4: deload => ({
    name: 'Conditioning', focus: 'Engine + full body', environment: 'gym', targetDurationMin: deload ? 35 : 40,
    blocks: [
      warmup('b0', 'row-erg'),
      { id: 'b1', type: 'interval', exerciseId: 'row-erg', rounds: deload ? 4 : 6, workSec: 60, restSec: 90, target: 'Hard — 8/10 effort' },
      { id: 'b2', type: 'circuit', rounds: 3, restBetweenSec: 10, restSec: 90, exercises: [
        { exerciseId: 'kb-swing', reps: 15 },
        { exerciseId: 'push-up', reps: 12 },
        { exerciseId: 'goblet-squat', reps: 12 },
        { exerciseId: 'burpee', reps: 10 },
      ] },
    ],
  }),
  5: () => ({
    name: 'Long Easy Cardio', focus: 'Ride, hike or long run', environment: 'outdoor', targetDurationMin: 75,
    blocks: [
      { id: 'b1', type: 'cardio', exerciseId: 'ride', durationMin: 75, target: 'Easy — Zone 2' },
    ],
  }),
}

export const SAMPLE_VERSION = 3

/** The sample block is regenerated when it runs out or the app ships a new one. */
export function sampleIsStale(plan, today) {
  return !!plan?.sample && (plan.sampleVersion !== SAMPLE_VERSION || plan.endDate < today)
}

export function buildSamplePlan(today) {
  const start = startOfWeek(today)
  const weeks = 4
  const sessions = []
  for (let w = 0; w < weeks; w++) {
    const deload = w === weeks - 1
    for (const [dow, make] of Object.entries(TEMPLATES)) {
      const date = addDays(start, w * 7 + Number(dow))
      sessions.push({ id: `s-${date}`, date, time: '18:00', transitionSec: 90, ...make(deload) })
    }
  }
  return {
    version: 1,
    id: `sample-${start}`,
    name: 'Starter Block (sample)',
    sample: true,
    sampleVersion: SAMPLE_VERSION,
    phase: 'Getting started',
    rationale:
      'A placeholder 4-week block — 3 strength-ish days, 2 aerobic days, 1 mobility day, week 4 is a deload. ' +
      'Your coach replaces this after the intake conversation.',
    startDate: start,
    endDate: addDays(start, weeks * 7 - 1),
    sessions,
  }
}

export const DEFAULT_ENVIRONMENTS = [
  { id: 'gym', name: 'Gym', equipment: ['barbell', 'rack', 'bench', 'dumbbells', 'kettlebell', 'cable', 'machine', 'pullup-bar', 'bands', 'box', 'rower', 'bike', 'treadmill', 'mat'] },
  { id: 'home', name: 'Home', equipment: ['dumbbells', 'bands', 'pullup-bar', 'mat'] },
  { id: 'travel', name: 'Travel / hotel', equipment: ['bands', 'mat'] },
  { id: 'outdoor', name: 'Outdoor', equipment: [] },
]
