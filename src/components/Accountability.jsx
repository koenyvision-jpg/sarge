import { useState } from 'react'
import { Sheet, Scale, toast } from './ui.jsx'
import { useStore } from '../lib/store.jsx'
import { formatDay, nowMs, todayISO, uid } from '../lib/dates.js'
import { EXCUSES } from '../lib/excuses.js'

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

/** "Can't today" — forces a reason and logs the skip. Rearranging the plan is the coach's job. */
export function CantTodaySheet({ session, onClose }) {
  const { addRecord } = useStore()
  const [category, setCategory] = useState(null)
  const [text, setText] = useState('')
  const today = todayISO()

  const skip = () => {
    addRecord({
      type: 'excuse', id: uid('x'), sessionId: session.id, sessionName: session.name, sessionDate: session.date, when: 'ahead',
      category, text, date: today, createdAt: nowMs(),
    })
    toast('Logged. The coach will hear about this.')
    onClose()
  }

  return (
    <Sheet open onClose={onClose}>
      <div className="stack">
        <div>
          <h2>Can't train today?</h2>
          <p className="muted">Give me a reason. A real one.</p>
        </div>
        <ReasonPicker category={category} setCategory={setCategory} text={text} setText={setText} placeholder="Details (optional)" />
        <button className="btn danger block" disabled={!category} onClick={skip}>Skip it — log the excuse</button>
        <div className="tiny faint center">The coach reworks the plan. Want it moved instead? Talk to Sarge.</div>
      </div>
    </Sheet>
  )
}

/** Blocks the Today screen until each logged miss has an explanation. */
export function ExplainYourself({ missed }) {
  const { addRecord } = useStore()
  const [category, setCategory] = useState(null)
  const [text, setText] = useState('')
  const session = missed[0]
  const today = todayISO()
  if (!session) return null

  const submit = () => {
    addRecord({
      type: 'excuse', id: uid('x'), sessionId: session.id, sessionName: session.name, sessionDate: session.date, when: 'after',
      category, text, date: today, createdAt: nowMs(),
    })
    setCategory(null)
    setText('')
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
        <button className="btn primary block" disabled={!category} onClick={submit}>Log it</button>
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
