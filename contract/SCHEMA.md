# trainer-data — data contract

This repo is the shared brain between **Sarge** (the workout app on the phone) and **the coach**
(the claude.ai "Personal Trainer" Project and the scheduled Claude Code routine).
Both sides MUST follow these formats. The app validates what it reads; anything it can't parse is ignored.

## Who writes what

| Path | Written by | Notes |
|---|---|---|
| `plan/current.json` | Coach | The active training block. The app reads it on every launch. Overwrite the whole file. |
| `plan/archive/*.json` | Coach | Move the old block here before replacing `current.json`. |
| `coach/today.md` | Coach | Today's orders, shown at the top of the Today screen. 1–4 short sentences. |
| `coach/brief.md`, `coach/principles.md`, `coach/notes.md` | Coach | Goals, training rules, coach memory. |
| `coach/feed/*.md` | Coach | Messages, debriefs, reviews (append-only, `YYYY-MM-DD-HHMM-<slug>.md`). |
| `environments.json` | App | Locations and their equipment. |
| `logs/*.json` | App | Workouts, check-ins, reschedules. Append-only — never edit or delete. |
| `inbox/*.json` | App | Messages and excuses for the coach. Coach answers in `coach/feed/`. |

## plan/current.json

```json
{
  "version": 1,
  "id": "2026-autumn-strength-1",
  "name": "Autumn Strength Block",
  "phase": "Autumn rebuild",
  "rationale": "Why this block, in 2–4 sentences.",
  "startDate": "2026-10-12",
  "endDate": "2026-11-22",
  "sessions": [ Session, ... ]
}
```

### Session

```json
{
  "id": "s-2026-10-12",            // unique and STABLE — keep ids when editing a plan, logs reference them
  "date": "2026-10-12",            // local date YYYY-MM-DD
  "time": "18:00",                 // optional
  "name": "Lower Strength",
  "focus": "Squat + posterior chain",
  "environment": "gym",            // id from environments.json
  "targetDurationMin": 60,
  "transitionSec": 90,             // setup time between blocks (default 90)
  "notes": "optional coaching notes",
  "blocks": [ Block, ... ]
}
```

### Block types

`exerciseId` must be an id from the app's exercise library (`src/lib/exercises.js` in the app repo,
e.g. `back-squat`, `rdl`, `bench-press`, `pull-up`, `db-row`, `push-up`, `run`, `row-erg`, `couch-stretch`).
Unknown ids still work but show a generated name and can't be swapped.

**single** — straight sets of one exercise
```json
{ "id": "b1", "type": "single",
  "exercises": [{ "exerciseId": "back-squat", "sets": 4, "reps": 5, "load": 100, "rpe": 8, "restSec": 180 }] }
```
`reps` may be a number or a string like `"6-8"` or `"AMRAP"`. `load` is kg (omit or `null` for "pick a weight").

**superset** / **circuit** — exercises done back to back, for N rounds
```json
{ "id": "b2", "type": "superset", "rounds": 3, "restBetweenSec": 15, "restSec": 90,
  "exercises": [
    { "exerciseId": "overhead-press", "reps": 8, "rpe": 8 },
    { "exerciseId": "cable-row", "reps": 10 }
  ] }
```
`restBetweenSec` = rest between exercises inside a round, `restSec` = rest after each round.

**interval** — timed work/rest repeats
```json
{ "id": "b3", "type": "interval", "exerciseId": "row-erg", "rounds": 6, "workSec": 60, "restSec": 90,
  "target": "Hard — 8/10" }
```

**hold** — mobility or isometric holds, optionally per side
```json
{ "id": "b4", "type": "hold", "rounds": 2, "restBetweenSec": 10,
  "items": [{ "exerciseId": "couch-stretch", "holdSec": 60, "sides": true }] }
```

**cardio** — one steady piece
```json
{ "id": "b5", "type": "cardio", "exerciseId": "run", "durationMin": 35, "target": "Zone 2" }
```

Any block may have an optional `"label"` (e.g. `"Warm-up"`, `"Finisher"`) shown instead of the type.
A `single` exercise may add `"warmupSets": 3` (optional `"warmupReps": 5`, `"warmupRestSec": 60`) —
warm-up sets are timed and logged with `"warmup": true` but don't count toward PRs.

### Rest guidelines the app uses for pacing
Heavy compounds 120–180 s · accessories 60–90 s · supersets/circuits 0–20 s between moves.
The app estimates session length from sets (≈4 s/rep + 15 s setup), rests and transitions,
and shows the user if they run behind. Keep `targetDurationMin` realistic.

## environments.json

```json
[ { "id": "gym", "name": "Gym", "equipment": ["barbell", "rack", "bench", "dumbbells", "..."] } ]
```
Equipment ids: barbell, rack, bench, dumbbells, kettlebell, cable, machine, pullup-bar, bands, box, rower, bike, treadmill, mat.

## logs/ (app → coach)

`logs/YYYY-MM-DD-workout-<id>.json`
```json
{ "type": "workout", "id": "w…", "sessionId": "s-2026-10-12", "date": "2026-10-12", "name": "Lower Strength",
  "environment": "gym", "startedAt": 1760284800000, "finishedAt": 1760288700000,
  "plannedSec": 3480, "actualSec": 3900, "pausedSec": 0,
  "overSec": 240,            // total time over plan: slow sets + rests extended
  "endedEarly": false, "sessionRpe": 8, "note": "Left knee a bit cranky on last set",
  "adjustments": [ { "type": "swap", "blockId": "b2", "from": "rdl", "to": "db-rdl", "at": "before" } ],
  "blocks": [ { "blockId": "b1", "type": "single", "title": "Back squat", "actualSec": 960,
    "exercises": [ { "exerciseId": "back-squat", "sets": [ { "reps": 5, "load": 100 } ] } ],
    "timed": [], "cardio": { "exerciseId": "run", "durationSec": 2100, "distanceKm": 6.2, "avgHr": 142 } } ] }
```
Adjustment types: `swap`, `sets`, `reps`, `load`, `rest`, `remove`, `add`, `reorder`, `environment`,
`shorten-rests`, `drop-set`. `at` is `before` (in the session overview) or `during` (in the workout).
Patterns in adjustments (always cutting the same set, always swapping the same lift) are worth calling out.

`logs/YYYY-MM-DD-checkin.json` — 1–5 scales (5 = best for sleep/energy, 5 = worst for soreness/stress)
```json
{ "type": "checkin", "id": "checkin-2026-10-12", "date": "2026-10-12",
  "sleep": 4, "energy": 3, "soreness": 2, "stress": 3, "bodyweight": 82.4, "createdAt": 1760252400000 }
```

`logs/YYYY-MM-DD-reschedule-<id>.json` — the user moved a session (the app applies this on top of the plan;
fold it into `plan/current.json` next time you rewrite the plan)
```json
{ "type": "reschedule", "id": "…", "sessionId": "s-2026-10-14", "fromDate": "2026-10-14", "toDate": "2026-10-15",
  "reason": "Work dinner", "date": "2026-10-13", "createdAt": 1760338800000 }
```

## inbox/ (app → coach, needs an answer)

`inbox/<UTC timestamp>-excuse-<id>.json`
```json
{ "type": "excuse", "id": "…", "sessionId": "s-2026-10-13", "sessionDate": "2026-10-13",
  "when": "ahead",          // "ahead" = called off in advance, "after" = explained after missing it
  "category": "tired",      // tired | no-time | sick | injured | travel | skipped | other
  "text": "Slept 4 hours", "date": "2026-10-13", "createdAt": 1760360000000 }
```

`inbox/<UTC timestamp>-message-<id>.json`
```json
{ "type": "message", "id": "…", "text": "Knee hurts going down stairs", "date": "2026-10-13", "createdAt": 1760360000000 }
```

The coach marks inbox items handled by replying in `coach/feed/` and mentioning the inbox file name.
