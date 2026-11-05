import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { accountability, checkinFor, fallbackOrders, scheduledSessions, timeline, unexplainedMisses } from '../lib/schedule.js'
import { excuseLabel } from '../lib/excuses.js'
import { addDays, formatDay, formatDuration, formatMinutes, parseISODate, todayISO } from '../lib/dates.js'
import { blockTitle, estimateSessionSec } from '../lib/engine.js'
import { CantTodaySheet, CheckInCard, ExplainYourself } from '../components/Accountability.jsx'

export default function TodayPage({ onOpenSession, onResume }) {
  const { plan, records, coachToday, activeWorkout, environments } = useStore()
  const [cantFor, setCantFor] = useState(null)
  const today = todayISO()
  const sessions = scheduledSessions(plan, records, today)
  const events = timeline(sessions, records, plan)
  const todays = events.filter(s => s.date === today)
  const stats = accountability(events, plan, today)
  const checkin = checkinFor(records, today)
  const missed = unexplainedMisses(records, today)
  const upcoming = sessions.filter(s => s.date > today && s.date <= addDays(today, 3))
  const envName = id => environments.find(e => e.id === id)?.name || id
  const orders = coachToday?.text?.trim() || fallbackOrders({ todaySessions: todays, sessions: events, today, checkedIn: !!checkin })

  return (
    <div className="page">
      <div>
        <div className="eyebrow">{parseISODate(today).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1 className="page-title">Today</h1>
      </div>

      <div className="stack tight">
        <div className="orders">{orders}</div>
        <div className="tiny faint" style={{ paddingLeft: 17 }}>{coachToday ? '— your coach' : '— Sarge (coach not connected yet)'}</div>
      </div>

      {activeWorkout && (
        <button className="card tap accent" onClick={onResume}>
          <div className="eyebrow" style={{ color: 'var(--accent)' }}>In progress</div>
          <div className="row between">
            <div className="bold" style={{ fontSize: 20 }}>{activeWorkout.name}</div>
            <span className="btn small primary">Resume</span>
          </div>
        </button>
      )}

      {todays.map(s => (
        <SessionCard
          key={s.id}
          session={s}
          envName={envName(s.environment)}
          onOpen={() => onOpenSession(s)}
          onCant={() => setCantFor(s)}
          hideActions={!!activeWorkout}
        />
      ))}
      {!todays.length && (
        <div className="card">
          <div className="bold">Rest day</div>
          <div className="small muted">Nothing scheduled. Recovery is part of the plan — walk, stretch, sleep.</div>
        </div>
      )}

      <div className="stats">
        <div className="stat"><div className="v">{stats.streak}</div><div className="l">Streak</div></div>
        <div className="stat"><div className="v">{stats.doneThisWeek}<span className="faint" style={{ fontSize: 16 }}>/{stats.plannedThisWeek}</span></div><div className="l">This week</div></div>
        <div className="stat">
          <div className="v" style={{ color: stats.missedInBlock ? 'var(--bad)' : undefined }}>{stats.missedInBlock}</div>
          <div className="l">Missed (block)</div>
        </div>
      </div>

      <CheckInCard key={checkin?.id || 'new'} existing={checkin} />

      {upcoming.length > 0 && (
        <>
          <div className="section-title">Coming up</div>
          <div className="list">
            {upcoming.map(s => (
              <button key={s.id} className="list-row" onClick={() => onOpenSession(s)}>
                <span className="dot" />
                <div className="grow">
                  <div className="bold ellipsis">{s.name}</div>
                  <div className="small muted">{formatDay(s.date, today)}{s.time ? ` · ${s.time}` : ''} · {envName(s.environment)}</div>
                </div>
                <span className="small faint tnum">{s.targetDurationMin || Math.round(estimateSessionSec(s) / 60)} min</span>
              </button>
            ))}
          </div>
        </>
      )}

      {cantFor && <CantTodaySheet session={cantFor} onClose={() => setCantFor(null)} />}
      {!activeWorkout && !cantFor && <ExplainYourself missed={missed} />}
    </div>
  )
}

function SessionCard({ session: s, envName, onOpen, onCant, hideActions }) {
  if (s.status === 'done') {
    const w = s.workout
    const delta = w.actualSec - w.plannedSec
    return (
      <div className="card">
        <div className="row between">
          <div className="bold" style={{ fontSize: 19 }}>{s.name}</div>
          <span className="badge good">Done</span>
        </div>
        <div className="small muted tnum" style={{ marginTop: 4 }}>
          {formatDuration(w.actualSec)} vs {formatMinutes(w.plannedSec)} planned
          {' · '}
          <span style={{ color: delta > 120 ? 'var(--warn)' : 'var(--good)' }}>
            {delta > 0 ? `+${formatDuration(delta)}` : `−${formatDuration(-delta)}`}
          </span>
          {w.sessionRpe ? ` · RPE ${w.sessionRpe}` : ''}
        </div>
      </div>
    )
  }
  if (s.status === 'excused') {
    return (
      <div className="card">
        <div className="row between">
          <div className="bold" style={{ fontSize: 19 }}>{s.name}</div>
          <span className="badge warn">Skipped</span>
        </div>
        <div className="small muted">Excuse logged: {excuseLabel(s.excuse)}</div>
      </div>
    )
  }
  const est = estimateSessionSec(s)
  return (
    <div className="stack tight">
      <button className="card tap accent" onClick={onOpen}>
        <div className="row between">
          <span className="eyebrow" style={{ color: 'var(--accent)' }}>Today's session{s.time ? ` · ${s.time}` : ''}</span>
          {s.moved && <span className="badge warn">Moved</span>}
        </div>
        <div style={{ fontSize: 26, fontWeight: 850, letterSpacing: -0.4, marginTop: 2 }}>{s.name}</div>
        <div className="muted">{s.focus}</div>
        <div className="row wrap" style={{ marginTop: 10, gap: 6 }}>
          <span className="badge accent tnum">{s.targetDurationMin || Math.round(est / 60)} min</span>
          <span className="badge">{envName}</span>
          <span className="badge">{s.blocks.length} blocks</span>
        </div>
        <div className="small faint" style={{ marginTop: 10 }}>
          {s.blocks.map(b => blockTitle(b)).join(' · ')}
        </div>
        <div className="row between" style={{ marginTop: 14 }}>
          <span className="small muted">Review & adjust</span>
          <span className="btn small primary">Open →</span>
        </div>
      </button>
      {!hideActions && <button className="btn ghost small" onClick={onCant}>Can't today?</button>}
    </div>
  )
}
