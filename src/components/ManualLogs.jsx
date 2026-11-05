import { useState } from 'react'
import { Sheet, toast } from './ui.jsx'
import { ExerciseName } from './ExerciseInfo.jsx'
import { useStore } from '../lib/store.jsx'
import { formatDay, nowMs, todayISO, uid } from '../lib/dates.js'
import {
  cardioBlockOf, durationText, linkRunFields, missingCardioBlocks, outsideWorkoutRecord, parseDuration, replacementRecord, runFieldsFrom,
} from '../lib/manualLogs.js'

const num = text => {
  const v = Number(String(text ?? '').trim().replace(',', '.'))
  return String(text ?? '').trim() !== '' && Number.isFinite(v) && v >= 0 ? v : null
}

function RpeChips({ value, onChange }) {
  return (
    <div className="chips">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <button key={n} type="button" className={`chip${value === n ? ' on' : ''}`} style={{ minWidth: 40, justifyContent: 'center' }}
          onClick={() => onChange(value === n ? null : n)}>{n}</button>
      ))}
    </div>
  )
}

/** Distance, time and pace for a run. Fill in any two; the third follows. */
function RunFields({ value, onChange }) {
  const field = (key, label, placeholder, mode) => (
    <label className="grow stack tight" style={{ minWidth: 0 }}>
      <span className="field-label">{label}</span>
      <input inputMode={mode} placeholder={placeholder} value={value[key]} onChange={e => onChange(linkRunFields(value, key, e.target.value))} />
    </label>
  )
  return (
    <div className="row run-fields">
      {field('distance', 'Km', '6.2', 'decimal')}
      {field('duration', 'Time', '38.30', 'decimal')}
      {field('pace', 'Pace /km', '6.10', 'decimal')}
    </div>
  )
}

/** "Done outside the app" for a cardio session: distance, duration, optional RPE → a normal workout log. */
export function OutsideLogSheet({ session, onClose, onSaved }) {
  const { addRecord } = useStore()
  const block = cardioBlockOf(session)
  const [run, setRun] = useState({ distance: '', duration: block?.durationMin ? String(block.durationMin) : '', pace: '' })
  const [rpe, setRpe] = useState(null)
  const [note, setNote] = useState('')
  const today = todayISO()
  const date = session.date && session.date < today ? session.date : today
  const durationSec = parseDuration(run.duration)
  const distanceKm = num(run.distance)
  const ok = durationSec && distanceKm != null && distanceKm > 0

  const save = () => {
    const rec = outsideWorkoutRecord(session, { durationSec, distanceKm, sessionRpe: rpe, note: note.trim() }, { id: uid('w'), today, now: nowMs() })
    addRecord(rec, `Sarge: workout ${rec.date} — ${rec.name} (outside the app)`)
    toast('Logged. The coach will see it.')
    onSaved?.()
  }

  return (
    <Sheet open onClose={onClose}>
      <div className="stack">
        <div>
          <h2>Done outside the app</h2>
          <p className="muted small">{session.name} · logged for {formatDay(date, today)}</p>
        </div>
        <RunFields value={run} onChange={setRun} />
        <div className="tiny faint">Fill in any two — the third follows. Times as minutes (40) or min.sec (38.30); 1.05.00 for over an hour.</div>
        {run.duration && !durationSec && <div className="tiny" style={{ color: 'var(--bad)' }}>Can't read that time.</div>}
        <div className="field-label">How hard? (RPE, optional)</div>
        <RpeChips value={rpe} onChange={setRpe} />
        <textarea rows={2} placeholder="Notes for the coach (optional)" value={note} onChange={e => setNote(e.target.value)} />
        <button className="btn primary block" disabled={!ok} onClick={save}>Log it</button>
      </div>
    </Sheet>
  )
}

/** Correct a wrong workout log: writes a new log that supersedes it. The old file stays in the repo. */
export function ReplaceLogSheet({ workout: w, onClose, onSaved }) {
  const { addRecord, records, plan } = useStore()
  const [missing] = useState(() => missingCardioBlocks(w, plan))
  const [date, setDate] = useState(w.date)
  const [duration, setDuration] = useState(durationText(w.actualSec))
  const [rpe, setRpe] = useState(w.sessionRpe ?? null)
  const [note, setNote] = useState(w.note || '')
  const [blocks, setBlocks] = useState(() => Object.fromEntries((w.blocks || []).map(b => [b.blockId, {
    cardio: b.cardio ? runFieldsFrom(b.cardio) : null,
    sets: Object.fromEntries((b.exercises || []).map(ex => [ex.exerciseId, ex.sets.map(s => ({ reps: s.reps ?? '', load: s.load ?? '' }))])),
  }])))
  const [added, setAdded] = useState(() => Object.fromEntries(missing.map(m => [m.blockId, runFieldsFrom(null)])))
  const today = todayISO()
  const outside = w.source === 'outside'

  const patch = (blockId, fn) => setBlocks(prev => {
    const next = structuredClone(prev)
    fn(next[blockId])
    return next
  })

  // Collect edits; null if something can't be read.
  const edits = (() => {
    const out = { date, sessionRpe: rpe, note: note.trim(), blocks: {} }
    if (!outside) {
      const sec = parseDuration(duration)
      if (!sec) return null
      out.actualSec = sec
    }
    for (const [blockId, b] of Object.entries(blocks)) {
      const e = {}
      if (b.cardio) {
        const sec = parseDuration(b.cardio.duration)
        if (!sec) return null
        e.cardio = { durationSec: sec, distanceKm: num(b.cardio.distance) }
      }
      e.sets = {}
      for (const [exId, sets] of Object.entries(b.sets)) {
        if (sets.some(st => num(st.reps) == null || (String(st.load).trim() !== '' && num(st.load) == null))) return null
        e.sets[exId] = sets.map(st => ({ reps: num(st.reps), load: num(st.load) }))
      }
      out.blocks[blockId] = e
    }
    // A run the log is missing: optional, but if you fill anything in, the time has to be readable.
    for (const m of missing) {
      const f = added[m.blockId]
      if (!f.distance.trim() && !f.duration.trim() && !f.pace.trim()) continue
      const sec = parseDuration(f.duration)
      if (!sec) return null
      out.blocks[m.blockId] = { add: m, cardio: { durationSec: sec, distanceKm: num(f.distance) } }
    }
    return out
  })()

  const save = () => {
    const rec = replacementRecord(w, edits, records, { id: uid('w'), now: nowMs() })
    addRecord(rec, `Sarge: correct workout ${rec.date} — ${rec.name} (replaces ${w.id})`)
    toast('Corrected. The old log is ignored from now on.')
    onSaved?.(rec)
  }

  return (
    <Sheet open onClose={onClose}>
      <div className="stack">
        <div>
          <h2>Fix this log</h2>
          <p className="muted small">{w.name} · {formatDay(w.date, today)}. Saves a corrected copy; the coach sees which log it replaces.</p>
        </div>
        <div className="row">
          <label className="grow stack tight">
            <span className="field-label">Date</span>
            <input type="date" max={today} value={date} onChange={e => setDate(e.target.value || w.date)} />
          </label>
          {!outside && (
            <label className="grow stack tight">
              <span className="field-label">Total time</span>
              <input inputMode="decimal" value={duration} onChange={e => setDuration(e.target.value)} />
            </label>
          )}
        </div>

        {(w.blocks || []).map(b => {
          const e = blocks[b.blockId]
          if (!e?.cardio && !b.exercises?.length) return null
          return (
            <div key={b.blockId} className="card tight stack tight">
              <span className="bold">{b.title}</span>
              {e.cardio && <RunFields value={e.cardio} onChange={v => patch(b.blockId, x => { x.cardio = v })} />}
              {(b.exercises || []).map(ex => (
                <div key={ex.exerciseId} className="stack tight">
                  <div className="small"><ExerciseName exerciseId={ex.exerciseId} className="muted" /></div>
                  {e.sets[ex.exerciseId].map((s, i) => (
                    <div key={i} className="row fix-set">
                      <span className="tiny faint tnum">{ex.sets[i].warmup ? 'W' : i + 1}</span>
                      <input inputMode="decimal" aria-label={`Set ${i + 1} kg`} placeholder="kg" value={s.load}
                        onChange={ev => patch(b.blockId, x => { x.sets[ex.exerciseId][i].load = ev.target.value })} />
                      <span className="tiny faint">kg ×</span>
                      <input inputMode="numeric" aria-label={`Set ${i + 1} reps`} placeholder="reps" value={s.reps}
                        onChange={ev => patch(b.blockId, x => { x.sets[ex.exerciseId][i].reps = ev.target.value })} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )
        })}

        {missing.map(m => (
          <div key={m.blockId} className="card tight stack tight">
            <div className="row between"><span className="bold">{m.title}</span><span className="badge warn">Not in this log</span></div>
            <div className="tiny faint">Skipped in the app but did it anyway? Fill it in and it's logged as done.</div>
            <RunFields value={added[m.blockId]} onChange={v => setAdded(prev => ({ ...prev, [m.blockId]: v }))} />
          </div>
        ))}

        <div className="field-label">Session RPE</div>
        <RpeChips value={rpe} onChange={setRpe} />
        <textarea rows={2} placeholder="Notes for the coach" value={note} onChange={e => setNote(e.target.value)} />
        {!edits && <div className="tiny" style={{ color: 'var(--bad)' }}>Check the numbers. Every set needs reps, every run a time: minutes (40) or min.sec (38.30).</div>}
        <button className="btn primary block" disabled={!edits} onClick={save}>Save correction</button>
      </div>
    </Sheet>
  )
}
