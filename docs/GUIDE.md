# Guide

How to use the plugin once it's [installed](INSTALLATION.md).

## 1. Sign in

Run **Sign in to Garmin Connect** from the command palette, or use the button in
**Settings → Connection**. Accounts on Garmin's China service set **Region** to
`garmin.cn` there first.

Your password is used for one request and never written anywhere. If your
account has MFA on, the same dialog asks for the code next: three tries before
the sign-in starts over.

## 2. Sync

| Command | What it does |
| --- | --- |
| **Sync recent days** | The last *N* days, 3 by default (**Settings → Sync → Days to sync**). Home's ↻ button runs the same thing. |
| **Sync today** | Just today. |
| **Sync a date range…** | Backfill. Shows the request count and time it will take before you start. |

Turn on **Sync on startup** to run **Sync recent days** shortly after Obsidian
loads.

### History

The pages read history files that a routine sync only keeps topped up. After the
first sync of a session, the plugin fills them by itself, one after the other,
for the groups that are on:
- activities;
- steps, floors and intensity minutes;
- sleep;
- each Health Stats and Performance Stats history.

A run cut short, by a rate limit or by closing Obsidian, keeps what it fetched
and carries on next time.

Until a page's history is complete it shows a banner — "Activity history isn't
synced", "Sleep history isn't synced" and so on — with a rough request count and
a **Sync history** button. Each history also has its own command (below).

## Where the data goes

Everything the sync writes is JSON in the data folder, `Garmin/data` by default
(**Settings → Storage → Data folder**). It writes no notes, so your own notes
are never touched, and every day is writable, so a backfill works from nothing.

Each day's numbers go into a file per year, `days/<year>.json`, keyed by date,
one day per line:

```json
{
	"version": 1,
	"year": 2026,
	"days": {
		"2026-09-12": {"steps":8432,"distance_km":6.21,"resting_hr":48,"sleep_hours":7.5,"sleep_score":82,"hrv_avg":42,"training_readiness":71}
	}
}
```

Every key, with its units, is in the [property reference](properties.md).

Versions before this kept each day as a note with the numbers as properties,
and generated a `Garmin Health.base` table view. The first load of a new build
copies those days into the day files; see the
[FAQ](FAQ.md#i-used-an-older-version-where-did-my-day-notes-go).

### History and series files

The pages need more than a day's summary can hold. These files sit beside
`days/` in the data folder:

| Path | Holds | Filled by the group |
| --- | --- | --- |
| `series/<date>.json` | A day's curves: heart rate, stress, Body Battery, steps, floors, intensity, the sleep hypnogram | `intraday` |
| `account.json` | Facts that belong to no day: the watch, personal records, lactate threshold, training plan | `profile` |
| `activities/` | Every activity on the account | `workouts` |
| `activity-details/` | One file per run whose page you opened, or every run with **Download runs** on: its samples, laps, zones, weather and GPS route | `workouts`, when the page opens or after a sync |
| `daily-stats/` | Steps, floors and intensity minutes | `activity` |
| `sleep/` | A row per night | `sleep` |
| `stress/`, `body-battery/` | Stress and Body Battery | `stress` |
| `heart-rate/` | Heart rate | `heart` |
| `respiration/` | Respiration | `respiration` |
| `pulse-ox/` | Pulse Ox and acclimation | `spo2` |
| `weight/`, `blood-pressure/` | Weigh-ins and readings | `body` |
| `fitness-age/` | Fitness Age | `fitness` |
| `health-status/` | Health Status | `health` |
| `vo2-max/` | VO₂ Max | `fitness` |
| `hill-score/` | Hill Score | `fitness` |
| `hrv-status/` | HRV Status; the night's readings go into that day's series file | `hrv` |
| `race-predictions/` | Race Predictor | `races` |
| `training-status/` | Training Status, and Load's Training Load tab | `training` |
| `endurance-score/` | Endurance Score | `fitness` |
| `heat-acclimation/` | Heat Acclimation, and Training Status's Heat Acclimation row | `fitness` |
| `training-readiness/` | Training Readiness; a day's every reading goes into that day's series file | `readiness` |
| `running-tolerance/`, `running-tolerance-weeks/` | Running Tolerance: a row a day for Current, Garmin's weeks for 12w and 1y | `training` |
| `ftp/` | FTP, and Running Lactate Threshold's power | `fitness` |
| `lactate-threshold/` | Running Lactate Threshold's heart rate and pace | `fitness` |

They are plain JSON written through Obsidian, so they sync like any other file.
They are rewritten only when their content changes.

## What gets collected

Sixteen metric groups, each switchable under **Settings → Metrics**, write
about two hundred values into the day files and fill the files above. Turning a group off stops
its requests, where it has any of its own:

| Groups | Cost |
| --- | --- |
| activity, heart, stress, respiration, spo2 | Nothing extra: one daily summary request serves all five |
| sleep, hrv, readiness, body, training, health | One request a day each |
| fitness | Two requests a day |
| races, workouts | One range request per sync, not per day |
| intraday | Six requests a day, for the newest seven days of a sync only |
| profile | About nine requests per sync, not per day |

Some groups also make range requests once per sync: fitness two (VO₂ max and
hill score), training two (running tolerance by day and by week) and health one
(Health Snapshots). The settings screen shows each group's cost beside its switch.

With everything on, a day costs nine requests. On top of that come the intraday
and per-sync requests, the history fills described above, and ten requests the
first time you open a run's page — or for every run, after a sync, with
**Download runs** on (see [Activities](#activities)).

## Home

**Open home**, or the ribbon icon, opens Home: a copy of Garmin Connect's home
screen, built so you can hold your phone next to it and check that every number
arrived.

- **Layout** in the header picks one of Garmin's three presets — **Be healthy**,
  **Stay active** or **Track my training** — with the cards the app gives each.
  **Reset Home** at the bottom opens the same choice, and brings back any section
  you hid with its **Hide** link.
- It shows today. Before today has synced it shows the newest synced day, and
  says so.
- The header's ↻ runs **Sync recent days**; **⋯** opens **More**, which holds
  **Activities** and **Health Stats**.
- Cards open their pages, as in the app:
  - Sleep, Steps and All Activities in In Focus;
  - the Sleep Coach row;
  - At a Glance's cards for Steps, Floors, Intensity Minutes, Sleep and the
    Health Stats.
- **See All** beside At a Glance opens its full page. Home shows the first eight
  stats; See All holds up to twenty. **Edit** there lets you:
  - remove a stat with its red badge;
  - move one: drag the card, drag its grip on a touch screen, or focus the grip
    and use the arrow keys;
  - pick more from **Add a Stat**, which lists Garmin's stats that aren't on the
    page yet.

  **Save** keeps the order; **Cancel** throws the edit away. Choosing a preset
  again puts the preset's own stats back.
- Stats Garmin has nothing for yet — blood pressure, hydration, nutrition and the
  like — show Garmin's own prompt card, as the app does. Challenges are not
  synced, so that section only ever shows Garmin's empty state.
- **Layout by pane width.**
  - A narrow pane gets the phone layout: In Focus swipes, with dots.
  - From 640px wide, In Focus and the bottom sections sit side by side and At a
    Glance runs four across.
  - From 1000px, three and six.
- Charts come from the series files and the header from `account.json`, so the
  **intraday** and **profile** groups need to be on.

## Activities

Garmin Connect's Activities section, under **More → Activities** or **Open
activities**.

- The hub lists Running, Cycling, Gym & Fitness Equipment, Swimming, Hiking,
  Multisport and Other, each sorted the way Garmin sorts them (yoga, stair
  climbing and mobility are Gym; walking and meditation are Other), then All
  Activities. The hub's last rows open Steps, Floors and Intensity Minutes.
- A sport's page has:
  - the sub-type picker in its title (All Running, Treadmill Running, Trail
    Running… — only the ones you have recorded);
  - **7d / 4w / 1y**, with **‹ ›** to step back and forward a whole period;
  - a tab per measure the app shows for that sport:

    | Sport | Measures |
    | --- | --- |
    | Running, cycling, hiking, multisport | Distance, Time, Ascent, Calories |
    | Gym | Time, Calories |
    | Swimming | Distance, Time |
    | Other | Time |

  Under the chart are the total and the daily, weekly or monthly averages, then
  the activities — or, over a year, one row a month, which opens that month.
- **View Personal Records** opens the records for that sport: Steps, Running,
  Cycling, Swimming and Strength, with every distance Garmin keeps a record for,
  whether you have one or not.
- **A run opens its page**: from its sport's page, a month, All Activities, a
  running record or Home's Today's Activity. It has the app's five tabs:
  - **Overview**: the route map and the weather, the headline figures,
    Evaluation (Primary Benefit, Feel, Perceived Effort), links to running
    records and all running activities, and the watch it was recorded on;
  - **Stats**: every figure the app lists, in its groups;
  - **Laps**;
  - **Charts**: pace, heart rate, elevation, power, stamina, performance
    condition, running dynamics, training effect, run/walk and time in zones,
    against **Time** or **Distance**;
  - **Gear**.

  A chart icon beside a figure opens its chart full size, where the chips lay a
  second measure over it. Tapped, the map opens full screen: it pans and zooms,
  and its layers button colours the route by another measure or hides the lap
  numbers. Other sports' rows don't open anything yet.
- The first time a run's page opens it costs ten requests, made between syncs,
  never during one. The answer is kept in `activity-details/`, so the page opens
  again without asking. It needs a session and the `workouts` group.
- **Download runs** under **Settings → Sync** fetches every run's page ahead,
  so it opens without a connection: after each sync, in the background, newest
  first, at least two seconds apart. A run is about 150 KB in the vault and ten
  requests, so 230 runs come to about 35 MB and 2,300 requests, spread over as
  many sessions as it takes. A page you open goes first, a sync waits for the run
  in hand, and a 429 stops the downloads until the next sync. The map's tiles
  aren't fetched ahead (OpenStreetMap's tile policy rules out bulk downloads):
  offline, a map draws the tiles that device viewed in the last week or so, and
  the route alone elsewhere.
- The map's tiles come from OpenStreetMap, which sees roughly where the run was.
  **Map tiles** under **Settings → Maps** turns them off, and the route is drawn
  on its own, as it is offline. A treadmill run has no map.
- The pages read the activity index (`activities/`). Filling it costs about one
  request per hundred activities; after that, routine syncs keep it current with
  the request they already make.
- Panes from 1000px wide put the controls on one row, the totals beside the chart
  and the lists three across. A run's page puts its map beside the figures, and
  its stats and charts three across.

## Steps, Floors and Intensity Minutes

Each opens from Home's cards, the Activities hub, or **Open steps**, **Open
floors** and **Open intensity minutes**. Each has **1d / 7d / 4w / 1y** and
**‹ ›**, and opens on today.

- **Steps.**
  - A day's ring against its goal; the distance walked or run (not ridden or
    swum, which is why it can be less than the day file's `distance_km`);
    calories; and the day's steps climbing through it.
  - A week or four weeks show each day against its goal, green when met, then
    the totals and the averages, which leave today out as the app does.
  - A year totals by the month or, with the toggle, by the week.
  - **View Personal Records** opens the Steps records.
- **Floors.** Climbed up from the line, descended below it, the goal dashed
  across. A year totals each week.
- **Intensity Minutes.** Vigorous minutes count double.
  - A day shows the week's total running through it.
  - A week shows its ring against the weekly goal.
  - Four weeks restart the total each Monday.
  - A year shows each week, green at goal.

  Weeks run Monday to Sunday, as they do in the app.
- A day in a list opens that day's page; **Back** returns to the list.
- **Where the data comes from.** The pages read the daily stats index
  (`daily-stats/`), whose whole history costs about 40 requests a year. Day
  charts come from the series files, so they cover days synced with the
  **intraday** group on.

## Sleep

From Home's sleep cards, **More → Health Stats → Sleep**, or **Open sleep**.
**1d / 7d / 4w / 1y**, with **‹ ›**.

- **A night** has two tabs:
  - **Sleep Score**: the score and its verdict, the stages ring, the timeline,
    and the factor cards (duration, stress, deep, light, REM, awake time), each
    opening its own page.
  - **Sleep Coach**: how much sleep the night called for and what adjusted it,
    with the Sleep History sheet.
- **Longer ranges** show:
  - the score and the metric averages;
  - duration against sleep need;
  - Sleep Consistency and Sleep Alignment (bed and wake times).
- **Where the data comes from.** The pages read the sleep index (`sleep/`),
  about 14 requests for a year of history. The night's timeline, factors and
  coach come from that day's series file.

## Health Stats

**More → Health Stats** lists Sleep and these pages, in the app's order. Each
also has an **Open …** command and opens from its At a Glance card. A page needs
its metric group on.

| Page | Ranges | Group |
| --- | --- | --- |
| Health Status | A day at a time; each metric opens a sheet | `health` |
| Lifestyle Logging | Garmin's empty state for now | `health` |
| Weight | 1d, 7d, 4w, 1y | `body` |
| Pulse Ox | 1d, 7d, 4w | `spo2` |
| Pulse Ox Acclimation | 7d, 4w | `spo2` |
| Respiration | 1d, 7d, 4w | `respiration` |
| Heart Rate | 1d, 7d, 4w, 1y | `heart` |
| Blood Pressure | 1d, 7d, 4w, 1y | `body` |
| Stress | 1d, 7d, 4w, 1y | `stress` |
| Body Battery | 1d, 7d, 4w | `stress` |
| Fitness Age | Current, 7d, 4w, 1y | `fitness` |
| Health Snapshot | A list of snapshots, each opening its detail | `health` |

**Where the data comes from.**
- Most pages read their own history index (see the table under
  [Where the data goes](#history-and-series-files)). A banner offers to fill it
  until it holds the whole history.
- A day page's curve comes from that day's series file. For a day older than
  the newest seven of a sync, the page fetches the curve when you open it, if
  you are signed in and the page's metric group is on.
- Health Snapshots are fetched when the page opens.

## Performance Stats

**More → Performance Stats** lists Garmin's performance pages in the app's
order, as each is rebuilt; so far:

| Page | Ranges | Group |
| --- | --- | --- |
| Training Status | Current, whose rows open VO₂ Max, HRV Status, Load and Heat Acclimation; 4w, 12w, 6m | `training` |
| Training Readiness | A day at a time, with a sheet for each of its six factors | `readiness` |
| HRV Status | 1d, 7d, 4w, with the Overnight Averages chip | `hrv` |
| Race Predictor | Current, 4w, 6m, 1y, a chip per distance | `races` |
| VO₂ Max | Current, 4w, 12w, 6m, for running and cycling | `fitness` |
| Training Effect | 7d, 4w, and a page per activity with its benefit and scales | `workouts` |
| FTP | Current, 4w, 12w, 1y, for cycling and cross country skiing, in Watts or W/kg | `fitness` |
| Running Tolerance | Current, 12w, 1y in Sunday weeks, with the Actual Distance chip | `training` |
| Running Lactate Threshold | Current, 4w, 12w, 1y: heart rate, with pace, power or W/kg on a chip | `fitness` |
| Endurance Score | 1d, 12w, 1y, each with a Top Contributors tab | `fitness` |
| Hill Score | 1d with its factors, 4w, 12w, 1y, and a month page | `fitness` |

Each has an **Open …** command and opens from its card on Home. Two pages are
not in the list and open from Training Status's rows instead:
- **Load**, also from Home's Load Focus and Training Load cards, with a tab
  each for Load Focus, Exercise Load and Training Load over the last four
  weeks;
- **Heat Acclimation**, also from Home's heat card: the day's acclimation and
  its trend, and 7d and 4w of daily progress.

The histories are cheap: a year of Garmin's data per request, about two or
three requests each for the whole history. Load and Training Effect keep none
of their own: they read Training Status's, the day files and the activity list. Cycling Ability
and Altitude Acclimation are left out for now.

## Commands

All are in the command palette under **Garmin Connect:**.

| Opens | Commands |
| --- | --- |
| Home and its sections | **Open home**, **Open activities**, **Open steps**, **Open floors**, **Open intensity minutes**, **Open sleep** |
| A Health Stats page | **Open health status**, **Open lifestyle logging**, **Open weight**, **Open pulse ox**, **Open pulse ox acclimation**, **Open respiration**, **Open heart rate**, **Open blood pressure**, **Open stress**, **Open body battery**, **Open fitness age**, **Open health snapshot** |
| Performance Stats | **Open performance stats**, **Open training status**, **Open training readiness**, **Open HRV status**, **Open race predictor**, **Open VO₂ max**, **Open training effect**, **Open FTP**, **Open running tolerance**, **Open running lactate threshold**, **Open endurance score**, **Open hill score** |

| Syncs | Commands |
| --- | --- |
| Days | **Sync recent days**, **Sync today**, **Sync a date range…** |
| A history | **Sync activity history**, **Sync step, floor and intensity history**, **Sync sleep history**, **Sync stress history**, **Sync heart rate history**, **Sync body battery history**, **Sync respiration history**, **Sync health status history**, **Sync fitness age history**, **Sync weight history**, **Sync pulse ox history**, **Sync blood pressure history**, **Sync VO₂ max history**, **Sync hill score history**, **Sync HRV status history**, **Sync race predictions history**, **Sync training status history**, **Sync endurance score history**, **Sync heat acclimation history**, **Sync training readiness history**, **Sync running tolerance history**, **Sync weekly running tolerance history**, **Sync FTP history**, **Sync lactate threshold history** |

| Other | What it does |
| --- | --- |
| **Sign in to Garmin Connect** | Signs in, asking for an MFA code if Garmin wants one |
| **Run diagnostics** | Four checks of sign-in and connectivity — see [Troubleshooting](troubleshooting.md#diagnostics) |

## How syncing behaves

- **Re-syncing is free on disk.** If nothing would change, the file isn't
  touched, which matters with Obsidian Sync.
- **It syncs more than one day on purpose.** Garmin keeps revising a day after
  it ends; sleep is finalised late.
- **It backs off rather than digging in.** A 429 or a dead session abandons the
  whole run. One endpoint failing for one day is just a warning, and the rest of
  that day still gets written.
- **It stops at the end of your history.** After 45 consecutive empty days
  (**Settings → Advanced → Stop after empty days**; 0 disables) a backfill gives
  up and says so. Nothing bogus is ever written.
- **Newest day first**, so a run cut short still covered the days you care
  about.

## Next

- Something broken → [Troubleshooting](troubleshooting.md)
- Every setting → [Settings reference](settings.md)
- Common questions → [FAQ](FAQ.md)
