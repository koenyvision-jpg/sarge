import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { accountability, heatmap, history, prBoard, scheduledSessions, timeline, workouts } from '../lib/schedule.js'
import { excuseLabel } from '../lib/excuses.js'
import { formatDay, formatDuration, todayISO } from '../lib/dates.js'
import { summarizeSets } from '../lib/engine.js'
import { describeAdjustment } from '../lib/adjust.js'
import { Sheet } from '../components/ui.jsx'
import { ExerciseName } from '../components/ExerciseInfo.jsx'

const pct = v => (v == null ? '—' : `${Math.round(v * 100)}%`)

export default function ProgressPage() {
  const { records, plan } = useStore()
  const [open, setOpen] = useState(null)
  const today = todayISO()
  const all = workouts(records)
  const events = timeline(scheduledSessions(plan, records, today), records, plan)
  const acc = accountability(events, plan, today)
  const days = heatmap(records, today, 12, events.filter(e => e.date < today))
  const log = history(records, plan).slice(0, 60)
  const prs = prBoard(records).slice(0, 8)
  const recent = all.slice(0, 10)
  const avgOver = recent.length ? recent.reduce((s, w) => s + (w.actualSec - w.plannedSec), 0) / recent.length : null
  const avgDrag = recent.length ? recent.reduce((s, w) => s + (w.overSec || 0), 0) / recent.length : null

  return (
    <div className="page">
      <div>
        <div className="eyebrow">The numbers don't lie</div>
        <h1 className="page-title">Progress</h1>
      </div>

      <div className="stats">
        <div className="stat"><div className="v">{pct(acc.blockCompliance)}</div><div className="l">Block compliance</div></div>
        <div className="stat"><div className="v">{all.length}</div><div className="l">Workouts</div></div>
        <div className="stat"><div className="v">{acc.streak}</div><div className="l">Streak</div></div>
      </div>

      <div className="card stack tight">
        <div className="row between">
          <span className="bold">Consistency</span>
          <span className="tiny faint">last 12 weeks{days.some(d => d.missed) ? ' · red = missed' : ''}</span>
        </div>
        <div className="heat" aria-label="Workout heatmap">
          {days.map(d => (
            <span key={d.date} title={`${d.date}: ${d.count}`}
              className={[d.future ? 'future' : d.count >= 2 ? 'c2' : d.count === 1 ? 'c1' : d.missed ? 'miss' : '', d.date === today ? 'today' : ''].join(' ')} />
          ))}
        </div>
      </div>

      <div className="card stack tight">
        <span className="bold">Session pacing <span className="tiny faint">(last {recent.length || 0})</span></span>
        {recent.length ? (
          <>
            <div className="kv tnum"><span>Avg vs plan</span><span style={{ color: avgOver > 180 ? 'var(--warn)' : 'var(--good)' }}>{avgOver >= 0 ? '+' : '−'}{formatDuration(Math.abs(avgOver))}</span></div>
            <div className="kv tnum"><span>Avg time lost to slow sets / long rests</span><span>{formatDuration(avgDrag)}</span></div>
          </>
        ) : <div className="small faint">Finish a workout to see this.</div>}
      </div>

      <div className="section-title">Best lifts (estimated 1RM)</div>
      <div className="list">
        {prs.map(p => (
          <div key={p.exerciseId} className="list-row">
            <div className="grow">
              <div><ExerciseName exerciseId={p.exerciseId} /></div>
              <div className="tiny faint">{p.load} kg × {p.reps} · {formatDay(p.date, today)}</div>
            </div>
            <span className="bold tnum">{Math.round(p.e1rm)} kg</span>
          </div>
        ))}
        {!prs.length && <div className="empty small">Log weighted sets to build your PR board.</div>}
      </div>

      <div className="section-title">History</div>
      <div className="list">
        {log.map(e => {
          if (e.kind !== 'workout') {
            const [cls, label] = { missed: ['bad', 'Missed'], excused: ['warn', 'Skipped'], moved: ['', 'Moved'] }[e.kind]
            const detail = e.kind === 'moved'
              ? [e.from && formatDay(e.from, today), e.to && formatDay(e.to, today)].filter(Boolean).join(' → ')
              : [formatDay(e.date, today), e.excuse && excuseLabel(e.excuse)].filter(Boolean).join(' · ')
            return (
              <div key={e.key} className="list-row">
                <span className={`dot ${e.kind === 'moved' ? '' : e.kind}`} />
                <div className="grow">
                  <div className="row" style={{ gap: 6 }}><span className="bold ellipsis muted">{e.name}</span><span className={`badge ${cls}`}>{label}</span></div>
                  <div className="tiny faint ellipsis">{detail}</div>
                </div>
              </div>
            )
          }
          const w = e.workout
          const d = (w.actualSec || 0) - (w.plannedSec || 0)
          return (
            <button key={e.key} className="list-row" onClick={() => setOpen(w)}>
              <span className="dot done" />
              <div className="grow">
                <div className="bold ellipsis">{w.name || 'Workout'}</div>
                <div className="tiny faint">{formatDay(w.date, today)}{w.sessionRpe ? ` · RPE ${w.sessionRpe}` : ''}{w.prs?.length ? ` · ${w.prs.length} PR` : ''}</div>
              </div>
              <div className="tnum small" style={{ textAlign: 'right' }}>
                <div>{formatDuration(w.actualSec || 0)}</div>
                {w.plannedSec > 0 && <div className="tiny" style={{ color: d > 180 ? 'var(--warn)' : 'var(--text-3)' }}>{d >= 0 ? '+' : '−'}{formatDuration(Math.abs(d))}</div>}
              </div>
            </button>
          )
        })}
        {!log.length && <div className="empty small">No workouts yet. Today's a good day to start.</div>}
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <div className="stack">
            <div>
              <h2>{open.name}</h2>
              <div className="small muted tnum">{formatDay(open.date, today)} · {formatDuration(open.actualSec || 0)}{open.plannedSec ? ` (plan ${Math.round(open.plannedSec / 60)} min)` : ''}{open.sessionRpe ? ` · RPE ${open.sessionRpe}` : ''}</div>
            </div>
            {(open.blocks || []).map(b => (
              <div key={b.blockId} className="card tight stack tight">
                <div className="row between"><span className="bold">{b.title}</span><span className="tiny faint tnum">{formatDuration(b.actualSec)}</span></div>
                {(b.exercises || []).map(e => (
                  <div key={e.exerciseId} className="small"><ExerciseName exerciseId={e.exerciseId} className="muted" suffix=":" /> {summarizeSets(e.sets)}</div>
                ))}
                {b.cardio && <div className="small muted">{formatDuration(b.cardio.durationSec)}{b.cardio.distanceKm ? ` · ${b.cardio.distanceKm} km` : ''}{b.cardio.avgHr ? ` · ${b.cardio.avgHr} bpm` : ''}</div>}
                {b.timed?.length > 0 && <div className="small muted">{b.timed.filter(t => t.completed).length}/{b.timed.length} intervals/holds done</div>}
              </div>
            ))}
            {open.adjustments?.length > 0 && (
              <div className="small muted">{open.adjustments.map((a, i) => <div key={i}>• {describeAdjustment(a)}</div>)}</div>
            )}
            {open.note && <div className="card tight small">“{open.note}”</div>}
          </div>
        )}
      </Sheet>
    </div>
  )
}
