import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { useNow, useWakeLock } from '../lib/hooks.js'
import { cues, say, unlockAudio } from '../lib/audio.js'
import { formatClock, formatDuration } from '../lib/dates.js'
import {
  NAG_EVERY_SEC, adjustStep, advance, autoAdvances, catchUp, currentStepDuration, dropLastSet, endEarly, goBack, restartStep, skipStep,
  lastDroppableSetIndex, lastPerformance, overrunSec, pace, pause, resume, shortenRests, stepElapsedSec, summarizeSets,
} from '../lib/engine.js'
import { getExercise, loadStep, usesLoad } from '../lib/exercises.js'
import { Sheet, Stepper } from '../components/ui.jsx'
import WorkoutSummary from './WorkoutSummary.jsx'
import { ExerciseInfoButton } from '../components/ExerciseInfo.jsx'

const BEHIND_PROMPT_SEC = 180

export default function WorkoutFlow({ onMinimize, onDone }) {
  const { activeWorkout: w, set, records } = useStore()
  const now = useNow(250, !!w && !w.finishedAt)
  const fired = useRef(new Set())
  const [menu, setMenu] = useState(false)
  const [dismissedBehind, setDismissedBehind] = useState(0)
  useWakeLock(!!w && !w.finishedAt)

  const update = next => set({ activeWorkout: next })
  const fire = (key, fn) => {
    if (fired.current.has(key)) return
    fired.current.add(key)
    fn()
  }
  // Let a step's countdown beeps play again (after restart, back, or adding time).
  const rearm = stepId => {
    for (const k of [...fired.current]) if (k.startsWith(`${stepId}:`) && !k.endsWith(':start')) fired.current.delete(k)
  }

  // Drive the clock: auto-advance rests/holds, and play cues.
  useEffect(() => {
    if (!w || w.pausedAt || w.finishedAt) return
    const next = catchUp(w, now)
    if (next !== w) {
      const step = next.steps[next.index]
      fire(`${step?.id ?? 'end'}:start`, () => {
        if (!step) return cues.finish()
        if (step.kind === 'rest' || step.kind === 'transition') return cues.done()
        cues.go()
        if (step.kind === 'set') say(`${step.label}. ${describeTarget(step.target)}`)
        else say(step.label + (step.side ? `, ${step.side}` : ''))
      })
      update(next)
      return
    }
    const step = w.steps[w.index]
    if (!step) return
    const total = currentStepDuration(w)
    const remaining = total - stepElapsedSec(w, now)
    if (autoAdvances(step)) {
      if (step.kind !== 'timed' && total >= 30 && remaining <= 10 && remaining > 8) fire(`${step.id}:w10`, cues.warn)
      for (const n of [3, 2, 1]) if (remaining <= n && remaining > n - 1) fire(`${step.id}:t${n}`, cues.tick)
    } else if (step.kind === 'set') {
      const over = overrunSec(w, now)
      if (over > 0) fire(`${step.id}:nag${Math.floor(over / NAG_EVERY_SEC)}`, cues.nag)
    } else if (step.kind === 'cardio' && remaining <= 0) {
      fire(`${step.id}:end`, cues.done)
    }
  })

  if (!w) return null
  if (w.finishedAt) return <WorkoutSummary workout={w} onDone={onDone} />

  const step = w.steps[w.index]
  const p = pace(w, now)
  const total = currentStepDuration(w)
  const elapsed = stepElapsedSec(w, now)
  const remaining = Math.max(0, total - elapsed)
  const over = overrunSec(w, now)

  const done = result => {
    unlockAudio()
    // Logging work while paused means you're back at it: resume first.
    const t = Date.now()
    const next = advance(w.pausedAt ? resume(w, t) : w, t, result)
    const nextStep = next.steps[next.index]
    if (!nextStep) cues.finish()
    update(next)
  }
  const togglePause = () => { unlockAudio(); update(w.pausedAt ? resume(w, Date.now()) : pause(w, Date.now())) }
  const control = {
    back: () => { const next = goBack(w, Date.now()); rearm(next.steps[next.index]?.id); update(next) },
    restart: () => { rearm(step.id); update(restartStep(w, Date.now())) },
    skip: () => { unlockAudio(); update(skipStep(w, Date.now())) },
    adjust: sec => { if (sec > 0) rearm(step.id); update(adjustStep(w, Date.now(), sec)) },
  }

  const blockCount = new Set(w.steps.map(s => s.blockId)).size
  const behind = p.behindSec
  const showBehind = behind > BEHIND_PROMPT_SEC && behind > dismissedBehind + 60 && !w.pausedAt
  const canDrop = lastDroppableSetIndex(w) >= 0
  const nextWork = w.steps.slice(w.index + 1).find(s => s.kind !== 'rest' && s.kind !== 'transition')

  const tone = w.pausedAt ? '' : step.kind === 'set' && over > 0 ? 'over' : step.kind === 'rest' || step.kind === 'transition' ? 'rest' : step.kind === 'timed' ? 'timed' : ''

  return (
    <div className="fullscreen">
      <div className={`fullscreen-inner flow ${tone}`}>
        <div className="topbar" style={{ background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
          <button className="icon-btn" onClick={onMinimize} aria-label="Minimize">⌄</button>
          <div className="title">
            <div className="tiny faint" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>Block {step.blockIndex + 1} of {blockCount}</div>
            <div className="ellipsis small">{w.name}</div>
          </div>
          <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Workout menu">⋯</button>
        </div>

        <PaceBar p={p} pausedAt={w.pausedAt} />

        {showBehind && (
          <div style={{ padding: '6px var(--gutter) 0' }}>
            <div className="callout bad stack tight">
              <div className="small"><b>{Math.round(behind / 60)} min behind.</b> Fix it:</div>
              <div className="row wrap">
                <button className="btn small" onClick={() => update(shortenRests(w))}>Shorten rests 25%</button>
                {canDrop && <button className="btn small" onClick={() => update(dropLastSet(w))}>Drop last set</button>}
                <button className="btn small ghost" onClick={() => setDismissedBehind(behind)}>Ignore</button>
              </div>
            </div>
          </div>
        )}

        <div className="flow-main">
          {w.pausedAt && <div className="paused-pill">Paused · {formatDuration((now - w.pausedAt) / 1000)}</div>}
          {step.kind === 'set' ? (
            <SetView key={step.id} w={w} step={step} elapsed={elapsed} over={over} records={records} onDone={done} />
          ) : step.kind === 'rest' || step.kind === 'transition' ? (
            <RestView step={step} remaining={remaining} total={total} next={nextWork} w={w} records={records} />
          ) : step.kind === 'timed' ? (
            <TimedView step={step} remaining={remaining} total={total} />
          ) : (
            <CardioView key={step.id} step={step} label={w.session.blocks.find(b => b.id === step.blockId)?.label} elapsed={elapsed} total={total} onDone={done} />
          )}
        </div>
        <TimerControls countdown={step.kind !== 'set'} paused={!!w.pausedAt} remaining={total - elapsed}
          canBack={w.index > 0} skipLabel={step.kind === 'rest' || step.kind === 'transition' ? 'Go now' : 'Skip'}
          onToggle={togglePause} {...control} />
        <div style={{ height: 'calc(var(--safe-bottom) + 12px)' }} />
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)}>
        <div className="stack">
          <h2>Workout</h2>
          <button className="btn block" onClick={() => { update(shortenRests(w)); setMenu(false) }}>Shorten remaining rests 25%</button>
          <button className="btn block" disabled={!canDrop} onClick={() => { update(dropLastSet(w)); setMenu(false) }}>Drop the last set</button>
          <button className="btn danger block" onClick={() => { update(endEarly(w, Date.now())); setMenu(false) }}>End workout now</button>
        </div>
      </Sheet>
    </div>
  )
}

function describeTarget(t) {
  if (!t) return ''
  return `${t.reps} reps${t.load ? ` at ${t.load} kilos` : ''}`
}

function PaceBar({ p, pausedAt }) {
  const b = p.behindSec
  const status = Math.abs(b) < 60 ? ['On pace', 'ahead']
    : b < 0 ? [`${Math.round(-b / 60)} min ahead`, 'ahead']
      : [`${Math.round(b / 60)} min behind`, b > 300 ? 'way-behind' : 'behind']
  return (
    <div className="pace">
      <div className="pace-track"><div className="pace-fill" style={{ width: `${Math.round(p.progress * 100)}%` }} /></div>
      <div className="pace-line">
        <span>{formatDuration(p.elapsedSec)}</span>
        <span className={`pace-status ${pausedAt ? '' : status[1]}`}>{pausedAt ? 'Paused' : status[0]}</span>
        <span>done ~{formatClock(p.projectedEndMs)}</span>
      </div>
    </div>
  )
}

function SetDots({ step }) {
  return (
    <div className="set-dots" aria-label={`Set ${step.setNo} of ${step.setsTotal}`}>
      {Array.from({ length: step.setsTotal }, (_, i) => (
        <span key={i} className={i + 1 < step.setNo ? 'done' : i + 1 === step.setNo ? 'now' : ''} />
      ))}
    </div>
  )
}

/** Value to pre-fill: what you just did this workout, else the target, else last time. */
function initialValues(w, step, records) {
  const earlier = w.steps.slice(0, w.index).reverse()
    .find(s => s.kind === 'set' && s.exerciseId === step.exerciseId && !!s.warmup === !!step.warmup &&
      w.results[s.id] && !w.results[s.id].skipped)
  const prev = earlier && w.results[earlier.id]
  const last = lastPerformance(step.exerciseId, records)
  const targetReps = typeof step.target.reps === 'number' ? step.target.reps : parseInt(String(step.target.reps).match(/\d+/)?.[0] || '10', 10)
  return {
    reps: prev?.reps ?? targetReps,
    load: prev?.load ?? step.target.load ?? (step.warmup ? null : last?.sets?.at(-1)?.load) ??
      (getExercise(step.exerciseId).equipment.includes('barbell') ? 20 : 0),
  }
}

function SetView({ w, step, elapsed, over, records, onDone }) {
  const [vals, setVals] = useState(() => initialValues(w, step, records))
  const weighted = usesLoad(step.exerciseId) || step.target.load
  const last = lastPerformance(step.exerciseId, records)
  const block = w.session.blocks.find(b => b.id === step.blockId)
  const grouped = block && (block.type === 'superset' || block.type === 'circuit')
  const kicker = step.warmup
    ? `Warm-up ${step.setNo} of ${step.setsTotal}`
    : grouped
    ? `Round ${step.setNo} of ${step.setsTotal} · ${String.fromCharCode(65 + step.blockIndex % 26)}${step.exIndex + 1}`
    : `Set ${step.setNo} of ${step.setsTotal}`

  return (
    <>
      <div className="stack tight">
        <div className="flow-kicker">{kicker}</div>
        <div className="flow-name">{step.label}<ExerciseInfoButton exerciseId={step.exerciseId} size="lg" /></div>
        <div className="flow-target">
          Target: <b style={{ color: 'var(--text)' }}>{step.target.reps} reps</b>
          {step.target.load ? ` @ ${step.target.load} kg` : ''}{step.target.rpe ? ` · RPE ${step.target.rpe}` : ''}
        </div>
        {last && <div className="flow-last">Last time: {summarizeSets(last.sets)}</div>}
        <SetDots step={step} />
      </div>

      <div className="log-grid">
        <div className="stack tight" style={{ alignItems: 'center' }}>
          <div className="field-label">Reps</div>
          <Stepper big label="reps" value={vals.reps} min={0} max={100} onChange={reps => setVals({ ...vals, reps })} />
        </div>
        {weighted ? (
          <div className="stack tight" style={{ alignItems: 'center' }}>
            <div className="field-label">Load (kg)</div>
            <Stepper big label="load" value={vals.load} min={0} max={500} step={loadStep(step.exerciseId)}
              format={v => (v ? v : '—')} onChange={load => setVals({ ...vals, load })} />
          </div>
        ) : null}
      </div>

      <div className="stack tight">
        {over > 0 ? (
          <div className="flow-overline bad tnum">+{formatDuration(over)} over — finish the set</div>
        ) : (
          <div className="center small faint tnum">Set time {formatDuration(elapsed)} / {formatDuration(step.expectedSec)}</div>
        )}
        <button className="btn good block big" onClick={() => onDone({ reps: vals.reps, load: weighted ? vals.load || null : null })}>
          Done ✓
        </button>
      </div>
    </>
  )
}

function Ring({ fraction, children, color = 'var(--info)' }) {
  const r = 104
  const c = 2 * Math.PI * r
  return (
    <div className="ring">
      <svg viewBox="0 0 230 230" aria-hidden="true">
        <circle cx="115" cy="115" r={r} stroke="var(--surface-3)" strokeWidth="10" fill="none" />
        <circle cx="115" cy="115" r={r} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, fraction)))}
          style={{ transition: 'stroke-dashoffset 0.25s linear' }} />
      </svg>
      <div className="inner">{children}</div>
    </div>
  )
}

function NextCard({ next, w, records }) {
  if (!next) return <div className="flow-next center bold">Last one done after this. Finish strong.</div>
  const last = next.kind === 'set' ? lastPerformance(next.exerciseId, records) : null
  const block = w.session.blocks.find(b => b.id === next.blockId)
  return (
    <div className="flow-next">
      <div className="eyebrow">Next</div>
      <div className="bold" style={{ fontSize: 20 }}>{next.label}{next.side ? ` — ${next.side}` : ''}{next.exerciseId && <ExerciseInfoButton exerciseId={next.exerciseId} />}</div>
      <div className="small muted">
        {next.kind === 'set'
          ? `${next.warmup ? `Warm-up ${next.setNo}/${next.setsTotal} · ` : block?.type === 'single' ? `Set ${next.setNo}/${next.setsTotal} · ` : ''}${next.target.reps} reps${next.target.load ? ` @ ${next.target.load} kg` : ''}`
          : next.kind === 'cardio' ? `${Math.round(next.durationSec / 60)} min · ${next.target}`
            : `${formatDuration(next.durationSec)} · ${next.target}`}
      </div>
      {last && <div className="tiny faint">Last time: {summarizeSets(last.sets)}</div>}
    </div>
  )
}

function RestView({ step, remaining, total, next, w, records }) {
  const warn = remaining <= 10
  return (
    <>
      <div className="flow-kicker">{step.kind === 'transition' ? 'Set up next station' : step.label === 'Switch' ? 'Switch' : 'Rest'}</div>
      <Ring fraction={remaining / total} color={warn ? 'var(--warn)' : 'var(--info)'}>
        <div className={`flow-timer small tnum${warn ? ' warn' : ''}`}>{formatDuration(Math.ceil(remaining))}</div>
        <div className="tiny faint">of {formatDuration(total)}</div>
      </Ring>
      <NextCard next={next} w={w} records={records} />
    </>
  )
}

function TimedView({ step, remaining, total }) {
  return (
    <>
      <div className="stack tight">
        <div className="flow-kicker">{step.setsTotal > 1 ? `Round ${step.setNo} of ${step.setsTotal}` : 'Hold'}{step.side ? ` · ${step.side}` : ''}</div>
        <div className="flow-name">{step.label}<ExerciseInfoButton exerciseId={step.exerciseId} size="lg" /></div>
        <div className="flow-target">{step.target}</div>
      </div>
      <Ring fraction={remaining / total} color="var(--accent)">
        <div className="flow-timer small tnum">{formatDuration(Math.ceil(remaining))}</div>
      </Ring>
    </>
  )
}

function CardioView({ step, label, elapsed, total, onDone }) {
  const [distance, setDistance] = useState('')
  const [hr, setHr] = useState('')
  const left = total - elapsed
  return (
    <>
      <div className="stack tight">
        <div className="flow-kicker">{label || 'Cardio'} · {Math.round(total / 60)} min</div>
        <div className="flow-name">{getExercise(step.exerciseId).name}<ExerciseInfoButton exerciseId={step.exerciseId} size="lg" /></div>
        {step.target && <div className="flow-target">{step.target}</div>}
      </div>
      <div className={`flow-timer tnum`} style={{ color: left <= 0 ? 'var(--good)' : undefined }}>
        {left > 0 ? formatDuration(Math.ceil(left)) : `+${formatDuration(-left)}`}
      </div>
      <div className="center small faint">{left > 0 ? 'remaining' : 'Time\'s up — log it and move on'}</div>
      <div className="row">
        <input inputMode="decimal" placeholder="Distance km" value={distance} onChange={e => setDistance(e.target.value.replace(',', '.'))} />
        <input inputMode="numeric" placeholder="Avg HR" value={hr} onChange={e => setHr(e.target.value)} />
      </div>
      <button className="btn good block big" onClick={() => onDone({ distanceKm: distance ? Number(distance) : null, avgHr: hr ? Number(hr) : null })}>
        Done ✓
      </button>
    </>
  )
}

const ICON = {
  back: <path d="M6 5v14M19 5 9 12l10 7z" />,
  next: <path d="M18 5v14M5 5l10 7-10 7z" />,
  restart: <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4.5h4.5" />,
  play: <path d="M7 4.5v15l12.5-7.5z" />,
  pause: <path d="M8 5v14M16 5v14" />,
}

function CtlButton({ icon, label, big, ...props }) {
  return (
    <button type="button" className={`tbtn${big ? ' big' : ''}`} aria-label={label} {...props}>
      <svg viewBox="0 0 24 24" fill={icon === 'play' ? 'currentColor' : 'none'} stroke="currentColor"
        strokeWidth={icon === 'pause' ? 3.2 : 2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[icon]}</svg>
      <span>{label}</span>
    </button>
  )
}

/** Transport bar under every step; the ±seconds row only on steps with a countdown. */
function TimerControls({ countdown, paused, remaining, canBack, skipLabel, onToggle, back, restart, skip, adjust }) {
  return (
    <div className="timer-ctl">
      {countdown && (
        <div className="adj-row">
          {[-10, -5, 5, 10].map(d => (
            <button key={d} type="button" className="btn small outline tnum" disabled={d < 0 && remaining <= 0}
              onClick={() => adjust(d)} aria-label={`${d > 0 ? 'Add' : 'Take off'} ${Math.abs(d)} seconds`}>
              {d > 0 ? `+${d}` : `−${-d}`}s
            </button>
          ))}
        </div>
      )}
      <div className="transport">
        <CtlButton icon="back" label="Back" disabled={!canBack} onClick={back} />
        <CtlButton icon="restart" label="Restart" disabled={!countdown} onClick={restart} />
        <CtlButton icon={paused ? 'play' : 'pause'} label={paused ? 'Start' : 'Pause'} big onClick={onToggle} />
        <CtlButton icon="next" label={skipLabel} onClick={skip} />
      </div>
    </div>
  )
}
