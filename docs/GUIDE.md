# Guide

How to use the plugin once it's [installed](INSTALLATION.md): set it up, sync, choose what to keep,
and find your way around the pages.

## Set up

Enabling the plugin in a vault that isn't set up opens Home with the setup over it. The setup also
opens from **Garmin Connect: Set up…** in the command palette, from Home's **Finish setting up**
card, and from **Settings → Data → Run setup again**. It has four steps:

1. **Sign in.** Your password is used for the sign-in and never stored. If your account has MFA on,
   the same form asks for the code next, with three tries before the sign-in starts over. Accounts
   on Garmin's China service choose **garmin.cn** under **Region** first.
2. **Scan.** A few requests find where your Garmin history starts and how much there is: the watch's
   last upload, your activities and the oldest of them, and the weeks with health data. The result is
   kept in `scan.json`. Before showing the result it also downloads your activity list, and while
   you choose, it syncs your recent days in the background.
3. **Choose** what to keep: the three [data sets](#what-to-keep), each with its size and time (Day
   details also with what it adds a year), then a total, plus the **Sync speed**.
4. **Start download** fetches your history in the background. **Keep new days only** fetches no
   more history than the scan already did; **Settings → Data** can add more later.

Already signed in, the setup starts at the scan. To sign in again without the rest, run **Sign in
to Garmin Connect** or use the button in **Settings → Connection**.

## Syncing

| Command | What it does |
| --- | --- |
| **Sync recent days** | Everything since the watch's last upload as of the last recent sync, from the day before it through today. The view's ↻ button runs the same thing. |
| **Sync today** | Just today. |
| **Sync a date range…** | Any stretch of days, back as far as 2010, with each day's timelines. Shows the request count and the time it will take before you start. |

Turn on **Sync on startup** to run **Sync recent days** five seconds after Obsidian loads the
plugin. There is no background interval: data refreshes when you sync.

### How Sync recent days picks its days

Garmin keeps revising a day after it ends: sleep is finalised late, and a watch that syncs in the
morning rewrites yesterday. So a recent sync always covers at least yesterday and today.

- **The mark** is the watch's last upload as Garmin reported it at the last recent sync, not the
  time of that sync. A watch left offline for four days keeps the mark where it was, however often
  you sync. The sync after it uploads covers all four days.
- **The first sync** covers three days. The history download fills in the rest.
- **After a gap longer than 30 days** it covers the last 30 and says so. **Sync a date range…**
  covers the days before.
- **A sync cut short** by a rate limit or a dead session leaves the mark where it was, so the next
  one covers its oldest days again.
- **The mark lives in `<dataFolder>/sync-state.json`;** delete the file to start over. **Sync today**
  and **Sync a date range…** leave it alone.

### Good to know

- **Re-syncing is free on disk.** A file is rewritten only when its content changes, which matters
  with Obsidian Sync.
- **Newest day first,** so a sync cut short has already covered the days you care about.
- **It backs off rather than digging in.**
  - A 429, Garmin's bot check refusing the device, or a dead session ends the whole run.
  - One endpoint failing for one day is just a warning, and the rest of the day is still written.
  - A request unanswered for a minute counts as failed.
- **It stops at the end of your history.** **Sync a date range…** gives up after 45 empty days in a
  row (**Settings → Advanced → Stop after empty days**; 0 turns it off) and says where it stopped.
  Nothing bogus is ever written: a day with no usable numbers is skipped, not stored as zeroes.

## What to keep

The setup offers three data sets, and **Settings → Data** changes them later. The sizes were
measured on a real vault with every metric group on.

| Data set | Holds | How far back | About |
| --- | --- | --- | --- |
| **Charts & trends** | every page's 7-day, 4-week and 1-year history: the activity list, sleep, and each stat's daily history | all your history, always | 0.9 MB and 150 requests a year of history |
| **Day details** | each day's file and its timelines (heart rate, stress, Body Battery, steps, floors and sleep stages through the day) | **New days only**, **Last 30 days**, **Last 90 days** (default), **Last year** or **All history** | 44 KB and 15 requests a day, about 16 MB a year |
| **Activity details** | an activity's page, every sport: map, charts, splits and laps | **Only activities I open** (default), **Last 90 days**, **Last year** or **All activities** | about 150 KB and up to 11 requests a run; less for most other sports |

A range says only how far back the download goes. Every new day is kept with its timelines whatever
the range (timelines need the **intraday** group), and an activity's page downloads the first time
you open it. Narrowing a range deletes nothing.

## The history download

What you agreed to downloads in the background, about ten seconds of work at a time. It goes in this
order:
1. the activity list;
2. the chart histories, a year at a time;
3. Day details and Activity details, newest first.

Apart from the activity list the setup's scan reads, nothing downloads your history in the
background unless you agreed to it: in the setup, the update dialog or **Settings → Data**. The
**Sync … history** commands and a page's **Sync history** button fetch when you ask.

- **A sync, or a page loading what it needs, always goes first.**
- **It stays under an hourly request budget on each device,** manual syncs included: 2,500 requests
  at Gentle **Sync speed** (the default), 5,000 at Normal, 8,000 at Fast.
- **When Garmin pushes back:**
  - a 429 pauses it for 5 minutes, doubling each time up to an hour;
  - Garmin's bot check refusing the device pauses it for half an hour, doubling up to twelve hours;
  - a session that ended pauses it until you sign in again.
- **It carries on after a restart,** from what the files say is still missing. On a phone it can't
  run while Obsidian is in the background.
- **One device downloads at a time.** With the same vault on two devices, one downloads and the
  other leaves it alone until the first has been quiet for ten minutes.

It shows on **Home** under the title, for example "Downloading history · 42% · Mar 2025" with a pause
button, then "History up to date". It also shows in **Settings → Data**, and on a computer in the
status bar ("Garmin · history 42%"), which opens the settings. **Pause** holds it on every device
until **Resume**. What each state means is in
[Troubleshooting](troubleshooting.md#the-history-download-is-paused).

Until a page's history is complete, the page shows a banner such as "Sleep history isn't synced",
with a rough request count and a **Sync history** button that fetches it at once. Each history also
has its own command (see [Commands](#commands)).

## After an update

An update that can fill in more of your history asks once, the first time a Garmin page opens after
it while you are signed in. That covers a page with a history of its own, or more detail for days you
keep.
- **The dialog.** **New data for your history** lists each item, ticked, with its size and time, or
  its request count for a small one.
  **Download now** fetches the ticked items in the background; **Later** puts them off.
- **After either choice** it doesn't ask again. **Settings → Data** lists what is still on offer,
  with a **Download** button.

What you already agreed to needs no question: new days and the gaps in your Day details and Activity
details ranges keep filling. Only what an older version saved is offered again.

## Where the data goes

Everything the sync writes is plain JSON in the data folder, `Garmin/data` by default (**Settings →
Data → Data folder**). It writes no notes, so your own notes are never touched.
- Each day's numbers go into a file per year, `days/<year>.json`.
- The pages' histories and timelines sit beside them.

Every file and key is in the [Data reference](properties.md).

> [!IMPORTANT]
> With Obsidian Sync, turn on **Sync all other types** (off by default) so the JSON reaches your
> other devices. Without it the data stays on the device that fetched it.

## Metric groups

Sixteen metric groups, each a switch under **Settings → Metrics**, decide what is fetched. With
everything on, a day costs nine requests, plus six for its timelines inside Day details, plus about
30 per sync. Each group's cost and pages are in [Settings → Metrics](settings.md#metrics).

## Home

**Open home**, or the ribbon icon, opens Home, from whichever page the view was on: a copy of Garmin
Connect's home screen, built so you can hold your phone next to it and check that every number
arrived.

- **Getting around.** In a wide pane, a rail down the left lists **Home**, **Activities**,
  **Health Stats** and **Performance Stats**. The area you're in opens to its pages, with the page
  you're on lit, so any page is one click away. **«** collapses the rail to its icons, and **»**
  brings it back. Below 1000 px it starts collapsed.
- **↻** runs **Sync recent days**. In a wide pane it sits at the top right of every page, beside
  **Layout** on Home, with the last sync's result before it.
- **On a phone** the four areas are tabs across the top of Home and of each area's own page, next
  to ↻. Deeper pages keep Back and their title.
- **Obsidian's tab** is named after the area you're in: **Garmin Home**, **Garmin Health Stats**,
  and so on.
- **Layout** in the header picks one of Garmin's three presets: **Be healthy**, **Stay active** or
  **Track my training**, each with the cards the app gives it. **Reset Home**, at the bottom, opens
  the same choice and brings back any section you hid with its **Hide** link.
- **It shows today.** Before today has synced, it shows the newest synced day and says so.
- **The history download** shows above everything else while it runs.
- **A card shows when something is in the way:**

  | Card | When |
  | --- | --- |
  | **Finish setting up** | the setup hasn't run |
  | **Sign in to Garmin Connect** | not signed in on this device, and either no data has arrived here or this device's session ended |
  | **Not signed in on this device** | the data reached this device through your vault sync, but it never signed in. **Not now** puts the card away |
  | **No Garmin data on this device** | signed in here, but the data folder is empty: the settings arrived and the data didn't |
- **Cards open their pages,** as in the app: In Focus's Sleep, Steps, All Activities, Training
  Readiness and Training Status; the Sleep Coach row; Today's Activity; and the At a Glance cards
  that have a page.
- **See All** beside At a Glance opens its full page. Home shows the first eight stats, and See All
  holds up to twenty. **Edit** there lets you:
  - remove a stat with its red badge;
  - move one: drag the card, drag its grip on a touch screen, or focus the grip and use the arrow
    keys;
  - pick more from **Add a Stat**.

  **Save** keeps the order, and **Cancel** throws the edit away. Choosing a preset again puts its
  own stats back.
- **Stats Garmin has nothing for yet,** such as hydration or nutrition, show Garmin's own prompt
  card, as the app does. Challenges aren't synced, so that section only shows Garmin's empty state.
- **Layout by pane width.** A narrow pane gets the phone layout, where In Focus swipes. From 640 px
  the sections sit side by side and At a Glance runs four across; from 1000 px, three and six.
  These are the page's own widths, beside the rail: a 1190 px pane leaves Home 950 px, so two
  columns.

## Activities

Garmin Connect's Activities section: **Activities** in the rail or the phone's tabs, or **Open
activities**.

- **The hub** lists Running, Cycling, Gym & Fitness Equipment, Swimming, Hiking, Multisport and
  Other, sorted the way Garmin sorts them, then All Activities. Yoga, stair climbing and mobility
  count as Gym; walking and meditation as Other. The hub's last rows open Steps, Floors and
  Intensity Minutes.
- **A sport's page** has:
  - the sub-type picker in its title (All Running, Treadmill Running, Trail Running…), showing only
    the ones you've recorded;
  - **7d / 4w / 1y**, with **‹ ›** to step a whole period;
  - a tab per measure the app shows for that sport:

    | Sport | Measures |
    | --- | --- |
    | Running, cycling, hiking, multisport | Distance, Time, Ascent, Calories |
    | Gym | Time, Calories |
    | Swimming | Distance, Time |
    | Other | Time |

  Under the chart come the total and the daily, weekly or monthly averages, then the activities. Over
  a year it shows one row a month, each opening its month.
- **View Personal Records** opens the records for Steps, Running, Cycling, Swimming and Strength:
  every distance Garmin keeps a record for, whether or not you have one. A record opens the activity
  that set it.
- **The pages read the activity index** (`activities/`). Filling it costs about one request per
  hundred activities; after that, routine syncs keep it current with a request they already make.

### All Activities

Garmin's list of every activity, from the hub or Home's All Activities card. It filters the index on
the device, so it sends no request.

- **Search** stays at the top while the list scrolls. It finds what you type anywhere in a name,
  ignoring case and accents: "cafe" finds "Café".
- **Filters** (the button beside the title, which shows a dot while a filter is on) has:
  - **Activities**, in Garmin's groups;
  - **Date Range**;
  - **Distance** and **Time**, each a slider or a typed minimum and maximum;
  - **Total Ascent**;
  - **Event Type**;
  - **Favorite Activities** and **Personal Records**.

  Each filter in force shows as a chip whose × removes it. The footer counts the matches as you
  choose ("Show 28 Activities"), and **Clear All** empties the filters.
- **Sort:** Newest First, Oldest First, A to Z or Z to A.
- **Cards** run one, two or three across as the pane widens, and load sixty at a time as you scroll.
  A swim's distance is in whole metres, or yards for a yard pool.
- **The search, sort and filters belong to the page:** Back from an activity, or a restart, keeps
  them.

Favourites and records are as of the last listing: a sync refreshes the newest activities, and
**Sync activity history** the rest. Garmin's own count can be one higher than the plugin's when it
counts a multisport leg the index leaves out.

### An activity's page

Every activity opens its page, whatever the sport. It opens from All Activities, a sport's page or a
month, Personal Records, Home's Today's Activity, Load's Exercise Load list, Training Effect's
related activity, and the Cycling Power Curve's record dates. Each page has the app's five tabs,
**Overview**, **Stats**, **Laps**, **Charts** and **Gear**, filled as the app fills them for that
sport:

- **A run:** the route map and weather, the headline figures, Evaluation (Primary Benefit, Feel,
  Perceived Effort), the watch it was recorded on, every figure the app lists, laps, and charts.
  - The charts: pace, heart rate, elevation, power, stamina, performance condition, running dynamics,
    training effect, run/walk and time in zones.
  - Every chart can be drawn against **Time** or **Distance**.
- **A ride** colours its route by power zone and lists the sensors it used, with their firmware and
  battery. Its Stats include Power and Cycling Dynamics, and its Laps a Total row. Charts adds
  Position, the Power Phase and Balance dials, the seven power zones, and the Power Curve against
  your record.
- **A pool swim** has no map. Laps is Garmin's interval table, rests included. Charts draws each
  length as a bar, for pace, strokes and Swolf.
- **An open-water swim** draws its route in red, with the weather. Its charts are pace, strokes a
  minute and temperature.
- **Every other sport** gets the sections the sports share, each shown only with data, as the app
  draws a Stair Stepper session.

**What every page has:**
- **Badges and sensors:** the Overview shows the badges the activity earned and the sensors it
  recorded with.
- **Full-size charts:** a chart icon beside a figure opens its chart full size, where chips lay a
  second measure over it.
- **The map:** tapped, it opens full screen and pans and zooms. Its layers button colours the route
  by another measure.

**Costs, storage and maps:**
- **The first time a page opens** it costs eight to eleven requests: eleven for a run or ride with
  power, eight for a pool swim or yoga. They are made between syncs, never during one.
- **After that** the page is kept in `activity-details/` and opens without asking again. It needs a
  session and the `workouts` group.
- **Activity details** in the setup or **Settings → Data** fetches the pages in its range ahead,
  newest first, so they open without a connection.
- **Map tiles** come from OpenStreetMap, which sees roughly where the activity was. They aren't
  fetched ahead: offline, a map draws the tiles that device viewed recently, and elsewhere the route
  alone. **Settings → Maps → Map tiles** turns them off. An activity without GPS, such as a
  treadmill run, has no map.

## Steps, Floors and Intensity Minutes

Each opens from Home's cards, the Activities hub, or **Open steps**, **Open floors** and **Open
intensity minutes**. Each has **1d / 7d / 4w / 1y** with **‹ ›**, and opens on today.

- **Steps.**
  - **A day:** its ring against the goal, the distance walked or run, calories, and the day's steps.
    Rides and swims don't count, which is why the distance can be less than the day file's
    `distance_km`.
  - **A week or four weeks:** each day against its goal, green when met, then the totals and
    averages. As in the app, the averages leave today out.
  - **A year** totals by the month, or by the week with the toggle.
- **Floors:** climbed up from the line, descended below it, with the goal dashed across. A year
  totals each week.
- **Intensity Minutes:** vigorous minutes count double, and weeks run Monday to Sunday as in the app.

The pages read the daily stats index (`daily-stats/`), whose whole history costs about 40 requests
a year. Day charts come from the timelines, so they cover the days inside Day details.

## Sleep

From Home's sleep cards, **Health Stats → Sleep**, or **Open sleep**, with **1d / 7d / 4w / 1y**
and **‹ ›**.

- **A night** has two tabs:
  - **Sleep Score:** the score and its verdict, the stages, the timeline and the factor cards, each
    opening its own page;
  - **Sleep Coach:** how much sleep the night called for and what adjusted it.
- **Longer ranges** show the score and the averages, duration against sleep need, and Sleep
  Consistency; 7d and 4w also show Sleep Alignment.

The pages read the sleep index (`sleep/`), about 14 requests for a year of history. A night's
timeline, factors and coach come from that day's timelines.

## Health Stats

**Health Stats**, in the rail or the phone's tabs, lists Sleep and these pages, in the app's order.
**Open health stats** opens that list. Each page has an **Open …** command, and all but Pulse Ox
Acclimation and Health Snapshot open from an At a Glance card. A page needs its metric group on.

| Page | Ranges | Group |
| --- | --- | --- |
| Health Status | a day at a time; each metric opens a sheet | `health` |
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
| Health Snapshot | a list of snapshots, each opening its detail | `health` |

- **Most pages read their own history index,** and show a banner offering to fill it until it holds
  your whole history.
- **A day's curve** comes from that day's timelines. For a day without them, such as one older than
  your Day details range, the page fetches the curve when you open it. That works if you're signed
  in and the page's group is on.
- **Health Snapshots** are fetched when the page opens.

## Performance Stats

**Performance Stats**, in the rail or the phone's tabs, lists Garmin's performance pages in the
app's order. Each has an **Open …** command. All but Race Predictor, Training Effect, Cycling Power Curve and HRV Stress also
open from a card on Home.

| Page | Ranges | Group |
| --- | --- | --- |
| Training Status | Current, whose rows open VO₂ Max, HRV Status, Load and Heat Acclimation; 4w, 12w, 6m | `training` |
| Training Readiness | a day at a time, with a sheet for each of its six factors | `readiness` |
| HRV Status | 1d, 7d, 4w | `hrv` |
| Race Predictor | Current, 4w, 6m, 1y, with a chip per distance | `races` |
| VO₂ Max | Current, 4w, 12w, 6m, for running and cycling | `fitness` |
| Running Economy | Current, 4w, 12w, 1y | `fitness` |
| Training Effect | 7d, 4w, and a page per activity | `workouts` |
| Cycling Power Curve | 4w, 3m, 1y: your best power by duration against your all-time Record | `workouts` |
| FTP | Current, 4w, 12w, 1y, for cycling and cross-country skiing | `fitness` |
| Critical Swim Speed | Current, 7d, 12w, 1y; Garmin's empty state until you have a result | `workouts` |
| Running Tolerance | Current, 12w, 1y, in Sunday weeks | `training` |
| Running Lactate Threshold | Current, 4w, 12w, 1y | `fitness` |
| Endurance Score | 1d, 12w, 1y, each with a Top Contributors tab | `fitness` |
| Hill Score | 1d with its factors, 4w, 12w, 1y, and a month page | `fitness` |
| HRV Stress | 7d, 4w; Garmin's empty state until you take an HRV stress test | `hrv` |

Two pages open from Training Status's rows instead of the list:
- **Load**, also from Home's Load Focus and Training Load cards: Load Focus, Exercise Load and
  Training Load over the last four weeks.
- **Heat Acclimation**, also from Home's heat card: the day's acclimation, its trend, and 7d and 4w
  of daily progress.

The histories are cheap: a request covers a year, so a few requests each fetch the whole history.
Load, Training Effect and Cycling Power Curve keep no history of their own; they read Training
Status's, the day files and the activity list.

## Commands

All are in the command palette under **Garmin Connect:**. A page opens inside its area, so Back
goes to the area's list.

| Opens | Commands |
| --- | --- |
| Home and Activities | **Open home**, **Open activities**, **Open steps**, **Open floors**, **Open intensity minutes** |
| Health Stats | **Open health stats**, **Open sleep**, **Open health status**, **Open lifestyle logging**, **Open weight**, **Open pulse ox**, **Open pulse ox acclimation**, **Open respiration**, **Open heart rate**, **Open blood pressure**, **Open stress**, **Open body battery**, **Open fitness age**, **Open health snapshot** |
| Performance Stats | **Open performance stats**, **Open training status**, **Open training readiness**, **Open HRV status**, **Open race predictor**, **Open VO₂ max**, **Open running economy**, **Open training effect**, **Open cycling power curve**, **Open FTP**, **Open critical swim speed**, **Open running tolerance**, **Open running lactate threshold**, **Open endurance score**, **Open hill score**, **Open HRV stress** |

| Syncs | Commands |
| --- | --- |
| Days | **Sync recent days**, **Sync today**, **Sync a date range…** |
| A history | **Sync activity history**, **Sync step, floor and intensity history**, **Sync sleep history**, **Sync stress history**, **Sync heart rate history**, **Sync body battery history**, **Sync respiration history**, **Sync health status history**, **Sync fitness age history**, **Sync weight history**, **Sync pulse ox history**, **Sync blood pressure history**, **Sync VO₂ max history**, **Sync hill score history**, **Sync HRV status history**, **Sync race predictions history**, **Sync training status history**, **Sync endurance score history**, **Sync heat acclimation history**, **Sync training readiness history**, **Sync running tolerance history**, **Sync weekly running tolerance history**, **Sync FTP history**, **Sync lactate threshold history**, **Sync running economy history**, **Sync critical swim speed history**, **Sync HRV stress history** |

| Other | What it does |
| --- | --- |
| **Set up…** | Opens the setup: sign in, scan your account, choose what to keep. |
| **Sign in** | Signs in, asking for an MFA code if Garmin wants one. |
| **Save debug info** | What a bug report needs, redacted, saved as a note in the **Log folder** and opened, to attach to an issue. No password, no request. |
| **Stop syncing** | Stops the sync or history walk you started after the day it is on, keeping what came in. |
| **Pause the history download** / **Resume the history download** | What the pause button and Settings → Data do. Resume also lifts Garmin's own pauses. |
| **Run diagnostics** | Four checks of sign-in and connectivity; see [Troubleshooting](troubleshooting.md#diagnostics). |
