import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EQUIPMENT, EXERCISES, alternativesFor, getExercise, isAvailable, missingEquipment } from './exercises.js'

const HOME = ['kettlebell', 'pullup-bar', 'bands', 'mat']
const ids = list => list.map(e => e.id)

test('library ids are unique and only use known equipment', () => {
  const seen = new Set()
  const known = new Set(EQUIPMENT.map(q => q.id))
  for (const e of EXERCISES) {
    assert.ok(!seen.has(e.id), `duplicate id ${e.id}`)
    seen.add(e.id)
    for (const q of [...e.equipment, ...(e.optionalEquipment || [])]) assert.ok(known.has(q), `${e.id}: unknown equipment ${q}`)
  }
})

test('coach block-1 and upcoming ids exist with real names', () => {
  const wanted = ['kb-row', 'kb-floor-press', 'kb-reverse-lunge', 'kb-hammer-curl', 'scap-pull-up', 'table-row', 'prone-ytw',
    'band-hip-flexor-march', 'hip-90-90', 'bird-dog', 'leg-swing',
    'kb-halo', 'kb-rdl', 'kb-bulgarian-split-squat', 'kb-half-kneeling-press', 'kb-front-squat']
  const lib = new Set(ids(EXERCISES))
  for (const id of wanted) {
    assert.ok(lib.has(id), `${id} missing`)
    assert.notEqual(getExercise(id).pattern, 'other')
  }
})

test('home swaps work both ways', () => {
  const pairs = [['kb-row', 'band-row'], ['kb-row', 'inverted-row'], ['kb-floor-press', 'push-up'], ['kb-floor-press', 'band-chest-press'],
    ['kb-reverse-lunge', 'reverse-lunge'], ['kb-reverse-lunge', 'split-squat-bw']]
  for (const [a, b] of pairs) {
    assert.ok(ids(alternativesFor(a, HOME)).includes(b), `${a} → ${b}`)
    assert.ok(ids(alternativesFor(b, HOME)).includes(a), `${b} → ${a}`)
  }
})

test('band-hip-flexor-march is never blocked by a missing band', () => {
  assert.ok(getExercise('band-hip-flexor-march').equipment.includes('bands'))
  assert.ok(isAvailable('band-hip-flexor-march', []))
  assert.deepEqual(missingEquipment('band-hip-flexor-march', ['kettlebell']), [])
  assert.ok(ids(alternativesFor('dead-bug', [])).includes('band-hip-flexor-march'))
  // Required equipment still blocks as before.
  assert.deepEqual(missingEquipment('kb-row', ['bands']), ['kettlebell'])
})
