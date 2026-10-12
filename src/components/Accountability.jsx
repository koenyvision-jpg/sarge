import { useState } from 'react'
import { Sheet, Scale, toast } from './ui.jsx'
import { useStore } from '../lib/store.jsx'
import { addDays, formatDay, nowMs, todayISO, uid } from '../lib/dates.js'
import { EXCUSES } from '../lib/excuses.js'


function DayPicker({ from, value, onChange, days = 7 }) {
  const today = todayISO()
  return (
    <div className="chips scroll">
      {Array.from({ length: days }, (_, i) => addDays(from, i)).map(d => (
        <button key={d} type="button" className={`chip${value === d ? ' on' : ''}`} onClick={() => onChange(d)}>
          {formatDay(d, today)}
        </button>
      ))}
    </div>
  )
}

function ReasonPicker({ category, setCategory, text, setText, placeholder }) {
  return (
    <>
      <div className="chips">
        {EXCUSES.map(([id, label]) => (
          <button key={id} type="button" className={`chip${category === id ? ' on' : ''}`} onClick={() => setCategory(id)}>{label}</button>
        ))}
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder={placeholder} rows={2} />
    </>
  )
}

/** "Can't today" — forces a reason, then either moves the session or writes it off. */
export function CantTodaySheet({ session, onClose, title = "Can't train today?", allowSkip = true }) {
  const { addRecord } = useStore()
  const [category, setCategory] = useState(null)
  const [text, setText] = useState('')
  const [moveTo, setMoveTo] = useState(null)
  const today = todayISO()

  const move = () => {
    const now = nowMs()
    addRecord({
      type: 'reschedule', id: uid('r'), sessionId: session.id, fromDate: session.date, toDate: moveTo,
      reason: [EXCUSES.find(e => e[0] === category)?.[1], text].filter(Boolean).join(' — '),
      date: today, createdAt: now,
    })
    toast(`Moved to ${formatDay(moveTo, today)}. Don't make me move it again.`)
    onClose()
  }
  const skip = () => {
    const now = nowMs()
    addRecord({
      type: 'excuse', id: uid('x'), sessionId: session.id, sessionDate: session.date, when: 'ahead',
      category, text, date: today, createdAt: now,
    })
    toast('Logged. The coach will hear about this.')
    onClose()
  }

  return (
    <Sheet open onClose={onClose}>
      <div className="stack">
        <div>
          <h2>{title}</h2>
          <p className="muted">Give me a reason. A real one.</p>
        </div>
        <ReasonPicker category={category} setCategory={setCategory} text={text} setText={setText} placeholder="Details (optional)" />
        <div className="divider" />
        <div className="field-label">Move {session.name} to</div>
        <DayPicker from={session.date > today ? today : addDays(today, 1)} value={moveTo} onChange={setMoveTo} days={10} />
        <button className="btn primary block" disabled={!category || !moveTo || moveTo === session.date} onClick={move}>Move it</button>
        {allowSkip && <button className="btn danger block" disabled={!category} onClick={skip}>Skip it — log the excuse</button>}
      </div>
    </Sheet>
  )
}

/** Blocks the Today screen until each missed session has an explanation (or is made up). */
export function ExplainYourself({ missed }) {
  const { addRecord } = useStore()
  const [category, setCategory] = useState(null)
  const [text, setText] = useState('')
  const [makeUp, setMakeUp] = useState(null)
  const session = missed[0]
  const today = todayISO()
  if (!session) return null

  const reset = () => { setCategory(null); setText(''); setMakeUp(null) }
  const submit = () => {
    const now = nowMs()
    const reason = [EXCUSES.find(e => e[0] === category)?.[1], text].filter(Boolean).join(' — ')
    if (makeUp) {
      addRecord({
        type: 'reschedule', id: uid('r'), sessionId: session.id, fromDate: session.date, toDate: makeUp,
        reason: `Missed: ${reason}`, date: today, createdAt: now,
      })
    } else {
      addRecord({
        type: 'excuse', id: uid('x'), sessionId: session.id, sessionDate: session.date, when: 'after',
        category, text, date: today, createdAt: now,
      })
    }
    reset()
  }

  return (
    <Sheet open dismissable={false}>
      <div className="stack">
        <div>
          <div className="eyebrow" style={{ color: 'var(--bad)' }}>Missed session{missed.length > 1 ? ` · ${missed.length} to explain` : ''}</div>
          <h2>Explain yourself.</h2>
          <p className="muted">{formatDay(session.date, today)}: <b style={{ color: 'var(--text)' }}>{session.name}</b> didn't happen. What went wrong?</p>
        </div>
        <ReasonPicker category={category} setCategory={setCategory} text={text} setText={setText} placeholder="What happened?" />
        <div className="field-label">Make it up? (optional)</div>
        <DayPicker from={today} value={makeUp} onChange={d => setMakeUp(makeUp === d ? null : d)} days={6} />
        <button className="btn primary block" disabled={!category} onClick={submit}>
          {makeUp ? `Reschedule to ${formatDay(makeUp, today)}` : 'Log it as missed'}
        </button>
      </div>
    </Sheet>
  )
}

const CHECKIN_FIELDS = [
  ['sleep', 'Sleep', 'terrible → great'],
  ['energy', 'Energy', 'empty → full'],
  ['soreness', 'Soreness', 'none → wrecked'],
  ['stress', 'Stress', 'calm → maxed'],
]

export function CheckInCard({ existing }) {
  const { addRecord } = useStore()
  const [editing, setEditing] = useState(!existing)
  const [vals, setVals] = useState(() => existing || {})
  const today = todayISO()

  if (!editing && existing) {
    return (
      <button className="card tight tap" onClick={() => setEditing(true)}>
        <div className="row between">
          <span className="row"><span className="badge good">Checked in</span></span>
          <span className="small muted tnum">
            Sleep {existing.sleep} · Energy {existing.energy} · Sore {existing.soreness} · Stress {existing.stress}
            {existing.bodyweight ? ` · ${existing.bodyweight} kg` : ''}
          </span>
        </div>
      </button>
    )
  }
  const complete = CHECKIN_FIELDS.every(([k]) => vals[k])
  const save = () => {
    addRecord({
      type: 'checkin', id: `checkin-${today}`, date: today,
      sleep: vals.sleep, energy: vals.energy, soreness: vals.soreness, stress: vals.stress,
      bodyweight: vals.bodyweight ? Number(vals.bodyweight) : null,
      createdAt: existing?.createdAt || nowMs(),
    })
    setEditing(false)
  }
  return (
    <div className="card stack">
      <div className="row between">
        <div className="bold">Daily check-in</div>
        <span className="tiny faint">10 seconds</span>
      </div>
      {CHECKIN_FIELDS.map(([k, label, hint]) => (
        <div key={k} className="stack tight">
          <div className="row between"><span className="small bold">{label}</span><span className="tiny faint">{hint}</span></div>
          <Scale label={label} value={vals[k]} onChange={v => setVals({ ...vals, [k]: v })} />
        </div>
      ))}
      <div className="row">
        <input inputMode="decimal" placeholder="Bodyweight kg (optional)" value={vals.bodyweight ?? ''}
          onChange={e => setVals({ ...vals, bodyweight: e.target.value.replace(',', '.') })} />
        <button className="btn primary" disabled={!complete} onClick={save}>Save</button>
      </div>
    </div>
  )
}
