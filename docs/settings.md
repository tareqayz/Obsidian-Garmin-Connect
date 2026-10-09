# Settings reference

Every setting on the plugin's settings tab, in the tab's order: the name on
screen, the `data.json` key it is saved under, its default, and what changing it
actually does. Defaults come from `DEFAULT_SETTINGS` in `src/settings-data.ts`.

## Where settings live

Everything is saved to `data.json` in the plugin's folder
(`.obsidian/plugins/garmin-connect/`), in three blocks:

| Block | Holds |
| --- | --- |
| `settings` | Every setting on this page, plus `settingsVersion` (see [upgrades](#upgrades)). |
| `auth` | The session: a refresh token, the DI client ID it belongs to, and when it was saved (`savedAt`). No password and no access token. |
| `home` | Home's own state — see [Home's state](#homes-state). |

The file is read by allowlist. A key this version does not know, such as one
left by an older build, is dropped at the next save. A value out of range is
pulled back into it. Read [security](SECURITY.md) before you put that file
anywhere public.

`data.json` sits in the vault's configuration folder. A sync tool that copies
plugin settings between devices therefore copies the session along with them.

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
| Days to sync | `syncDays` | `3` | How many days back **Sync recent days** covers. Slider 1–30. |
| Sync on startup | `syncOnStartup` | off | Runs **Sync recent days** five seconds after Obsidian loads the plugin, when you are signed in. |
| Units | `units` | `auto` | `metric` writes `distance_km`, `imperial` writes `distance_mi`, and `auto` asks Garmin which system your account uses. |

**Why three days and not one.** Garmin keeps revising a day after it ends.
Sleep is finalised late, and a watch that syncs in the morning rewrites
yesterday. Re-syncing an unchanged day writes nothing: the incoming properties
are compared with the frontmatter, and an identical day leaves the file
untouched. That matters with Obsidian Sync or LiveSync, which treat a bumped
modification time as a change to send everywhere.

A sync also keeps the history indexes the pages read up to date (see
[properties](properties.md#history-indexes)). After the first sync of a session,
each index whose group is on walks back through the account's history until it
is complete.

## Storage

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Where to put the data | `storageMode` | `dataFolder` | `dataFolder`, `dailyNotes` or `both`. |

| Mode | What it does |
| --- | --- |
| **Data folder** (one note per day) | One note per day in the data folder. It never touches notes you wrote, and every day is writable, so a backfill works with nothing in place first. |
| **Daily notes** | Properties go into the daily note you already keep, prefixed so they cannot collide with yours. Only notes that already exist are written unless **Create missing notes** is on. |
| **Both** | Writes to each. A day counts as written if either target took it. |

In daily-notes mode a note you have moved is still found by name, the way
Obsidian itself resolves it.

These settings appear unless the mode is **Daily notes**:

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Data folder | `dataFolder` | `Garmin/data` | Where the day notes go. The history indexes, the series files and `account.json` sit in it too. |
| Table view folder | `basesFolder` | `Garmin` | Where `Garmin Health.base` lives. Keeping it above the data folder keeps the day notes out of the way. Changing it does not move an existing file. |
| Property prefix in the data folder | `dataFolderPrefix` | `""` | A prefix for every property. Blank, because a folder of its own has nothing to collide with. |
| Table view | `createBasesView` | on | Creates `Garmin Health.base`, a Bases table over the data folder, on the first sync that writes something. |
| Link every day to the table view | `linkToBase` | on | Writes a link property on each day note pointing at `Garmin Health.base`. |
| Link property name | `linkProperty` | `link` | The name of that property. |

In daily-notes mode the data folder is hidden but still used: it holds the
history indexes, the series files and `account.json`. Set it before switching
modes if `Garmin/data` does not suit.

### Table view

The view is **created once and never overwritten**, so columns and filters you
change by hand survive every later sync. When you want it regenerated from the
current settings, use **Rebuild now** beside the toggle or the **Rebuild the
table view** command. A rebuild starts from the headline columns of the groups
that are on.

Bases needs Obsidian 1.9.10 or later, which is also this plugin's minimum.

### Linking every day to it

The link is written as a wikilink (`[[Garmin/Garmin Health.base]]`), not as a
plain path. That makes Obsidian treat it as a link, so the base collects a
backlink from every day note. It is written **unprefixed**, because it is yours rather
than a metric.

It is only written while the table view is on and the mode is not **Daily
notes**. Turn it off if you would rather your day notes carried no link.

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
| `intraday` | Intraday charts — heart rate, stress, Body Battery, steps and sleep stages, saved as a file per day | 6 requests per day, for the newest 7 days of a sync only |
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
- **`intraday`.** It is spent only on the newest seven days of a sync.
- **"Per sync" groups.** These make one call for the whole range. A backfill
  longer than a year makes one call per year.
- **Range calls not on the toggles.** `fitness`, `training` and `health` each
  add range calls of their own: VO₂ Max and hill score, running tolerance, and
  Health Snapshots. They are one request per 28 days of the run, or per year
  for VO₂ Max.

Days a sync cannot write cost **nothing**. In daily-notes mode with **Create
missing notes** off, a day without a note is skipped before any request is
made.

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
also drops its columns from a rebuilt table view.

### Upgrades

`settingsVersion` records which groups a vault has already been offered. It is
4 today. When a release adds a group, a vault saved before it gets that group
switched on once. Leaving it off would mean the new metrics never appear until
you went looking for a toggle you did not know about. A group you switch off
yourself stays off, and an empty selection stays empty.

| Version | Switched on |
| --- | --- |
| 2 | `respiration`, `spo2`, `body`, `training` |
| 3 | `intraday` |
| 4 | `health`, `profile` |

## Daily notes

These settings appear unless the mode is **Data folder**:

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Property prefix in daily notes | `prefix` | `garmin_` | Prepended to every property, so `steps` becomes `garmin_steps`. Clear it at your own risk: an unprefixed key can collide with one of your own. |
| Folder | `dailyNoteFolder` | `""` | Overrides the core Daily Notes folder. Empty follows it. |
| Date format | `dailyNoteFormat` | `""` | Moment tokens overriding the core Daily Notes format. Empty follows it. |
| Create missing notes | `createMissingNotes` | off | Whether a sync may create a daily note that does not exist. |

**Create missing notes** is **off on purpose**. Writing into notes you already
have is safe; inventing notes in someone's daily-note folder is not.

## Advanced

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Pause between days | `pauseBetweenDays` | `250` | Milliseconds to wait between days. Slider 0–2000. |
| Stop after empty days | `stopAfterEmptyDays` | `45` | A backfill gives up after this many days in a row with nothing in them. `0` walks the whole range. Slider 0–120. |
| Save every diagnostics run to the vault | `autoSaveLog` | on | Writes each **Run diagnostics** log to a note. |
| Log folder | `logFolder` | `Garmin/diagnostics` | Where those notes go. Vaults set up before 0.2 keep the `garmin-probe-logs` they were given. |

The sliders stop at 2000 and 120. A value typed into `data.json` by hand may go
up to 5000 and 365; anything beyond that is clamped on load.

**Raising Pause between days** is the first thing to try if long backfills hit
429s.

**Why Stop after empty days exists.** A backfill can reach as far back as you
ask, but a range reaching past the start of your Garmin history would keep
asking, several requests a day, until Garmin rate-limits you. The sync walks
newest to oldest, so that empty stretch is always the tail. After the set run
of empty days it stops and says where it gave up. Nothing is written for those
days.

Diagnostics logs go into the vault rather than the console because **a phone
has no console**, and a note in the vault syncs back to your desktop like any
other. See [troubleshooting](troubleshooting.md).

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
