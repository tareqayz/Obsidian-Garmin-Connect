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
| `fetch` | the Node harness | `src/fetch-http.ts` |
| fixtures | tests | `src/testing/fixture-http.ts` |

So the same auth and API code runs unchanged on a phone, in Node, and against
recorded responses.

**2. The note target is injected.** The sync engine talks to a `NoteTarget`:

```ts
interface NoteTarget {
	exists(date: string): boolean;
	write(date: string, properties: Properties): Promise<WriteOutcome>;
}
```

That is the whole contract. It keeps the engine — dates, budgets, back-off,
partial failures — pure and testable with no Obsidian at all. Adding the
data-folder mode required **no engine change**: it is one more `NoteTarget`, and
"both" is `MultiTarget` wrapping two.

The reason "build `node-garminconnect` first, then consume it" fails is not that
libraries are wrong. It is that a Node library bakes in Node assumptions
(`https`, `tough-cookie`, `axios`) you then cannot remove for a mobile WebView.
Starting transport-agnostic gets you both.

## Module map

```
src/http.ts              HttpClient, CookieJar                — imports nothing
src/log.ts               the Log interface + probe renderer
src/garmin/
  constants.ts           endpoints, client IDs, native headers
  errors.ts              typed failures (Auth / Blocked / RateLimit / Api / Network)
  auth.ts                sign-in: login, MFA, ticket exchange
  tokens.ts              TokenStore, expiry, refresh
  client.ts              authenticated transport: refresh, 401 retry
  endpoints.ts           typed API wrappers (extends client)
src/sync/
  metrics.ts             Garmin payloads → properties     — pure
  diff.ts                the dirty check                  — pure
  bases-view.ts          generates the Bases table view   — pure
  link.ts                the graph hub link               — pure
  engine.ts              orchestration, MultiTarget, the history pager — pure
  activity-index.ts      the activity index: rows, merging, year files — pure
  daily-stats.ts         the daily stats index: rows, merging, year files — pure
  day-index.ts           defineDayIndex: a Health Stats day index from its description — pure
  day-indexes.ts         DAY_INDEXES, the registered day indexes — pure
  intraday-registry.ts   on-view intraday loads: the series file's own blocks, extras, loadDay — pure
  intraday-extras.ts     INTRADAY_EXTRAS, the registered extras — pure
  series-store.ts        series files, account.json, every index on disk
  daily-note.ts          NoteTarget: your daily notes
  data-folder.ts         NoteTarget: one note per day
  frontmatter.ts         shared dirty-checked write
  runner.ts              settings → a run, and reporting
src/dashboard/
  series.ts              rows → series, stats, formatting  — pure
  scales.ts              chart geometry, ticks, paths      — pure
  metrics.ts             what is shown and how it behaves  — pure
  collect.ts             reads days back out of the vault
  day.ts                 day-row lookups and date/number wording — pure
  home.ts                Home presets and the In Focus / Today numbers — pure
  glance.ts              At a Glance: the 36 stats, the list, each card's view — pure
  activities.ts          the Activities pages: categories, periods, totals, records — pure
  totals-chart.ts        a "<Metric> Totals" chart's geometry, measured off the app — pure
  stats-pages.ts         Steps, Floors, Intensity Minutes: periods, Garmin's rounding, rings, lists — pure
  stats-charts.ts        their charts' geometry, measured off the app — pure
  health-stats.ts        HEALTH_STATS: the Health Stats in the app's order, ranges, groups — pure
  periods.ts             the periods a range stat pages through: spans, 1y weeks, card routes, labels, means — pure
  stat-charts.ts         a Health Stats chart's box: frames, gridlines, the axis, gap-breaking lines — pure
  stress-pages.ts        Stress: the 1d, 7d, 4w and 1y view model — pure
  stress-charts.ts       Stress's chart frames and marks, and its ring — pure
  routes.ts              the page stack inside the Home view, and reading it back — pure
  home-view.ts           the Home ItemView: rows + series files + account.json + both indexes
  view.ts                the classic dashboard's ItemView, mounts Svelte
src/ui/svelte/           components; none import Obsidian except via an action
src/ui/svelte/home/      the Home screen, one component per Garmin card; SeeAll.svelte is
                         At a Glance's See All page and its edit mode; PageBar.svelte is the
                         back / title / action bar every page inside the view shares
src/ui/svelte/activities/ More, the Activities hub, a sport's page, a month, Personal Records
                         and All Activities, with their parts
src/ui/svelte/stats/     the Steps, Floors and Intensity Minutes page (StatsPage.svelte) and its
                         parts: the ring, the chart, the day cards
src/ui/svelte/health/    the Health Stats hub, HEALTH_PAGES and the props every stat page gets, and
                         the parts a stat page is built from (see "Building a stat page")
src/ui/svelte/stress/    the Stress page: its 1d and period bodies, the ring, the timeline, its colours
src/ui/sport-icons.ts    sport figures (Tabler, MIT) registered as Obsidian icons
src/ui/add-stat-modal.ts Add a Stat, the picker the edit mode opens
src/obsidian-http.ts     requestUrl adapter  — the only Obsidian import in the auth path
src/probe.ts             the four diagnostic probes
src/main.ts              plugin entry, commands, ribbon
```

Modules marked **pure** have no Obsidian import, no network and no clock beyond
what is passed in. That is what makes them directly testable, and it is worth
preserving when adding to them.

## Request flow for one sync

```
runner.ts        reads settings → builds SyncOptions, picks the NoteTarget(s)
   │
engine.ts        walks the range NEWEST → OLDEST
   │               ├─ target.exists(date)?  no, and not creating → skip, no request
   │               ├─ endpointsFor(groups) → only the calls this config needs
   │               ├─ per-day calls: summary, sleep, hrv, readiness, endurance
   │               └─ range calls (once for the whole window): maxMetrics,
   │                  racePredictions, activities
   │                     └─ the same listing is merged into the activity index
   │                        (series-store.ts), even when no note in the range is due
   │               └─ after the days: the summaries' steps, floors and minutes go to
   │                  the daily stats index; days without a note come from the range
   │                  endpoints (3 requests per 28 days)
   │               └─ then each registered day index whose group is on (see the
   │                  Health Stats foundation below)
   │
metrics.ts       mapDay(payloads) → canonical properties     (pure)
   │
link.ts          withLink() adds the graph hub property      (pure)
   │
frontmatter.ts   diff against existing frontmatter
   │               └─ nothing would change → "unchanged", file untouched
   │
target.write()   data-folder note, daily note, or both
```

Two details in there carry real weight:

- **`exists()` is consulted before any request.** A day with nowhere to go costs
  nothing, which is what makes a sparse daily-notes range cheap.
- **Range endpoints are called once for the window, not once per day.**
  `maxMetrics`, `racePredictions` and the activity list all take a range or page,
  so the request budget is roughly *groups needed × days with notes*, plus a
  small constant.

## The activity index and the pages inside Home

The Activities pages need every activity with Garmin's raw numbers, which the
day notes cannot give them (see `docs/properties.md`, "The activity index"). So
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
                                 without a note and any gap         │
                fetchDailyStatsHistory → 28 days a window, back ──┤   (the history: ~40 requests / year)
                                                                    ▼
daily-stats.ts      mergeDays · extendCoverage · serializeYear     (pure)
                                                                    ▼
series-store.ts     mergeDailyStats: one file per year, rewritten only on change
                                                                    ▼
home-view.ts        readDailyStats + the notes' calories → stats-pages.ts → the pages
```

A day's chart reads that day's series file, read when the page asks for it; the
file's `dayStart` puts the chart on the watch's clock, which need not be this
computer's. `SyncRunner.onStatsHistory` reports the history sync to their banner.

Home is a stack of pages (`routes.ts`): Home at the bottom, then See All, More,
Activities, a sport, a month, Personal Records, All Activities, Steps, Floors
or Intensity Minutes, Health Stats, Sleep, or any other Health Stats page. Back pops one;
a filter or a tab replaces the top rather than adding a step. The stack is the
view's state (`getState` / `setState`), so a reload comes back to the same page,
and the **Open activities**, **Open steps**, **Open floors** and **Open intensity
minutes** commands open the view through the same `setState`.

## Health Stats foundation

Every Health Stats page but Sleep is built on one shared route, one hub, one
way to keep a day index and one way to load a day's chart on view. A stat is
its own files plus three one-line registrations; nothing else shared changes.

### What a stat owns

| File | What goes in it |
| --- | --- |
| `src/sync/<stat>-index.ts` | its day index (`defineDayIndex`) and, when its day page needs a payload the series file does not have, its intraday extra (`defineIntraday`). No Obsidian import: the tests load every registered definition |
| `src/dashboard/<stat>-*.ts` | the view model and chart geometry, pure, with golden-number tests |
| `src/ui/svelte/<stat>/` | the page, taking `HealthStatPageProps` |
| `tests/<stat>-*.test.ts` | its tests |

### The three registrations

```ts
// src/sync/day-indexes.ts
import { STRESS_INDEX } from "./stress-index";
export const DAY_INDEXES: readonly DayIndexDef[] = [STRESS_INDEX];

// src/sync/intraday-extras.ts — only for a payload of the stat's own
import { STRESS_DAY } from "./stress-index";
export const INTRADAY_EXTRAS: readonly IntradayDef[] = [STRESS_DAY];

// src/ui/svelte/health/pages.ts
import StressPage from "../stress/StressPage.svelte";
export const HEALTH_PAGES: … = { stress: StressPage };
```

| Registration | What it switches on |
| --- | --- |
| `DAY_INDEXES` | routine syncs feed the index; the once-per-session history walk takes it in turn, while its group is on; a **Sync <title> history** command; `readIndex(kind)`; Home watches its folder |
| `INTRADAY_EXTRAS` | `loadIntraday(date, [key])` fetches the payload for any day and keeps it in the series file under `extra[key]` |
| `HEALTH_PAGES` | the stat's row in the hub, an **Open <stat>** command, its At a Glance card opening the page, and Home rendering it for the `health-stat` route |

`HEALTH_STATS` (`src/dashboard/health-stats.ts`) already lists every stat in
the app's order with its title, ranges, default range, settings group and At a
Glance cards. Ranges are provisional until a stat's spec confirms them; a
builder's integration note corrects its line. Stats reuse the settings'
existing groups, so no vault needs a migration.

### The route

`{ page: "health-stat", stat, range, offset, tab?, sub?, date? }`, opened with
`healthStatRoute(stat, opts?)`. Read back from saved state, an unknown stat (or
Sleep, which keeps its own route) is refused; a range the stat does not have
becomes its default; `offset` is a whole number at or below 0; `tab` and `sub`
are kept when they are short tokens and `date` when it is `YYYY-MM-DD`. What
`tab`, `sub` and `date` mean is the page's business — Health Status keeps the
metric sheet it has open in `sub`. A saved route whose page is not registered
shows a "not in this version" page rather than failing.

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
  given its own cap (the respiration range 31, fitness age 29, HRV 367, the
  weekly weight and blood pressure ranges 364; Health Status's range has none),
  up to 3660. `emptyWindowsToStop` windows in a row without a row end a
  history walk, once it is past the oldest activity; `maxHistoryDays` stops it
  where Garmin stops keeping the stat.
- **`refreshDays`** (0 by default) has every routine sync fetch the index's
  last days again, held or not, for a stat Garmin revises late: Health Status
  rescores days up to 26 days on. A row that comes back the same changes no
  file.
- **`fetchWindow(api, start, end)`** owns its request, through the API batch's
  wrapper or `api.request`. **`fromSummary(summary, date)`** makes the run's own
  days free: the daily summary is fetched anyway.
- Bump **`version`** when a row's meaning changes: an `index.json` of another
  version reads as none, and the history is fetched again.
- `defineDayIndex` throws on a definition that cannot work — a window over
  3660 days, a negative refresh, a folder the store already uses — so the
  mistake fails the build's tests.

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

A routine sync feeds an index without `fromSummary` one window request per
`windowDays` of the run. Index files do not rebuild Home: only the pages that
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
  day already waiting joins it, the usual pause separates days, and the
  automatic history walks let waiting loads in between walks. Signed out, or
  with the block's group off, a load resolves at once and `reason` says why. A
  429 answers every waiting load without asking again.
- A sync's own write of a day replaces the file, as it always has, extras and
  `checked` included. That is what keeps a recent day's on-view blocks fresh:
  the next view fetches them again.

A day page reads its series, and when `missingKeys(series, keys)` is not empty
shows the day's summary from its index while `loadIntraday` runs, as Sleep's
day view does before the night's file is in.

### What a page gets

`HealthStatPageProps` (`src/ui/svelte/health/pages.ts`): `route`, `today`,
`units`, `canSync`, `onBack`, `go`, `swap`, `readSeries`, `readIndex`,
`loadIntraday`, `onSyncHistory(kind)`, `versions` (by index kind), `seriesVersion`
and `history` (walks in progress, by kind). Re-read an index when
`versions[kind]` moves and the series when `seriesVersion` does. The history
banner (`activities/HistoryBanner.svelte`) shows while `history[kind]` is set
or the index's meta is not `complete`.

### Building a stat page

A stat page is the shared parts below plus the stat's own view model, chart
frames and marks. Stress is built this way (`src/ui/svelte/stress/`); start
from it, not from a copy of it.

| Shared part | What it gives a stat |
| --- | --- |
| `src/dashboard/periods.ts` | `periodOf` (7d, 4w, 1y rolling back from today, offsets a whole period), `rollingWeeks` and `weeksOf` (the 1y's 52 rolling weeks, each the rounded mean of its days), `switchRange`, `stepRoute`, `dayCardRoute`, `weekCardRoute`, the labels (`dayLabel` "Today" / "Wednesday, October 7", `periodLabel` "Oct 2 - 8" / "Oct 16-22, 2025", `yearLabel`, `weekTitle`, `cardDate`), the axes (`dayAxis` with its "MM-DD" ends, `monthAxis`), and `meanOf(values, rounding)`: `"floor"` for Stress, `"round"` (half up) for Body Battery, Heart Rate and Respiration |
| `src/dashboard/stat-charts.ts` | `ChartFrame` (a chart's insets and heights, measured off the stat's Figma frame, one for the phone and one for a pane's 748pt column), `plotBox(frame, width, ticks, axis)` (gridlines, y labels, the axis' dots and labels, and the scale for the stat's marks) and `linePath` (a line that breaks at a missing value) |
| `health/StatPageShell.svelte` | the sticky header — back and the stat's title, the range control with the stat's ranges from `HEALTH_STATS`, the period stepper (‹ disabled at the start of history, › only on a past period) — the history banner, and the phone and pane containers (640 and 1000pt) |
| `health/StatChart.svelte` | a chart under its title: the box at the width it gets, with `under` and `over` snippets for the stat's marks and a `footer` for its key |
| `health/StatFigures.svelte` | figures two to a row under a rule: the "Avg <metric>" block, or a day's tiles with a colour dot each |
| `health/StatCardList.svelte`, `StatCard.svelte` | a period's day or week cards, the figure on the right and an optional `visual` snippet beside it; one a row, two from 640pt, three in a pane |
| `health/StatDayLayout.svelte`, `StatPeriodLayout.svelte` | a 1d body (summary, then chart) and a 7d / 4w / 1y body (chart, figures, list), side by side in a pane |

`StatPageShell` takes the page's `route`, `today`, `onBack` and `swap` from
`HealthStatPageProps`, the period's `label` and `canGoBack` from the stat's
view, an optional `history` (`{ title, windowDays, complete, walking,
canSync, onSync }`, for the banner) and an optional `style` (custom
properties for the whole page, such as a stat's colours). It moves the page
itself; its body snippet gets `{ pane, move }`, so a card switches the page
with `move(dayCardRoute(date, today))`. Spacing defaults are the twin's for
Stress; a stat whose twin differs sets the layouts' custom properties
(`--stat-chart-top`, `--stat-chart-top-pane`, `--stat-figures-top-pane`,
`--stat-list-top`, `--stat-list-top-pane`).

What stays the stat's own: its view model's rules (what a figure is, its
rounding, its copy), its chart frames (measured off its own twin) and marks,
and anything only it draws — Stress's ring, colours and timeline stay in
`src/ui/svelte/stress/`.

A 7d / 4w page, sketched for a stat like Respiration:

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
| `GarminRateLimitError` | HTTP 429, carries `retryAfter` | Abandon the range |
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
3. Add the key to `byGroup` in `keysFor`, in display order.
4. Add a label to `METRIC_LABELS`, or the column header falls back to the raw key.
5. If the value is a duration in seconds, add it to `DURATION_KEYS`.
6. Add a test in `tests/metrics.test.ts`.
7. Update [docs/properties.md](properties.md).

### Add a metric group

As above, plus a new member of `MetricGroup` and `ALL_GROUPS`, and an entry in
`endpointsFor()` so the request is only made when the group is on.

### Add a storage target

Implement `NoteTarget` — two methods — and wire it in `runner.ts`. The engine
needs no change. `src/sync/data-folder.ts` is the smaller of the two existing
examples.

### Add a chart

The UI is **Svelte 5**, set up the way [Obsidian's guide][svelte-guide]
prescribes: `esbuild-svelte` in the build, components mounted with `mount()`
and torn down with `unmount()`. Charts are hand-drawn SVG — no chart library,
because a plugin cannot load external scripts and a bundled library would be
dead weight on a phone. A chart is markup, and its geometry (where the marks
go) lives in a pure `*-charts.ts` module beside the page's view model, so it is
unit-tested without a DOM.

**Settings keep native controls.** The settings panel is a Svelte component,
but every row is built with Obsidian's own `Setting` API through a small action
(`src/ui/svelte/obsidian-setting.ts`). Hand-rolled toggles and sliders would
re-implement Obsidian's look and its mobile behaviour and get both subtly wrong.
Svelte decides which rows exist, so switching storage mode shows and hides
sections instead of rebuilding the pane and losing your scroll position.

[svelte-guide]: https://docs.obsidian.md/Plugins/Getting+started/Use+Svelte+in+your+plugin

## Testing

Tests bundle with esbuild and run on Node's built-in runner — no network, no
Obsidian. `FixtureHttpClient` replays canned responses in order, which is how
sequences like "401, then refresh, then success" and "first DI client ID
rejected, second accepted" are expressed.

Nothing of ours is mocked. The fixtures sit at the **transport** seam and the
engine's doubles sit at the **note-target** seam, so what is under test is the
real code. That is the payoff from the two seams.

```bash
npm test                   # the suite, no network
npm run build              # typecheck → svelte-check → tests → bundle → mobile check
npm run preview:dashboard  # real Dashboard.svelte in a browser, synthetic data
npm run probe:node         # the real auth module under Node, step 0 only
```

`npm run build` fails if a node or electron require reaches the bundle. Keep
that in CI — it is what backs `isDesktopOnly: false`.
