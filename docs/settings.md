# Settings reference

Every setting on the plugin's tab, in the tab's order: the main page, then its three sub-pages,
**History**, **Metrics** and **Advanced**. Each entry gives the name on screen, the `data.json` key it
is saved under, its default, and what changing it does. The defaults come from `DEFAULT_SETTINGS` in
`src/settings-data.ts`.

Obsidian's settings search finds every row, sub-pages included, and shows the page a row is on.

## Where settings live

Everything is saved to `data.json` in the plugin's folder (`.obsidian/plugins/garmin-connect/`), in
two blocks:

| Block | Holds |
| --- | --- |
| `settings` | every setting on this page, plus `settingsVersion` (see [Upgrades](#upgrades)), `setup` and the consent ledger (see [History](#history)) |
| `home` | Home's own state (see [Home's state](#homes-state)) |

- **The Garmin session isn't in it.** It is kept in each device's keychain; see
  [Security](SECURITY.md#the-session-obsidians-keychain).
- **The file is read by allowlist.** A key this version doesn't know is dropped at the next save,
  and a value out of range is pulled back into range.
- **It travels with plugin settings.** `data.json` sits in the vault's configuration folder, so a
  sync tool that copies plugin settings copies it between devices. When another device's copy
  arrives, a running plugin takes only its `setup` and `data` from it.

## Main page

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Garmin account | `email` | `""` | Who is signed in on this device, with a **Sign in** or **Sign out** button. The email is saved when a sign-in succeeds. |
| Sync on startup | `syncOnStartup` | off | Runs **Sync recent days** five seconds after Obsidian loads the plugin, when you are signed in. |
| Units | `units` | `auto` | `metric` writes `distance_km`, `imperial` writes `distance_mi`, and `auto` asks Garmin which system your account uses. |
| Map tiles | `mapTiles` | on | Draws OpenStreetMap's map under an activity's route, from `tile.openstreetmap.org`, which sees the area of each activity whose map you open. Off, the route is drawn on its own and no tile is requested. |

Below them, three rows open the sub-pages. Their descriptions are taken when the page is drawn:
**History** gives the data folder's size and whether the download is running, and **Metrics** how
many groups are on.

Your password is never stored. If the account has multi-factor authentication on, the sign-in asks
for the code as a second step. The code isn't stored either. Expect the challenge on every sign-in,
which happens only when there is no session to restore, not on every sync.

There is no setting for how far back **Sync recent days** reaches: see
[How Sync recent days picks its days](GUIDE.md#how-sync-recent-days-picks-its-days).

## History

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| On disk | — | — | What the data folder takes. |
| Day details | `data.dayDetails` | `90d` | How far back the history download fetches each day's file and timelines: `new` (New days only), `30d`, `90d`, `1y` or `all`. Every new day is kept whatever the range. Below it: how far back it reaches, and the days still missing with their size. |
| Activity details | `data.activityDetails` | `opened` | Which activities' pages the download fetches ahead, every sport: `opened` (Only activities I open), `90d`, `1y` or `all`. Below it: the activities left to download. |
| Data folder | `dataFolder` | `Garmin/data` | Where everything the sync writes goes, all of it JSON. Changing it doesn't move files already written. It can't be the vault's root, a folder whose name starts with a dot, or a folder inside the vault's settings folder. |
| Run setup again | — | — | **Open setup** runs the setup again: a fresh scan of your Garmin history, then the recommendation or **Advanced options**. |

**The setup recommends `all` for both ranges.** The defaults above are narrower on purpose: they also
stand in for a range `data.json` holds in a form this version can't read, and a fallback must never
widen a download already agreed to.

**Choosing a range agrees to it.** Its data set joins the consent ledger, and the download starts on
what is missing. Narrowing a range deletes nothing.

While the download has work to do, a card under **On disk** shows:
- what it is fetching, how far back it has got and the time left;
- **Pause**, then **Resume** once paused, or **Sign in** when the session ended.

Under it, **New data for your history** lists what an update offers that you haven't agreed to,
including what you put off with **Later**, with a **Download** button (see
[After an update](GUIDE.md#after-an-update)).

| Key | Holds |
| --- | --- |
| `setup` | `null` until the setup has run, then when it finished (`completedAt`). While it is `null`, enabling the plugin opens the setup, Home shows **Finish setting up**, and nothing downloads in the background. |
| `data.accepted`, `data.deferred` | the consent ledger: what you agreed to and what you put off, as `<store>@<version>` keys such as `days@1`, `activity-details@6` and `index:stress@1`. A key in neither list is asked about once. How the keys drive the download is in [Architecture](architecture.md#the-consent-ledger). |
| `data.runDetails` | the older Run details range, from before every sport had a page. It is still read when `data.activityDetails` is absent. |

## Metrics

One switch per metric group on the **Metrics** page, and all sixteen are on by default (`groups`).
Each row gives the group's name, what it holds, and what it costs:

| Group | On screen | Holds | Cost |
| --- | --- | --- | --- |
| `activity` | Activity | Steps, distance, calories, floors, intensity minutes | Free |
| `heart` | Heart rate | Resting, min and max | Free |
| `sleep` | Sleep | Stages, score, need, SpO2 | 1 request a day |
| `stress` | Stress and Body Battery | Levels, peaks, charge and drain | Free |
| `hrv` | HRV | Overnight average, status, baseline | 1 request a day |
| `readiness` | Training readiness | Score, recovery time, factors | 1 request a day |
| `fitness` | Fitness | VO2 Max, fitness age, endurance, hill score | 2 requests a day |
| `races` | Race predictions | 5K to marathon | 1 request a sync |
| `respiration` | Respiration | Waking average, low, high | Free |
| `spo2` | Pulse ox | Average, lowest, latest SpO2 | Free |
| `body` | Body composition | Weight, BMI, body fat, muscle, bone | 1 request a day |
| `training` | Training load | Status, load, focus, running tolerance | 1 request a day |
| `workouts` | Workouts | The day's activities | 1 request a sync |
| `intraday` | Intraday charts | Heart rate, stress, steps and sleep through the day | 6 requests a day |
| `health` | Health status | Overnight vitals against your baseline | 1 request a day |
| `profile` | Profile | Watch, thresholds, FTP, events, records | About 9 requests a sync; saved to `account.json` |

Each row also carries search aliases for what its line leaves out, so searching **lactate threshold**
finds **Profile** and **Health Snapshot** finds **Health status**.

What the costs mean:
- **"Free" groups.** `activity`, `heart`, `stress`, `respiration` and `spo2` all come out of one
  request, the daily summary. It is made once a day while any of the five is on, so switching off
  some of them saves nothing.
- **Per day.** With everything on, a day costs nine requests: the summary, sleep, HRV, readiness, two
  for fitness (endurance and fitness age), body composition, training status and Health Status.
- **`intraday`.** Spent on the days inside Day details, on every day **Sync a date range…** covers,
  and before the setup on the newest seven days of a sync.
- **Per sync.** `fitness`, `training` and `health` also make range calls once a sync: VO2 Max, hill
  score, running tolerance and Health Snapshots. Each history index tops itself up too. With
  everything on, that comes to about 30 requests a sync; the breakdown is in
  [Garmin API](garmin-api.md#request-budget).

A group also gates its pages. While it is off, nothing is fetched for them, but turning a group off
doesn't remove what it already wrote.

| Group | Pages |
| --- | --- |
| `activity` | Steps, Floors, Intensity Minutes |
| `workouts` | Activities, Training Effect, Cycling Power Curve, Critical Swim Speed |
| `sleep` | Sleep |
| `stress` | Stress, Body Battery |
| `heart` | Heart Rate |
| `respiration` | Respiration |
| `spo2` | Pulse Ox, Pulse Ox Acclimation |
| `body` | Weight, Blood Pressure |
| `fitness` | Fitness Age, VO₂ Max, Hill Score, Endurance Score, Heat Acclimation, FTP, Running Lactate Threshold, Running Economy |
| `health` | Health Status, Health Snapshot, Lifestyle Logging |
| `hrv` | HRV Status, HRV Stress |
| `readiness` | Training Readiness |
| `training` | Training Status, Load, Running Tolerance |
| `races` | Race Predictor |

Every key a group writes is in the [Data reference](properties.md).

### Upgrades

`settingsVersion` records which of these changes a vault has had; it is 5 today. When a release adds
a group, a vault saved before it gets the group switched on once. A group you switch off yourself
stays off, and an empty selection stays empty.

| Version | What it does |
| --- | --- |
| 2 | Switches on `respiration`, `spo2`, `body` and `training` |
| 3 | Switches on `intraday` |
| 4 | Switches on `health` and `profile` |
| 5 | Replaces `downloadRuns` with the details range: `all` if it was on, `opened` if not. A vault with a saved session counts as set up without running the setup: Day details `30d`, and the chart histories agreed to. It leaves Day details unagreed, so the first update dialog offers the recent days an older build saved without their timelines. |

## Advanced

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Region | `domain` | `garmin.com` | `garmin.cn` for mainland China accounts. It changes every Garmin host the plugin talks to, so changing it signs you out and rebuilds the client. The sign-in form has the same choice. |
| Sync speed | `syncSpeed` | `normal` | `gentle`, `normal` or `fast`: how hard a sync leans on Garmin. See below. |
| Stop after empty days | `stopAfterEmptyDays` | `45` | **Sync a date range…** gives up after this many days in a row with nothing in them; `0` walks the whole range. The slider runs 0–120 in steps of 5. A value typed into `data.json` may go up to 365. |

Under **Diagnostics**:

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Save diagnostics runs | `autoSaveLog` | off | Saves each **Run diagnostics** check that ends in a verdict as a note. Check 1, **Network fingerprint**, has no verdict and isn't saved. Off by default, because a log is about your account and the vault syncs. |
| Log folder | `logFolder` | `Garmin/diagnostics` | Where those notes, and **Save debug info**'s notes, go. Vaults set up before 0.2 keep the `garmin-probe-logs` they were given. The folder rules are the same as the data folder's. |

**Sync speed** paces every request to Garmin (syncs, the history download and pages loading on view)
and sets how many days a sync fetches at once:

| Speed | Pace | Days at once | 30-day sync | Hourly budget |
| --- | --- | --- | --- | --- |
| Gentle | about 8 requests a second | 1 | about 43 s | 2,500 |
| Normal (default) | about 20 | 3 | about 17 s | 5,000 |
| Fast | about 32 | 5 | about 12 s | 8,000 |

- **The hourly budget** applies to the history download on each device. It counts every request this
  device made in the hour, manual syncs and retries included, and is kept across restarts.
- **On a 429** the sync pauses for as long as Garmin asks, carries on at half the pace, and says so in
  its notice.
- **Why not faster?** Garmin was measured allowing at least 47 requests a second once, on one account,
  but every install looks alike to Garmin, so even Fast stays far below that (see
  [Request pace](garmin-api.md#request-pace)). New vaults start at Normal; a vault that saved Gentle
  keeps it.
- **Older vaults.** `syncSpeed` replaced `pauseBetweenDays`: a saved pause of 0 reads as Fast,
  1000 ms or more as Gentle, and anything else as Normal.

## Danger zone

The last group on **Advanced**:

| Setting | Key | Default | Effect |
| --- | --- | --- | --- |
| Delete synced data | — | — | **Delete…** asks first, with the size, the file count and a box to delete the diagnostics notes too. See below for what it removes. |

What **Delete…** does:
- **The plugin's own files** in the data folder go to the trash, then the folder itself once it is
  empty, and the folder above it (`Garmin`) if that is empty too. Anything else you keep in the data
  folder stays.
- **The diagnostics notes**, if you tick the box: the `garmin-probe-*.md` and `garmin-debug-*.md`
  notes in the **Log folder**.
- **The plugin starts over:** no setup, nothing agreed to, and Day details and Activity details back
  at their defaults. Nothing downloads the data straight back, and you stay signed in.

Which files count as the plugin's is in the [Data reference](properties.md#the-data-folder).
Deleted files go wherever Obsidian's **Files and links → Deleted files** setting sends them.

## Home's state

The `home` block in `data.json` belongs to Home, not to the settings tab:

| Key | Default | Meaning |
| --- | --- | --- |
| `preset` | `be-healthy` | Which of Garmin's three Home presets is showing: `be-healthy`, `stay-active` or `track-my-training`. |
| `hidden` | `[]` | Sections removed with their **Hide** link: `coachPlans` and `challenges`. |
| `glance` | absent | The At a Glance cards in order, once edited on **See All**: up to 20. Absent means the preset's own list. |

**Reset Home** picks a preset again, brings back hidden sections and returns At a Glance to the
preset's list. A card or section this version doesn't know is dropped on load.
