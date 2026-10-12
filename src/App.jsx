import { useEffect, useState } from 'react'
import { useStore } from './lib/store.jsx'
import { startWorkout } from './lib/engine.js'
import { scheduledSessions, unexplainedMisses } from './lib/schedule.js'
import { todayISO } from './lib/dates.js'
import { BottomNav, ToastHost } from './components/ui.jsx'
import TodayPage from './pages/TodayPage.jsx'
import CoachPage from './pages/CoachPage.jsx'
import PlanPage from './pages/PlanPage.jsx'
import ProgressPage from './pages/ProgressPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import SessionOverview from './screens/SessionOverview.jsx'
import WorkoutFlow from './screens/WorkoutFlow.jsx'

export default function App() {
  const { loaded, activeWorkout, set, plan, records } = useStore()
  const [tab, setTab] = useState('today')
  const [overview, setOverview] = useState(null)
  const [flowOpen, setFlowOpen] = useState(true)

  useEffect(() => { window.scrollTo(0, 0) }, [tab])

  if (!loaded) return null

  const begin = (session, adjustments, envId) => {
    set({ activeWorkout: startWorkout({ session, plannedSession: overview, adjustments, environment: envId, now: Date.now() }) })
    setOverview(null)
    setFlowOpen(true)
  }
  const openSession = s => {
    if (activeWorkout) return setFlowOpen(true)
    setOverview(s)
  }

  if (activeWorkout && flowOpen) {
    return <><WorkoutFlow onMinimize={() => setFlowOpen(false)} onDone={() => { setTab('today'); setFlowOpen(true) }} /><ToastHost /></>
  }

  const today = todayISO()
  const pips = { today: unexplainedMisses(scheduledSessions(plan, records, today), today).length > 0 }

  return (
    <>
      {tab === 'today' && <TodayPage onOpenSession={openSession} onResume={() => setFlowOpen(true)} />}
      {tab === 'coach' && <CoachPage onGoSettings={() => setTab('settings')} />}
      {tab === 'plan' && <PlanPage onOpenSession={openSession} />}
      {tab === 'progress' && <ProgressPage />}
      {tab === 'settings' && <SettingsPage />}
      <BottomNav tab={tab} onChange={setTab} pips={pips} />
      {overview && <SessionOverview session={overview} onClose={() => setOverview(null)} onStart={begin} />}
      <ToastHost />
    </>
  )
}
