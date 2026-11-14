import { useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { formatDuration } from '../lib/dates.js'
import { buildWorkoutRecord, estimateByBlock, findPRs, listExerciseNotes, noteKey, setExerciseNote } from '../lib/engine.js'
import { describeAdjustment } from '../lib/adjust.js'
import { toast } from '../components/ui.jsx'
import { ExerciseName } from '../components/ExerciseInfo.jsx'

function verdict(rec) {
  const over = rec.actualSec - rec.plannedSec
  if (rec.endedEarly) return 'Ended early. The coach will want to know why.'
  if (over <= 60) return 'On time. That\'s how it\'s done.'
  if (over <= 5 * 60) return `${Math.round(over / 60)} min over plan. Acceptable — barely.`
  return `You dragged it out by ${Math.round(over / 60)} minutes. Tighten up the rests next time.`
}

export default function WorkoutSummary({ workout, onDone }) {
  const { records, addRecord, set } = useStore()
  const [rpe, setRpe] = useState(null)
  const [note, setNote] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const base = useMemo(() => buildWorkoutRecord(workout), [workout])
  const prs = useMemo(() => findPRs(base, records), [base, records])
  const planned = useMemo(() => estimateByBlock(workout.session), [workout.session])
  const overPlan = base.actualSec - base.plannedSec
  // Fixed when the summary opens, so clearing a note to retype it doesn't make the box vanish.
  const [exNotes] = useState(() => listExerciseNotes(workout))
  const editNote = (n, text) => set({ activeWorkout: setExerciseNote(workout, n.blockId, n.exerciseId, text) })

  const save = () => {
    addRecord({ ...base, sessionRpe: rpe, note: note.trim(), prs }, `Sarge: workout ${base.date} — ${base.name}`)
    set({ activeWorkout: null })
    toast(prs.length ? `Saved. ${prs.length} PR${prs.length > 1 ? 's' : ''}!` : 'Saved. Coach will review it.')
    onDone()
  }
  const discard = () => {
    set({ activeWorkout: null })
    onDone()
  }

  return (
    <div className="fullscreen">
      <div className="fullscreen-inner">
        <div className="stack" style={{ padding: 'calc(var(--safe-top) + 20px) var(--gutter) 16px' }}>
          <div>
            <div className="eyebrow" style={{ color: base.endedEarly ? 'var(--warn)' : 'var(--good)' }}>
              {base.endedEarly ? 'Ended early' : 'Workout complete'}
            </div>
            <h1 className="page-title">{base.name}</h1>
          </div>

          <div className="orders" style={{ fontSize: 17 }}>{verdict(base)}</div>

          <div className="stats">
            <div className="stat"><div className="v">{formatDuration(base.actualSec)}</div><div className="l">Actual</div></div>
            <div className="stat"><div className="v">{Math.round(base.plannedSec / 60)}′</div><div className="l">Planned</div></div>
            <div className="stat">
              <div className="v" style={{ color: overPlan > 120 ? 'var(--warn)' : 'var(--good)' }}>
                {overPlan > 0 ? '+' : '−'}{formatDuration(Math.abs(overPlan))}
              </div>
              <div className="l">vs plan</div>
            </div>
          </div>
          <div className="small muted tnum">
            Time lost to slow sets & extended rests: <b style={{ color: base.overSec > 120 ? 'var(--warn)' : 'var(--text)' }}>{formatDuration(base.overSec)}</b>
            {base.pausedSec ? ` · paused ${formatDuration(base.pausedSec)}` : ''}
          </div>

          {prs.length > 0 && (
            <div className="card accent stack tight">
              <div className="eyebrow" style={{ color: 'var(--accent)' }}>Personal records</div>
              {prs.map(p => (
                <div key={p.exerciseId} className="pr-row">
                  <ExerciseName exerciseId={p.exerciseId} />
                  <span className="tnum">{p.load} kg × {p.reps} <span className="faint small">(e1RM {Math.round(p.e1rm)} ← {Math.round(p.previous)})</span></span>
                </div>
              ))}
            </div>
          )}

          <div className="section-title">Time per block</div>
          <div className="card tight">
            {base.blocks.map(b => {
              const plan = planned[b.blockId] || 0
              const d = b.actualSec - plan
              return (
                <div key={b.blockId} className="kv tnum">
                  <span className="ellipsis">{b.title}</span>
                  <span>
                    {formatDuration(b.actualSec)}{' '}
                    <span className="small" style={{ color: d > 60 ? 'var(--warn)' : 'var(--text-3)' }}>
                      ({d >= 0 ? '+' : '−'}{formatDuration(Math.abs(d))})
                    </span>
                  </span>
                </div>
              )
            })}
          </div>

          {base.adjustments.length > 0 && (
            <>
              <div className="section-title">Changes from the plan</div>
              <div className="card tight small muted stack tight">
                {base.adjustments.map((a, i) => <div key={i}>• {describeAdjustment(a)}</div>)}
              </div>
            </>
          )}

          <div className="section-title">How hard was it? (session RPE)</div>
          <div className="chips">
            {[5, 6, 7, 8, 9, 10].map(n => (
              <button key={n} className={`chip${rpe === n ? ' on' : ''}`} onClick={() => setRpe(n)} style={{ minWidth: 44, justifyContent: 'center' }}>{n}</button>
            ))}
          </div>
          {exNotes.length > 0 && (
            <>
              <div className="section-title">Exercise notes</div>
              <div className="stack tight">
                {exNotes.map(n => (
                  <div key={noteKey(n.blockId, n.exerciseId)} className="stack tight" style={{ gap: 4 }}>
                    <ExerciseName exerciseId={n.exerciseId} className="small bold" />
                    <textarea rows={2} style={{ minHeight: 0 }} value={workout.exerciseNotes?.[noteKey(n.blockId, n.exerciseId)] ?? ''}
                      onChange={e => editNote(n, e.target.value)} aria-label="Exercise note" />
                  </div>
                ))}
              </div>
              <div className="section-title">Overall notes</div>
            </>
          )}
          <textarea placeholder="Notes for the coach — pain, form, how it felt" value={note} onChange={e => setNote(e.target.value)} />
        </div>

        <div className="bottombar stack tight">
          <button className="btn primary block big" onClick={save}>Save workout</button>
          {confirmDiscard
            ? <button className="btn danger block" onClick={discard}>Really discard? Nothing will be logged</button>
            : <button className="btn ghost block small" onClick={() => setConfirmDiscard(true)}>Discard</button>}
        </div>
      </div>
    </div>
  )
}
