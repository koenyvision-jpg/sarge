# Sarge

A personal-trainer web app built for one person, installed on your iPhone home screen. The full design is in [BLUEPRINT.md](BLUEPRINT.md).

**Phase 1 (this code):** the app itself works on its own:
- Today screen
- Session overview, where you can adjust exercises before starting
- Workout flow mode with timed rests, a pace bar and sound cues
- Finish summary, Plan, Progress and Settings
- Accountability prompts ("Can't today?" and "Explain yourself")
- Daily check-in
- GitHub sync

Until the coach is connected, the app runs on a generated 4-week **starter block**.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173/sarge/
npm test           # engine + schedule unit tests
npm run lint
```

To try it on your phone over Wi-Fi, run `npm run dev` and open `http://<your-mac-ip>:5173/sarge/` in Safari. Screen wake-lock and offline mode only work over HTTPS, so for real use, deploy it as described below.

## Deploy (free, GitHub Pages)

1. Create a **public** GitHub repo named `sarge` and push this folder to it. It contains no personal data. If you use a different repo name, change `base` in `vite.config.js` to match.
2. In the repo, go to **Settings → Pages → Source: GitHub Actions**. `.github/workflows/deploy.yml` then builds and deploys on every push to `main`.
3. On your iPhone, open `https://<username>.github.io/sarge/` in Safari, then tap **Share → Add to Home Screen**.

## Connect your data repo

1. Create a **private** repo called `trainer-data`.
2. Create a fine-grained personal access token: GitHub → Settings → Developer settings → Fine-grained tokens. Give it access to **only** `trainer-data`, with permission **Contents: Read and write**.
3. In the app, go to Settings → GitHub sync, enter your username, `trainer-data` and the token, then tap **Connect**.

The app then writes the following to `trainer-data`:
- `SCHEMA.md`: the data contract between the app and the coach (source: [contract/SCHEMA.md](contract/SCHEMA.md))
- `environments.json`
- `plan/current.json`: the starter block, only if no plan exists yet
- your workouts, check-ins and missed sessions under `logs/`
- your messages and excuses under `inbox/`

The coach (phase 3) reads these files and writes `plan/current.json` and `coach/today.md` back.

## Layout

```
src/lib/engine.js      session → timed steps, estimates, pace, records (pure, unit-tested)
src/lib/schedule.js    plan + records → statuses, streaks, compliance
src/lib/adjust.js      pre-workout edits + diff for the coach
src/lib/store.jsx      IndexedDB state + GitHub sync queue
src/lib/exercises.js   exercise library (ids the coach must use)
src/screens/           SessionOverview, WorkoutFlow, WorkoutSummary
src/pages/             Today, Coach, Plan, Progress, Settings
contract/SCHEMA.md     repo data contract (pushed to trainer-data)
```
