// Exercise library. `pattern` drives swaps; `equipment` is what the exercise needs
// (empty = bodyweight). Equipment also listed in `optionalEquipment` is nice to have but
// never blocks the exercise. `sided`: worked one side at a time. `use`: a hint for the coach on
// what the exercise is for. The coach can reference any id here from plan/current.json.

export const EQUIPMENT = [
  { id: 'barbell', label: 'Barbell' },
  { id: 'rack', label: 'Squat rack' },
  { id: 'bench', label: 'Bench' },
  { id: 'dumbbells', label: 'Dumbbells' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'cable', label: 'Cable station' },
  { id: 'machine', label: 'Machines' },
  { id: 'pullup-bar', label: 'Pull-up bar' },
  { id: 'bands', label: 'Bands' },
  { id: 'box', label: 'Box / step' },
  { id: 'rower', label: 'Rower' },
  { id: 'bike', label: 'Bike / spin bike' },
  { id: 'treadmill', label: 'Treadmill' },
  { id: 'mat', label: 'Mat' },
]

const ex = (id, name, pattern, equipment, kind = 'strength', muscles = []) =>
  ({ id, name, pattern, equipment, kind, muscles })

export const EXERCISES = [
  // Squat
  ex('back-squat', 'Back squat', 'squat', ['barbell', 'rack'], 'strength', ['quads', 'glutes']),
  ex('front-squat', 'Front squat', 'squat', ['barbell', 'rack'], 'strength', ['quads']),
  ex('goblet-squat', 'Goblet squat', 'squat', ['dumbbells'], 'strength', ['quads', 'glutes']),
  ex('kb-goblet-squat', 'Kettlebell goblet squat', 'squat', ['kettlebell'], 'strength', ['quads', 'glutes']),
  // sided: worked one side at a time, so it runs per side even if the plan doesn't say perSide.
  { ...ex('kb-squat-swing', 'Kettlebell squat swing (wide stance)', 'squat', ['kettlebell'], 'strength', ['quads', 'glutes', 'adductors']), use: 'Warm-up for squats' },
  { ...ex('kb-squat-rotation-uppercut', 'Squat rotation to uppercut', 'squat', ['kettlebell'], 'strength', ['quads', 'glutes', 'core', 'shoulders']), sided: true },
  ex('kb-front-squat', 'Kettlebell front squat', 'squat', ['kettlebell'], 'strength', ['quads', 'glutes']),
  ex('leg-press', 'Leg press', 'squat', ['machine'], 'strength', ['quads', 'glutes']),
  ex('band-squat', 'Banded squat', 'squat', ['bands'], 'strength', ['quads']),
  ex('air-squat', 'Air squat', 'squat', [], 'strength', ['quads']),
  ex('jump-squat', 'Jump squat', 'squat', [], 'strength', ['quads']),
  // Hinge
  ex('deadlift', 'Deadlift', 'hinge', ['barbell'], 'strength', ['hamstrings', 'glutes', 'back']),
  ex('rdl', 'Romanian deadlift', 'hinge', ['barbell'], 'strength', ['hamstrings', 'glutes']),
  ex('db-rdl', 'Dumbbell RDL', 'hinge', ['dumbbells'], 'strength', ['hamstrings', 'glutes']),
  ex('kb-swing', 'Kettlebell swing', 'hinge', ['kettlebell'], 'strength', ['glutes', 'hamstrings']),
  { ...ex('kb-single-arm-swing', 'One-arm kettlebell swing', 'hinge', ['kettlebell'], 'strength', ['glutes', 'hamstrings', 'core', 'grip']), sided: true, use: 'Anti-rotation core work' },
  ex('kb-rdl', 'Kettlebell Romanian deadlift', 'hinge', ['kettlebell'], 'strength', ['hamstrings', 'glutes']),
  ex('hip-thrust', 'Hip thrust', 'hinge', ['barbell', 'bench'], 'strength', ['glutes']),
  ex('band-good-morning', 'Banded good morning', 'hinge', ['bands'], 'strength', ['hamstrings']),
  ex('sl-rdl-bw', 'Single-leg RDL (bodyweight)', 'hinge', [], 'strength', ['hamstrings', 'glutes']),
  ex('glute-bridge', 'Glute bridge', 'hinge', [], 'strength', ['glutes']),
  { ...ex('sl-glute-bridge', 'Single-leg glute bridge', 'hinge', [], 'strength', ['glutes', 'hamstrings']), sided: true, use: 'Warm-up for squats and deadlifts, usually 15–20 reps per side' },
  // Lunge
  ex('bulgarian-split-squat', 'Bulgarian split squat', 'lunge', ['dumbbells', 'bench'], 'strength', ['quads', 'glutes']),
  ex('db-walking-lunge', 'Dumbbell walking lunge', 'lunge', ['dumbbells'], 'strength', ['quads', 'glutes']),
  ex('kb-reverse-lunge', 'Kettlebell reverse lunge (goblet)', 'lunge', ['kettlebell'], 'strength', ['quads', 'glutes']),
  ex('kb-bulgarian-split-squat', 'Kettlebell Bulgarian split squat', 'lunge', ['kettlebell'], 'strength', ['quads', 'glutes']),
  ex('step-up', 'Step-up', 'lunge', ['box'], 'strength', ['quads', 'glutes']),
  ex('reverse-lunge', 'Reverse lunge', 'lunge', [], 'strength', ['quads', 'glutes']),
  ex('split-squat-bw', 'Split squat (bodyweight)', 'lunge', [], 'strength', ['quads']),
  // Horizontal push
  ex('bench-press', 'Bench press', 'h-push', ['barbell', 'bench', 'rack'], 'strength', ['chest', 'triceps']),
  ex('db-bench-press', 'Dumbbell bench press', 'h-push', ['dumbbells', 'bench'], 'strength', ['chest', 'triceps']),
  ex('incline-db-press', 'Incline dumbbell press', 'h-push', ['dumbbells', 'bench'], 'strength', ['chest', 'shoulders']),
  ex('chest-press-machine', 'Chest press machine', 'h-push', ['machine'], 'strength', ['chest']),
  ex('band-chest-press', 'Banded chest press', 'h-push', ['bands'], 'strength', ['chest']),
  ex('kb-floor-press', 'Kettlebell floor press', 'h-push', ['kettlebell'], 'strength', ['chest', 'triceps']),
  ex('push-up', 'Push-up', 'h-push', [], 'strength', ['chest', 'triceps']),
  ex('dip', 'Dip', 'h-push', [], 'strength', ['chest', 'triceps']),
  // Vertical push
  ex('overhead-press', 'Overhead press', 'v-push', ['barbell', 'rack'], 'strength', ['shoulders', 'triceps']),
  ex('db-shoulder-press', 'Dumbbell shoulder press', 'v-push', ['dumbbells'], 'strength', ['shoulders']),
  ex('kb-half-kneeling-press', 'Half-kneeling kettlebell press', 'v-push', ['kettlebell'], 'strength', ['shoulders', 'triceps']),
  ex('band-overhead-press', 'Banded overhead press', 'v-push', ['bands'], 'strength', ['shoulders']),
  ex('pike-push-up', 'Pike push-up', 'v-push', [], 'strength', ['shoulders']),
  // Horizontal pull
  ex('barbell-row', 'Barbell row', 'h-pull', ['barbell'], 'strength', ['back']),
  ex('db-row', 'One-arm dumbbell row', 'h-pull', ['dumbbells'], 'strength', ['back']),
  ex('kb-row', 'One-arm kettlebell row', 'h-pull', ['kettlebell'], 'strength', ['back', 'biceps']),
  ex('cable-row', 'Seated cable row', 'h-pull', ['cable'], 'strength', ['back']),
  ex('band-row', 'Banded row', 'h-pull', ['bands'], 'strength', ['back']),
  ex('inverted-row', 'Inverted row', 'h-pull', ['pullup-bar'], 'strength', ['back']),
  ex('table-row', 'Table row (inverted)', 'h-pull', [], 'strength', ['back']),
  // Vertical pull
  ex('pull-up', 'Pull-up', 'v-pull', ['pullup-bar'], 'strength', ['back', 'biceps']),
  ex('chin-up', 'Chin-up', 'v-pull', ['pullup-bar'], 'strength', ['back', 'biceps']),
  ex('lat-pulldown', 'Lat pulldown', 'v-pull', ['cable'], 'strength', ['back']),
  ex('band-pulldown', 'Banded pulldown', 'v-pull', ['bands'], 'strength', ['back']),
  ex('scap-pull-up', 'Scapular pull-up', 'v-pull', ['pullup-bar'], 'strength', ['back']),
  // Shoulders / arms
  ex('lateral-raise', 'Lateral raise', 'shoulder-iso', ['dumbbells'], 'strength', ['shoulders']),
  ex('band-lateral-raise', 'Banded lateral raise', 'shoulder-iso', ['bands'], 'strength', ['shoulders']),
  ex('face-pull', 'Face pull', 'rear-delt', ['cable'], 'strength', ['shoulders', 'back']),
  ex('band-pull-apart', 'Band pull-apart', 'rear-delt', ['bands'], 'strength', ['shoulders', 'back']),
  ex('prone-ytw', 'Prone Y-T-W', 'rear-delt', [], 'mobility', ['shoulders', 'back']),
  ex('db-curl', 'Dumbbell curl', 'biceps', ['dumbbells'], 'strength', ['biceps']),
  ex('band-curl', 'Banded curl', 'biceps', ['bands'], 'strength', ['biceps']),
  ex('kb-hammer-curl', 'Towel kettlebell hammer curl', 'biceps', ['kettlebell'], 'strength', ['biceps', 'grip']),
  ex('triceps-pushdown', 'Triceps pushdown', 'triceps', ['cable'], 'strength', ['triceps']),
  ex('db-overhead-extension', 'Dumbbell overhead extension', 'triceps', ['dumbbells'], 'strength', ['triceps']),
  ex('diamond-push-up', 'Diamond push-up', 'triceps', [], 'strength', ['triceps']),
  // Calves
  ex('calf-raise', 'Standing calf raise', 'calf', ['dumbbells'], 'strength', ['calves']),
  ex('calf-raise-bw', 'Single-leg calf raise', 'calf', [], 'strength', ['calves']),
  // Core
  ex('hanging-knee-raise', 'Hanging knee raise', 'core', ['pullup-bar'], 'strength', ['core']),
  ex('dead-bug', 'Dead bug', 'core', [], 'strength', ['core']),
  ex('bird-dog', 'Bird dog', 'core', [], 'strength', ['core']),
  // Band adds resistance but the march works without one.
  { ...ex('band-hip-flexor-march', 'Banded hip flexor march', 'core', ['bands'], 'strength', ['core']), optionalEquipment: ['bands'] },
  ex('ab-wheel', 'Ab wheel rollout', 'core', [], 'strength', ['core']),
  ex('plank', 'Plank', 'core-hold', [], 'mobility', ['core']),
  ex('side-plank', 'Side plank', 'core-hold', [], 'mobility', ['core']),
  ex('hollow-hold', 'Hollow hold', 'core-hold', [], 'mobility', ['core']),
  // Carry
  ex('farmer-carry', "Farmer's carry", 'carry', ['dumbbells'], 'strength', ['grip', 'core']),
  ex('kb-carry', 'Kettlebell carry', 'carry', ['kettlebell'], 'strength', ['grip', 'core']),
  { ...ex('kb-suitcase-march', 'Kettlebell suitcase march', 'carry', ['kettlebell'], 'strength', ['core', 'grip']), sided: true },
  // Cardio
  ex('run', 'Run', 'cardio', [], 'cardio'),
  ex('treadmill-run', 'Treadmill run', 'cardio', ['treadmill'], 'cardio'),
  ex('row-erg', 'Rower', 'cardio', ['rower'], 'cardio'),
  ex('bike-erg', 'Bike', 'cardio', ['bike'], 'cardio'),
  ex('ride', 'Bike ride (outdoor)', 'cardio', [], 'cardio'),
  ex('hike', 'Hike / brisk walk', 'cardio', [], 'cardio'),
  ex('jump-rope', 'Jump rope', 'cardio', [], 'cardio'),
  ex('burpee', 'Burpee', 'cardio', [], 'cardio'),
  // Mobility
  ex('couch-stretch', 'Couch stretch', 'mobility', [], 'mobility'),
  ex('hip-flexor-stretch', 'Half-kneeling hip flexor stretch', 'mobility', [], 'mobility'),
  ex('pigeon', 'Pigeon pose', 'mobility', [], 'mobility'),
  ex('worlds-greatest', "World's greatest stretch", 'mobility', [], 'mobility'),
  ex('thoracic-rotation', 'Thoracic rotations', 'mobility', [], 'mobility'),
  ex('cat-cow', 'Cat-cow', 'mobility', [], 'mobility'),
  ex('deep-squat-hold', 'Deep squat hold', 'mobility', [], 'mobility'),
  ex('hamstring-stretch', 'Hamstring stretch', 'mobility', [], 'mobility'),
  ex('dead-hang', 'Dead hang', 'mobility', ['pullup-bar'], 'mobility'),
  ex('childs-pose', "Child's pose", 'mobility', [], 'mobility'),
  ex('hip-90-90', '90/90 hip switch', 'mobility', [], 'mobility'),
  ex('leg-swing', 'Leg swings', 'mobility', [], 'mobility'),
  ex('kb-halo', 'Kettlebell halo', 'mobility', ['kettlebell'], 'mobility', ['shoulders']),
]

const BY_ID = new Map(EXERCISES.map(e => [e.id, e]))

export function getExercise(id) {
  return BY_ID.get(id) || { id, name: prettify(id), pattern: 'other', equipment: [], kind: 'strength', muscles: [] }
}

function prettify(id) {
  const s = String(id || 'Exercise').replace(/-/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Equipment the exercise can't be done without (`equipment` minus `optionalEquipment`). */
export function requiredEquipment(exerciseId) {
  const e = getExercise(exerciseId)
  const optional = new Set(e.optionalEquipment || [])
  return e.equipment.filter(q => !optional.has(q))
}

export function isAvailable(exercise, equipment) {
  return missingEquipment(exercise.id || exercise, equipment).length === 0
}

export function missingEquipment(exerciseId, equipment) {
  const have = new Set(equipment || [])
  return requiredEquipment(exerciseId).filter(e => !have.has(e))
}

/** "Kettlebell", "Bands (optional)", "Bodyweight" — for pickers. */
export function equipmentSummary(exercise) {
  const optional = new Set(exercise.optionalEquipment || [])
  if (!exercise.equipment.length) return 'Bodyweight'
  return exercise.equipment.map(q => equipmentLabel(q) + (optional.has(q) ? ' (optional)' : '')).join(', ')
}

export function equipmentLabel(id) {
  return EQUIPMENT.find(e => e.id === id)?.label || id
}

/** Same-pattern alternatives that the given equipment allows, best (most equipment) first. */
export function alternativesFor(exerciseId, equipment) {
  const base = getExercise(exerciseId)
  return EXERCISES
    .filter(e => e.id !== base.id && e.pattern === base.pattern && isAvailable(e, equipment))
    .sort((a, b) => b.equipment.length - a.equipment.length)
}

/** Weighted exercises get a kg stepper; bodyweight ones log reps only (optional added load). */
export function usesLoad(exerciseId) {
  const e = getExercise(exerciseId)
  return e.equipment.some(q => ['barbell', 'dumbbells', 'kettlebell', 'cable', 'machine'].includes(q))
}

export function loadStep(exerciseId) {
  const e = getExercise(exerciseId)
  if (e.equipment.includes('barbell')) return 2.5
  if (e.equipment.includes('dumbbells') || e.equipment.includes('kettlebell')) return 2
  return 2.5
}
