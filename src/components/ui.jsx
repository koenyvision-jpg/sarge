/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react'

export function Sheet({ open, onClose, children, dismissable = true }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])
  if (!open) return null
  return (
    <div className="backdrop" onClick={dismissable ? onClose : undefined}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="grabber" />
        {children}
      </div>
    </div>
  )
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, format = v => v, big = false, label }) {
  const clamp = v => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  return (
    <div className={`stepper${big ? ' big' : ''}`} aria-label={label}>
      <button type="button" aria-label={`Decrease ${label || ''}`} onClick={() => onChange(clamp((value || 0) - step))}>−</button>
      <div className="val">{format(value)}</div>
      <button type="button" aria-label={`Increase ${label || ''}`} onClick={() => onChange(clamp((value || 0) + step))}>+</button>
    </div>
  )
}

export function Scale({ value, onChange, label }) {
  return (
    <div className="scale" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" role="radio" aria-checked={value === n} className={value === n ? 'on' : ''} onClick={() => onChange(n)}>
          {n}
        </button>
      ))}
    </div>
  )
}

let toastSetter = null
export function toast(msg) { toastSetter?.(msg) }
export function ToastHost() {
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    toastSetter = setMsg
    return () => { toastSetter = null }
  }, [])
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2400)
    return () => clearTimeout(t)
  }, [msg])
  return msg ? <div className="toast" role="status">{msg}</div> : null
}

const ICONS = {
  today: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />,
  coach: <path d="M4 5h16v11H9l-5 4zM8 9h8M8 12h5" />,
  plan: <path d="M4 6h16v14H4zM4 10h16M9 3v4M15 3v4M8 14h3M8 17h6" />,
  progress: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  settings: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />,
}

export function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

const TABS = [
  ['today', 'Today'],
  ['coach', 'Coach'],
  ['plan', 'Plan'],
  ['progress', 'Progress'],
  ['settings', 'Settings'],
]

export function BottomNav({ tab, onChange, pips = {} }) {
  return (
    <nav className="nav">
      {TABS.map(([id, label]) => (
        <button key={id} className={tab === id ? 'on' : ''} onClick={() => onChange(id)} aria-current={tab === id ? 'page' : undefined}>
          <Icon name={id} />
          {label}
          {pips[id] && <span className="pip" />}
        </button>
      ))}
    </nav>
  )
}
