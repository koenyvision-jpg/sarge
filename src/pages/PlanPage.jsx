import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { scheduledSessions } from '../lib/schedule.js'
import { addDays, formatDay, parseISODate, startOfWeek, todayISO } from '../lib/dates.js'
import { estimateSessionSec } from '../lib/engine.js'
import { EQUIPMENT } from '../lib/exercises.js'
import { CantTodaySheet } from '../components/Accountability.jsx'

const STATUS_BADGE = {
  done: ['good', 'Done'],
  missed: ['bad', 'Missed'],
  excused: ['warn', 'Skipped'],
  today: ['accent', 'Today'],
}

export default function PlanPage({ onOpenSession }) {
  const { plan, records, environments, setEnvironments } = useStore()
  const [showPast, setShowPast] = useState(false)
  const [moving, setMoving] = useState(null)
  const [editEnv, setEditEnv] = useState(null)
  const today = todayISO()
  const sessions = scheduledSessions(plan, records, today)
  const envName = id => environments.find(e => e.id === id)?.name || id

  const weeks = []
  if (plan) {
    for (let w = startOfWeek(plan.startDate); w <= plan.endDate; w = addDays(w, 7)) {
      weeks.push({ start: w, sessions: sessions.filter(s => s.date >= w && s.date <= addDays(w, 6)) })
    }
    // Sessions moved outside the block's range still need a home.
    const outside = sessions.filter(s => !weeks.some(wk => s.date >= wk.start && s.date <= addDays(wk.start, 6)))
    if (outside.length) weeks.push({ start: startOfWeek(outside[0].date), sessions: outside })
  }
  const thisWeek = startOfWeek(today)
  const visible = weeks.filter(w => showPast || addDays(w.start, 6) >= thisWeek)
  const hiddenCount = weeks.length - visible.length

  const toggleEquipment = (env, id) => {
    const has = env.equipment.includes(id)
    setEnvironments(environments.map(e => (e.id === env.id
      ? { ...e, equipment: has ? e.equipment.filter(x => x !== id) : [...e.equipment, id] }
      : e)))
  }

  return (
    <div className="page">
      <div>
        <div className="eyebrow">{plan?.phase || 'Training block'}</div>
        <h1 className="page-title">{plan?.name || 'No plan'}</h1>
        {plan && (
          <div className="small muted">
            {parseISODate(plan.startDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – {parseISODate(plan.endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
            {plan.sample && <> · <span className="badge warn">Sample</span></>}
          </div>
        )}
      </div>
      {plan?.rationale && <div className="card small muted">{plan.rationale}</div>}

      {hiddenCount > 0 && <button className="btn ghost small" onClick={() => setShowPast(true)}>Show {hiddenCount} past week{hiddenCount > 1 ? 's' : ''}</button>}

      {visible.map(w => (
        <div key={w.start}>
          <div className="week-head">
            <span className="section-title">{w.start === thisWeek ? 'This week' : `Week of ${parseISODate(w.start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}</span>
            <span className="tiny faint">{w.sessions.filter(s => s.status === 'done').length}/{w.sessions.length} done</span>
          </div>
          <div className="list">
            {w.sessions.map(s => {
              const badge = STATUS_BADGE[s.status]
              return (
                <div key={s.id} className="list-row" style={{ padding: 0 }}>
                  <button className="row grow" style={{ padding: '13px 0 13px 14px', textAlign: 'left', gap: 12 }} onClick={() => onOpenSession(s)}>
                    <span className={`dot ${s.status}`} />
                    <div className="grow">
                      <div className="row" style={{ gap: 6 }}>
                        <span className="bold ellipsis">{s.name}</span>
                        {badge && <span className={`badge ${badge[0]}`}>{badge[1]}</span>}
                        {s.moved && <span className="badge">Moved</span>}
                      </div>
                      <div className="small muted">
                        {formatDay(s.date, today)} · {envName(s.environment)} · {s.targetDurationMin || Math.round(estimateSessionSec(s) / 60)} min
                      </div>
                    </div>
                  </button>
                  {(s.status === 'upcoming' || s.status === 'today') && (
                    <button className="btn small ghost" style={{ marginRight: 6 }} onClick={() => setMoving(s)}>Move</button>
                  )}
                </div>
              )
            })}
            {!w.sessions.length && <div className="empty small">Nothing planned</div>}
          </div>
        </div>
      ))}

      <div className="section-title">Locations & equipment</div>
      <div className="list">
        {environments.map(env => (
          <div key={env.id}>
            <button className="list-row" onClick={() => setEditEnv(editEnv === env.id ? null : env.id)}>
              <div className="grow">
                <div className="bold">{env.name}</div>
                <div className="small muted ellipsis">{env.equipment.length ? `${env.equipment.length} items` : 'Bodyweight only'}</div>
              </div>
              <span className="faint">{editEnv === env.id ? '▴' : '▾'}</span>
            </button>
            {editEnv === env.id && (
              <div className="chips" style={{ padding: '4px 14px 14px' }}>
                {EQUIPMENT.map(q => (
                  <button key={q.id} className={`chip${env.equipment.includes(q.id) ? ' on' : ''}`} onClick={() => toggleEquipment(env, q.id)}>
                    {q.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {moving && <CantTodaySheet session={moving} title={`Move ${moving.name}?`} allowSkip={moving.status === 'today'} onClose={() => setMoving(null)} />}
    </div>
  )
}
