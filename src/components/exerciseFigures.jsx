// Renders the pose drawings from src/lib/exerciseFigures.js.
import { FIGURES, FLOOR } from '../lib/exerciseFigures.js'

const line = pts => pts.map(p => p.join(',')).join(' ')

/** One shared 4:3 viewBox around every frame of an exercise, so the figure fills the tile at a constant scale. */
function viewBoxFor(frames) {
  const xs = [], ys = []
  const add = ([x, y], r = 4) => { xs.push(x - r, x + r); ys.push(y - r, y + r) }
  for (const f of frames) {
    add(f.head, 10); add(f.neck); add(f.hip)
    for (const p of [...(f.shoulders || []), ...(f.hips || [])]) add(p)
    for (const seg of [...(f.arms || []), ...(f.legs || [])]) seg.forEach(p => add(p))
    if (f.kb) add(f.kb.at, 16)
    if (f.halo) { xs.push(f.head[0] - 30, f.head[0] + 30) }
    if (f.wall) xs.push(f.wall - 8)
    if (!f.top) ys.push(FLOOR + 5)
  }
  const pad = 10
  let x = Math.min(...xs) - pad, y = Math.min(...ys) - pad
  let w = Math.max(...xs) + pad - x, h = Math.max(...ys) + pad - y
  if (w / h < 4 / 3) { const nw = h * 4 / 3; x -= (nw - w) / 2; w = nw }
  else {
    const nh = w * 3 / 4
    // Keep the floor at the bottom edge; centre top views.
    y -= frames[0].top ? (nh - h) / 2 : nh - h
    h = nh
  }
  return { x, y, w, h }
}

function Kettlebell({ at: [x, y], flip }) {
  const d = flip ? `M${x - 5},${y + 5} Q${x},${y + 15} ${x + 5},${y + 5}` : `M${x - 5},${y - 5} Q${x},${y - 15} ${x + 5},${y - 5}`
  return (
    <g>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="3" />
      <circle cx={x} cy={y} r="7" fill="var(--accent)" />
    </g>
  )
}

function Frame({ pose, vb }) {
  const { head, neck, hip, shoulders, hips, arms = [], legs = [] } = pose
  const front = !!shoulders
  // Side view: index 0 is the near limb (solid), 1 is far (faded). Front/top views: both solid.
  const limbs = (list, roots, near) => list.map((seg, i) => {
    if (!front && (i === 0) !== near) return null
    const root = front ? roots[i] : roots
    return <polyline key={i} points={line([root, ...seg])} opacity={front || near ? 1 : 0.38} />
  })
  return (
    <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="ex-figure" role="img" aria-label={pose.label}>
      {!pose.top && <line x1={vb.x} y1={FLOOR + 3.5} x2={vb.x + vb.w} y2={FLOOR + 3.5} stroke="var(--border-strong, var(--border))" strokeWidth="2" />}
      {pose.wall && <line x1={pose.wall - 4} y1="40" x2={pose.wall - 4} y2={FLOOR + 3.5} stroke="var(--border-strong, var(--border))" strokeWidth="3" />}
      {pose.kb && !pose.kbFront && <Kettlebell {...pose.kb} />}
      <g fill="none" stroke="var(--text)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        {!front && limbs(arms, neck, false)}
        {!front && limbs(legs, hip, false)}
        {front && <polyline points={line(shoulders)} />}
        {front && <polyline points={line(hips)} />}
        <polyline points={line([neck, hip])} />
        {limbs(legs, front ? hips : hip, true)}
        {limbs(arms, front ? shoulders : neck, true)}
      </g>
      <circle cx={head[0]} cy={head[1]} r="9" fill="var(--text)" />
      {pose.kb && pose.kbFront && <Kettlebell {...pose.kb} />}
      {pose.halo && <ellipse cx={head[0]} cy={head[1] - 2} rx="26" ry="10" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 4" />}
    </svg>
  )
}

export function ExerciseFigure({ exerciseId }) {
  const frames = FIGURES[exerciseId]
  if (!frames) return null
  const vb = viewBoxFor(frames)
  return (
    <div className="ex-media">
      {frames.map((f, i) => (
        <figure key={i} className="ex-frame drawn">
          <Frame pose={f} vb={vb} />
          <figcaption>{f.label}</figcaption>
        </figure>
      ))}
    </div>
  )
}
