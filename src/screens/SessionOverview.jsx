import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { useNow } from '../lib/hooks.js'
import { unlockAudio } from '../lib/audio.js'
import { formatClock, formatDay, formatDuration, todayISO } from '../lib/dates.js'
import { estimateByBlock, estimateSessionSec, lastPerformance, summarizeSets } from '../lib/engine.js'
import {
  EXERCISES, alternativesFor, equipmentLabel, equipmentSummary, getExercise, isAvailable, loadStep, missingEquipment, usesLoad,
} from '../lib/exercises.js'
import {
  adaptToEnvironment, addExerciseBlock, blockExercises, diffSession, moveBlock, removeBlock, removeExercise,
  swapExercise, unavailableExercises, updateBlock,
} from '../lib/adjust.js'
import { Sheet, Stepper, toast } from '../components/ui.jsx'

const GROUP_LABEL = { superset: 'Superset', circuit: 'Circuit', interval: 'Intervals', hold: 'Mobility / holds', cardio: 'Cardio' }
const fmtRest = s => formatDuration(s)

export default function SessionOverview({ session, onClose, onStart }) {
  const { environments, records } = useStore()
  const original = useMemo(() => structuredClone(session), [session])
  const [draft, setDraft] = useState(original)
  const [envId, setEnvId] = useState(session.environment || environments[0]?.id)
  const [openId, setOpenId] = useState(null)
  const [swap, setSwap] = useState(null) // { blockId, key, exerciseId }
  const [adding, setAdding] = useState(false)
  const now = useNow(30000)
  const today = todayISO()
  const readOnly = session.status === 'done'

  const env = environments.find(e => e.id === envId) || environments[0]
  const estSec = estimateSessionSec(draft)
  const perBlock = estimateByBlock(draft)
  const targetSec = (draft.targetDurationMin || 0) * 60
  const overTarget = targetSec ? estSec - targetSec : 0
  const missing = unavailableExercises(draft, env.equipment)
  const adjustments = diffSession(original, draft, { fromEnv: session.environment, toEnv: envId })
  const last = id => lastPerformance(id, records)

  const edit = fn => setDraft(d => fn(d))
  const adaptAll = () => {
    const { session: next, unresolved } = adaptToEnvironment(draft, env.equipment)
    setDraft(next)
    toast(unresolved.length ? `${unresolved.length} exercise(s) have no ${env.name} alternative` : `Adapted for ${env.name}`)
  }
  const start = () => {
    unlockAudio()
    onStart({ ...draft, environment: envId, date: today }, adjustments, envId)
  }

  return (
    <div className="fullscreen">
      <div className="fullscreen-inner">
        <div className="topbar">
          <button className="icon-btn" onClick={onClose} aria-label="Back">←</button>
          <div className="title ellipsis">{formatDay(session.date, today)}{session.time ? ` · ${session.time}` : ''}</div>
          {adjustments.length > 0 && !readOnly
            ? <button className="btn small ghost" onClick={() => { setDraft(original); setEnvId(session.environment) }}>Reset</button>
            : <span style={{ width: 40 }} />}
        </div>

        <div className="stack" style={{ padding: '4px var(--gutter) 16px' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: 28 }}>{draft.name}</h1>
            <div className="muted">{draft.focus}</div>
          </div>

          <div className="card stack tight">
            <div className="duration-bar">
              <span className="big">{Math.round(estSec / 60)}<span style={{ fontSize: 18, fontWeight: 700 }}> min</span></span>
              {targetSec > 0 && <span className="muted small">target {draft.targetDurationMin} min</span>}
            </div>
            {!readOnly && <div className="small muted tnum">Start now → done by <b style={{ color: 'var(--text)' }}>{formatClock(now + estSec * 1000)}</b></div>}
            {overTarget > 5 * 60 && !readOnly && (
              <div className="callout small">This runs <b>{Math.round(overTarget / 60)} min</b> over the target. Cut something or stay sharp on rests.</div>
            )}
          </div>

          {!readOnly && (
            <div className="stack tight">
              <div className="field-label">Where are you training?</div>
              <div className="chips scroll">
                {environments.map(e => (
                  <button key={e.id} className={`chip${e.id === envId ? ' on' : ''}`} onClick={() => setEnvId(e.id)}>{e.name}</button>
                ))}
              </div>
              {missing.length > 0 && (
                <div className="callout small row between">
                  <span>{missing.length} exercise{missing.length > 1 ? 's' : ''} need equipment {env.name} doesn't have.</span>
                  <button className="btn small primary" onClick={adaptAll}>Adapt</button>
                </div>
              )}
            </div>
          )}

          {draft.notes && <div className="card tight small muted">{draft.notes}</div>}

          <div className="stack">
            {draft.blocks.map((b, i) => (
              <BlockCard
                key={b.id}
                block={b}
                index={i}
                count={draft.blocks.length}
                estSec={perBlock[b.id] || 0}
                open={openId === b.id && !readOnly}
                onToggle={() => setOpenId(openId === b.id ? null : b.id)}
                equipment={env.equipment}
                last={last}
                onChange={fn => edit(d => updateBlock(d, b.id, fn))}
                onMove={dir => edit(d => moveBlock(d, b.id, dir))}
                onRemove={() => { edit(d => removeBlock(d, b.id)); setOpenId(null) }}
                onRemoveExercise={key => edit(d => removeExercise(d, b.id, key))}
                onSwap={(key, exerciseId) => setSwap({ blockId: b.id, key, exerciseId })}
              />
            ))}
            {!readOnly && <button className="btn outline block" onClick={() => setAdding(true)}>+ Add exercise</button>}
          </div>

          {adjustments.length > 0 && !readOnly && (
            <div className="small faint">{adjustments.length} change{adjustments.length > 1 ? 's' : ''} from the plan — your coach will see them.</div>
          )}
        </div>

        <div className="bottombar">
          {readOnly
            ? <button className="btn block big" disabled>Completed</button>
            : <button className="btn primary block big" onClick={start} disabled={!draft.blocks.length}>
                Start workout · {Math.round(estSec / 60)} min
              </button>}
        </div>
      </div>

      <SwapSheet
        swap={swap}
        equipment={env.equipment}
        envName={env.name}
        onClose={() => setSwap(null)}
        onPick={toId => { edit(d => swapExercise(d, swap.blockId, swap.key, toId)); setSwap(null) }}
      />
      <AddSheet
        open={adding}
        equipment={env.equipment}
        onClose={() => setAdding(false)}
        onPick={id => { edit(d => addExerciseBlock(d, id)); setAdding(false) }}
      />
    </div>
  )
}

function prescription(e) {
  const parts = [`${e.sets ? `${e.sets}×` : ''}${e.reps}`]
  if (e.load) parts[0] += ` @ ${e.load} kg`
  if (e.rpe) parts.push(`RPE ${e.rpe}`)
  if (e.warmupSets) parts.push(`+${e.warmupSets} warm-up`)
  return parts.join(' · ')
}

function ExerciseLine({ exerciseId, detail, equipment, last }) {
  const lack = missingEquipment(exerciseId, equipment)
  const prev = last(exerciseId)
  return (
    <div className="block-ex">
      <div className="n">{getExercise(exerciseId).name}</div>
      <div className="small muted">{detail}</div>
      {prev && <div className="tiny faint">Last: {summarizeSets(prev.sets)}</div>}
      {lack.length > 0 && <div className="tiny" style={{ color: 'var(--warn)' }}>Needs {lack.map(equipmentLabel).join(', ')}</div>}
    </div>
  )
}

function BlockCard({ block: b, index, count, estSec, open, onToggle, equipment, last, onChange, onMove, onRemove, onRemoveExercise, onSwap }) {
  const exs = blockExercises(b)
  const unavailable = exs.some(e => !isAvailable(e.exerciseId, equipment))
  let lines
  if (b.type === 'interval') {
    lines = [<ExerciseLine key="i" exerciseId={b.exerciseId} equipment={equipment} last={() => null}
      detail={`${b.rounds} × ${fmtRest(b.workSec)} on / ${fmtRest(b.restSec)} off${b.target ? ` · ${b.target}` : ''}`} />]
  } else if (b.type === 'cardio') {
    lines = [<ExerciseLine key="c" exerciseId={b.exerciseId} equipment={equipment} last={() => null}
      detail={`${b.durationMin} min${b.target ? ` · ${b.target}` : ''}`} />]
  } else if (b.type === 'hold') {
    lines = b.items.map((it, i) => <ExerciseLine key={i} exerciseId={it.exerciseId} equipment={equipment} last={() => null}
      detail={`${fmtRest(it.holdSec)}${it.sides ? ' each side' : ''}`} />)
  } else {
    lines = b.exercises.map((e, i) => <ExerciseLine key={i} exerciseId={e.exerciseId} equipment={equipment} last={last}
      detail={prescription(b.type === 'single' ? e : { ...e, sets: null })} />)
  }
  const restLine = b.type === 'single'
    ? `Rest ${fmtRest(b.exercises[0]?.restSec ?? 90)}`
    : b.type === 'superset' || b.type === 'circuit'
      ? `${b.rounds} rounds · ${b.restBetweenSec ?? 15}s between · ${fmtRest(b.restSec ?? 90)} after round`
      : b.type === 'hold' ? `${b.rounds || 1} round${(b.rounds || 1) > 1 ? 's' : ''}` : null

  return (
    <div className={`block-card${open ? ' open' : ''}${unavailable ? ' warn' : ''}`}>
      <button className="block-head" onClick={onToggle} aria-expanded={open}>
        <span className="block-num">{index + 1}</span>
        <div className="grow stack tight" style={{ gap: 4 }}>
          {(b.label || GROUP_LABEL[b.type]) && <div className="block-group-label">{b.label || GROUP_LABEL[b.type]}</div>}
          {lines}
          {restLine && <div className="tiny faint">{restLine}</div>}
        </div>
        <span className="small faint tnum">{Math.round(estSec / 60)}′</span>
      </button>
      {open && (
        <div className="block-edit">
          <BlockEditor block={b} onChange={onChange} onSwap={onSwap} onRemoveExercise={onRemoveExercise} last={last} />
          <div className="row">
            <button className="btn small" disabled={index === 0} onClick={() => onMove(-1)}>↑ Up</button>
            <button className="btn small" disabled={index === count - 1} onClick={() => onMove(1)}>↓ Down</button>
            <span className="grow" />
            <button className="btn small danger" onClick={onRemove}>Remove</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, children }) {
  return <div className="edit-row"><span className="small bold">{label}</span>{children}</div>
}

function repsNumber(reps) {
  return typeof reps === 'number' ? reps : parseInt(String(reps).match(/\d+/g)?.pop() || '10', 10)
}

function ExerciseEditor({ e, showSets, onChange, onSwap, onRemove, last }) {
  const set = patch => onChange({ ...e, ...patch })
  const weighted = usesLoad(e.exerciseId)
  const prevLoad = last(e.exerciseId)?.sets?.at(-1)?.load
  return (
    <div className="stack tight">
      <div className="row between">
        <span className="bold">{getExercise(e.exerciseId).name}</span>
        <span className="row">
          <button className="btn small" onClick={onSwap}>Swap</button>
          {onRemove && <button className="btn small danger" onClick={onRemove} aria-label="Remove exercise">✕</button>}
        </span>
      </div>
      {showSets && <Row label="Warm-up sets"><Stepper label="warm-up sets" value={e.warmupSets || 0} min={0} max={5} onChange={v => set({ warmupSets: v })} /></Row>}
      {showSets && <Row label="Sets"><Stepper label="sets" value={e.sets} min={1} max={10} onChange={v => set({ sets: v })} /></Row>}
      <Row label="Reps">
        <Stepper label="reps" value={repsNumber(e.reps)} min={1} max={100}
          format={v => (String(e.reps).match(/\D/) && v === repsNumber(e.reps) ? e.reps : v)}
          onChange={v => set({ reps: v })} />
      </Row>
      {weighted && (
        <Row label="Load">
          <Stepper label="load" value={e.load ?? 0} min={0} max={500} step={loadStep(e.exerciseId)}
            format={v => (v ? `${v} kg` : '—')}
            onChange={v => set({ load: v || null })} />
        </Row>
      )}
      {weighted && !e.load && prevLoad ? <button className="btn small ghost" onClick={() => set({ load: prevLoad })}>Use last: {prevLoad} kg</button> : null}
      {showSets && <Row label="Rest"><Stepper label="rest" value={e.restSec ?? 90} min={0} max={600} step={15} format={fmtRest} onChange={v => set({ restSec: v })} /></Row>}
    </div>
  )
}

function BlockEditor({ block: b, onChange, onSwap, onRemoveExercise, last }) {
  const patch = p => onChange(blk => ({ ...blk, ...p }))
  if (b.type === 'single') {
    const e = b.exercises[0]
    return <ExerciseEditor e={e} showSets last={last} onSwap={() => onSwap(0, e.exerciseId)}
      onChange={ne => onChange(blk => ({ ...blk, exercises: [ne] }))} />
  }
  if (b.type === 'superset' || b.type === 'circuit') {
    return (
      <>
        <Row label="Rounds"><Stepper label="rounds" value={b.rounds} min={1} max={10} onChange={v => patch({ rounds: v })} /></Row>
        <Row label="Between moves"><Stepper label="rest between" value={b.restBetweenSec ?? 15} min={0} max={120} step={5} format={v => `${v}s`} onChange={v => patch({ restBetweenSec: v })} /></Row>
        <Row label="Rest after round"><Stepper label="rest after round" value={b.restSec ?? 90} min={0} max={600} step={15} format={fmtRest} onChange={v => patch({ restSec: v })} /></Row>
        {b.exercises.map((e, i) => (
          <div key={i} className="card tight" style={{ background: 'var(--surface)' }}>
            <ExerciseEditor e={e} last={last} onSwap={() => onSwap(i, e.exerciseId)} onRemove={() => onRemoveExercise(i)}
              onChange={ne => onChange(blk => ({ ...blk, exercises: blk.exercises.map((x, k) => (k === i ? ne : x)) }))} />
          </div>
        ))}
      </>
    )
  }
  if (b.type === 'interval') {
    return (
      <>
        <Row label={getExercise(b.exerciseId).name}><button className="btn small" onClick={() => onSwap('self', b.exerciseId)}>Swap</button></Row>
        <Row label="Rounds"><Stepper label="rounds" value={b.rounds} min={1} max={20} onChange={v => patch({ rounds: v })} /></Row>
        <Row label="Work"><Stepper label="work" value={b.workSec} min={10} max={1200} step={15} format={fmtRest} onChange={v => patch({ workSec: v })} /></Row>
        <Row label="Rest"><Stepper label="rest" value={b.restSec} min={0} max={600} step={15} format={fmtRest} onChange={v => patch({ restSec: v })} /></Row>
      </>
    )
  }
  if (b.type === 'cardio') {
    return (
      <>
        <Row label={getExercise(b.exerciseId).name}><button className="btn small" onClick={() => onSwap('self', b.exerciseId)}>Swap</button></Row>
        <Row label="Duration"><Stepper label="duration" value={b.durationMin} min={5} max={240} step={5} format={v => `${v} min`} onChange={v => patch({ durationMin: v })} /></Row>
      </>
    )
  }
  // hold
  return (
    <>
      <Row label="Rounds"><Stepper label="rounds" value={b.rounds || 1} min={1} max={6} onChange={v => patch({ rounds: v })} /></Row>
      {b.items.map((it, i) => (
        <div key={i} className="stack tight">
          <div className="row between">
            <span className="bold">{getExercise(it.exerciseId).name}{it.sides ? ' (each side)' : ''}</span>
            <span className="row">
              <button className="btn small" onClick={() => onSwap(i, it.exerciseId)}>Swap</button>
              <button className="btn small danger" onClick={() => onRemoveExercise(i)} aria-label="Remove">✕</button>
            </span>
          </div>
          <Row label="Hold">
            <Stepper label="hold" value={it.holdSec} min={10} max={300} step={5} format={fmtRest}
              onChange={v => onChange(blk => ({ ...blk, items: blk.items.map((x, k) => (k === i ? { ...x, holdSec: v } : x)) }))} />
          </Row>
        </div>
      ))}
    </>
  )
}

function SwapSheet({ swap, equipment, envName, onClose, onPick }) {
  const [showAll, setShowAll] = useState(false)
  if (!swap) return null
  const base = getExercise(swap.exerciseId)
  const options = showAll
    ? EXERCISES.filter(e => e.pattern === base.pattern && e.id !== base.id)
    : alternativesFor(swap.exerciseId, equipment)
  return (
    <Sheet open onClose={onClose}>
      <h2>Swap {base.name}</h2>
      <p className="muted small" style={{ marginBottom: 12 }}>{showAll ? 'All alternatives' : `Alternatives you can do at: ${envName}`}</p>
      <div className="list">
        {options.map(e => (
          <button key={e.id} className="list-row" onClick={() => onPick(e.id)}>
            <div className="grow">
              <div className="bold">{e.name}</div>
              <div className="tiny faint">{equipmentSummary(e)}</div>
            </div>
          </button>
        ))}
        {!options.length && <div className="empty">No alternatives here.</div>}
      </div>
      <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => setShowAll(!showAll)}>
        {showAll ? 'Only show what I can do here' : 'Show all alternatives'}
      </button>
    </Sheet>
  )
}

const PATTERN_LABEL = {
  squat: 'Squat', hinge: 'Hinge', lunge: 'Lunge', 'h-push': 'Push (horizontal)', 'v-push': 'Push (vertical)',
  'h-pull': 'Pull (horizontal)', 'v-pull': 'Pull (vertical)', 'shoulder-iso': 'Shoulders', 'rear-delt': 'Rear delts',
  biceps: 'Biceps', triceps: 'Triceps', calf: 'Calves', core: 'Core', 'core-hold': 'Core holds', carry: 'Carries',
  cardio: 'Cardio', mobility: 'Mobility',
}

function AddSheet({ open, equipment, onClose, onPick }) {
  const [q, setQ] = useState('')
  if (!open) return null
  const list = EXERCISES.filter(e => isAvailable(e, equipment) && e.name.toLowerCase().includes(q.toLowerCase()))
  const groups = Object.keys(PATTERN_LABEL).map(p => [p, list.filter(e => e.pattern === p)]).filter(([, l]) => l.length)
  return (
    <Sheet open onClose={onClose}>
      <h2>Add exercise</h2>
      <input placeholder="Search" value={q} onChange={e => setQ(e.target.value)} style={{ margin: '8px 0 12px' }} />
      <div className="stack">
        {groups.map(([p, l]) => (
          <div key={p} className="stack tight">
            <div className="field-label">{PATTERN_LABEL[p]}</div>
            <div className="list">
              {l.map(e => <button key={e.id} className="list-row" onClick={() => onPick(e.id)}>{e.name}</button>)}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  )
}
