import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { isConfigured, testConnection } from '../lib/github.js'
import { cues, say, unlockAudio } from '../lib/audio.js'
import { toast } from '../components/ui.jsx'

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone

export default function SettingsPage() {
  const store = useStore()
  const { github, settings, syncStatus, syncQueue, allRecords: records, plan, environments } = store
  const [form, setForm] = useState(github)
  const [busy, setBusy] = useState(null)
  const [confirmWipe, setConfirmWipe] = useState(false)

  const run = async (label, fn) => {
    setBusy(label)
    try {
      await fn()
    } catch (e) {
      toast(e.message)
    } finally {
      setBusy(null)
    }
  }

  const connect = () => run('connect', async () => {
    const cfg = { ...form, owner: form.owner.trim(), repo: form.repo.trim(), token: form.token.trim(), branch: form.branch.trim() || 'main' }
    const info = await testConnection(cfg)
    if (!info.private) toast('Warning: that repo is PUBLIC — make it private, it holds your training data.')
    store.setGithub(cfg)
    await store.bootstrapRepo()
    toast('Connected. Your data now syncs to GitHub.')
  })

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), plan, environments, records }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `sarge-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const connected = isConfigured(github)

  return (
    <div className="page">
      <div>
        <div className="eyebrow">Sarge</div>
        <h1 className="page-title">Settings</h1>
      </div>

      {!standalone() && (
        <div className="callout small">
          <b>Install it:</b> in Safari tap <b>Share</b> → <b>Add to Home Screen</b>. It then opens full-screen like a normal app and keeps the screen awake during workouts.
        </div>
      )}

      <div className="section-title">GitHub sync</div>
      <div className="card stack">
        <div className="small muted">
          Your logs sync to a <b>private</b> repo (e.g. <code>trainer-data</code>). The coach reads it from there. Use a fine-grained token with access to that one repo and <b>Contents: Read and write</b>.
        </div>
        <div className="row">
          <input placeholder="Username" autoCapitalize="none" autoCorrect="off" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} />
          <input placeholder="Repo" autoCapitalize="none" autoCorrect="off" value={form.repo} onChange={e => setForm({ ...form, repo: e.target.value })} />
        </div>
        <input type="password" placeholder="Fine-grained token (github_pat_…)" autoComplete="off" value={form.token} onChange={e => setForm({ ...form, token: e.target.value })} />
        <button className="btn primary" disabled={!form.owner || !form.repo || !form.token || !!busy} onClick={connect}>
          {busy === 'connect' ? 'Connecting…' : connected ? 'Save & re-check' : 'Connect'}
        </button>
        {connected && (
          <>
            <div className="divider" />
            <div className="kv small"><span className="muted">Last sync</span><span>{syncStatus.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : 'never'}</span></div>
            <div className="kv small"><span className="muted">Waiting to upload</span><span>{syncQueue.length} file{syncQueue.length === 1 ? '' : 's'}</span></div>
            {syncStatus.lastError && <div className="callout bad small">{syncStatus.lastError}</div>}
            <div className="row">
              <button className="btn grow" disabled={!!busy || syncStatus.syncing} onClick={() => run('sync', store.syncNow)}>
                {syncStatus.syncing ? 'Syncing…' : 'Sync now'}
              </button>
              <button className="btn grow" disabled={!!busy} onClick={() => run('restore', async () => {
                const n = await store.restoreFromRepo()
                toast(`Restored ${n} records from GitHub`)
              })}>
                {busy === 'restore' ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="section-title">Coach</div>
      <div className="card stack tight">
        <div className="small muted">Link to your claude.ai "Personal Trainer" project (opens from the Coach tab).</div>
        <input placeholder="https://claude.ai/project/…" autoCapitalize="none" value={settings.claudeProjectUrl}
          onChange={e => store.updateSettings({ claudeProjectUrl: e.target.value.trim() })} />
      </div>

      <div className="section-title">Workout cues</div>
      <div className="card stack">
        <label className="row between">
          <span>Sounds <span className="small faint">(rest countdown, overtime nag)</span></span>
          <input type="checkbox" style={{ width: 22, height: 22 }} checked={settings.sound} onChange={e => store.updateSettings({ sound: e.target.checked })} />
        </label>
        <label className="row between">
          <span>Voice <span className="small faint">(announces the next exercise)</span></span>
          <input type="checkbox" style={{ width: 22, height: 22 }} checked={settings.voice} onChange={e => store.updateSettings({ voice: e.target.checked })} />
        </label>
        <button className="btn small" onClick={() => { unlockAudio(); cues.go(); say('Rest over. Back to work.') }}>Test sound</button>
        <div className="tiny faint">iPhones don't let web apps vibrate, and sounds only play while Sarge is on screen. Turn the volume up.</div>
      </div>

      <div className="section-title">Data</div>
      <div className="card stack tight">
        <div className="small muted">{records.length} records on this phone · plan: {plan?.name}</div>
        <button className="btn" onClick={exportData}>Export everything (JSON)</button>
        {confirmWipe
          ? <button className="btn danger" onClick={() => { store.resetLocal(); setConfirmWipe(false); toast('Local data wiped') }}>
              Really wipe this phone? {connected ? 'GitHub copy stays.' : 'Nothing is backed up!'}
            </button>
          : <button className="btn ghost" onClick={() => setConfirmWipe(true)}>Wipe local data…</button>}
      </div>

      <div className="tiny faint center">Sarge v0.1 · phase 1</div>
    </div>
  )
}
