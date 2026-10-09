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
- each Health Stats history.

A run cut short, by a rate limit or by closing Obsidian, keeps what it fetched
and carries on next time.

Until a page's history is complete it shows a banner — "Activity history isn't
synced", "Sleep history isn't synced" and so on — with a rough request count and
a **Sync history** button. Each history also has its own command (below).

## Where the data goes

**Settings → Storage → Where to put the data** picks the mode:

| Mode | Behaviour |
| --- | --- |
| **Data folder** (default) | One note per day, `Garmin/data/<date>.md`. Never touches notes you wrote, and every day is writable, so a backfill works from nothing. |
| **Daily notes** | Properties go into your existing daily notes, prefixed `garmin_`. It writes only to notes that already exist unless you turn on **Create missing notes**. |
| **Both** | Writes to each. |

A day note carries the day's numbers as frontmatter properties:

```yaml
---
date: 2026-09-12
steps: 8432
distance_km: 6.21
resting_hr: 48
sleep_hours: 7.5
sleep_score: 82
hrv_avg: 42
training_readiness: 71
---
```

Every property, with units and query examples, is in the
[property reference](properties.md).

### The table view

The first sync that writes something also creates a Bases table,
`Garmin/Garmin Health.base`, so the notes read as one sortable table. It is
created once and then left alone, so columns you change by hand survive. **Rebuild
the table view** regenerates it from the current settings. In daily-notes mode
there is no table view.

### History and series files

The pages need more than a note per day can hold. These files sit under the data
folder (`Garmin/data` by default) whatever the storage mode:

| Path | Holds | Filled by the group |
| --- | --- | --- |
| `series/<date>.json` | A day's curves: heart rate, stress, Body Battery, steps, floors, intensity, the sleep hypnogram | `intraday` |
| `account.json` | Facts that belong to no day: the watch, personal records, lactate threshold, training plan | `profile` |
| `activities/` | Every activity on the account | `workouts` |
| `daily-stats/` | Steps, floors and intensity minutes | `activity` |
| `sleep/` | A row per night | `sleep` |
| `stress/`, `body-battery/` | Stress and Body Battery | `stress` |
| `heart-rate/` | Heart rate | `heart` |
| `respiration/` | Respiration | `respiration` |
| `pulse-ox/` | Pulse Ox and acclimation | `spo2` |
| `weight/`, `blood-pressure/` | Weigh-ins and readings | `body` |
| `fitness-age/` | Fitness Age | `fitness` |
| `health-status/` | Health Status | `health` |

They are plain JSON written through Obsidian, so they sync like any other file.
They are rewritten only when their content changes.

## What gets collected

Sixteen metric groups, each switchable under **Settings → Metrics**, write
about two hundred properties and fill the files above. Turning a group off stops
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
hill score), training and health one each (running tolerance, Health
Snapshots). The settings screen shows each group's cost beside its switch.

With everything on, a day costs nine requests. On top of that come the intraday
and per-sync requests, and the history fills described above.

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
- Activity rows don't open anything yet: there is no activity detail screen.
- The pages read the activity index (`activities/`). Filling it costs about one
  request per hundred activities; after that, routine syncs keep it current with
  the request they already make.
- Panes from 1000px wide put the controls on one row, the totals beside the chart
  and the lists three across.

## Steps, Floors and Intensity Minutes

Each opens from Home's cards, the Activities hub, or **Open steps**, **Open
floors** and **Open intensity minutes**. Each has **1d / 7d / 4w / 1y** and
**‹ ›**, and opens on today.

- **Steps.**
  - A day's ring against its goal; the distance walked or run (not ridden or
    swum, which is why it can be less than the note's `distance_km`);
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

## Commands

All are in the command palette under **Garmin Connect:**.

| Opens | Commands |
| --- | --- |
| Home and its sections | **Open home**, **Open activities**, **Open steps**, **Open floors**, **Open intensity minutes**, **Open sleep** |
| A Health Stats page | **Open health status**, **Open lifestyle logging**, **Open weight**, **Open pulse ox**, **Open pulse ox acclimation**, **Open respiration**, **Open heart rate**, **Open blood pressure**, **Open stress**, **Open body battery**, **Open fitness age**, **Open health snapshot** |

| Syncs | Commands |
| --- | --- |
| Days | **Sync recent days**, **Sync today**, **Sync a date range…** |
| A history | **Sync activity history**, **Sync step, floor and intensity history**, **Sync sleep history**, **Sync stress history**, **Sync heart rate history**, **Sync body battery history**, **Sync respiration history**, **Sync health status history**, **Sync fitness age history**, **Sync weight history**, **Sync pulse ox history**, **Sync blood pressure history** |

| Other | What it does |
| --- | --- |
| **Rebuild the table view** | Regenerates `Garmin Health.base` from the current settings |
| **Sign in to Garmin Connect** | Signs in, asking for an MFA code if Garmin wants one |
| **Run diagnostics** | Four checks of sign-in and connectivity — see [Troubleshooting](troubleshooting.md#diagnostics) |

## How syncing behaves

- **A day with nowhere to go costs nothing.** Whether a day is writable is
  decided before any request is made.
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
