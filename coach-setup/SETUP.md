# Setting up the coach (claude.ai Project)

About 15 minutes. These steps are easiest on a computer at claude.ai. The Project then works the same in the Claude app on your phone.

## 1. Create the project
1. claude.ai → **Projects** → **Create project** → name it **Personal Trainer**.
2. Open the project → **Instructions** (project instructions / "Set custom instructions").
3. Paste the full contents of [`PROJECT_INSTRUCTIONS.md`](PROJECT_INSTRUCTIONS.md) and save.

## 2. Connect GitHub (with write access) — the step to test
The coach needs to **read and write** `trainer-data` live. The built-in "Add from GitHub" button in project knowledge **won't do**: it only copies a snapshot of files, you have to press "Sync now" yourself, and it can't write.

Use GitHub's own connector instead:
1. claude.ai → **Settings** → **Connectors**.
2. If **GitHub** appears in the connector list/directory, connect it there. Otherwise choose **Add custom connector**:
   - Name: `GitHub`
   - URL: `https://api.githubcopilot.com/mcp/`
3. Click **Connect** and approve in GitHub. If GitHub asks which repositories to allow, pick **only `trainer-data`**.
4. In a chat inside the project, open the tools menu (the **+** / sliders icon next to the message box) and make sure GitHub is **enabled**.

### Test it — send this in the project
> Connection test. Read `SCHEMA.md` and `coach/principles.md` in koenyvision-jpg/trainer-data and tell me the first heading of each. Then create `coach/feed/connection-test.md` containing "Connection test OK" with commit message "Coach: connection test".

**It works** if Claude reports both headings *and* `coach/feed/connection-test.md` appears at https://github.com/koenyvision-jpg/trainer-data.

**If reading works but writing fails, or the connector won't connect,** stop there and tell Claude Code. The fallback is to route the coach's writes through the Google Drive connector, which needs a small change in the app.

## 3. Connect Google Calendar
1. Settings → **Connectors** → **Google Calendar** → **Connect**, using the Google account whose calendar you use.
2. Enable it in the project chat's tools menu, as you did for GitHub.

## 4. Link the project in the app
1. Open the project in your browser and copy the address (`https://claude.ai/project/…`).
2. Sarge → **Settings → Coach** → paste it. The **Talk to Sarge** button on the Coach tab now opens it.

## 5. Intake
In the project, start a new chat and say **"Start intake"**. Sarge interviews you, writes `coach/brief.md`, and proposes your first real block. Once you approve it, the block replaces the sample plan in the app (next time you open it), and the sessions go into your calendar.

---

## What's in `trainer-data` (for reference)
| Path | Who writes it |
|---|---|
| `SCHEMA.md`, `exercises.json`, `environments.json`, `logs/`, `inbox/` | The app |
| `plan/current.json`, `plan/archive/`, `coach/*.md`, `coach/feed/` | The coach |

Still to come (next phase): a scheduled daily check-in that writes your morning orders, calls out missed sessions in the evening, and writes a weekly review on Sundays, with push notifications through the ntfy app.
