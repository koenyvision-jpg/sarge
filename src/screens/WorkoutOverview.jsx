import { useRef, useState } from 'react'
import { blockTitle, mainRest, movableBlockIds, reorderBlocks, setBlockRest, setKeepEdits } from '../lib/engine.js'
import { blockExercises } from '../lib/adjust.js'
import { getExercise } from '../lib/exercises.js'
import { formatDuration } from '../lib/dates.js'
import { Stepper } from '../components/ui.jsx'

const REST_STEP = { restSec: [15, 15, 600], restBetweenSec: [5, 5, 120] } // step, min, max

/**
 * The whole workout as blocks, mid-workout. Rests can be changed and blocks that haven't
 * started can be dragged into a new order. Changes apply to this session; "keep" asks the coach
 * to carry them into the plan.
 */
export default function WorkoutOverview({ w, update }) {
  const movable = movableBlockIds(w)
  const [drag, setDrag] = useState(null)
  const rows = useRef({})
  const current = w.steps[w.index]

  const withSteps = new Set(w.steps.map(s => s.blockId))
  const blocks = w.session.blocks.filter(b => withSteps.has(b.id))
  const fixed = blocks.filter(b => !movable.includes(b.id))
  const live = drag ? [...drag.order.filter(id => movable.includes(id)), ...movable.filter(id => !drag.order.includes(id))] : movable
  const ordered = [...fixed, ...live.map(id => blocks.find(b => b.id === id))]

  const status = b => {
    if (movable.includes(b.id)) return current?.blockId === b.id ? 'setup' : 'next'
    if (current?.blockId === b.id) return 'now'
    return 'done'
  }

  // Drag by the handle. Rows are measured once at the start; the dragged row follows the finger
  // and the others reorder around it.
  const onDown = (id, e) => {
    if (movable.length < 2) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const rects = {}
    for (const m of movable) {
      const r = rows.current[m]?.getBoundingClientRect()
      if (r) rects[m] = { top: r.top, height: r.height }
    }
    setDrag({ id, base: movable, order: movable, startY: e.clientY, y: e.clientY, rects })
  }
  const onMove = e => {
    if (!drag) return
    const { rects, id, base, startY } = drag
    const center = rects[id].top + (e.clientY - startY) + rects[id].height / 2
    const others = base.filter(x => x !== id)
    const at = others.filter(o => rects[o].top + rects[o].height / 2 < center).length
    const order = [...others]
    order.splice(at, 0, id)
    setDrag({ ...drag, y: e.clientY, order })
  }
  const onUp = () => {
    if (!drag) return
    if (drag.order.join() !== drag.base.join()) update(reorderBlocks(w, drag.order))
    setDrag(null)
  }
  const offset = id => {
    if (!drag || drag.id !== id) return 0
    const { rects, base, order, startY, y } = drag
    const top0 = Math.min(...base.map(m => rects[m].top))
    const natural = top0 + order.slice(0, order.indexOf(id)).reduce((sum, m) => sum + rects[m].height, 0)
    return rects[id].top + (y - startY) - natural
  }

  return (
    <div className="stack">
      <div>
        <h2>Workout</h2>
        <div className="small muted">Changes apply to this session.{movable.length > 1 ? ' Drag ≡ to reorder blocks that haven\'t started.' : ''}</div>
      </div>

      <div className="list ov-list">
        {ordered.map((b, i) => {
          const st = status(b)
          const rest = mainRest(b)
          const canDrag = movable.includes(b.id) && movable.length > 1
          const dy = offset(b.id)
          const names = [...new Set(blockExercises(b).map(e => getExercise(e.exerciseId).name))].join(' · ')
          const [step, min, max] = REST_STEP[rest?.field] || []
          return (
            <div key={b.id} ref={el => { rows.current[b.id] = el }}
              className={`list-row ov-row${st === 'done' ? ' done' : ''}${drag?.id === b.id ? ' dragging' : ''}`}
              style={dy ? { transform: `translateY(${dy}px)` } : undefined}>
              {canDrag ? (
                <span className="drag-handle" aria-label={`Drag to move ${blockTitle(b)}`} role="button"
                  onPointerDown={e => onDown(b.id, e)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    <path d="M5 8h14M5 12h14M5 16h14" />
                  </svg>
                </span>
              ) : (
                <span className="ov-num tnum">{st === 'done' ? '✓' : i + 1}</span>
              )}
              <div className="grow stack tight" style={{ minWidth: 0, gap: 4 }}>
                <div className="row" style={{ gap: 6 }}>
                  <span className="bold ellipsis">{blockTitle(b)}</span>
                  {st === 'now' && <span className="badge accent">Now</span>}
                  {st === 'setup' && <span className="badge accent">Up next</span>}
                </div>
                {names && names !== blockTitle(b) && <div className="tiny faint ellipsis">{names}</div>}
                {rest && (st === 'done' ? (
                  <div className="tiny faint tnum">Rest {formatDuration(rest.sec)}</div>
                ) : (
                  <div className="row between">
                    <span className="small muted">{rest.field === 'restBetweenSec' ? 'Rest between' : b.type === 'superset' || b.type === 'circuit' ? 'Rest after round' : 'Rest'}</span>
                    <Stepper label={`rest for ${blockTitle(b)}`} value={rest.sec} step={step} min={min} max={max}
                      format={formatDuration} onChange={sec => update(setBlockRest(w, b.id, sec))} />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <label className="row check-row" style={{ gap: 12 }}>
        <input type="checkbox" checked={!!w.keepEdits} onChange={e => update(setKeepEdits(w, e.target.checked))} />
        <span className="grow">
          <span className="small bold">Keep these changes for future sessions</span>
          <span className="tiny faint" style={{ display: 'block' }}>Sarge updates the plan after reading your log.</span>
        </span>
      </label>
    </div>
  )
}
