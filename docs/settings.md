# Settings reference

Every setting on the plugin's settings tab, in the tab's order: the name on
screen, the `data.json` key it is saved under, its default, and what changing it
actually does. Defaults come from `DEFAULT_SETTINGS` in `src/settings-data.ts`.

## Where settings live

Everything is saved to `data.json` in the plugin's folder
(`.obsidian/plugins/garmin-connect/`), in three blocks:

| Block | Holds |
| --- | --- |
| `settings` | Every setting on this page, plus `settingsVersion` (see [upgrades](#upgrades)), `setup` and the consent ledger (see [Data](#data)). |
| `auth` | The session: a refresh token, the DI client ID it belongs to, and when it was saved (`savedAt`). No password and no access token. |
| `home` | Home's own state — see [Home's state](#homes-state). |

The file is read by allowlist. A key this version does not know, such as one
left by an older build, is dropped at the next save. A value out of range is
pulled back into it. Read [security](SECURITY.md) before you put that file
anywhere public.

`data.json` sits in the vault's configuration folder. A sync tool that copies
plugin settings between devices therefore copies the session along with them.
When another device's copy arrives, a running plugin takes its `setup` and
`data` from it and nothing else.

## Connection

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Status | — | — | Says whether you are signed in, and when the session was saved, with a **Sign in** or **Sign out** button. |
| Garmin email | `email` | `""` | The account to sign in as. |
| Region | `domain` | `garmin.com` | `garmin.cn` for mainland China accounts. Changes every host the plugin talks to, so the client is rebuilt on the spot. |

Your **password is never stored**. It is used for one sign-in request and then
dropped. Only the refresh token and the DI client ID it belongs to are written.

If the account has multi-factor authentication on, the sign-in dialog asks for
the verification code as a second step. The code is not stored either.
"Remember this browser" needs a cookie the plugin deliberately does not keep,
so expect the challenge every time you sign in. That is only when there is no
saved session to restore, not on every sync.

## Sync

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Sync on startup | `syncOnStartup` | off | Runs **Sync recent days** five seconds after Obsidian loads the plugin, when you are signed in. |
| Units | `units` | `auto` | `metric` writes `distance_km`, `imperial` writes `distance_mi`, and `auto` asks Garmin which system your account uses. |

**How Sync recent days picks its days.** There is no setting: it covers
everything since the last recent sync that finished, from the day before
through today. Garmin keeps revising a day after it ends — sleep is
finalised late, and a watch that syncs in the morning rewrites yesterday —
so it always covers at least yesterday and today.

- The mark is the watch's last upload as Garmin reported it then, not the
  time of the sync. A watch left offline for four days keeps the mark where
  it was however often you sync, and the sync after it uploads covers all four.
- The first sync covers three days; the history download fills in the rest.
- After a gap longer than 30 days it covers the last 30 and says so in the
  notice. **Sync a date range…** covers the days before.
- A sync cut short by a rate limit or a dead session leaves the mark where it
  was, so the next one covers its oldest days again.
- The mark is in `<dataFolder>/sync-state.json`. Delete it to start over.
  **Sync today** and **Sync a date range…** leave it alone.

Re-syncing an unchanged day writes nothing: the day's year file is
rewritten only when its text changes, so an identical day leaves it
untouched, and a sync writes each year file once, after its days are in.
That matters with Obsidian Sync or LiveSync, which treat a bumped
modification time as a change to send everywhere.

A sync also keeps the history indexes the pages read up to date (see
[properties](properties.md#history-indexes)), and fetches the timelines of each
of its days inside Day details. The whole history comes from the history
download, for what you agreed to (see [Data](#data)).

## Data

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Data folder | `dataFolder` | `Garmin/data` | Where everything the sync writes goes, all of it JSON: the day files in `days/`, the series files, the history indexes, the activity pages' files, `account.json` and the bookkeeping files. Changing it does not move files already written. |
| On disk | — | — | What the data folder takes, by data set: Charts & trends (the history indexes), Day details (`days/` and `series/`), Activity details (`activity-details/`) and Other (the files at the folder's top). |
| Day details | `data.dayDetails` | `90d` | How far back the history download fetches each day's file and timelines: `new` (New days only, from the setup on), `30d`, `90d`, `1y` or `all`. Every new day is kept whatever the range. Below it: the days still missing, their size and how long they take. |
| Activity details | `data.activityDetails` | `opened` | Which activities' pages the download fetches, every sport: `opened` (Only activities I open: each downloads the first time you open it), `90d`, `1y` or `all`. Below it: the activities left to download. A vault saved before every sport had a page keeps its choice from `data.runDetails`. |
| Run setup again | — | — | **Open setup** runs the setup again: a fresh scan of your Garmin history, and the choices. |

The sync writes no notes. Each day's numbers go into `days/<year>.json`, keyed
by date (see [properties](properties.md)). Every day is writable, so a backfill
works with nothing in place first.

**Choosing a range agrees to it.** Its data set joins the consent ledger and the
download starts on what is missing. Narrowing a range deletes nothing.

While the download has something to do, a card under the ranges says what it is
fetching, how far back it has got and the time left, with **Pause**, **Resume**
once paused, or **Sign in** when the session ended. Under it, **New data for
your history** lists what an update offers that you have not agreed to, what you
put off with **Later** included, with a **Download** button for all of it (see
the [Guide](GUIDE.md#after-an-update)).

**The consent ledger.** `data.accepted` lists what you agreed to and
`data.deferred` what you put off, each as a store at a version: `days@1` for Day
details, `activity-details@6` for Activity details, and `activities@…`,
`daily-stats@…`, `sleep@…` and `index:<kind>@<version>` for each chart history.
A key in neither is asked about once. A store you agreed to keeps filling its
gaps without asking; only what an older version saved is asked about again.
`runs@5` is Run details', from when only runs had a page: a vault that agreed to
it keeps downloading the runs in its range, and is asked once about the other
sports and the runs saved before.

`setup` is `null` until the setup has run, then holds when it finished
(`completedAt`). While it is `null`, enabling the plugin opens the setup, Home
shows **Finish setting up**, and nothing downloads in the background.

## Metrics

One toggle per metric group, and all sixteen are on by default (`groups`). Each
row is labelled with what the group writes, and below it what it costs:

| Group | On screen | Cost |
| --- | --- | --- |
| `activity` | Activity — steps, distance, calories, floors, intensity and active minutes | Free — shares the daily summary request |
| `heart` | Heart rate — resting, seven-day resting, min, max | Free — shares the daily summary request |
| `sleep` | Sleep — duration, stages, score, Sleep Coach need, respiration, SpO2, restlessness | 1 request per day |
| `stress` | Stress and Body Battery — averages, peaks, time in each band, charge and drain | Free — shares the daily summary request |
| `hrv` | HRV — overnight average, status and your personal baseline range | 1 request per day |
| `readiness` | Training readiness — score, recovery time and the factors behind it | 1 request per day |
| `fitness` | Fitness — VO2 Max, fitness age, endurance and hill score, heat and altitude acclimation | 2 requests per day |
| `races` | Race predictions — 5K, 10K, half, marathon | 1 request per sync, not per day |
| `respiration` | Respiration — waking average, low and high | Free — shares the daily summary request |
| `spo2` | Pulse ox — average, lowest and latest SpO2 | Free — shares the daily summary request |
| `body` | Body composition — weight, BMI, body fat, muscle and bone mass | 1 request per day |
| `training` | Training load — status, acute and chronic load, load ratio, load focus, running tolerance | 1 request per day |
| `workouts` | Workouts — a list of the day's activities | 1 request per sync, not per day |
| `intraday` | Intraday charts — heart rate, stress, Body Battery, steps and sleep stages, saved as a file per day | 6 requests per day, for the days inside Day details (Data, above) |
| `health` | Health status — overnight HRV, heart rate, SpO2, respiration and skin temperature against your baseline, plus Health Snapshots | 1 request per day |
| `profile` | Profile — watch, avatar, lactate threshold, FTP, running economy, cycling ability, coach plan, upcoming events and personal records | About 9 requests per sync, not per day — saved to `account.json` |

See [properties](properties.md) for every property each group writes.

**What the costs mean.**
- **"Free" groups.** Five groups come out of one request, the daily summary:
  `activity`, `heart`, `stress`, `respiration` and `spo2`. That request costs
  one a day while any of the five is on, so switching off one of them saves
  nothing unless you switch off all five.
- **Per-day costs.** These are counted per day synced. With everything on, a
  day costs nine requests: the summary, sleep, HRV, readiness, two for fitness
  (endurance and fitness age), body composition, training status and Health
  Status.
- **`intraday`.** It is spent only on the days inside Day details: a routine
  sync's days in the range, and each day the history download fetches. **Sync
  a date range…** spends it on every day it covers, and its estimate counts
  it. Before the setup, only on the newest seven days of a sync.
- **"Per sync" groups.** These make one call for the whole range. A backfill
  longer than a year makes one call per year.
- **Range calls not on the toggles.** `fitness`, `training` and `health` each
  add range calls of their own: VO₂ Max and hill score, running tolerance, and
  Health Snapshots. They are one request per year of the run for VO₂ Max, hill
  score and running tolerance (and one for running tolerance's weeks), and per
  28 days for Health Snapshots.

A group also gates its pages' history:

| Group | Feeds |
| --- | --- |
| `activity` | Steps, Floors and Intensity Minutes |
| `workouts` | Activities |
| `sleep` | Sleep |
| `stress` | Stress, Body Battery |
| `heart` | Heart Rate |
| `respiration` | Respiration |
| `spo2` | Pulse Ox, Pulse Ox Acclimation |
| `body` | Weight, Blood Pressure |
| `fitness` | Fitness Age |
| `health` | Health Status, Health Snapshot |

While a group is off, nothing is fetched for those pages. Turning a group off
does not remove what it already wrote to the day files.

### Upgrades

`settingsVersion` records which of these changes a vault has already had. It is
5 today. When a release adds a group, a vault saved before it gets that group
switched on once. Leaving it off would mean the new metrics never appear until
you went looking for a toggle you did not know about. A group you switch off
yourself stays off, and an empty selection stays empty.

| Version | What it does |
| --- | --- |
| 2 | Switches on `respiration`, `spo2`, `body`, `training` |
| 3 | Switches on `intraday` |
| 4 | Switches on `health`, `profile` |
| 5 | Replaces `downloadRuns` with the details range, `data.activityDetails` (`data.runDetails` in builds before every sport had a page, still read): `all` if it was on, `opened` if not. A vault with a saved session is taken as set up without running the setup: Day details `30d`, and the chart histories agreed to, `runs@5` too when `downloadRuns` was on |

Version 5 leaves Day details unagreed, so the first update dialog offers the
recent days an older build saved without their full timelines.

## Maps

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Map tiles | `mapTiles` | on | Draws OpenStreetMap's map under an activity's route, from `tile.openstreetmap.org`, which sees the area of each activity whose map you open. Off, the route is drawn on its own and no tile is asked for. |

## Advanced

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Sync speed | `syncSpeed` | `normal` | `gentle`, `normal` or `fast`: how hard a sync leans on Garmin. See below. |
| Stop after empty days | `stopAfterEmptyDays` | `45` | **Sync a date range…** gives up after this many days in a row with nothing in them. `0` walks the whole range. Slider 0–120. The history download does without it: the scan found where your history starts. |
| Save every diagnostics run to the vault | `autoSaveLog` | on | Writes each **Run diagnostics** log to a note. |
| Log folder | `logFolder` | `Garmin/diagnostics` | Where those notes go. Vaults set up before 0.2 keep the `garmin-probe-logs` they were given. |

The slider stops at 120. A value typed into `data.json` by hand may go up to
365; anything beyond that is clamped on load.

**Sync speed** paces every request to Garmin — syncs, the history download and
pages loading on view — and sets how many days a sync fetches at once. Normal
is about 20 requests a second, three days at a time, and syncs 30 days in about
17 s; Fast about 32 and five days, 12 s; Gentle 8 and one day, 43 s. Garmin was
measured allowing at least 47 a second; see
[Request pace](garmin-api.md#request-pace). The history download also stays
under an hourly budget: 5,000 requests at Gentle, 10,000 at Normal, 15,000 at
Fast. If Garmin does answer 429, the sync pauses for as long as it asks,
carries on at half the pace, and says so in its notice. **Gentle** is the first
thing to try if long date ranges or the download still hit 429s. It replaced
`pauseBetweenDays`: a saved pause of 0 reads as Fast, 1000 ms or more as
Gentle, anything else as Normal.

**Why Stop after empty days exists.** A date range can reach as far back as you
ask, but one reaching past the start of your Garmin history would keep asking,
several requests a day, until Garmin rate-limits you. The sync walks newest to
oldest, so that empty stretch is always the tail. After the set run of empty
days it stops and says where it gave up. Nothing is written for those days.

Diagnostics logs go into the vault rather than the console because **a phone
has no console**, and a note in the vault syncs back to your desktop like any
other. See [troubleshooting](troubleshooting.md).

## Danger zone

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Delete synced data | — | — | **Delete…** asks first, with the size and the file count, and a box to delete the diagnostics notes too. Then the plugin's own files in the data folder go to the trash, then the folder itself once it is empty, and the folder above it (`Garmin`) if that is empty too. The plugin starts over, with no setup and nothing agreed to, so nothing downloads them straight back. You stay signed in. |

What counts as the plugin's: the folders the sync writes (`days/`, `series/`,
`activities/`, `activity-details/`, `daily-stats/`, `sleep/` and each history's
folder), each whole only when everything in it is the plugin's, and
`account.json`, `sync-state.json`, `scan.json` and `backfill.json` at the top,
conflict copies such as `2026 2.json` included. Anything else you keep in the
data folder stays. The diagnostics notes are the `garmin-probe-*.md` notes in
the **Log folder**. They go wherever Obsidian's **Files and links → Deleted
files** setting sends deleted files.

## Home's state

The `home` block in `data.json` belongs to Home, not to the settings tab:

| Key | Default | Meaning |
| --- | --- | --- |
| `preset` | `be-healthy` | Which of Garmin's three Home presets is showing: `be-healthy`, `stay-active` or `track-my-training`. |
| `hidden` | `[]` | Sections removed with their **Hide** link, from `events`, `coachPlans` and `challenges`. |
| `glance` | absent | The At a Glance cards in order, once edited on **See All**: up to 20. Absent means the preset's own list. |

**Reset Home** picks a preset again, brings back hidden sections and returns At
a Glance to the preset's list. A card id or section this version does not know
is dropped on load.
