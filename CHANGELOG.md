# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Version numbers match the git tag and the `version` in `manifest.json`. Each
GitHub release takes its notes from the matching section here — see
[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md#releasing) for how a release is cut.

## [Unreleased]

### Added

- **Performance Stats.** More → Performance Stats rebuilds Garmin's
  performance pages, each a copy of the app's from its own screenshots, with
  its own history kept in the data folder:
  - **VO₂ Max**: today's dial and class for running and cycling, and 4w, 12w
    and 6m charts; the dial links to Fitness Age.
  - **HRV Status**: the night's dial, figures and HRV timeline, and 7d / 4w
    averages against your baseline, with the overnight line on a chip. The
    sync keeps each night's readings, which Garmin later drops.
  - **Race Predictor**: the four predictions, and their paces over 4w, 6m and
    1y with a chip per distance.
  - **Hill Score**: today's score with its endurance, strength and VO₂ factors
    in sheets; 4w, 12w and 1y; and a month page from the year's list.
  - **Training Status**: the current status with its load focus and the VO₂
    Max, HRV Status and Load rows that open their pages, and 4w, 12w and 6m
    of statuses on a strip with their dates.
  - **Load**, from Training Status and Home's Load Focus and Training Load
    cards: Load Focus against its optimal ranges, Exercise Load's daily totals
    with the activities behind them, and Training Load's four-week acute load
    with its optimal band, the chronic load and the load ratio.
  - **Endurance Score**: today's dial and top contributors, and 12w / 1y of
    weekly and monthly scores with the sports behind each.
  - **Heat Acclimation**, from Training Status and Home's heat card: the day's
    acclimation and its trend, and 7d / 4w of daily progress. Training
    Status's Heat Acclimation row reads the same history.
  - **Training Readiness**, also from Home's In Focus card: the day's reading
    on Garmin's dial with when and why it was updated, and its six factors,
    each opening a sheet — the night's sleep, recovery time, HRV, acute load,
    recent sleep scores and recent stress. The sync keeps every reading of the
    day, and a day stepper goes back through the history.
  - **Training Effect**: 7d and 4w of each day's aerobic and anaerobic effect,
    and a card per activity opening its primary benefit, its two scales and
    the activity itself.
  - **Cycling Power Curve**: your best power at each duration from 1 second
    to 5 hours, for 4w, 3m and 1y against your all-time Record, with the
    records table — read from the rides already synced.
  - **Running Tolerance**: this week's impact load against your tolerance, and
    12w / 1y of Sunday weeks against the tolerance line, with the distance
    you actually ran on a chip and a list of the weeks.
  - **FTP**: today's W/kg dial with its class and what it is based on, for
    cycling and cross country skiing, and 4w / 12w / 1y of FTP in Watts or
    W/kg.
  - **Running Lactate Threshold**: today's threshold heart rate, pace, power
    and W/kg, and 4w / 12w / 1y of the heart rate with pace, power or W/kg on
    a second axis.
  - **Running Economy**: the newest reading on Garmin's dial with its class,
    and 4w / 12w / 1y of scores with their average and best.
  - **Critical Swim Speed** and **HRV Stress**: Garmin's pages as they look
    without data, ready for a first CSS result or HRV stress test.
- **Activity details for runs.** A run opens its own page from its sport's
  page, a month, All Activities, Personal Records or Home's Today's Activity,
  as in Garmin's app:
  - **Overview**: the route on a map with the weather, the headline figures,
    the Primary Benefit, how it felt and the device it was recorded on;
  - **Stats**, **Laps** and **Gear**;
  - **Charts** against time or distance — pace, heart rate, elevation, power,
    stamina, running dynamics, time in zones and more — and any of them full
    size with a second metric to compare.

  The page loads from Garmin the first time it opens and is kept in the vault,
  in `activity-details/`, or downloads ahead with Run details (below). On a
  phone its sheets rise from the bottom and drag down to close.
- **Activity maps.** OpenStreetMap under the route, coloured by pace (or grade-
  adjusted pace, heart rate, power, elevation or run/walk), with lap markers.
  The full-screen map pans and pinches. **Settings → Maps → Map tiles** turns
  the tiles off and draws the route alone.
- **A page for every activity.** Every activity opens its page, whatever its
  sport: from All Activities, a sport's page and its months, Personal Records
  on every tab, Home's Today's Activity, Load's Exercise Load list, Training
  Effect's related activity and the Cycling Power Curve's record dates. Each is
  drawn as the app draws that sport:
  - **Rides**: the route coloured by power zone, from Less Power to More Power;
    sixteen Stats sections, Power (NP, IF, TSS, FTP, work) and Cycling Dynamics
    among them; laps with Avg Speed and a Total row; and twenty charts, among
    them Position, Time in Position, the Power Phase and Balance dials, Platform
    Offset, seven power zones and the Power Curve against your record in W or
    W/kg, with fifteen measures to lay over a chart full size.
  - **Pool swims**: no map; Garmin's interval table with its rests and a Total;
    a bar a length for pace per 100 m, strokes and Swolf, against time or
    distance; heart rate, Training Effect and the zones.
  - **Open-water swims**: the route in red with the weather, and pace, strokes a
    minute and temperature charts.
  - **Every other sport**: the sections the sports share, as the app draws a
    Stair Stepper session, with Total Time as the big figure when there is no
    distance.
- **Sensors and badges.** Every activity's Overview, a run's too, shows the
  badges it earned and the sensors it recorded with, named as the app names
  them: "Rally 100/200 · 4.1 • Battery: OK".
- **"All <Group> Activities"** under an activity opens the hub's page for its
  group, or All Activities filtered to the group where the hub has none: "All
  Walking Activities" under a walk.
- **All Activities, as Garmin's new page.** A search over activity names that
  stays at the top and ignores case and accents; a filter button with a dot
  while a filter is on; a chip per filter to remove it; the exact count; and
  Sort: Newest First, Oldest First, A to Z, Z to A. Cards show the sport's
  coloured disc and figure, the date and the distance (a pool swim's in its
  pool's unit) or the time, one to three across as the pane widens. The
  **Filters** sheet has the activity groups in Garmin's order, a date range on a
  calendar, distance and time sliders with typed values, total ascent, event
  type, favourites and personal records, and counts what it would show as you
  choose ("Show 28 Activities"). It filters the activity index with no request,
  and a pane keeps its filters.
- **A setup.** Enabling the plugin opens it over Home: sign in, scan your
  account, choose what to keep, start. The scan finds where your Garmin
  history starts in a few requests. You choose from three data sets, each
  with its size, how long it takes and what it adds a year:
  - **Charts & trends**: every page's history, always all of it, under 1 MB a
    year;
  - **Day details**: each day's file and its timelines, from new days only to
    all history (the last 90 days by default), about 44 KB a day;
  - **Run details**: a run's map, charts and laps, from only the runs you open
    (the default) to every run, about 150 KB a run.

  It opens again from **Set up Garmin Connect…**, Home and Settings → Data. On
  a phone it is a sheet on the bottom edge.
- **The history download.** What you choose downloads in the background,
  about ten seconds at a time, and a sync or a page always goes first. It stays
  under an hourly request limit, pauses after a 429 or until you sign in again,
  carries on after a restart, and runs on one device at a time. Home, Settings
  → Data and the status bar on a computer show how far it has got, with Pause
  and Resume.
- **New data for your history.** An update that can fill in more of the
  history you keep asks once, with each item's size: Download now or Later.
  Settings → Data keeps what you put off.
- **Settings → Data**, in place of Storage: the data folder, what it takes on
  disk by data set, the Day details and Run details ranges with what is still
  missing, the download in progress, and Run setup again.
- **Delete synced data…** under Settings → Danger zone moves the plugin's own
  files in the data folder to the trash, the diagnostics notes too if you ask,
  and leaves anything else there.
- **After an uninstall** the plugin asks whether to keep the synced data or
  move it to the trash, and clears the map tiles that device cached.
- **"No Garmin data on this device"** on Home, when the settings reached a
  device and the data did not: with Obsidian Sync, turn on Sync all other
  types.
- For contributors: `tests/dataset-shapes.test.ts` fails when a data set
  stores something new without a version bump (see
  [Data versions](https://github.com/tareqayz/Obsidian-Garmin-Connect/blob/main/docs/CONTRIBUTING.md#data-versions)).

### Changed

- **Run details is now Activity details**, for every sport, in the setup and
  Settings → Data. A Run details range chosen before keeps downloading runs
  without asking; the other sports, and the runs saved before, are offered once
  in **New data for your history**.
- **The activity index is version 3**: it keeps each activity's event type, its
  favourite and personal-record flags, and a pool swim's unit, for All
  Activities. It is listed again once you agree, about a request per hundred
  activities. **An activity's file is version 6**, with what every sport's page
  shows; a run saved by the version before is kept and asks only its summary
  and badges again, two requests.
- **Sport names are the app's.** Page titles and the sub-type picker name each
  type from a table of Garmin's 154 activity types: "Stair Stepper", "Obstacle
  Course Racing", "Gravel/Unpaved Cycling".
- **Hill score syncs a year at a time** (Garmin takes up to 401 days), not 28
  days, and Garmin's class 4 reads "Skilled", as the app's help names it.
- **Running tolerance syncs a year at a time** too (Garmin takes up to 366
  days), and Home's card rounds its kilometres as Garmin does: 21,450 m is
  21.5 km.
- **Home's VO₂ Max dial** uses Garmin's own scale ends, which moves its marker
  by under 1%.
- **Home's Training Readiness card** writes "Well-recovered", as Garmin does.
- **Home's Lactate Threshold card** rounds the pace from Garmin's speed as the
  app does: 4:29, not 4:28.
- **Home's Running Economy card** writes "Well-Trained", as Garmin does.
- **The activity index** keeps each activity's training effect, benefit,
  load and a ride's best powers. It is listed again once, about a request per
  hundred activities.
- **Everything is JSON now.** A day's properties are written to
  `<data folder>/days/<year>.json` instead of a markdown note's frontmatter,
  beside the series and indexes that were already JSON. The first time this
  version loads, the days already in your notes are copied over. The notes and
  `Garmin Health.base` stay where they are, and you can delete them.
- **Network use.** Activity maps load tiles from `tile.openstreetmap.org`,
  which sees which part of the map you open. See the README.
- **Dragging a card on At a Glance's See All page.** The card now comes away
  under the pointer and follows it, and a dashed outline marks where it will
  land. The other cards slide out of its way, and on release it settles into
  place. With reduced motion turned on, the cards move without sliding.
- **History downloads only when you say so.** The histories no longer fill in
  by themselves after the first sync of a session: Charts & trends, Day
  details and Run details download what you agreed to, in the setup or an
  update dialog, and nothing else. A vault signed in before the update is
  taken as set up, without the setup: the histories it was filling carry on,
  and Day details keep the last 30 days. Its first Garmin page after the
  update offers the recent days an older version saved without their full
  timelines.
- **Timelines follow Day details.** A routine sync fetches the timelines of
  every day it covers inside the Day details range, not only its newest seven
  days. **Sync a date range…** fetches every day's, and its estimate counts
  them.
- **Settings.** The headings are Obsidian's own setting headings, and **Stop
  after empty days** is for **Sync a date range…**: the history download
  knows from the scan where your history starts.

### Removed

- Day notes and daily notes as storage, with their settings: where to put the
  data, the property prefixes, the daily-note folder and format, and Create
  missing notes.
- The Bases table view (`Garmin Health.base`), its settings, the link to it on
  every day, and the Rebuild the table view command.

### Fixed

- Perceived Effort's dot followed the run's slider colours, so a 5 was green
  where the app draws it yellow. The colours now go in pairs: 1–2 blue, 3–4
  green, 5–6 yellow, 7–8 orange, 9–10 red.
- A pool swim's page said "Loading the map…" for good. An activity without a
  GPS track now has no map, as a treadmill run has none.
- Sleep History showed two close buttons on Obsidian 1.14, which renamed the
  modal's own.
- On a phone with Obsidian's floating navigation bar, the end of every page
  stayed under the bar. Pages now scroll clear of it.
- Re-syncing an older day kept only its night, erasing the stress, Body
  Battery, heart rate, steps, floors and intensity timelines an earlier sync
  had saved. A sync now changes only what it asked Garmin for, and keeps the
  rest.
- A sync of many days rewrote its year file once for every day, and a sync
  service uploaded each rewrite. It now writes each year file once, after the
  days are in.
- Closing Obsidian during a history walk lost everything the walk had fetched.
  Walks now keep each year as it comes in and carry on from there.

## [0.2.0] — 2026-10-09

The plugin is now Garmin Connect, rebuilt inside Obsidian: the phone app's
Home, Activities, daily stats, Sleep and Health Stats pages, drawn from data
the sync keeps in your vault. The configurable dashboard that came before it is
gone.

### Added

- **Home.** Garmin Connect's home screen, opened by the ribbon icon or **Open
  home**. All three of the app's presets (Be healthy, Stay active, Track my
  training), and At a Glance with 36 cards. Its See All page has an edit mode:
  remove, reorder (drag or arrow keys) and Add a Stat, up to 20 cards.
- **Activities.** From Home's ⋯ menu, More → Activities:
  - one page per sport, with distance, time, ascent and calorie totals over a
    week, four weeks or a year, and a page per month;
  - All Activities and Personal Records.

  They read an activity index the sync keeps in `<data folder>/activities/`.
- **Steps, Floors and Intensity Minutes.** Pages for a day, a week, four weeks
  and a year, read from a daily stats index in `<data folder>/daily-stats/`.
- **Sleep.** The night's score, stages and timeline, its factors, and the Sleep
  Coach, plus the weekly, four-week and yearly views. Read from a sleep index in
  `<data folder>/sleep/`.
- **Health Stats.** From More → Health Stats, a hub with these pages. They read
  the histories the sync keeps under `<data folder>/`; Health Snapshot loads on
  view.
  - Health Status, Weight, Pulse Ox, Pulse Ox Acclimation
  - Respiration, Heart Rate, Blood Pressure, Stress, Body Battery
  - Fitness Age, Health Snapshot
  - Lifestyle Logging (Garmin's empty state for now)
- **Commands.**
  - A command to open each page: **Open activities**, **Open steps**, **Open
    sleep**, **Open stress** and so on.
  - A command to sync each history: activity; step, floor and intensity;
    sleep; and each of the nine Health Stats indexes. Each history also fills
    in by itself after the first sync of a session, until it is complete.
- **Three metric groups.**
  - `intraday`: the day's heart rate, stress, Body Battery, steps, floors and
    intensity curves, kept in `<data folder>/series/<date>.json` for
    the newest seven days of a sync.
  - `health`: Health Status and Health Snapshots.
  - `profile`: the watch, personal records, lactate threshold and training plan
    in `<data folder>/account.json`, about nine requests a sync.

  A vault that predates them gets them switched on once.
- The API catalogue now covers the Activities and Health Stats endpoints: 167
  in all, 69 of them checked against the live service every day.
- For contributors:
  - CI builds and tests every pull request;
  - release notes come from this file;
  - the `/garmin-page` pipeline (`.claude/skills/garmin-page/`) rebuilds a
    Garmin page from the phone and web app.

### Changed

- **Command and ribbon names.** The ribbon icon is **Open Garmin Home**, and:
  - **Open dashboard** → **Open home**;
  - **Run connectivity probe** → **Run diagnostics**;
  - **Rebuild the Garmin table view** → **Rebuild the table view**.

  Command ids are unchanged, so hotkeys keep working.
- **Settings.**
  - The Diagnostics section is now **Advanced**.
  - Races and workouts show what they cost: one request per sync, not one a
    day.
  - New vaults save diagnostics runs to `Garmin/diagnostics`.
- **Requires Obsidian 1.9.10 or later**, the first release with Bases, which
  the generated table view needs.

### Fixed

- VO₂ Max and training status now reach the day notes. The sync was looking
  for them in the wrong place in Garmin's responses.

### Removed

- **The classic dashboard.** The following are gone:
  - **Open classic dashboard** and its layouts;
  - the history charts for HRV, readiness, recovery, training load, VO₂ max,
    endurance and race predictions;
  - the per-activity detail (splits, heart-rate zones, elevation);
  - the calendar heatmap and the data table;
  - its **Backfill…** button.

  The data is all still there:
  - your day notes and the Bases table keep every value;
  - Home's At a Glance cards show the latest;
  - **Sync a date range…** still backfills.

  Performance Stats and an activity detail screen are next to be rebuilt (see
  [TODO.md](https://github.com/tareqayz/Obsidian-Garmin-Connect/blob/main/TODO.md)).
  Hotkeys bound to **Open classic dashboard** no longer do anything, and a tab
  of it left open reopens as Home.
- The one-off clean-up, and its notice, for settings written by pre-release
  builds.
- For contributors: `npm run probe:node` and `npm run preview:dashboard`.

## [0.1.0-beta.1] — 2026-09-19

The first build published for testers. It includes everything from the
development builds before it.

### Added

- **Sign-in that works on desktop and mobile.**
  - Garmin's mobile-app sign-in flow: SSO login, service ticket exchange, and
    OAuth2 bearer tokens.
  - Multi-factor authentication, asked for in the same dialog. A refused code
    is asked again, up to three times.
  - The session survives restarts through a stored refresh token, refreshed
    ahead of expiry.
- **Sync.**
  - Into a data folder of its own, your daily notes, or both.
  - Newest day first, skipping days that did not change, tolerant of one
    failed request.
  - A backfill stops after a run of empty days.
  - A request that fails with a 5xx or no response is retried, with jittered
    backoff. A 429 is never retried.
- **Thirteen metric groups as note properties:** activity, heart, sleep,
  stress and Body Battery, HRV, readiness, fitness (VO₂ Max, fitness age,
  endurance), race predictions, respiration, pulse ox, body composition,
  training load and status, and workouts.
- **A generated Bases table view** ("Garmin Health.base"). Each day note can
  also link to it, so the notes form a hub in the graph view.
- **A configurable dashboard** of 36 cards with saved layouts. It was removed
  in the release after this one.
- **Run connectivity probe.** A four-step check of sign-in and connectivity
  that saves its log into the vault, because a phone has no console.
- **The Garmin API, written down and checked daily.**
  - `api/endpoints.json` catalogues the endpoints Garmin exposes.
  - `api/schema/` records the response shapes actually seen.
  - A daily workflow opens an issue when a field the plugin reads stops
    arriving.
- **Releases.** A tag-driven pipeline with stable and BRAT beta channels.
- **Licence.** MIT.

### Known issues at the time

- VO₂ Max never populated. Fixed since.
- Android was untested: a third TLS fingerprint after desktop and iOS.
- The graph view can struggle when many day notes link to one hub note. Turn
  off "Link every day to the table view" if it does.

[Unreleased]: https://github.com/tareqayz/Obsidian-Garmin-Connect/compare/0.2.0...HEAD
[0.2.0]: https://github.com/tareqayz/Obsidian-Garmin-Connect/compare/0.1.0-beta.1...0.2.0
[0.1.0-beta.1]: https://github.com/tareqayz/Obsidian-Garmin-Connect/releases/tag/0.1.0-beta.1
