# Guide

How to use the plugin once it's [installed](INSTALLATION.md).

## 1. Set up

Enabling the plugin in a vault not set up yet opens Home with the setup over it.
The setup also opens from **Set up Garmin Connect…** in the command palette,
Home's **Finish setting up** card and **Settings → Data → Run setup again**. It
has four steps:

1. **Sign in.** Your password is used for one request and never written
   anywhere. If your account has MFA on, the same form asks for the code next:
   three tries before the sign-in starts over. Signed in already, the setup
   starts at the scan.
2. **Scan.** A few requests find where your Garmin history starts and how much
   of it there is: the watch's last upload, your activities and the oldest of
   them, and the weeks with health data. The result is kept in `scan.json`.
   While you choose, the recent days sync in the background.
3. **Choose** what to keep: the three data sets below, each with its size, how
   long it takes and what it adds a year, and the **Sync speed**.
4. **Start download** fetches it in the background. **Keep new days only**
   fetches no history at all; **Settings → Data** can add it later.

Accounts on Garmin's China service close the setup, set **Region** to
`garmin.cn` in **Settings → Connection**, and run it again from **Settings →
Data**.

To sign in again later without the rest, run **Sign in to Garmin Connect**, or
use the button in **Settings → Connection**.

## 2. Sync

| Command | What it does |
| --- | --- |
| **Sync recent days** | Everything since the last recent sync, from the day before through today; at least yesterday and today, at most 30 days (see [settings](settings.md#sync)). Home's ↻ button runs the same thing. |
| **Sync today** | Just today. |
| **Sync a date range…** | Any stretch of days, by hand. Shows the request count and time it will take before you start. |

Turn on **Sync on startup** to run **Sync recent days** shortly after Obsidian
loads.

### What to keep

The setup offers three data sets; **Settings → Data** changes them later. The
sizes were measured on a real vault, with every metric group on:

| Data set | Holds | How far back | About |
| --- | --- | --- | --- |
| **Charts & trends** | Every stat's 7d, 4w and 1y charts, the activity list and the sleep scores: the history indexes | All history, always | 0.9 MB and 150 requests a year of history |
| **Day details** | Each day's file and its timelines: heart rate, stress, Body Battery, steps, floors and sleep stages through the day | **New days only**, **Last 30 days**, **Last 90 days** (the default), **Last year** or **All history** | 44 KB and 15 requests a day |
| **Activity details** | An activity's page, every sport: map, charts, splits and laps | **Only activities I open** (the default), **Last 90 days**, **Last year** or **All activities** | up to 150 KB and 8 to 11 requests an activity |

A range only says how far back the download goes. Every new day is kept with
its timelines whatever the range (timelines need the **intraday** group), and an
activity's page downloads the first time you open it.

### The history download

What you agreed to downloads in the background, about ten seconds of work at a
time: the activity list first, then the chart histories a year at a time, then
Day details and Activity details, newest first. Nothing fetches your history unless
you agreed to it, in the setup or in the update dialog below.

- A sync, or a page loading what it needs, always goes first.
- It stays under an hourly request budget on each device, counting manual syncs
  too: 2,500 at Gentle **Sync speed** (the default), 5,000 at Normal, 8,000 at
  Fast.
- A 429 pauses it for five minutes, doubling each time up to an hour; Garmin's
  bot check refusing the device, half an hour, doubling up to twelve. A session
  that ended pauses it until you sign in again.
- It carries on after a restart, from what the files say is still missing. On a
  phone it stops while Obsidian is in the background.
- With the same vault on two devices, one downloads and the other leaves it
  alone, until the first has been quiet for ten minutes.

It shows on **Home**, under the title ("Downloading history · 42% · Mar 2025",
with a pause button, then "History up to date"), in **Settings → Data**, and on
a computer in the status bar ("Garmin · history 42%"), which opens the
settings. **Pause** holds it on every device until **Resume**.

Until a page's history is complete it shows a banner — "Activity history isn't
synced", "Sleep history isn't synced" and so on — with a rough request count and
a **Sync history** button, which fetches it at once. Each history also has its
own command (below).

### After an update

An update that can fill in more of your history — a page with a history of its
own, or more detail for days you keep — asks once, the first time a Garmin page
opens after it while you are signed in. **New data for your history** lists each
item with its size and time, ticked. **Download now** fetches the ticked ones in
the background; **Later** puts them off. Either way it doesn't ask again, and
**Settings → Data** lists what is still on offer, with a **Download** button.

What you already agreed to needs no question: new days, and gaps in your Day
details and Activity details ranges, keep filling. Only what an older version saved
is asked about again. A **Run details** range chosen before every sport had a page
keeps your runs coming; the other sports, and the runs saved before, wait for one
**Download now**.

## Where the data goes

Everything the sync writes is JSON in the data folder, `Garmin/data` by default
(**Settings → Data → Data folder**). It writes no notes, so your own notes
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
| `activity-details/` | One file per activity whose page you opened, and each activity in the **Activity details** range: its samples, laps, zones, weather, sensors, badges and GPS route | `workouts`, when the page opens or by the history download |
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
| `running-economy/` | Running Economy | `fitness` |
| `critical-swim-speed/` | Critical Swim Speed | `workouts` |
| `hrv-stress/` | HRV Stress | `hrv` |

A few small files keep the sync's own bookkeeping:

| Path | Holds | Written by |
| --- | --- | --- |
| `sync-state.json` | Where the last **Sync recent days** got to: its mark | **Sync recent days** |
| `scan.json` | Where your Garmin history starts and ends, as the scan found it | the setup |
| `backfill.json` | Whether the history download is paused, and which device runs it | the history download |
| `days/index.json` | Which days' details were fetched whole, and by which version of Day details | every sync and the history download |
| `activity-details/index.json` | The version of each activity's file | each activity's page as it is saved |

They are plain JSON written through Obsidian, so they sync like any other file.
With Obsidian Sync that needs **Sync all other types**, which is off by default.
Without it the data stays on the device that fetched it, and Home on another
device says "No Garmin data on this device". The files are rewritten only when
their content changes, and a sync writes each `days/<year>.json` once, after
its days are in.

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
| intraday | Six requests a day, for the days inside Day details, and for every day of **Sync a date range…** (before the setup, the newest seven days of a sync) |
| profile | About nine requests per sync, not per day |

Some groups also make range requests once per sync: fitness two (VO₂ max and
hill score), training two (running tolerance by day and by week) and health one
(Health Snapshots). The settings screen shows each group's cost beside its switch.

With everything on, a day costs nine requests. On top of that come the intraday
and per-sync requests, the history download described above, and eight to
eleven requests the first time you open an activity's page, or for each activity
in the **Activity details** range (see [Activities](#activities)).

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
- Above everything else it shows the [history download](#the-history-download)
  while there is one, and a card when something stands in the way: **Finish
  setting up**, **Sign in to Garmin Connect**, or **No Garmin data on this
  device** when the settings reached this device but the data folder did not.
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
  whether you have one or not. A record opens the activity that set it.
- The pages read the activity index (`activities/`). Filling it costs about one
  request per hundred activities; after that, routine syncs keep it current with
  the request they already make.
- Panes from 1000px wide put the controls on one row, the totals beside the chart
  and the lists three across.

### All Activities

Garmin's list of every activity, from the hub or Home's All Activities card.

- **Search** stays at the top while the list scrolls. It finds what you type
  anywhere in an activity's name, whatever the case and accents: "cafe" finds
  "Café". An activity without a name goes by its sport's.
- The filter button beside the title opens **Filters**, and shows a dot while a
  filter is on. Each filter in force is a chip under the search, whose × removes
  that filter alone.
- Then the count, exact ("341 ACTIVITIES"), and **Sort**: Newest First, Oldest
  First, A to Z or Z to A.
- Each card has the sport's coloured disc and figure, the name, the date, and
  the distance, or the time for an activity without one. A swim's distance is in
  whole metres, or yards for a yard pool. The cards run one, two or three across
  as the pane widens, and load sixty at a time as you scroll.
- **Filters** has:
  - **Activities**: Garmin's groups in its order, the first five and then
    **Show All**; tick **All <Group>** or any of its sub-types;
  - **Date Range**: a start and an end, picked on a calendar whose title opens
    month and year pickers;
  - **Distance** and **Time**: a slider each, or a typed minimum and maximum;
    the slider's end, 150+ km or 24h+, sets no limit;
  - **Total Ascent**: a minimum and a maximum;
  - **Event Type**: Race, Training, Transportation and Garmin's other types,
    several at once if you like;
  - **Favorite Activities** and **Personal Records**.

  Its footer counts what the choices would list as you make them ("Show 28
  Activities"), and **Clear All** empties them. The search and the sort stay as
  they are.
- It filters the activity index, so it sends no request. The search, sort and
  filters belong to the page: Back from an activity, or a restart, keeps them.
- Favourites and records are as of the last listing: a sync refreshes the
  newest activities, **Sync activity history** the rest. Garmin's own count can
  be one higher than the plugin's, when it counts a multisport leg the index
  leaves out.

### An activity's page

Every activity opens its page, whatever the sport: from All Activities, a
sport's page or a month, Personal Records, Home's Today's Activity, Load's
Exercise Load list, Training Effect's related activity and the Cycling Power
Curve's record dates. Each page has the app's five tabs, **Overview**,
**Stats**, **Laps**, **Charts** and **Gear**, filled as the app fills them for
that sport:

- **A run**:
  - **Overview**: the route map and the weather, the headline figures,
    Evaluation (Primary Benefit, Feel, Perceived Effort), links to running
    records and all running activities, and the watch it was recorded on;
  - **Stats**: every figure the app lists, in its groups;
  - **Laps**;
  - **Charts**: pace, heart rate, elevation, power, stamina, performance
    condition, running dynamics, training effect, run/walk and time in zones,
    against **Time** or **Distance**;
  - **Gear**.
- **A ride** colours its route by power zone, from Less Power to More Power.
  Under the map come Distance, Total Time, Avg Speed, Total Ascent and Avg
  Power, and under Devices & Apps the sensors it used ("Rally 100/200", with
  their firmware and battery). Stats has sixteen sections, among them Power
  (normalized power, Intensity Factor, Training Stress Score, FTP, work) and
  Cycling Dynamics (time and power seated and standing, the power phases, the
  platform centre offset). Laps gives Avg Speed rather than pace, and a Total
  row. Charts has twenty cards, among them Position, Time in Position, the Power
  Phase and Balance dials, Platform Offset, the seven power zones, and the Power
  Curve against your record in W or W/kg. Full size, a chart offers up to
  fifteen others to lay over it.
- **A pool swim** has no map. Laps is Garmin's interval table, **Int**, rests
  included, with a Total. Charts draws each length as a bar, for pace per 100 m,
  strokes and Swolf, against **Time** or **Distance**, then heart rate, Training
  Effect and the zones.
- **An open-water swim** draws its route in red, with the weather. Its charts
  are pace, strokes a minute and temperature, then heart rate, Training Effect
  and the zones.
- **Every other sport** gets the sections the sports share, as the app draws a
  Stair Stepper session, each only with data: pace and speed, timing, heart
  rate, Training Effect, Nutrition & Hydration and the rest; laps with a Total;
  and charts of heart rate, Training Effect and the zones, with pace and
  elevation for an activity that moved. Without a distance the big figure is
  Total Time, and Charts has no **Time** / **Distance** switch. Garmin's own
  placeholders show as the app shows them: "0:00 /km" for a pace that never
  moved, "-- m" for an ascent not measured.

Every Overview shows the badges the activity earned and the sensors it recorded
with, when it has any. A chart icon beside a figure opens its chart full size,
where the chips lay a second measure over it. Tapped, the map opens full screen:
it pans and zooms, and its layers button colours the route by another measure or
hides the lap numbers. **All <Group> Activities**, under Navigation, opens the
hub's page for the activity's group, or All Activities filtered to the group
where the hub has none: "All Walking Activities" under a walk.

- The first time an activity's page opens it costs eight to eleven requests
  (a run with power or a ride eleven, a pool swim or yoga eight), made between
  syncs, never during one. The answer is kept in `activity-details/`, so the page
  opens again without asking. It needs a session and the `workouts` group. A
  run's page saved before every sport had one asks two requests more, once.
- **Activity details**, in the setup or **Settings → Data**, fetches the pages
  of the activities in its range ahead, so they open without a connection: in
  the history download, newest first, at least two seconds apart. A run is about
  150 KB in the vault and eleven requests, so 230 runs come to about 35 MB and
  2,500 requests. A page you open goes first, and a sync waits only for the
  activity in hand. The map's tiles aren't fetched ahead (OpenStreetMap's tile
  policy rules out bulk downloads): offline, a map draws the tiles that device
  viewed in the last week or so, and the route alone elsewhere.
- The map's tiles come from OpenStreetMap, which sees roughly where the
  activity was. **Map tiles** under **Settings → Maps** turns them off, and the
  route is drawn on its own, as it is offline. An activity without GPS, such as
  a treadmill run or a pool swim, has no map.
- Panes from 1000px wide put an activity's map beside its figures, and its stats
  and charts three across.

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
  charts come from the series files, so they cover the days inside Day details,
  synced with the **intraday** group on.

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
- A day page's curve comes from that day's series file. For a day whose file
  doesn't have it, such as one older than your Day details range, the page
  fetches the curve when you open it, if you are signed in and the page's
  metric group is on.
- Health Snapshots are fetched when the page opens.

## Performance Stats

**More → Performance Stats** lists Garmin's performance pages in the app's
order:

| Page | Ranges | Group |
| --- | --- | --- |
| Training Status | Current, whose rows open VO₂ Max, HRV Status, Load and Heat Acclimation; 4w, 12w, 6m | `training` |
| Training Readiness | A day at a time, with a sheet for each of its six factors | `readiness` |
| HRV Status | 1d, 7d, 4w, with the Overnight Averages chip | `hrv` |
| Race Predictor | Current, 4w, 6m, 1y, a chip per distance | `races` |
| VO₂ Max | Current, 4w, 12w, 6m, for running and cycling | `fitness` |
| Running Economy | Current, 4w, 12w, 1y, with the average and the best (lower is better) | `fitness` |
| Training Effect | 7d, 4w, and a page per activity with its benefit and scales | `workouts` |
| Cycling Power Curve | 4w, 3m, 1y: your best power by duration against the all-time Record, and the records table | `workouts` |
| FTP | Current, 4w, 12w, 1y, for cycling and cross country skiing, in Watts or W/kg | `fitness` |
| Critical Swim Speed | Current, 7d, 12w, 1y, with the results table; Garmin's empty state until you have a CSS result | `workouts` |
| Running Tolerance | Current, 12w, 1y in Sunday weeks, with the Actual Distance chip | `training` |
| Running Lactate Threshold | Current, 4w, 12w, 1y: heart rate, with pace, power or W/kg on a chip | `fitness` |
| Endurance Score | 1d, 12w, 1y, each with a Top Contributors tab | `fitness` |
| Hill Score | 1d with its factors, 4w, 12w, 1y, and a month page | `fitness` |
| HRV Stress | 7d, 4w; Garmin's empty state until you take an HRV stress test | `hrv` |

Each has an **Open …** command and opens from its card on Home. Two pages are
not in the list and open from Training Status's rows instead:
- **Load**, also from Home's Load Focus and Training Load cards, with a tab
  each for Load Focus, Exercise Load and Training Load over the last four
  weeks;
- **Heat Acclimation**, also from Home's heat card: the day's acclimation and
  its trend, and 7d and 4w of daily progress.

The histories are cheap: a year of Garmin's data per request, about two or
three requests each for the whole history. Load, Training Effect and Cycling
Power Curve keep none of their own: they read Training Status's, the day files
and the activity list. Cycling Ability
and Altitude Acclimation are left out for now.

## Commands

All are in the command palette under **Garmin Connect:**.

| Opens | Commands |
| --- | --- |
| Home and its sections | **Open home**, **Open activities**, **Open steps**, **Open floors**, **Open intensity minutes**, **Open sleep** |
| A Health Stats page | **Open health status**, **Open lifestyle logging**, **Open weight**, **Open pulse ox**, **Open pulse ox acclimation**, **Open respiration**, **Open heart rate**, **Open blood pressure**, **Open stress**, **Open body battery**, **Open fitness age**, **Open health snapshot** |
| Performance Stats | **Open performance stats**, **Open training status**, **Open training readiness**, **Open HRV status**, **Open race predictor**, **Open VO₂ max**, **Open running economy**, **Open training effect**, **Open cycling power curve**, **Open FTP**, **Open critical swim speed**, **Open running tolerance**, **Open running lactate threshold**, **Open endurance score**, **Open hill score**, **Open HRV stress** |

| Syncs | Commands |
| --- | --- |
| Days | **Sync recent days**, **Sync today**, **Sync a date range…** |
| A history | **Sync activity history**, **Sync step, floor and intensity history**, **Sync sleep history**, **Sync stress history**, **Sync heart rate history**, **Sync body battery history**, **Sync respiration history**, **Sync health status history**, **Sync fitness age history**, **Sync weight history**, **Sync pulse ox history**, **Sync blood pressure history**, **Sync VO₂ max history**, **Sync hill score history**, **Sync HRV status history**, **Sync race predictions history**, **Sync training status history**, **Sync endurance score history**, **Sync heat acclimation history**, **Sync training readiness history**, **Sync running tolerance history**, **Sync weekly running tolerance history**, **Sync FTP history**, **Sync lactate threshold history**, **Sync running economy history**, **Sync critical swim speed history**, **Sync HRV stress history** |

| Other | What it does |
| --- | --- |
| **Set up Garmin Connect…** | Opens the setup: sign in, scan your account, choose what to keep |
| **Sign in to Garmin Connect** | Signs in, asking for an MFA code if Garmin wants one |
| **Stop syncing** | Stops the sync or history walk you started, after the day it is on, keeping what came in |
| **Pause the history download** / **Resume the history download** | What the pill and Settings → Data do |
| **Run diagnostics** | Four checks of sign-in and connectivity — see [Troubleshooting](troubleshooting.md#diagnostics) |

## How syncing behaves

- **Re-syncing is free on disk.** If nothing would change, the file isn't
  touched, which matters with Obsidian Sync.
- **It syncs more than one day on purpose.** Garmin keeps revising a day after
  it ends; sleep is finalised late.
- **It backs off rather than digging in.** A 429, Garmin's bot check refusing
  the device, or a dead session abandons the whole run. One endpoint failing for
  one day is just a warning, and the rest of that day still gets written. A
  request that goes unanswered for a minute counts as failed, so one stalled
  connection can't hold the sync forever.
- **It stops at the end of your history.** After 45 consecutive empty days
  (**Settings → Advanced → Stop after empty days**; 0 disables) **Sync a date
  range…** gives up and says so. The history download needs no such guard: the
  scan found where your history starts. Nothing bogus is ever written.
- **Newest day first**, so a run cut short still covered the days you care
  about.

## Next

- Something broken → [Troubleshooting](troubleshooting.md)
- Every setting → [Settings reference](settings.md)
- Common questions → [FAQ](FAQ.md)
