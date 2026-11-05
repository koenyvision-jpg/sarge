import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { recordPath } from '../lib/schedule.js'
import { formatDay, todayISO, uid } from '../lib/dates.js'
import { EXCUSES } from '../lib/excuses.js'
import { toast } from '../components/ui.jsx'
import { isConfigured } from '../lib/github.js'

export default function CoachPage({ onGoSettings }) {
  const { records, coachToday, settings, syncQueue, github, addRecord, plan } = useStore()
  const [text, setText] = useState('')
  const today = todayISO()
  const connected = isConfigured(github)
  const queued = new Set(syncQueue.map(q => q.path))
  const inbox = records
    .filter(r => r.type === 'message' || r.type === 'excuse')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 30)
  const sessionName = id => plan?.sessions?.find(s => s.id === id)?.name || 'session'

  const send = () => {
    const t = text.trim()
    if (!t) return
    addRecord({ type: 'message', id: uid('m'), text: t, date: today, createdAt: Date.now() }, 'Sarge: message for coach')
    setText('')
    toast(connected ? 'Sent to the coach\'s inbox' : 'Saved — connect GitHub so the coach can read it')
  }
  const projectUrl = settings.claudeProjectUrl || 'https://claude.ai/projects'

  return (
    <div className="page">
      <div>
        <div className="eyebrow">Your trainer</div>
        <h1 className="page-title">Coach</h1>
      </div>

      <a className="card tap accent" href={projectUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="row between">
          <div>
            <div className="bold" style={{ fontSize: 19 }}>Talk to Sarge</div>
            <div className="small muted">Live conversation in your claude.ai Personal Trainer project — goals, injuries, travel, the next block.</div>
          </div>
          <span style={{ fontSize: 24 }}>↗</span>
        </div>
        {!settings.claudeProjectUrl && <div className="tiny faint" style={{ marginTop: 8 }}>Add your project link in Settings to jump straight in.</div>}
      </a>

      {coachToday?.text && (
        <div className="card stack tight">
          <div className="eyebrow">Today's orders</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{coachToday.text}</div>
        </div>
      )}

      <div className="card stack tight">
        <div className="bold">Message the coach</div>
        <div className="small muted">Quick note — the coach reads its inbox on its next check-in.</div>
        <textarea rows={3} placeholder="e.g. Left knee hurts going downstairs. In Spain next week, hotel gym only." value={text} onChange={e => setText(e.target.value)} />
        <button className="btn primary" onClick={send} disabled={!text.trim()}>Send</button>
      </div>

      {!connected && (
        <div className="callout small row between">
          <span>Not connected to GitHub yet — the coach can't see anything you log.</span>
          <button className="btn small primary" onClick={onGoSettings}>Set up</button>
        </div>
      )}

      <div className="section-title">Inbox — what you've told the coach</div>
      <div className="list">
        {inbox.map(r => (
          <div key={r.id} className="list-row" style={{ alignItems: 'flex-start' }}>
            <span className={`badge ${r.type === 'excuse' ? 'warn' : ''}`}>{r.type === 'excuse' ? 'Excuse' : 'Note'}</span>
            <div className="grow">
              <div className="small">
                {r.type === 'excuse'
                  ? <><b>{r.sessionName || sessionName(r.sessionId)}</b> ({formatDay(r.sessionDate, today)}): {EXCUSES.find(e => e[0] === r.category)?.[1]}{r.text ? ` — ${r.text}` : ''}</>
                  : r.text}
              </div>
              <div className="tiny faint">{formatDay(r.date, today)} · {queued.has(recordPath(r)) ? 'waiting to sync' : connected ? 'delivered' : 'on this phone only'}</div>
            </div>
          </div>
        ))}
        {!inbox.length && <div className="empty small">Nothing yet. Excuses you log land here too.</div>}
      </div>

      <div className="card tight small faint">
        Coach replies, debriefs and weekly reviews will appear here once the coach routine is connected (next build phase).
      </div>
    </div>
  )
}
