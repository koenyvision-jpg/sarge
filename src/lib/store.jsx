/* eslint-disable react-refresh/only-export-components */
// App state: everything lives in IndexedDB on the phone and is mirrored to the
// private GitHub repo. The app only ever *adds* files there (logs/, inbox/) plus
// environments.json; plan/current.json and coach/ are written by Claude.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { idbGet, idbSet, idbClear, requestPersistence } from './idb.js'
import { getFile, listDir, writeFile, isConfigured } from './github.js'
import { buildSamplePlan, DEFAULT_ENVIRONMENTS, sampleIsStale } from './samplePlan.js'
import { recordPath } from './schedule.js'
import { todayISO } from './dates.js'
import { configureCues } from './audio.js'
import SCHEMA_MD from '../../contract/SCHEMA.md?raw'
import { EQUIPMENT, EXERCISES } from './exercises.js'

const PERSISTED = [
  'plan', 'planSha', 'records', 'environments', 'activeEnvId', 'settings',
  'github', 'activeWorkout', 'syncQueue', 'syncStatus', 'coachToday', 'contractVersion',
]

// Bump when contract/SCHEMA.md or the exercise library changes, so the repo copy is refreshed.
const CONTRACT_VERSION = 3

const DEFAULT_SETTINGS = { sound: true, voice: false, claudeProjectUrl: '' }

const INITIAL = {
  loaded: false,
  plan: null,
  planSha: null,
  records: [],
  environments: DEFAULT_ENVIRONMENTS,
  activeEnvId: 'gym',
  settings: DEFAULT_SETTINGS,
  github: { owner: '', repo: 'trainer-data', branch: 'main', token: '' },
  activeWorkout: null,
  syncQueue: [],
  syncStatus: { lastSyncAt: null, lastError: null, syncing: false },
  coachToday: null,
}

const SYNC_DEBOUNCE_MS = 2500
const StoreContext = createContext(null)

const json = v => JSON.stringify(v, null, 2) + '\n'

export function StoreProvider({ children }) {
  const [state, setState] = useState(INITIAL)
  const ref = useRef(state)
  const persisted = useRef({})
  const syncing = useRef(false)
  const timer = useRef(null)

  // `ref` is the source of truth so async code (sync, restore) always sees the latest state.
  const set = useCallback(patch => {
    const prev = ref.current
    const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }
    ref.current = next
    setState(next)
  }, [])

  // Load from IndexedDB once.
  useEffect(() => {
    let cancelled = false
    requestPersistence()
    Promise.all(PERSISTED.map(k => idbGet(k).catch(() => undefined))).then(values => {
      if (cancelled) return
      const loaded = {}
      PERSISTED.forEach((k, i) => { if (values[i] !== undefined) loaded[k] = values[i] })
      persisted.current = { ...loaded }
      set(prev => ({
        ...loaded,
        settings: { ...DEFAULT_SETTINGS, ...(loaded.settings || {}) },
        github: { ...prev.github, ...(loaded.github || {}) },
        syncStatus: { ...prev.syncStatus, ...(loaded.syncStatus || {}), syncing: false },
        plan: !loaded.plan || sampleIsStale(loaded.plan, todayISO()) ? buildSamplePlan(todayISO()) : loaded.plan,
        loaded: true,
      }))
    })
    return () => { cancelled = true }
  }, [set])

  // Persist changed keys.
  useEffect(() => {
    if (!state.loaded) return
    for (const k of PERSISTED) {
      if (state[k] !== persisted.current[k]) {
        persisted.current[k] = state[k]
        idbSet(k, state[k]).catch(err => console.error('save failed', k, err))
      }
    }
  }, [state])

  useEffect(() => { configureCues(state.settings) }, [state.settings])

  const setSyncStatus = useCallback(patch => set(prev => ({ syncStatus: { ...prev.syncStatus, ...patch } })), [set])

  const syncNow = useCallback(async ({ pull = true } = {}) => {
    const cfg = ref.current.github
    if (!isConfigured(cfg) || syncing.current) return
    if (!navigator.onLine) return setSyncStatus({ lastError: 'Offline — will sync when back online.' })
    syncing.current = true
    setSyncStatus({ syncing: true })
    try {
      // 1. Push queued files, oldest first.
      for (const item of [...ref.current.syncQueue]) {
        await writeFile(cfg, item.path, item.text, item.message)
        set(prev => ({ syncQueue: prev.syncQueue.filter(q => !(q.path === item.path && q.text === item.text)) }))
      }
      if (pull) {
        // 2. Keep the coach's copy of the data contract and exercise library current.
        if (ref.current.contractVersion !== CONTRACT_VERSION) {
          await writeFile(cfg, 'SCHEMA.md', SCHEMA_MD, 'Sarge: update data contract')
          await writeFile(cfg, 'exercises.json', json({ equipment: EQUIPMENT, exercises: EXERCISES }), 'Sarge: update exercise library')
          set({ contractVersion: CONTRACT_VERSION })
        }
        // 3. Pull the coach's plan and today's orders.
        const plan = await getFile(cfg, 'plan/current.json')
        const remote = plan ? JSON.parse(plan.text) : null
        if (remote && !Array.isArray(remote.sessions)) throw new Error('plan/current.json has no sessions array')
        if (remote && sampleIsStale(remote, todayISO()) && ref.current.plan?.sample) {
          // An expired starter block in the repo: replace it with the fresh local one.
          const sha = await writeFile(cfg, 'plan/current.json', json(ref.current.plan), 'Sarge: refresh starter plan')
          set({ planSha: sha })
        } else if (remote && plan.sha !== ref.current.planSha) {
          set({ plan: remote, planSha: plan.sha })
        } else if (!plan && ref.current.plan) {
          // Seed the repo so the coach can see the format and the current block.
          const sha = await writeFile(cfg, 'plan/current.json', json(ref.current.plan), 'Sarge: seed starter plan')
          set({ planSha: sha })
        }
        const today = await getFile(cfg, 'coach/today.md')
        set({ coachToday: today ? { text: today.text, sha: today.sha } : null })
      }
      setSyncStatus({ lastSyncAt: Date.now(), lastError: null })
    } catch (err) {
      setSyncStatus({ lastError: err.message })
    } finally {
      syncing.current = false
      setSyncStatus({ syncing: false })
    }
  }, [set, setSyncStatus])

  const scheduleSync = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => syncNow({ pull: false }), SYNC_DEBOUNCE_MS)
  }, [syncNow])

  const enqueue = useCallback((path, text, message) => {
    set(prev => ({ syncQueue: [...prev.syncQueue.filter(q => q.path !== path), { path, text, message }] }))
    scheduleSync()
  }, [set, scheduleSync])

  // Sync on launch, when the app comes back to the foreground, and when back online.
  useEffect(() => {
    if (!state.loaded) return
    syncNow()
    const onVisible = () => { if (document.visibilityState === 'visible') syncNow() }
    const onOnline = () => syncNow()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [state.loaded, syncNow])

  const actions = useMemo(() => ({
    set,
    syncNow,

    addRecord(rec, message) {
      set(prev => ({ records: [...prev.records.filter(r => r.id !== rec.id), rec] }))
      enqueue(recordPath(rec), json(rec), message || `Sarge: ${rec.type} ${rec.date}`)
    },

    setEnvironments(environments) {
      set({ environments })
      enqueue('environments.json', json(environments), 'Sarge: update environments')
    },

    setActiveEnv(activeEnvId) {
      set({ activeEnvId })
    },

    updateSettings(patch) {
      set(prev => ({ settings: { ...prev.settings, ...patch } }))
    },

    setGithub(github) {
      set(prev => ({ github: { ...prev.github, ...github } }))
    },

    /** First-time repo setup: environments + contract docs, without touching the coach's files. */
    async bootstrapRepo() {
      const cfg = ref.current.github
      const existing = new Set((await listDir(cfg, '')).map(f => f.path))
      set({ contractVersion: null }) // syncNow (below) writes SCHEMA.md + exercises.json
      if (!existing.has('environments.json')) {
        await writeFile(cfg, 'environments.json', json(ref.current.environments), 'Sarge: add environments')
      }
      await syncNow()
    },

    /** Rebuild local data from the repo (new phone, cleared Safari data, …). */
    async restoreFromRepo() {
      const cfg = ref.current.github
      const files = [...await listDir(cfg, 'logs'), ...await listDir(cfg, 'inbox')]
        .filter(f => f.type === 'file' && f.name.endsWith('.json'))
      const records = []
      for (const f of files) {
        const file = await getFile(cfg, f.path)
        try {
          const rec = JSON.parse(file.text)
          if (rec?.type && rec?.id) records.push(rec)
        } catch { /* skip malformed */ }
      }
      const envs = await getFile(cfg, 'environments.json')
      set(prev => {
        const byId = new Map(prev.records.map(r => [r.id, r]))
        for (const r of records) byId.set(r.id, r)
        return {
          records: [...byId.values()],
          ...(envs ? { environments: JSON.parse(envs.text) } : {}),
          planSha: null, // force re-pull of the plan
        }
      })
      await syncNow()
      return records.length
    },

    async resetLocal() {
      await idbClear()
      persisted.current = {}
      set({ ...INITIAL, plan: buildSamplePlan(todayISO()), loaded: true })
    },
  }), [set, syncNow, enqueue])

  const value = useMemo(() => ({ ...state, ...actions }), [state, actions])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  return useContext(StoreContext)
}

export function useActiveEnvironment() {
  const { environments, activeEnvId } = useStore()
  return environments.find(e => e.id === activeEnvId) || environments[0]
}
