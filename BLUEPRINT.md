# Blueprint v2 — "Sarge": a personal Claude trainer app, €0 extra cost

## Context
You want a workout app built only for you, with Claude as your personal trainer. It designs programs for the season and place you're in, tracks progress, and holds you accountable drill-sergeant style. You also want to talk strategy with the same coach in a claude.ai Project.

New constraints since v1:
- **Nothing extra to pay.** No Anthropic API bill, no $99 Apple Developer account, no paid hosting. It only uses the Claude subscription you already have.
- **No manual copy/paste** between the app and claude.ai. They talk to each other automatically.
- Still no backend server of your own to keep alive. Data stays yours, backed up to a private GitHub repo.

### What changed from v1, and why
| v1 | v2 | Reason |
|---|---|---|
| Claude API inside the app (pay per use) | **The coach runs on your Claude subscription**: claude.ai Project + a scheduled Claude Code routine | The API has no free tier. Your subscription already covers claude.ai and Claude Code. |
| Native iPhone app (Xcode) | **Installable web app (PWA)**, free hosting | A free Apple account means re-installing every 7 days, and avoiding that costs $99/yr. A PWA installs from Safari to the home screen and never expires. Same React stack as SkyLog. |
| Local iOS notifications | **Google Calendar alerts** (session reminders) + **ntfy** push app (drill-sergeant messages) | Both free. Without paid native or a server, this is how you get real pushes. |
| Copy/paste plan import | **Shared GitHub repo** that the app, the claude.ai Project, and the routine all read and write | Fully automatic both ways. |

Assumption: you have a paid Claude plan (Pro or Max), since you're using Claude Code. Everything below runs inside that plan's usage limits.

---

## 1. Architecture

```
  iPhone home screen                      Private GitHub repo "trainer-data"  (the shared brain)
  ┌───────────────────────┐   auto-sync   ┌───────────────────────────────────────────────┐
  │ Sarge PWA             │ ◄──────────►  │ coach/brief.md  coach/notes.md  coach/today.md │
  │ log · plan · progress │   (GitHub API)│ plan/current.json  logs/*.json  inbox/*.json   │
  └──────────┬────────────┘               └───────▲──────────────────────▲─────────────────┘
             │ "Talk to Sarge" button             │ GitHub connector     │ commits
             ▼                                    │ (read + write)       │
  Claude app → "Personal Trainer" Project ────────┘                      │
     · discuss goals/challenges                          Claude Code routine (cloud, scheduled)
     · writes plan + notes to repo                       · morning: today's orders
     · creates sessions in Google Calendar               · evening: missed-session check, roast
       (Calendar connector)                              · Sunday: weekly review + next week tweaks
                                                                  │ commit → GitHub Action
  Google Calendar alerts ◄── session reminders                    ▼
  ntfy app on iPhone     ◄────────────── push: "Session not logged. Explain yourself."
```

No manual steps anywhere:
- **App → Claude**: every log, check-in, and excuse is committed to the repo within seconds. The Project and the routine read the repo through the GitHub connector, so they always see current data.
- **Claude → App**: when you agree on a plan in the Project, Claude commits `plan/current.json` and puts the sessions in Google Calendar. The app pulls changes when it opens or comes back to the foreground.
- **Async chat in the app**: replies typed in the app ("knee hurts", "can't train today, flight") go into `inbox/`. The routine or the Project answers on its next run, and the answer appears in the app's Coach tab and as a push.

---

## 2. How much does the coach know about exercise science?
Claude (Opus/Sonnet 5.5) has strong, broad knowledge of evidence-based training:
- **Periodisation**: linear, undulating (DUP), block, conjugate; mesocycles, deloads, tapering, seasonal planning.
- **Strength/hypertrophy**: progressive overload, RPE/RIR autoregulation, volume landmarks (MEV/MAV/MRV), frequency, exercise selection and substitution, e1RM tracking.
- **Endurance**: heart-rate zones, polarised and Zone 2 training, interval design, 10% rule and load management, the interference effect in concurrent training.
- **Mobility and recovery**: sleep and stress effects on readiness, fatigue management, working around minor injuries.

Limits, and how the design handles them:
- **It can't see your form or diagnose injuries.** The persona rule is to adapt around pain and send you to a physio for anything sharp, persistent, or swelling. It never "pushes through" pain.
- **It can be confidently wrong on specifics.** The Project gets a curated **`coach/principles.md`**: your agreed training rules, such as rate of progression, deload triggers, and weekly volume ranges. The coach plans from that plus your real numbers, and must explain the why behind each block.
- **Generic advice turns into personal coaching through the data loop.** Because it reads your actual logs, check-ins, and missed sessions, it adjusts to how *you* respond (stalled lifts → change stimulus; poor sleep trend → reduce volume).

---

## 3. Pages (PWA)

Bottom tab bar has 5 tabs: Today, Coach, Plan, Progress, Settings. Session overview and Workout flow mode open full screen from Today.

### 3.1 Today
- **Sarge's orders** for the day, from `coach/today.md`, written by the morning routine. Example: "Lower body + 20 min Z2. You skipped mobility twice. Not today."
- **Today's session card**: name, focus, target duration, number of exercises. Tap it to open the **Session overview** (3.4). There's also **Can't today**, which requires a reason. That excuse goes to the inbox and the coach answers with a reschedule or a write-off.
- **Accountability strip**: streak, compliance % (week and block), open "debts" (missed sessions not made up).
- **10-second check-in**: sleep, energy, soreness, stress (1–5), optional bodyweight.
- Next 3 days preview.

### 3.2 Coach
- A feed of everything the coach has said: daily orders, roasts, weekly reviews, replies to your inbox messages.
- **Quick reply** box for async messages (see section 1).
- **Talk to Sarge**: opens the claude.ai Project in the Claude app for a live conversation (planning, "I'm travelling for 2 weeks", injury talk). That conversation can update the plan, notes, and calendar directly.

### 3.3 Plan
- Timeline: Season → Block → Weeks → Sessions, with the coach's rationale for the block.
- Week view and session detail: exercises, sets/reps/load or RPE targets, cardio targets (zones, time, distance), mobility.
- Drag a session to another day. The change is committed and the coach is told, and it may object in its next message.
- **Environments**: Home, Gym, Travel, Outdoor, each with equipment lists. The active environment is set from Today or by the coach.

### 3.4 Session overview (before you start)
You get here by tapping today's session card on Today.
- **Header**: session name, focus, environment, **target duration** (e.g. 60 min) and projected finish time ("Start now → done by 18:05").
- **Exercises as blocks**, in order. Each block shows the exercise, sets × reps, load/RPE target, **prescribed rest**, and last time's numbers. Supersets and circuits appear as grouped blocks.
- **Adjust before starting**:
  - drag to reorder
  - swap an exercise for an equipment-filtered alternative
  - add or remove an exercise or a set
  - change reps, load or rest
  - switch environment ("I'm at the hotel today")
- The projected duration updates live as you edit, so you can see if you're turning a 60-minute session into 90.
- Every adjustment is recorded in the log (e.g. "swapped squat → leg press, removed 1 set"). The coach sees the patterns and may push back ("3rd week in a row you've cut the last set of RDLs").
- Big **Start workout** button.

### 3.5 Workout flow mode (keeps the rhythm)
A guided, set-by-set screen designed so the session doesn't drag:
- **One thing at a time.** The current set is large: exercise, set 2 of 4, target reps and load, last time's numbers. Tap **Done** (pre-filled with the target, so adjusting the reps or weight is quick).
- **Rest auto-starts** the moment you log a set, using that exercise's prescribed rest. The coach sets defaults, which you can override per exercise: heavy compounds 2–3 min, accessories 60–90 s, supersets/circuits 0–30 s between moves.
- **Countdown cues**: a sound at 10 s left and a "Get ready" tone at 0. The next set's details appear during rest, so you're ready to go.
- **Over-rest warning**: once rest runs past the target, the timer turns red, counts up the overrun, and plays a repeat tone every 15 s.
- **Transitions**: a short timer between exercises (default 90 s) to set up the next station, so walking around and phone time stay capped.
- **Session pace bar** always visible: elapsed time vs plan, **ahead/behind** by X min, projected finish time. If you fall behind, the app offers fixes: shorten the remaining rests, or drop the last accessory set.
- **Supersets/circuits**: the app moves through A1 → A2 → rest → A1… automatically.
- **Cardio and mobility blocks** run as interval or hold timers (e.g. 30 s hold × 3 sides, 4 × 4 min intervals).
- **Screen stays on** (Wake Lock) so you don't need to unlock between sets. Optional voice cues ("Rest over. Set 3, bench, 80 kg").
- **Pause** is allowed but counts as paused time in the stats.
- **Finish → summary**:
  - planned vs actual duration
  - total rest overrun
  - time per block
  - PRs
  - session RPE + note

  The summary is committed to the repo. The evening routine writes the debrief, and dragging the session out gets called out just like skipping does.

### 3.6 Progress
- Consistency heatmap, compliance per block, excuse log with top reasons.
- e1RM trends and a PR board, weekly volume per muscle group, cardio volume and pace trends, check-in trends against training load.
- Archive of weekly and block reviews.
- **Session pacing**: average actual vs planned duration, rest overrun trend.

### 3.7 Settings
- GitHub repo + token (one-time setup), sync status, **Sync now**, **Restore**.
- ntfy topic (one-time), check-in reminder preferences, quiet hours.
- Edit Coach Brief and Principles (they're just files in the repo, also editable from claude.ai).

### 3.8 Onboarding
1. In the app: connect the GitHub repo (paste a fine-grained token once).
2. In the Claude app: open the Project, say "Start intake". The coach interviews you (goals, history, injuries, sports, typical week, locations, equipment, why you quit before), then writes `coach/brief.md` and `environments.json` and proposes block 1. On approval it commits `plan/current.json` and adds the sessions to Google Calendar.
3. The app picks it all up automatically.

---

## 4. Drill-sergeant accountability (all free)
| When | Who sends it | Channel |
|---|---|---|
| Session time (−30 min) | Google Calendar event alert (created by the coach) | Calendar notification |
| Morning (e.g. 06:30) | Routine writes today's orders → GitHub Action pushes | ntfy |
| Evening (e.g. 21:00) | Routine checks logs. Session missed → roast + demand a reason. Done → debrief | ntfy |
| Next app open after a miss | Today screen blocks with "Explain yourself" until you give a reason | In app |
| Sunday evening | Routine: weekly review, compliance score, next week adjusted, calendar updated | ntfy + Coach tab |
| End of block | Routine flags it. The block review and new block happen in the Project conversation | ntfy |

The coach keeps `coach/notes.md`, its memory: excuse patterns, injury notes, what works for you. It calls out patterns, for example "Third 'too tired' on a Thursday. Thursday moves to 07:00."

---

## 5. Shared repo layout (contract between app and Claude)
```
trainer-data/  (private)
  coach/brief.md         goals, challenges, injuries, preferences, availability
  coach/principles.md    agreed training rules the coach must follow
  coach/notes.md         coach memory (Claude maintains)
  coach/today.md         today's orders (routine writes)
  coach/feed/*.md        all coach messages & reviews (append-only)
  plan/current.json      active block (Claude writes, app reads; schema in SCHEMA.md).
                         Each session has: targetDurationMin, transitionSec, and blocks[]
                         (single | superset | circuit | interval | hold). Each exercise has
                         sets, reps, load/RPE, restSec, and an optional tempo.
  plan/archive/          past blocks
  environments.json      locations + equipment
  logs/YYYY-MM-DD-<id>.json   one file per workout/check-in (app writes, append-only)
  inbox/<ts>.json        your async messages/excuses (app writes, Claude marks handled)
  SCHEMA.md              JSON formats for plan/logs (both sides follow it)
  .github/workflows/notify.yml   on push to coach/feed → send ntfy push
```
Each side writes to its own files, append-only where possible, so the app and Claude never overwrite each other. The one exception is plan edits from the app (rescheduling), which are small patch commits with a retry on conflict.

---

## 6. Tech stack (all free)
- **App**: React + Vite PWA (same as SkyLog), IndexedDB for local cache and offline, `vite-plugin-pwa` for install and offline, Recharts or uPlot for charts.
- **Hosting**: GitHub Pages from a **public** app-code repo. It contains no personal data, and Pages is free only for public repos. Data lives in the separate **private** `trainer-data` repo.
- **Sync**: GitHub Contents API with a fine-grained token scoped to `trainer-data` only, stored on the device. Port and extend SkyLog's `src/lib/githubBackup.js` (debounced writes, status tracking) into per-file sync with pull-on-open.
- **claude.ai Project**: project instructions (persona + "always read coach/ and plan/ first, write back via GitHub, update notes.md") + **GitHub connector** (read/write) + **Google Calendar connector**.
- **Claude Code routine** (cloud, scheduled through your subscription): runs on `trainer-data`, has a prompt file `ROUTINE.md` in the repo, commits results.
- **GitHub Action** `notify.yml`: on a push to `coach/feed/`, it `curl`s ntfy.sh. Uses a few free minutes a month.
- **ntfy** iOS app (free): subscribe to a long random topic name. Messages go through ntfy.sh, so they contain no sensitive data (just "Session missed, open Sarge").

### App code layout
```
Workout app/
  index.html  vite.config.js  package.json
  src/
    main.jsx  App.jsx
    pages/      TodayPage, CoachPage, PlanPage, WorkoutPage, ProgressPage, SettingsPage
    components/ BottomNav, SessionCard, SetRow, RestTimer, CheckIn, Heatmap, ...
    lib/        github.js (sync), store.js (IndexedDB), schema.js (validate plan/logs),
                stats.js (e1RM, volume, compliance), exercises.json
```

---

## 7. Build phases
0. **Spike (verify assumptions first)**: (a) the claude.ai GitHub connector can **write** to a private repo. If not, fall back to the Google Drive connector already on your account, with the app syncing to Drive. (b) A Claude Code cloud routine can run on a schedule on `trainer-data` and commit. (c) The ntfy push arrives on iPhone through the Action.
1. **Foundation**: PWA scaffold, IndexedDB store, exercise library, Today screen, Session overview (editable blocks + duration estimate), Workout flow mode (rest engine, pace bar, audio cues, wake lock), finish summary, GitHub sync, deploy to Pages, install on iPhone. This phase works with a hand-written sample plan, before any Claude is involved.
2. **Repo contract**: SCHEMA.md, plan reader, log writer, inbox.
3. **Coach**: Project instructions + connectors, intake flow, first block written to repo + calendar.
4. **Drill sergeant**: ROUTINE.md (morning, evening, Sunday), notify Action, ntfy, missed-session flow, excuse log.
5. **Progress & reviews**: charts, heatmap, PRs, review archive.
6. **Polish**: offline queue hardening, home-screen icon/splash, PWA web push later if wanted (also free, but needs more setup).

## 8. Caveats
- **Subscription limits**: the routine (2–3 runs a day) and Project chats count toward your plan's usage. That should be fine for one person.
- **Live chat happens in the Claude app, not inside Sarge.** In-app it's async (inbox → answer within hours, or immediately if you open the Project). True live chat embedded in the app requires the paid API.
- **PWA limits**:
  - No background sync. The app syncs when opened.
  - iPhone Safari doesn't support vibration, so workout cues are sounds and voice.
  - Cues play while the app is on screen. Wake Lock keeps the screen on so you never need to lock the phone mid-session.
  - If you do switch apps, the timer keeps correct time (it's based on timestamps) and shows the overrun when you come back. It just can't beep while you're away.

## 9. Verification
- Phase 0 spike checks each assumption end to end before any UI work.
- Flow mode on iPhone:
  - Open today's session → edit a block and confirm the projected duration updates.
  - Start → log a set and confirm rest auto-starts, the 10 s and 0 s tones play, and overrun turns red.
  - Confirm the pace bar shows "behind" after deliberately over-resting.
  - Confirm the screen stays on.
  - Finish and confirm the summary shows planned vs actual time.
- Log a workout in the app → commit appears in `trainer-data/logs/` → ask the Project "what did I do today?" and it answers correctly.
- Ask the Project to move Thursday's session → `plan/current.json` and Google Calendar both change → the app shows it on next open.
- Skip a planned session → the evening routine runs → ntfy push arrives → the app demands a reason → the excuse appears in `inbox/` and `notes.md`.
- Wipe the app's site data → reconnect the repo → everything restores.
