# Architecture

How the plugin is put together, why it is shaped that way, and where to change
things. For the user-facing behaviour it produces, see the
[README](../README.md).

## The two seams

Everything else follows from these.

**1. HTTP is injected.** Nothing in the Garmin logic imports Obsidian. It talks
to an `HttpClient` interface (`src/http.ts`), and the implementation is chosen at
the edge:

| Adapter | Used by | File |
| --- | --- | --- |
| `requestUrl` | the plugin, desktop and mobile | `src/obsidian-http.ts` |
| `fetch` | the API scripts (`api:check`, `api:token`) | `scripts/api/fetch-http.ts` |
| fixtures | tests | `tests/support/fixture-http.ts` |

So the same auth and API code runs unchanged on a phone, in Node, and against
recorded responses.

**2. The day target is injected.** The sync engine talks to a `DayTarget`:

```ts
interface DayTarget {
	exists(date: string): boolean;
	write(date: string, properties: Properties): Promise<WriteOutcome>;
}
```

That is the whole contract. It keeps the engine — dates, budgets, back-off,
partial failures — pure and testable with no Obsidian at all. Moving the days
from note frontmatter to JSON files only swapped the target: it is now
`VaultSeriesStore.writeDay`, which answers yes to every `exists()`.

The reason "build `node-garminconnect` first, then consume it" fails is not that
libraries are wrong. It is that a Node library bakes in Node assumptions
(`https`, `tough-cookie`, `axios`) you then cannot remove for a mobile WebView.
Starting transport-agnostic gets you both.

## Module map

```
src/main.ts              plugin entry: the views, commands, ribbon and settings tab
src/settings.ts          the settings tab, which mounts SettingsPanel.svelte
src/settings-data.ts     GarminSettings, DEFAULT_SETTINGS, SETTINGS_VERSION — pure
src/plugin-data.ts       owns data.json: settings, the session, Home's state; the group migrations
src/http.ts              HttpClient, CookieJar                — imports nothing
src/obsidian-http.ts     requestUrl adapter  — the only Obsidian import in the auth path
src/log.ts               the Log interface, the diagnostics renderer, redaction
src/probe.ts             the diagnostics: fingerprint, login, session persistence, fitness endpoints
src/garmin/
  constants.ts           endpoints, client IDs, native headers
  errors.ts              typed failures (Auth / Blocked / RateLimit / Api / Network / MFA)
  auth.ts                sign-in: login, MFA, ticket exchange
  tokens.ts              TokenStore, expiry, refresh
  client.ts              authenticated transport: refresh, 401 retry
  endpoints.ts           typed API wrappers (extends client), the GraphQL gateway included
src/sync/
  metrics.ts             Garmin payloads → properties; groups and the request budget — pure
  numbers.ts             num / isFiniteNumber, for Garmin's nulls and stray strings — pure
  days.ts                the day files: merging a day, a year file's text and parsing it — pure
  engine.ts              orchestration, the DayTarget, the history walks — pure
  progress.ts            what a sync reports while it runs: the Notice's bar — pure
  intraday.ts            intraday payloads → the day's series file — pure
  account.ts             account.json: profile, watch, latest values, plans, records — pure
  activity-index.ts      the activity index: rows, merging, year files — pure
  daily-stats.ts         the daily stats index: rows, merging, year files — pure
  sleep-index.ts         the sleep index: a row a night — pure
  day-index.ts           defineDayIndex: a Health Stats day index from its description — pure
  day-indexes.ts         DAY_INDEXES, the registered day indexes — pure
  <stat>-index.ts        the Health and Performance Stats day indexes and their intraday extras
                         (health-snapshot-index.ts has extras only) — pure
  intraday-registry.ts   on-view intraday loads: the series file's own blocks, extras, loadDay — pure
  intraday-extras.ts     INTRADAY_EXTRAS, the registered extras — pure
  activity-detail.ts     an activity's page file: its blocks, building it, loadActivity — pure
  series-store.ts        the day files, series files, account.json, every index and activity
                         file on disk
  import-notes.ts        the one-time copy of old builds' day notes into the day files
  vault-paths.ts         ensureFolder, trimSlashes
  runner.ts              settings → a run, the history walks in turn, reporting
src/dashboard/
  home-view.ts           the Home ItemView: rows, series files, account.json, the indexes
  legacy-view.ts         turns a saved tab of the retired classic dashboard into Home
  routes.ts              the page stack inside the Home view, and reading it back — pure
  series.ts              DayRow, shiftDate, duration       — pure
  day.ts                 day-row lookups and date/number wording — pure
  periods.ts             the periods a range stat pages through: span rules, spans, 1y weeks, card
                         routes, labels, means, and the shared month and weekday names — pure
  home.ts                Home presets and the In Focus / Today numbers — pure
  glance.ts              At a Glance: the 36 stats, the list, each card's view — pure
  activities.ts          the Activities pages: categories, periods, totals, records — pure
  activity-map.ts        an activity's map as data: route points, overlay runs, lap markers — pure
  activity-labels.ts     the words the activity tabs share: sport, date, benefit, feel, effort — pure
  activity-overview.ts   the Overview tab's view model — pure
  activity-stats-pages.ts the Stats, Laps and Gear tabs' view models — pure
  activity-chart-pages.ts the Charts tab and the expanded chart's view models — pure
  activity-charts.ts     their geometry, measured off the phone and the twin — pure
  activity-copy.ts       the benefit sheet's wording, from the app — pure
  totals-chart.ts        a "<Metric> Totals" chart's geometry, measured off the app — pure
  stats-pages.ts         Steps, Floors, Intensity Minutes: periods, Garmin's rounding, rings, lists — pure
  stats-charts.ts        their charts' geometry, measured off the app — pure
  sleep-pages.ts         Sleep: the night, its factors, the Sleep Coach, 7d / 4w / 1y — pure
  sleep-charts.ts        the Sleep charts' geometry — pure
  stat-registry.ts       StatDef and statRegistry: a stats section's list read as its hub, its
                         pages, its glance targets and its span rules — pure
  health-stats.ts        HEALTH_STATS: the Health Stats in the app's order, ranges, groups — pure
  performance-stats.ts   PERFORMANCE_STATS: the Performance Stats the same way, with tabs and spans — pure
  gauges.ts              Garmin's banded dials: VO₂ Max, FTP, readiness, endurance, hill, economy — pure
  stat-charts.ts         a Health Stats chart's box: frames, gridlines, the axis, gap-breaking lines — pure
  <stat>-pages.ts        each Health Stats page's view model — pure
  <stat>-charts.ts       its chart frames and marks — pure
  <stat>-copy.ts         wording Garmin keeps in the app's phrase tables, not the API
                         (sleep, stress, body battery) — pure
src/ui/
  icon.ts                the Garmin Connect ribbon icon
  sport-icons.ts         sport figures (Tabler, MIT) registered as Obsidian icons
  login-modal.ts         Sign in to Garmin Connect (LoginForm.svelte)
  probe-modal.ts         Run diagnostics (ProbePanel.svelte), and saving a run to the log folder
  sync-range-modal.ts    Sync a date range… (SyncRangeForm.svelte)
  add-stat-modal.ts      Add a Stat, the picker See All's edit mode opens
  sleep-history-modal.ts the Sleep Coach's Sleep History sheet
  sheet-modal.ts         SheetModal: any Svelte body as one of Garmin's bottom sheets
  map/                   the activity maps: Leaflet, loaded with the first map (leaflet.ts);
                         OpenStreetMap's tiles through requestUrl, cached in IndexedDB
                         (tiles.ts); the TileSource the pages see (tile-source.ts, pure)
src/ui/svelte/           SettingsPanel, LoginForm, ProbePanel and SyncRangeForm, and one folder
                         per area below. Obsidian comes in through actions (obsidian-setting.ts,
                         home/lucide.ts), apart from SettingsPanel's Notice and the Activities
                         sub-type Menu
  home/                  the Home screen, one component per Garmin card; SeeAll.svelte is
                         At a Glance's See All page and its edit mode; PageBar.svelte is the
                         back / title / action bar every page inside the view shares
  activities/            More, the Activities hub, a sport's page, a month, Personal Records
                         and All Activities, with their parts; HistoryBanner.svelte
  activity/              an activity's page (ActivityPage.svelte: bar, tabs, the expanded chart
                         in place of the page) and a component per tab, the full-screen map
                         (ActivityMapPage.svelte) and RouteMap.svelte; overview/ (weather chip,
                         figures, Evaluation, the benefit sheet), map/ (legend, Map Settings,
                         pins and lap markers), stats/ (sections, rows, the chart badge) and
                         charts/ (sections, axes, marks, zones, the expanded plot and its chips)
  stats/                 the Steps, Floors and Intensity Minutes page (StatsPage.svelte) and its
                         parts: the ring, the chart, the day cards
  sleep/                 the Sleep pages: the night, the factor pages, the Sleep Coach, the periods
  health/                the Health Stats hub, HEALTH_PAGES, the props every stat page gets, and
                         the parts both sections' pages are built from (see "Building a stat page")
  performance/           the Performance Stats hub and PERFORMANCE_PAGES
  <stat>/                each Health Stats page: stress, heart-rate, body-battery, respiration,
                         health-status, fitness-age, health-snapshot, weight, pulse-ox,
                         pulse-ox-acclimation, blood-pressure, lifestyle-logging
```

Modules marked **pure** have no Obsidian import, no network of their own (a
client is passed in) and no clock beyond what is passed in. That is what makes
them directly testable, and it is worth preserving when adding to them.

The plugin registers two views. `garmin-home` is everything: Home and every
page opened from it. `garmin-dashboard` belonged to the classic dashboard,
retired in 0.2; `legacy-view.ts` keeps the type registered for one release so
a workspace saved with that tab opens Home instead of a dead leaf.

## Request flow for one sync

```
runner.ts        reads settings → builds SyncOptions and the DayTarget (the day files)
   │
engine.ts        syncRange: endpointsFor(groups) → only the calls this config needs
   │               ├─ the activity list (workouts), merged into the activity index
   │               │  (series-store.ts)
   │               ├─ range calls, once for the window: maxMetrics, racePredictions,
   │               │  hillScores and runningTolerance (a request per 365 days), and
   │               │  healthSnapshots (a request per 28 days)
   │               ├─ then the days, NEWEST → OLDEST. Per day: summary (it serves
   │               │  activity, heart, stress, respiration and spo2), sleep, hrv,
   │               │  readiness, endurance and fitnessAge (fitness), training, body,
   │               │  health
   │               ├─ intraday, for the newest INTRADAY_DAYS (7) only: stress (with
   │               │  Body Battery), heartRate, steps, floors, intensity minutes,
   │               │  Body Battery events → the day's series file
   │               └─ after the days: the daily stats index (steps, floors and
   │                  minutes from the summaries; the range endpoints for days whose
   │                  summary failed, 3 requests per 28 days), the sleep index, then each
   │                  registered day index whose group is on (see the Health Stats
   │                  foundation below)
   │
metrics.ts       mapDay(payloads) → canonical properties     (pure)
   │
target.write()   series-store.ts writeDay: days.ts mergeDay over what the day held,
   │               serializeDays → <dataFolder>/days/<year>.json
   │               └─ same text → "unchanged", file untouched
   │
runner.ts        after the days: account.json (profile, about nine requests a
                 sync)
```

One detail in there carries real weight:

- **Range endpoints are called once for the window, not once per day.**
  `maxMetrics`, `racePredictions`, the activity list and the other range calls
  all take a range or a page, so the request budget is roughly *per-day calls ×
  days*, plus six intraday calls for each of the newest seven days,
  plus a small constant. The settings tab shows each group's share
  (`REQUESTS_PER_DAY`, `FREE_GROUPS`, `REQUESTS_PER_SYNC`, `RANGE_GROUPS`).

## The activity index and the pages inside Home

The Activities pages need every activity with Garmin's raw numbers, which the
day files cannot give them (see `docs/properties.md`, "The activity index"). So
the activity list feeds a second store, `<dataFolder>/activities/`:

```
engine.ts       fetchActivitiesFor → listing ──┐
                fetchAllActivities → listing ──┤   (the history: ~1 request / 100 activities)
                                               ▼
activity-index.ts   rowOf · mergeListing · serializeYear       (pure)
                                               ▼
series-store.ts     mergeActivities: one file per local year, rewritten only on change
                                               ▼
home-view.ts        readActivities → activities.ts → the pages
```

`mergeListing` trusts a listing only for what it covers. The list is newest
first, so a listing from its first page is a stretch with nothing missing: rows
in that stretch that Garmin no longer returns were deleted, while rows older
than it are left alone. A listing that reached the list's end replaces the index.

The runner starts the history sync by itself once per session, after the first
sync, until the index says `complete`; `SyncRunner.onHistory` reports its
progress to the banner on the sport pages.

The Steps, Floors and Intensity Minutes pages work the same way from their own
store, `<dataFolder>/daily-stats/` (see `docs/properties.md`, "The daily stats
index"):

```
engine.ts       rowFromSummary ← each day's summary, at no cost ──┐
                feedDailyStats → the range endpoints, for days  ──┤
                                 without a summary and any gap      │
                fetchDailyStatsHistory → 28 days a window, back ──┤   (the history: ~40 requests / year)
                                                                    ▼
daily-stats.ts      mergeDays · extendCoverage · serializeYear     (pure)
                                                                    ▼
series-store.ts     mergeDailyStats: one file per year, rewritten only on change
                                                                    ▼
home-view.ts        readDailyStats + the day files' calories → stats-pages.ts → the pages
```

A day's chart reads that day's series file, read when the page asks for it; the
file's `dayStart` puts the chart on the watch's clock, which need not be this
computer's. `SyncRunner.onStatsHistory` reports the history sync to their banner.

Home is a stack of pages (`routes.ts`): Home at the bottom, then See All, More,
Activities, a sport, a month, Personal Records, All Activities, an activity and
its full-screen map, Steps, Floors or Intensity Minutes, Health Stats, Sleep, or
any other Health Stats page. Back pops one; a filter or a tab replaces the top
rather than adding a step; a link to a page already on the stack goes back down
to it (`pushOrReturn`). The
stack is the view's state (`getState` / `setState`), so a reload comes back to
the same page, and every **Open …** command (Open activities, Open sleep, Open
stress and the rest) opens the view through the same `setState`.

## Health and Performance Stats foundation

Every Health Stats page but Sleep, and every Performance Stats page, is built
on one registry, one route per section, one hub per section, one way to keep a
day index and one way to load a day's chart on view. A stat is its own files
plus three one-line registrations; nothing else shared changes.

### What a stat owns

| File | What goes in it |
| --- | --- |
| `src/sync/<stat>-index.ts` | its day index (`defineDayIndex`) and, when its day page needs a payload the series file does not have, its intraday extra (`defineIntraday`). No Obsidian import: the tests load every registered definition |
| `src/dashboard/<stat>-*.ts` | the view model and chart geometry, pure, with golden-number tests |
| `src/ui/svelte/<stat>/` | the page, taking `HealthStatPageProps` or `PerformanceStatPageProps` |
| `tests/<stat>-*.test.ts` | its tests |

### The three registrations

```ts
// src/sync/day-indexes.ts
import { STRESS_INDEX } from "./stress-index";
export const DAY_INDEXES: readonly DayIndexDef[] = [STRESS_INDEX];

// src/sync/intraday-extras.ts — only for a payload of the stat's own
import { STRESS_DAY } from "./stress-index";
export const INTRADAY_EXTRAS: readonly IntradayDef[] = [STRESS_DAY];

// src/ui/svelte/health/pages.ts — or performance/pages.ts and PERFORMANCE_PAGES
import StressPage from "../stress/StressPage.svelte";
export const HEALTH_PAGES: … = { stress: StressPage };
```

| Registration | What it switches on |
| --- | --- |
| `DAY_INDEXES` | routine syncs feed the index; the once-per-session history walk takes it in turn, while its group is on; a **Sync <title> history** command; `readIndex(kind)`; Home watches its folder |
| `INTRADAY_EXTRAS` | `loadIntraday(date, [key])` fetches the payload for any day and keeps it in the series file under `extra[key]` |
| `HEALTH_PAGES` | the stat's row in the hub, an **Open <stat>** command, its At a Glance card opening the page, and Home rendering it for the `health-stat` route |
| `PERFORMANCE_PAGES` | the same for the `performance-stat` route, its In Focus card too (Training Readiness, Training Status). A `hub: false` stat gets no row and no command. The section's hub, More's row and **Open performance stats** appear with its first hub stat |

### The registry

`HEALTH_STATS` (`src/dashboard/health-stats.ts`) and `PERFORMANCE_STATS`
(`performance-stats.ts`) list every stat in the app's order as a `StatDef`
(`stat-registry.ts`): its title, ranges (`PERIOD_RANGES`: 1d, 7d, 4w, 12w,
3m, 6m, 1y), default range, settings group, `rangeLabels` ("Current" for
1d), and the At a Glance cards it claims. A card is an id, or `{ id, tab?,
sub?, range? }` when it lands on a tab (Cycling VO₂ Max on VO₂ Max's
`cycling`). Performance uses `tabs` (the first is the default), `spans`
(below) and `hub: false` for a page only another page opens (Load and Heat
Acclimation, from Training Status). Stats reuse the settings' existing
groups, so adding one needs no migration.

`statRegistry(list, { ownRoute, noPage })` reads a list: `get(id)`,
`page(id)` (on the section's route), `pageStats(registered)` (every
registered page, hidden ones too), `hubStats(registered)` and
`glanceTarget(card, registered)`, `registered` being the page map's keys. Health's Sleep is `ownRoute`, listed by the hub
on a route of its own; Performance's Cycling Ability is `noPage`, neither
routed nor listed. `health-stats.ts` keeps its helpers (`pageStat`,
`hubStats`, `glanceStat` …) over `HEALTH_REGISTRY`; Performance's is
`PERFORMANCE_REGISTRY`. A card is claimed by one stat at most, across both
sections.

### Span rules

A range cuts its period by a `SpanRule` (`periods.ts`), and `spanOf(rule,
offset, today)` steps it back one whole rule at a time. A stat names the
rules that are not its ranges' defaults in `spans`; `spanRuleOf(stat,
range)` reads them, `statSpan` and `statPeriodLabel` (`stat-registry.ts`)
give the period and its words.

| Rule | Period on Sunday 2026-10-11 |
| --- | --- |
| `{ days }`, the default: 7d 7, 4w 28, 12w 84, 6m 182, 1y 364 | 12w Jul 20 – Oct 11 |
| `{ weeks, weekStart }`: this week so far and whole weeks before | Running Tolerance's Sunday 12w, Jul 26 – Oct 11 |
| `{ months }`: n months back plus a day; 3m's default | Cycling Power Curve's 3m, Jul 12 – Oct 11 |
| `{ months, calendar: true }`: calendar months | Hill Score's 1y, "Nov 2025 - Oct 2026" |
| `{ monthEnds }`: a point per month end, and today (`monthEndsOf`) | Race Predictor's 6m, May 31 – Oct 11 |

Health's stats name none, so `periodOf` (the defaults) is their whole story.

### The route

`{ page: "health-stat", stat, range, offset, tab?, sub?, date? }`, opened with
`healthStatRoute(stat, opts?)`, and `{ page: "performance-stat", … }` the same
way with `performanceStatRoute`; `{ page: "performance" }` is the Performance
hub. Read back from saved state, an unknown stat (or Sleep, which keeps its
own route, or Cycling Ability, which has none) is refused; a range the stat
does not have becomes its default; `offset` is a whole number at or below 0;
`tab` and `sub` are kept when they are short tokens and `date` when it is
`YYYY-MM-DD`. What `tab`, `sub` and `date` mean is the page's business —
Health Status keeps the metric sheet it has open in `sub`. A saved route whose
page is not registered shows a "not in this version" page rather than failing.

`moveStatRoute(route, period)` is a page moved in place, keeping its tab and
sub-page; `statOfRoute(route)` its stat in its own section's registry;
`performanceTargetRoute(target, dayOffset)` the page a Performance card opens,
on Home's day when it opens on 1d.

### Day indexes

One short row a day for the stat's whole history, in the sleep index's file
shape: `<dataFolder>/<folder>/<year>.json` holding `{version, year, <listKey>:
[...]}`, one row per line, plus `index.json` holding `{version, from?, to?,
complete}`. Written only when the text changes.

```ts
export const STRESS_INDEX = defineDayIndex<StressRow>({
	kind: "stress", title: "stress", folder: "stress", version: 1,
	columns: { avg: {}, max: {}, rest: {}, quality: { text: true } },
	keepOld: false, group: "stress",
	windowDays: 28, emptyWindowsToStop: 4,
	fetchWindow: async (api, start, end) => rowsFrom(await api.request(`/usersummary-service/stats/stress/daily/${start}/${end}`)),
	fromSummary: (summary) => ({ avg: summary.averageStressLevel, max: summary.maxStressLevel }),
});
```

- **Columns** fix the row's key order. A number is rounded to `precision`
  decimals (whole by default); below zero it is Garmin's "not measured" and
  dropped, unless `signed`; `text` keeps a trimmed word. Unknown keys, nulls
  and rows left with nothing are dropped, so a mapper hands Garmin's fields
  straight over.
- **`keepOld`**: true keeps the fields a new row lacks (daily stats' calories),
  false replaces the row whole (a night). A day a fetch asked about and found
  empty loses its row either way.
- **`windowDays`** is 28 unless a definition says otherwise: most range
  endpoints answer 400 for a 29-day range. An endpoint that takes more is
  given its own window, up to 3660: respiration 31, fitness age 29, and 3660
  for the four whose range has no cap (weight, blood pressure, pulse ox,
  Health Status), which fetch the whole history in one request.
  `emptyWindowsToStop` windows in a row without a row end a
  history walk, once it is past the oldest activity; `maxHistoryDays` stops it
  where Garmin stops keeping the stat.
- **`refreshDays`** (0 by default) has every routine sync fetch the index's
  last days again, held or not, for a stat Garmin revises late: Health Status
  rescores days up to 26 days on. A row that comes back the same changes no
  file.
- **`fetchWindow(api, start, end)`** owns its request, through the API batch's
  wrapper or `api.request`. **`fromSummary(summary, date)`** makes the run's own
  days free: the daily summary is fetched anyway.
- **`requestsPerWindow`** (1 by default) is what a window costs when
  `fetchWindow` asks more than one route: FTP's watts and W/kg are 2, and
  the lactate threshold's heart rate and speed. The engine books it per
  window, in a sync's report and a history walk's log.
- Bump **`version`** when a row's meaning changes: an `index.json` of another
  version reads as none, and the history is fetched again.
- **`fromDay`** (a `DayFeed`, not with `fromSummary`) does the same from
  what the day sync fetched for the day file anyway (`maxMetrics`,
  `hillScore`, `runningTolerance`, …): `read(day, date)` makes the row, and
  `needs` names the parts it reads. A day counts as covered only when every
  part in `needs` came back, so a failed fetch leaves the day to the window
  fetch rather than dropping the row the index holds.
- `defineDayIndex` throws on a definition that cannot work — a window over
  3660 days, a negative refresh, a folder the store already uses, `fromDay`
  beside `fromSummary` or needing nothing — so the mistake fails the build's
  tests.

```
engine.ts     takeSummary ← each day's summary, through fromSummary, at no cost ──┐
              feedIndex → fetchWindow for the days the summaries missed,          ──┤
                          and the stretch since index.json's `to`                   │
              walkHistory → windowDays a request, back to the start               ──┤  (runner: once a session,
                                                                                    ▼   after the first sync)
day-index.ts      normalize · merge · serializeYear, from the definition       (pure)
                                                                                    ▼
series-store.ts   mergeDayIndex: one file per year, rewritten only on change
                                                                                    ▼
home-view.ts      readIndex(kind), read once per version; versions[kind] moves when the folder changes
```

A routine sync feeds an index without `fromSummary` one window per
`windowDays` of the run, `requestsPerWindow` requests each. Index files do not rebuild Home: only the pages that
read the index re-read it. `readIndex("sleep")` and `readIndex("daily-stats")`
read the two older indexes the same way, for pages that need nights or steps.

### Intraday on view

A sync spends intraday requests on the newest days only (`INTRADAY_DAYS`). A
day page asks for what it draws instead: `loadIntraday(date, keys)` fetches
whatever of `keys` the day's series file lacks, merges it in, writes the file
and resolves with the day's series.

- The series file's own blocks load by their own keys, under the `intraday`
  group: `stress` and `bodyBattery` (one request), `heartRate`,
  `bodyBatteryEvents`. So a Stress, Body Battery or Heart Rate day page reads
  an old day where it reads today. Steps, floors and intensity minutes are not
  loadable: their pages read what a sync wrote.
- An extra's block goes under `extra[key]`. `checked` lists the keys fetched on
  view, data or not, so a day Garmin had nothing for is not asked again.
- Loads run in the runner, never beside a sync: they wait, a second ask for a
  day already waiting joins it, the client's throttle paces them, and the
  automatic history walks let waiting loads in between walks. Signed out, or
  with the block's group off, a load resolves at once and `reason` says why. A
  429 answers every waiting load without asking again.
- A sync's own write of a day replaces the file, as it always has, extras and
  `checked` included. That is what keeps a recent day's on-view blocks fresh:
  the next view fetches them again.
- An extra with `fromDay(day, date)` is written by the sync itself, for every
  synced day whose payload the day sync already fetched (HRV Status's night
  from `hrv`), merged into the file and carried through the sync's own write.
  An empty or failed fetch never erases a block an earlier sync kept: Garmin
  drops old HRV readings (none before 2026-06-01), so the vault keeps them.

A day page reads its series, and when `missingKeys(series, keys)` is not empty
shows the day's summary from its index while `loadIntraday` runs, as Sleep's
day view does before the night's file is in.

### Activity details on view

An activity's page is never synced: `loadActivity(id)` fetches it the first time
the page opens and keeps it in `<dataFolder>/activity-details/<id>.json`
(`activity-detail.ts`), outside `activities/` so the write does not rebuild Home.

- Ten blocks, one request each: the summary, the samples (`details`, kept as
  named columns — `time`, `distance`, `hr`, `speed`, `lat`, `lon` and the rest —
  plus `clock`, seconds since the start), the laps, the typed splits (run/walk),
  heart rate and power zones, weather and gear go together; then the device as
  it was (its firmware id is in the summary) and the weight on the activity's
  day, for Power (W/kg). Each costs a request once.
- `checked` lists the blocks fetched, data or not: a block whose request failed
  is asked for again on the next view; one Garmin had nothing for is not. A file
  whose activity the index shows renamed or trimmed is fetched afresh, and a file
  of another `version` reads as missing.
- The loads queue with the intraday ones, in the same runner: never beside a
  sync, paced by the client's throttle, and a 429 or a dead session answers every
  waiting load without asking again. Gated on the `workouts` group.
- **Download runs** (`downloadRuns`) loads the rest the same way, after each
  sync and the session's history walks: `runsToDownload` lists the index's runs
  (the rows that open a page, `categoryOf(row) === "running"`, handed to the
  runner by `main.ts`) without a file, newest first. They come last in the same
  drain — days, then activities a page asked for, then downloads — at least
  two seconds apart. A sync or history walk that finds a download in hand waits
  for that one run instead of being turned away; a 429 drops the rest until the
  next sync, and a run that failed is not asked for again until a reload.
- The view keeps the last few details in memory, so a page coming back (Back
  from the map) draws at once and its scroll position holds.

The map draws the route from the `lat` and `lon` columns, so it needs nothing
from the network. Its tiles come from OpenStreetMap through `src/ui/map/`
(`requestUrl`, a User-Agent naming the plugin, an IndexedDB cache of a week at
least); with the **Map tiles** setting off, offline, or refused, the route draws
alone.

### What a page gets

`StatPageProps<R>` (`src/ui/svelte/health/pages.ts`), one object Home hands
both sections' pages; `HealthStatPageProps` and `PerformanceStatPageProps` are
it on their routes: `route`, `today`, `units`, `canSync`, `onBack`, `go`,
`swap`, `readSeries`, `readIndex`, `loadIntraday`, `onSyncHistory(kind)`,
`versions` (by index kind), `seriesVersion`, `history` (walks in progress, by
kind), `openSheet` (one of Garmin's sheets, as the activity pages open them),
`readDays()` (every day file's row), `readAccount()` (account.json) and
`activities` (the activity index, as the Activities pages get it). Re-read an
index when `versions[kind]` moves, the days when `versions["#days"]` does,
the account when `versions["#account"]` does and the series when
`seriesVersion` does; the view reads each once per version. The history
banner (`activities/HistoryBanner.svelte`) shows while `history[kind]` is set
or the index's meta is not `complete`.

### Building a stat page

A stat page is the shared parts below plus the stat's own view model, chart
frames and marks. Stress is built this way (`src/ui/svelte/stress/`); start
from it, not from a copy of it.

| Shared part | What it gives a stat |
| --- | --- |
| `src/dashboard/periods.ts` | `spanOf` and the span rules above, `periodOf` (a range's default: 7d, 4w, 1y rolling back from today, offsets a whole period), `rollingWeeks` and `weeksOf` (the 1y's 52 rolling weeks, each the rounded mean of its days), `switchRange`, `stepRoute`, `dayCardRoute`, `weekCardRoute`, the labels (`dayLabel` "Today" / "Wednesday, October 7", `periodLabel` "Oct 2 - 8" / "Oct 16-22, 2025", `yearLabel`, `weekTitle`, `cardDate`), the axes (`dayAxis` with its "MM-DD" ends, `monthAxis`), `meanOf(values, rounding)` (`"floor"` for Stress, `"round"`, half up, for Body Battery, Heart Rate and Respiration) and the plain `mean`, and the date words every page shares: `longDate`, `weekdayOf`, `daysBetween`, `shiftMonth`, `lastDayOfMonth`, `MONTHS`, `WEEKDAYS`, `SHORT_MONTHS`. Import these rather than copying them |
| `src/dashboard/stat-charts.ts` | `ChartFrame` (a chart's insets and heights, measured off the stat's Figma frame, one for the phone and one for a pane's 748pt column), `plotBox(frame, width, ticks, axis)` (gridlines, y labels, the axis' dots and labels, and the scale for the stat's marks) and `linePath` (a line that breaks at a missing value) |
| `health/StatPageShell.svelte` | the sticky header — back and the stat's title, the range control with the stat's ranges from its section's registry, the period stepper (‹ disabled at the start of history, › only on a past period) — the history banner, and the phone and pane containers (640 and 1000pt) |
| `health/StatChart.svelte` | a chart under its title: the box at the width it gets, with `under` and `over` snippets for the stat's marks and a `footer` for its key |
| `health/StatFigures.svelte` | figures two to a row under a rule: the "Avg <metric>" block, or a day's tiles with a colour dot each |
| `health/StatCardList.svelte`, `StatCard.svelte` | a period's day or week cards, the figure on the right and an optional `visual` snippet beside it; one a row, two from 640pt, three in a pane |
| `health/StatDayLayout.svelte`, `StatPeriodLayout.svelte` | a 1d body (summary, then chart) and a 7d / 4w / 1y body (chart, figures, list), side by side in a pane |

`StatPageShell` takes the page's `route`, `today`, `onBack` and `swap` from
its props, the period's `label` and `canGoBack` from the stat's view, an
optional `history` (`{ title, windowDays, complete, walking, canSync,
onSync }`, for the banner) and an optional `style` (custom properties for the
whole page, such as a stat's colours). Left out, `label` is the stat's
period in the app's words (`statPeriodLabel`); null leaves the period row out.
`ranges` and `rangeLabels` override the registry's, `steppers={false}` shows
the label alone (VO₂ Max's Current), `step` stands in for "<" and ">" with
the page's own (Hill Score's month page) and `canGoForward` for the default
"any past period". It moves the page itself, keeping its tab and sub-page;
its body snippet gets `{ pane, move, span }` (`span` the period shown, null
on 1d), so a card switches the page with `move(dayCardRoute(date, today))`.
Spacing defaults are the twin's for Stress; a stat whose twin differs sets
the layouts' custom properties (`--stat-chart-top`, `--stat-chart-top-pane`,
`--stat-figures-top-pane`, `--stat-list-top`, `--stat-list-top-pane`).

What stays the stat's own: its view model's rules (what a figure is, its
rounding, its copy), its chart frames (measured off its own twin) and marks,
and anything only it draws — Stress's ring, colours and timeline stay in
`src/ui/svelte/stress/`.

A 7d / 4w page in outline, simplified from Respiration's. The real one
(`averagesPlot` in `src/dashboard/respiration-charts.ts`, and
`src/ui/svelte/respiration/`) draws a sleep line and an awake line; the outline
keeps one:

```ts
// src/dashboard/respiration-charts.ts — its frames, measured off its twin
const FRAMES: Record<"phone" | "pane", ChartFrame> = { phone: { left: 46, … }, pane: { left: 32, … } };

export function respirationPlot(view: RespirationPeriodView, width: number, pane: boolean) {
	const { box, scale } = plotBox(FRAMES[pane ? "pane" : "phone"], width, view.ticks, view.axis);
	return { ...box, line: linePath(view.points.map((p) => [scale.x(p.x), p.value === null ? null : scale.y(p.value)])) };
}
```

```svelte
<!-- src/ui/svelte/respiration/RespirationPage.svelte -->
<StatPageShell {route} {today} {onBack} {swap} label={view.label} canGoBack={view.canGoBack}
	history={{ title: RESPIRATION_INDEX.title, windowDays: RESPIRATION_INDEX.windowDays, complete,
		walking: history.respiration, canSync, onSync: () => onSyncHistory("respiration") }}>
	{#snippet children({ pane, move })}
		<StatPeriodLayout>
			{#snippet chart()}
				<StatChart title="Daily Averages" {pane} plot={(width) => respirationPlot(view, width, pane)}>
					{#snippet over(p)}<path class="line" d={p.line} />{/snippet}
				</StatChart>
			{/snippet}
			{#snippet figures()}<StatFigures figures={[{ value: view.average, label: "Avg Waking" }]} />{/snippet}
			{#snippet list()}
				<StatCardList items={view.days.map((d) => ({ key: d.date, title: d.weekday, detail: d.detail,
					value: d.value, kind: "day", onclick: () => move(dayCardRoute(d.date, today)) }))} />
			{/snippet}
		</StatPeriodLayout>
	{/snippet}
</StatPageShell>
```

The view behind it is `periodOf` for the span, `daysOf` and `dayAxis` for
the points and the axis, `periodLabel` for the label and `meanOf(values,
"round")` for the average.

## Error taxonomy

`src/garmin/errors.ts`. The distinction that matters most is **Blocked vs Auth**:
Garmin's edge can refuse a request outright, and burying that under a generic
"sync failed" sends users hunting for a password problem they do not have.

| Error | Means | Engine response |
| --- | --- | --- |
| `GarminAuthError` | Bad credentials, or a session past refreshing | Abandon the range |
| `GarminBlockedError` | The edge refused the client (bot challenge) | Abandon the range |
| `GarminRateLimitError` | HTTP 429 that outlasted the client's pause-and-retry, carries `retryAfter` | Abandon the range |
| `GarminApiError` | An ordinary non-2xx from the API tier | Warn, keep the day |
| `GarminNetworkError` | Never completed: offline, DNS, TLS | Warn, keep the day |
| `GarminMfaRequiredError` | MFA demanded, and the caller passed no prompt | Sign-in only |
| `GarminMfaCancelledError` | The person closed the code prompt | Sign-in only |

The rule: a failure that would repeat identically on every later request
abandons the whole range. A single endpoint failing for a single day is a
warning, and the rest of that day still gets written.

**403 is triaged.** A JSON 403 is the API declining; a non-JSON 403 is the edge
declining. Different problems, different errors.

## What the client does for you

`src/garmin/client.ts`:

- **Refreshes ahead of expiry** with a five-minute margin, reading `expires_in`
  from the response rather than assuming a lifetime. Observed values have ranged
  from 66,341 s to 97,344 s, so assuming is not safe.
- **One refresh for concurrent callers.** A day touching four endpoints at once
  triggers a single token exchange, not four.
- **401 → refresh once → retry once**, then give up. If a concurrent request
  already refreshed past the token that failed, the retry uses theirs.
- **Persists rotation.** Garmin may hand back a new refresh token on use;
  dropping it strands the session days later for no visible reason.
- **A failed re-login leaves a working session alone.** A 429 while signing in
  again should not sign you out of the session you had.

## Two things a port must get right

- **`requestUrl` throws on status ≥ 400** unless you pass `throw: false` — and a
  403 body is exactly what you need when diagnosing a challenge.
- **`requestUrl` keeps no cookie jar**, and its `headers` is
  `Record<string, string>`, so multiple `Set-Cookie` values arrive comma-joined.
  Cookie expiry dates contain commas too, so `splitSetCookie` splits only on a
  comma followed by a `token=`.

## Extending

### Add a metric

1. Add the field to the payload interface in `src/garmin/endpoints.ts`.
2. Map it in `mapDay` in `src/sync/metrics.ts`, using `metric()` so negative
   sentinels are dropped.
3. If the endpoint is in the daily contract check, add the field's path to
   `reads` on its entry in `api/endpoints.json` (`critical` if the plugin cannot
   do without it). See [api/README.md](../api/README.md).
4. Add a test in `tests/metrics.test.ts`.
5. Update [docs/properties.md](properties.md).

### Add a metric group

As above, plus:

1. A new member of `MetricGroup` and `ALL_GROUPS` (display order), and an
   entry in `endpointsFor()` so its requests are only made when
   the group is on — all in `src/sync/metrics.ts`.
2. Its cost for the settings tab, in the same file: `REQUESTS_PER_DAY`, or
   `FREE_GROUPS` when it rides along in the daily summary, `REQUESTS_PER_SYNC`
   for a once-a-sync group, `RANGE_GROUPS` for one range request a sync.
3. Its label in `GROUP_LABELS` (`src/ui/svelte/SettingsPanel.svelte`).
4. Bump `SETTINGS_VERSION` (`src/settings-data.ts`) and add the group to
   `migrate()` in `src/plugin-data.ts`, so an existing vault gets it switched on
   once while a group someone turned off stays off. Extend
   `tests/plugin-data.test.ts`.
5. The group on the endpoint's entry in `api/endpoints.json` (`groups`).

### Add a chart

The UI is **Svelte 5**, set up the way [Obsidian's guide][svelte-guide]
prescribes: `esbuild-svelte` in the build, components mounted with `mount()`
and torn down with `unmount()`. Charts are hand-drawn SVG — no chart library,
because a plugin cannot load external scripts and a bundled library would be
dead weight on a phone. The one exception is the activity map's Leaflet
(`src/ui/map/leaflet.ts`): panning and pinching a tiled map on a phone is where
hand-rolled code breaks. It is bundled, evaluated only when the first map
draws, and its ES module build leaves `window.L` to whichever plugin owns it.
A chart is markup, and its geometry (where the marks go) lives in a pure
`*-charts.ts` module beside the page's view model, so it is unit-tested
without a DOM.

**Settings keep native controls.** The settings panel is a Svelte component,
but every row is built with Obsidian's own `Setting` API through a small action
(`src/ui/svelte/obsidian-setting.ts`). Hand-rolled toggles and sliders would
re-implement Obsidian's look and its mobile behaviour and get both subtly wrong.
Svelte decides which rows exist, so a row can come and go without rebuilding
the pane and losing your scroll position.

[svelte-guide]: https://docs.obsidian.md/Plugins/Getting+started/Use+Svelte+in+your+plugin

## Testing

Tests bundle with esbuild and run on Node's built-in runner — no network, no
Obsidian. `pretest` clears `tests/.build` first, so a deleted test cannot keep
passing from an old bundle. `FixtureHttpClient` (`tests/support/fixture-http.ts`)
replays canned responses in order, which is how sequences like "401, then
refresh, then success" and "first DI client ID rejected, second accepted" are
expressed.

Nothing of ours is mocked. The fixtures sit at the **transport** seam and the
engine's doubles sit at the **day-target** seam, so what is under test is the
real code. That is the payoff from the two seams.

What the suite pins down beyond the seams:

- **Golden numbers.** Each page's view-model tests assert the figures the
  phone showed when the page was specified. A change that moves one needs a
  reason, not a new expected value.
- **`data.json`.** `tests/plugin-data.test.ts` covers the allowlist read, the
  group migrations and what a save may carry.
- **The API catalogue, offline.** `tests/api-catalogue.test.ts` and its
  neighbours check `api/endpoints.json` against the probes and the recorded
  shapes, with no account.
- **Release notes.** `tests/release-notes.test.ts` reads the real
  `CHANGELOG.md`, so a release can always find its notes.

```bash
npm test                          # the suite, no network
npm run build                     # typecheck → svelte-check → tests → bundle → mobile check
scripts/dev/test.sh 'stress-*'    # only the matching tests, in tests/.build-<slug>/,
                                  # so runs in parallel do not overwrite each other
```

`npm run build` fails if a node or electron require reaches the bundle — that
is what backs `isDesktopOnly: false`. CI runs it on every pull request and every
push to `main` (`.github/workflows/ci.yml`).
