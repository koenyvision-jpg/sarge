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
| `exercises.json` | App | The exercise library: every valid `exerciseId`, its movement pattern and the equipment it needs. Equipment also listed in `optionalEquipment` is nice to have but not required. `sided: true` = worked one side at a time. `use` (optional) = what it's for, e.g. a warm-up. |
| `SCHEMA.md` | App | This file. |
| `logs/*.json` | App | Workouts, check-ins, missed sessions (plus old reschedules). Append-only — never edit or delete. |
| `inbox/*.json` | App | Messages and excuses for the coach. Coach answers in `coach/feed/`. |

## Scheduling — the coach owns it

The user never moves sessions in the app. All scheduling happens by rewriting `plan/current.json`.
- Plans are order-based. When the user skips a session, shift the remaining sessions forward and **keep their ids**.
- A date with no session is a **planned rest day**. It never counts as missed.
- Misses are recorded in `logs/` (see `missed` below), so they survive plan rewrites. Read them, don't infer misses from gaps.
- The app picks up a new plan the next time it's opened.

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

`exerciseId` must be an id from `exercises.json` in this repo (e.g. `back-squat`, `rdl`, `bench-press`, `pull-up`, `db-row`, `push-up`, `run`, `row-erg`, `couch-stretch`).
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

**Per side** — any exercise in a `single`, `superset` or `circuit` block may set `"perSide": true` (carries,
single-arm or single-leg work). Each set is then done and logged twice: left, a short switch, right — like
`"sides": true` on holds. `reps` and `load` are **per side**; the switch rest is `"switchSec"` (default 10).
Warm-up sets are done per side too. Plan time for both sides.
Exercises marked `"sided": true` in `exercises.json` (e.g. `kb-squat-rotation-uppercut`, `kb-suitcase-march`, `sl-glute-bridge`, `kb-single-arm-swing`) are
one-side-at-a-time moves: the app runs them per side even without `perSide`. Set `"perSide": false` to override.
```json
{ "id": "b3", "type": "single",
  "exercises": [{ "exerciseId": "kb-suitcase-march", "sets": 3, "reps": 10, "load": 16, "restSec": 60, "perSide": true }] }
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
    "exercises": [ { "exerciseId": "back-squat", "sets": [ { "reps": 5, "load": 100 } ] } ],   // per-side sets add "side": "Left" | "Right"
    "timed": [], "cardio": { "exerciseId": "run", "durationSec": 2100, "distanceKm": 6.2, "avgHr": 142 } } ] }
```
Adjustment types: `swap`, `sets`, `reps`, `load`, `rest`, `remove`, `add`, `reorder`, `environment`,
`shorten-rests`, `drop-set`, `skip` (a set, hold or cardio block skipped mid-workout without logging it:
`{ "type": "skip", "kind": "set", "exerciseId": "rdl", "setNo": 3, "at": "during" }`; a per-side set adds `"side"`).
`at` is `before` (in the session overview) or `during` (in the workout). Timers can also be shortened or extended
mid-workout; time added shows up in `overSec` / `restOverSec`.
Patterns in adjustments (always cutting the same set, always swapping the same lift) are worth calling out.

**Runs done outside the app.** On a session with a `cardio` block the user can log it without the workout flow.
That writes a normal workout log with `"source": "outside"`: the `cardio` block (`durationSec`, `distanceKm`), plus the
session's `hold` blocks (warm-up, cool-down) with every hold `"completed": true` — unless the user un-ticked that
block, then `"completed": false` and `actualSec` 0. `actualSec` = the run plus the ticked holds, `plannedSec` = the run's
`durationMin` plus the holds' planned time, `sessionRpe` if given. No adjustments or skips. It is dated on the session's date if that has passed, otherwise today. Timing fields (`overSec`,
`pausedSec`) are 0 — don't read pacing into them.

**Corrections — `supersedes`.** Logs are never edited. To fix a wrong log, the app writes a new log of the same type
with a new `id` and `"supersedes": "<old id>"` (plus `createdAt`). The old file stays, but it no longer counts:
**ignore every log whose `id` appears in another log's `supersedes`** — for compliance, PRs, volume and history.
Chains work the same way: if C supersedes B and B supersedes A, only C counts.
A correction may also add a `cardio` block the original log was missing (run skipped in the app but done anyway);
the matching `skip` adjustment is then removed. Pace isn't stored — it's `durationSec / distanceKm`.
```json
{ "type": "workout", "id": "w9c1…", "supersedes": "w4b2…", "createdAt": 1760400000000, "sessionId": "s-2026-10-14",
  "date": "2026-10-14", "name": "Zone 2 Run", "source": "outside", "actualSec": 2310, "sessionRpe": 4,
  "blocks": [ { "blockId": "b1", "type": "cardio", "title": "Run", "actualSec": 2310,
    "exercises": [], "timed": [], "cardio": { "exerciseId": "run", "durationSec": 2310, "distanceKm": 6.4, "avgHr": null } } ] }
```

`logs/YYYY-MM-DD-checkin.json` — 1–5 scales (5 = best for sleep/energy, 5 = worst for soreness/stress)
```json
{ "type": "checkin", "id": "checkin-2026-10-12", "date": "2026-10-12",
  "sleep": 4, "energy": 3, "soreness": 2, "stress": 3, "bodyweight": 82.4, "createdAt": 1760252400000 }
```

`logs/YYYY-MM-DD-missed-<sessionId>.json` — a planned session that didn't happen. The app writes it once, on the
first launch after the session's date, when the plan still has the session on that date and there is no workout and
no excuse for it. `date` is when the app noticed; `sessionDate` is the day it was planned for. At most one per
`sessionId`. If the user explains it later, an excuse with `"when": "after"` and the same `sessionId` + `sessionDate`
lands in `inbox/`.
```json
{ "type": "missed", "id": "missed-s-2026-10-14", "sessionId": "s-2026-10-14", "sessionName": "Engine",
  "sessionDate": "2026-10-14", "date": "2026-10-15", "createdAt": 1760511600000 }
```

`logs/YYYY-MM-DD-reschedule-<id>.json` — **legacy, no longer written.** Older versions let the user move sessions.
These files stay for history; the plan's own dates win.
```json
{ "type": "reschedule", "id": "…", "sessionId": "s-2026-10-14", "fromDate": "2026-10-14", "toDate": "2026-10-15",
  "reason": "Work dinner", "date": "2026-10-13", "createdAt": 1760338800000 }
```

## inbox/ (app → coach, needs an answer)

`inbox/<UTC timestamp>-excuse-<id>.json`
```json
{ "type": "excuse", "id": "…", "sessionId": "s-2026-10-13", "sessionName": "Upper Strength", "sessionDate": "2026-10-13",
  "when": "ahead",          // "ahead" = called off in advance, "after" = explained after missing it
  "category": "tired",      // tired | no-time | sick | injured | travel | skipped | other
  "text": "Slept 4 hours", "date": "2026-10-13", "createdAt": 1760360000000 }
```
An excuse covers the session on `sessionDate` only. "ahead" means: skip it — shift the plan. A skipped session you move
forward under the same id is live again on its new date.

`inbox/<UTC timestamp>-message-<id>.json`
```json
{ "type": "message", "id": "…", "text": "Knee hurts going down stairs", "date": "2026-10-13", "createdAt": 1760360000000 }
```

The coach marks inbox items handled by replying in `coach/feed/` and mentioning the inbox file name.
