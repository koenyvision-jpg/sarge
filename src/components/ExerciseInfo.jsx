import { useState } from 'react'
import { createPortal } from 'react-dom'
import { equipmentSummary, getExercise } from '../lib/exercises.js'
import { exerciseInfo, photoUrls, videoSearchUrl } from '../lib/exerciseInfo.js'
import { ExerciseFigure } from './exerciseFigures.jsx'
import { Sheet } from './ui.jsx'

/** Small ⓘ button next to an exercise name. Opens the how-to sheet. */
export function ExerciseInfoButton({ exerciseId, size = 'sm' }) {
  const [open, setOpen] = useState(false)
  const stop = e => e.stopPropagation()
  return (
    // The sheet is portalled to <body>, but React still bubbles its events through this
    // span, so stop them here: a tap inside the sheet must not reach a row's onClick.
    <span className="ex-info-wrap" onClick={stop} onPointerDown={stop}>
      <button type="button" className={`ex-info-btn ${size}`} aria-label={`How to do ${getExercise(exerciseId).name}`}
        onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="7.6" r="1.25" fill="currentColor" />
        </svg>
      </button>
      {open && createPortal(<ExerciseInfoSheet exerciseId={exerciseId} onClose={() => setOpen(false)} />, document.body)}
    </span>
  )
}

/** Exercise name with the ⓘ button right after it. */
export function ExerciseName({ exerciseId, className = 'bold', suffix = '' }) {
  return (
    <span className="ex-name">
      <span className={className}>{getExercise(exerciseId).name}{suffix}</span>
      <ExerciseInfoButton exerciseId={exerciseId} />
    </span>
  )
}

function ExerciseInfoSheet({ exerciseId, onClose }) {
  const ex = getExercise(exerciseId)
  const info = exerciseInfo(exerciseId)
  const photos = photoUrls(info)
  const tags = [ex.muscles?.length ? ex.muscles.join(', ') : null, ex.equipment ? equipmentSummary(ex) : null].filter(Boolean)
  return (
    <Sheet open onClose={onClose}>
      <h2>{ex.name}</h2>
      {tags.length > 0 && <div className="small muted" style={{ marginBottom: 12 }}>{tags.join(' · ')}</div>}

      {photos.length > 0 && (
        <div className="ex-media">
          {photos.map((src, i) => (
            <figure key={src} className="ex-frame">
              <img src={src} alt={`${ex.name}, ${i === 0 ? 'start' : 'finish'} position`} loading="lazy"
                onError={e => { e.currentTarget.closest('figure').style.display = 'none' }} />
              <figcaption>{i === 0 ? 'Start' : 'Finish'}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {info?.figure && <ExerciseFigure exerciseId={exerciseId} />}
      {info?.similar && <div className="tiny faint" style={{ marginTop: 6 }}>Photo shows a similar variation — follow the steps below.</div>}

      {info ? (
        <>
          <div className="section-title" style={{ marginTop: 16 }}>How to</div>
          <ol className="ex-steps">
            {info.how.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          {info.cues?.length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: 14 }}>Coach's cues</div>
              <ul className="ex-cues">
                {info.cues.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </>
          )}
        </>
      ) : (
        <p className="muted small" style={{ marginTop: 12 }}>No write-up for this one yet. Watch a demo below.</p>
      )}

      <a className="btn block" style={{ marginTop: 16 }} href={videoSearchUrl(ex.name)} target="_blank" rel="noreferrer">
        Watch a video demo ↗
      </a>
      <button className="btn ghost block" style={{ marginTop: 8 }} onClick={onClose}>Close</button>
      {photos.length > 0 && <div className="tiny faint center" style={{ marginTop: 10 }}>Photos: free-exercise-db (public domain)</div>}
    </Sheet>
  )
}
