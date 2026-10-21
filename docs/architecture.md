# Architecture

How the plugin is put together and why, for contributors and coding agents. What it does for a user
is in the [Guide](GUIDE.md); how the pages inside Home are built is in
[Building pages](building-pages.md).

**Code:** `src/main.ts` (entry), `src/garmin/` (talking to Garmin), `src/sync/` (syncing, storage,
the history download), `src/dashboard/` and `src/ui/` (pages and dialogs).

## Overview

`GarminPlugin` (`src/main.ts`) builds three things on load:
- a Garmin client, with the session from Obsidian's keychain;
- a `SyncRunner`, which runs every sync, history walk and on-view load;
- the `garmin-home` view, where every page lives.

The runner's engine fetches through the client and writes plain JSON into the data folder through
`VaultSeriesStore`. The pages read only those files, and ask the runner for anything a page needs
that a sync didn't fetch.

```mermaid
flowchart TB
  plugin["GarminPlugin (main.ts)"] --> data["PluginData: data.json"]
  plugin --> runner["SyncRunner (sync/runner.ts)"]
  plugin --> home["GarminHomeView + Svelte pages"]
  runner --> engine["engine.ts: syncRange, feedIndex, walkHistory"]
  runner --> store["VaultSeriesStore (sync/series-store.ts)"]
  engine --> api["GarminApi, extends GarminClient"]
  api --> tokens["SecretTokenStore: the keychain"]
  api --> http["HttpClient: requestUrl"]
  store --> folder[("Data folder: JSON files")]
  home --> store
  home -->|"loads on view"| runner
```

## The two seams

Everything else follows from these two.

**1. HTTP is injected.** The Garmin logic talks to an `HttpClient` interface (`src/http.ts`); the
implementation is chosen at the edge. The same sign-in and API code therefore runs unchanged on a
phone, in Node, and against recorded responses.

| Adapter | Used by | File |
| --- | --- | --- |
| `ObsidianHttpClient` (`requestUrl`) | the plugin, desktop and mobile | `src/obsidian-http.ts` |
| `FetchHttpClient` (`fetch`) | the API scripts: `api:check`, `api:token`, `api:ramp` | `scripts/api/fetch-http.ts` |
| `FixtureHttpClient` (recorded answers) | the tests | `tests/support/fixture-http.ts` |

Nothing in `src/garmin/` imports Obsidian at runtime. `secret-token-store.ts` imports its types
only, which are erased at build. A library written for Node bakes in Node assumptions (`https`,
cookie jars, `axios`) that a mobile WebView can't remove; starting transport-agnostic keeps one
codebase for all three.

**2. The day target is injected.** The sync engine writes days through a `DayTarget`:

```ts
interface DayTarget {
	exists(date: string): boolean;
	write(date: string, properties: Properties): Promise<WriteOutcome>;
}
```

That keeps the engine pure and testable with no Obsidian at all: dates, budgets, back-off and partial
failures. The target is a `DayBuffer` (`VaultSeriesStore.dayBuffer()`, `src/sync/days.ts`). It
answers yes to every `exists()`, holds the run's days, and writes each year file once when the
runner flushes it.

## Module map

A module marked *pure* has no runtime Obsidian import, no network of its own (a client is passed
in) and no clock beyond what is passed in. That is what makes it directly testable, so keep it pure
when adding to it.

### `src/`

| File | Role |
| --- | --- |
| `main.ts` | `GarminPlugin`: the views, commands, ribbon, settings tab, status bar and the uninstall watch |
| `settings.ts` | `GarminSettingTab`: every setting as a declarative definition, for Obsidian's settings search |
| `settings-data.ts` | `GarminSettings`, `DEFAULT_SETTINGS`, `SETTINGS_VERSION` — pure |
| `plugin-data.ts` | `PluginData`: owns `data.json` (settings and Home's state), its migrations, and moving an old session to the keychain |
| `http.ts` | `HttpClient`, `CookieJar`, `splitSetCookie` — imports nothing |
| `obsidian-http.ts` | `ObsidianHttpClient`, the `requestUrl` adapter |
| `log.ts` | the `Log` interface, the diagnostics renderer, redaction |
| `probe.ts` | **Run diagnostics**: network fingerprint, test login, session persistence, fitness endpoints |
| `debug-info.ts` | **Save debug info**: the redacted bug-report text, saved as a note |
| `uninstall-watch.ts` | after `onunload`, whether the plugin's folder is gone (an uninstall) — pure |
| `types.d.ts` | Leaflet's ES module build, typed as `leaflet` |

### `src/garmin/`

| File | Role |
| --- | --- |
| `constants.ts` | the hosts per domain, `DI_CLIENT_IDS`, `nativeHeaders()`, `IOS_LOGIN_UA` |
| `auth.ts` | sign-in: `loginWithMfa`, `exchangeServiceTicket`, `MFA_MAX_ATTEMPTS` |
| `tokens.ts` | `TokenStore`, expiry, `refreshAccessToken` |
| `secret-token-store.ts` | `SecretTokenStore`: the session in Obsidian's keychain under `SESSION_SECRET` (`garmin-connect-session`) |
| `client.ts` | `GarminClient`: the authenticated transport (see [the request pipeline](#the-request-pipeline)) |
| `throttle.ts` | `Throttle`: one pace for every API request, a token bucket plus a cap on requests in flight |
| `request-stats.ts` | `RequestStats`: what every API request cost, for reports and the ramp |
| `endpoints.ts` | `GarminApi extends GarminClient`: typed wrappers, REST and GraphQL |
| `errors.ts` | the typed failures (see [Errors](#errors)) |
| `device-names.ts` | sensor names by FIT product number, generated by `scripts/api/device-names.mjs` — pure |

### `src/sync/`

| File | Role |
| --- | --- |
| `runner.ts` | `SyncRunner`: turns settings into a run, runs the history walks, the scan, the backfill and on-view loads, and reports |
| `runner-lock.ts` | `RunnerLock`: one piece of work talks to Garmin at a time, by priority — pure |
| `engine.ts` | `syncRange`, `feedIndex`, `walkHistory`, the activity and stats walks, `recentRange` — pure |
| `metrics.ts` | `mapDay` (Garmin's payloads → a day's properties), `ALL_GROUPS`, `endpointsFor`, each group's request cost — pure |
| `numbers.ts` | `num`, `isFiniteNumber`, for Garmin's nulls and stray strings — pure |
| `intraday.ts` | `mapSeries`: intraday payloads → the day's series file — pure |
| `intraday-registry.ts`, `intraday-extras.ts` | `defineIntraday`, `keepBlocks`, `missingKeys`; `INTRADAY_EXTRAS` — pure |
| `account.ts` | `fetchAccount` and `account.json` — pure |
| `sync-state.ts` | `sync-state.json`: the recent sync's mark — pure |
| `speed.ts` | `SYNC_SPEEDS`: the pace and `parallelDays` of each **Sync speed** — pure |
| `fatal.ts` | `isFatal`: the errors that end a run — pure |
| `progress.ts`, `segments.ts` | the sync notice's progress bar; history walks a year of windows at a time — pure |
| `days.ts` | the day files: merging a day, a year file's text, `DayBuffer` — pure |
| `series-store.ts` | `VaultSeriesStore`: every file in the data folder |
| `file-health.ts` | setting aside a file it can't read; `NewerDataError` — pure |
| `vault-paths.ts` | folder helpers and rules |
| `activity-index.ts`, `daily-stats.ts`, `sleep-index.ts` | the activity, daily stats and sleep indexes — pure |
| `day-index.ts`, `day-indexes.ts`, `<stat>-index.ts` | `defineDayIndex`, `DAY_INDEXES` and every stat's index (see [Building pages](building-pages.md#day-indexes)) — pure |
| `activity-detail.ts` | an activity's page file: its blocks, `loadActivity`, `ACTIVITY_DETAIL_VERSION` — pure |
| `datasets.ts`, `coverage.ts` | `DATA_SETS`, versions, ranges, `consentKey`; `days/index.json` and `activity-details/index.json` — pure |
| `scan.ts`, `estimate.ts` | `scanAccount` and `scan.json`; bytes, requests and time for a choice, `HOURLY_BUDGET` — pure |
| `backfill.ts`, `debt.ts` | `planBackfill`, `backfill.json`, `RequestBudget`; `debtItems` and `pendingItems`, what an update offers — pure |
| `owned-paths.ts` | what **Delete synced data** removes — pure |

### `src/dashboard/` and `src/ui/`

| Path | Role |
| --- | --- |
| `dashboard/home-view.ts` | `GarminHomeView`: the Home view; reads the files and hands each page its props |
| `dashboard/legacy-view.ts` | turns a saved tab of the retired classic dashboard into Home |
| `dashboard/routes.ts`, `home.ts`, `glance.ts` | the page stack; Home's presets and numbers; At a Glance — pure |
| `dashboard/areas.ts` | the areas (Home, Activities, Health Stats, Performance Stats): each page's area, each area's pages, what the rail lights — pure. Drawn by `ui/svelte/home/AreaRail.svelte` (a wide pane) and `AreaTabs.svelte` (a phone) |
| `dashboard/series.ts`, `day.ts`, `periods.ts` | day rows and date words; periods, spans and labels — pure |
| `dashboard/stat-registry.ts`, `health-stats.ts`, `performance-stats.ts` | `StatDef`, `HEALTH_STATS`, `PERFORMANCE_STATS` — pure |
| `dashboard/stat-charts.ts`, `stat-dial.ts`, `stat-controls.ts`, `gauges.ts` | chart parts the stat pages share — pure |
| `dashboard/activities.ts`, `totals-chart.ts`, `activity-types.ts`, `all-activities.ts` | the Activities pages and their totals chart, Garmin's type table, All Activities — pure |
| `dashboard/activity-*.ts`, `cycling-activity-charts.ts`, `cycling-metrics.ts`, `swim-metrics.ts`, `sports/` | an activity's page: its sport profile, map, tabs, charts and wording — pure |
| `dashboard/stats-pages.ts`, `stats-charts.ts` | Steps, Floors and Intensity Minutes — pure |
| `dashboard/<stat>-pages.ts`, `<stat>-charts.ts`, `<stat>-copy.ts` | each Health and Performance Stats page (and Sleep): its view model, chart geometry and Garmin's wording — pure |
| `ui/*-modal.ts` | the dialogs: sign-in, setup, the update dialog, delete, "Garmin Connect was removed", diagnostics, date range, Add a Stat, Sleep History, and `SheetModal` for Garmin's bottom sheets |
| `ui/setup-flow.ts`, `ui/delete-data.ts` | the setup's views, its recommendation (`RECOMMENDED`) and what starting the download agrees to (pure); moving the plugin's files to the trash |
| `ui/icon.ts`, `ui/sport-icons.ts` | the ribbon icon (Lucide `watch`); the sport figures (Tabler, MIT) |
| `ui/map/` | Leaflet, loaded with the first map (`leaflet.ts`); OpenStreetMap tiles through `requestUrl`, cached in IndexedDB (`tiles.ts`); `tile-source.ts` (pure) |
| `ui/svelte/` | the Svelte components: the settings panel and dialogs at the top, then `home/`, `activities/`, `activity/`, `stats/`, `sleep/`, `health/`, `performance/`, `settings/`, `setup/`, and a folder per stat page |

The plugin registers two views. `garmin-home` is Home and every page opened from it.
`garmin-dashboard` belonged to the classic dashboard: `legacy-view.ts` keeps the type registered so
a workspace saved with that tab opens Home instead of a dead leaf.

## A sync, end to end

**Sync recent days** (the command, the view's ↻, or **Sync on startup** five seconds after load) runs
through `SyncRunner.syncRecent`:
1. It reads the mark in `sync-state.json` and asks `recentRange` for the days.
2. It makes one `lastUsedDevice()` call for the watch's last upload.
3. It hands the range to the engine. The engine fetches the activity list and the range calls first,
   then the days, newest first. `parallelDays` days are fetched ahead, but they are written in order.
4. After the days, the engine feeds the daily stats, sleep and day indexes side by side.
5. The runner flushes the day files, books the full days, fetches `account.json` and moves the mark.

```mermaid
sequenceDiagram
  participant R as SyncRunner
  participant E as syncRange
  participant G as GarminApi
  participant B as DayBuffer
  participant S as VaultSeriesStore
  R->>S: readSyncState
  R->>G: lastUsedDevice
  R->>E: from, to (recentRange), groups, parallelDays
  E->>G: activity list, then the range calls
  E->>S: merge the activity list into activities/
  loop each day, newest first
    E->>G: the day's requests
    E->>S: writeSeries, merged by keepBlocks
    E->>B: write(date, mapDay(payloads))
  end
  E->>S: daily stats, sleep and day indexes, in parallel
  R->>B: flush, one write per year file
  R->>G: fetchAccount, about nine requests
  R->>S: days/index.json, account.json, sync-state.json
```

- **What a day costs.** `endpointsFor(groups)` (`src/sync/metrics.ts`) picks only the calls the
  enabled groups need. The daily summary serves five groups at once, and the range calls run once
  for the window, not once per day. So a sync costs roughly the per-day calls times the days, plus
  six intraday calls for each day inside Day details, plus a small constant. The figures are in
  [Garmin API](garmin-api.md#request-budget).
- **What stops it.** A run stopped by a fatal error (see [Errors](#errors)) leaves the mark where it
  was, so the next sync covers its oldest days again. Anything else that fails is a warning, and the
  rest of the day is still written.
- **What it writes.** Only files whose text changes: an unchanged day leaves its year file
  untouched.

**Sync today** and **Sync a date range…** run the same way without the mark. A date range fetches
the timelines of every day it covers (`allTimelines`).

## The request pipeline

Every API request goes through `GarminClient.request` (`src/garmin/client.ts`); sign-in and token
refresh go straight to the HTTP client.
- **Token:** it takes a fresh access token first, refreshing once for all concurrent callers.
- **Retries:** it retries transient failures. A 429 pauses every request, and a 401 refreshes and
  retries once.
- **Errors:** `unwrap` turns the answer into data or a typed error.

```mermaid
flowchart TD
  req["request(path)"] --> fresh{"Access token fresh?"}
  fresh -->|no| refresh["One shared refresh; a rotated token is saved"]
  fresh -->|yes| send["Throttle.run, then send"]
  refresh --> send
  send --> transient{"5xx or no answer?"}
  transient -->|"yes, up to MAX_ATTEMPTS in all"| send
  transient -->|no| limited{"429?"}
  limited -->|"yes, up to RATE_LIMIT_RETRIES"| slow["Pause every request, slow the pace, send again"]
  slow --> limited
  limited -->|no| expired{"401?"}
  expired -->|"yes, once"| refresh
  expired -->|no| unwrap["unwrap: data, or a typed error"]
```

- **Refreshes ahead of expiry**, with a five-minute margin, reading `expires_in` from the response:
  Garmin's lifetimes vary.
- **Persists rotation.** Garmin may hand back a new refresh token on use. `SecretTokenStore` saves it
  at once, in the keychain local to this device and vault, never in `data.json`.
- **Only Garmin's own "no" ends a session.** A refresh answered with an OAuth error signs out. Any
  other failure keeps the session: a 403 page raises `GarminBlockedError`, a 429
  `GarminRateLimitError`, no answer `GarminNetworkError`, and anything else `GarminRefreshError`.
- **A failed re-login leaves a working session alone.**
- **403 is triaged.** A JSON 403 is the API declining one endpoint (`GarminApiError`). A non-JSON 403
  is Garmin's edge refusing the client (`GarminBlockedError`).

### Errors

`src/garmin/errors.ts`, plus `NewerDataError` (`src/sync/file-health.ts`). The distinction that
matters most is **blocked vs. auth**. Burying a refusal from Garmin's edge under "sync failed" sends
people hunting for a password problem they don't have.

| Error | Means | Fatal (`isFatal`) |
| --- | --- | --- |
| `GarminAuthError` | bad credentials, or a session past refreshing | yes: sign in again |
| `GarminBlockedError` | the edge refused the client (a bot check) | yes |
| `GarminRateLimitError` | a 429 that outlasted the client's pause-and-retry, with `retryAfter` | yes |
| `GarminRefreshError` | a refresh Garmin couldn't do just now; the session is kept | yes |
| `NewerDataError` | a newer build of the plugin wrote the files | yes |
| `GarminApiError` | an ordinary non-2xx from the API | no: a warning, the day is kept |
| `GarminNetworkError` | never completed: offline, DNS, TLS | no: a warning, the day is kept |
| `GarminMfaRequiredError`, `GarminMfaCancelledError` | MFA demanded with no prompt; the person closed it | sign-in only |

The rule: a failure that would repeat identically on every later request abandons the whole run. A
single endpoint failing for a single day is a warning, and the rest of that day is still written. A
day whose answers the mappers can't read fails alone and stays unfetched.

## Data sets and the backfill

Nothing walks history the user hasn't agreed to. What the setup offers, what the vault holds and
what is still missing are worked out from small files in the data folder. So the history download
(the *backfill* in code) keeps no plan of its own, and carries on after a restart, a 429 or another
device's turn.

```mermaid
flowchart LR
  setup["Setup: Download all history"] --> ledger[("data.accepted and data.deferred")]
  dialog["Update dialog: Download now"] --> ledger
  choice["Settings → History: a range"] --> ledger
  ledger --> plan["planBackfill: activities, walks, days, details"]
  plan --> checks{"Paused, held elsewhere, or over budget?"}
  checks -->|yes| wait["Wait, then look again"]
  checks -->|no| unit["Run one unit, about 10 s"]
  unit --> plan
```

### Data sets

`DATA_SETS` (`src/sync/datasets.ts`) names the three sets the setup offers:

| Set | Stores | Range (`data.*`) | Version |
| --- | --- | --- | --- |
| Charts & trends | the chart indexes: `activities/`, `daily-stats/`, `sleep/` and every `DAY_INDEXES` folder | always the whole history | each index's own |
| Day details | the day files and each day's full timelines (`series/`) | `dayDetails`: `new`, `30d`, `90d` (fallback), `1y`, `all` (recommended) | `DAY_DETAILS_VERSION` |
| Activity details | an activity's page, every sport (`activity-details/`) | `activityDetails`: `opened` (fallback), `90d`, `1y`, `all` (recommended) | `ACTIVITY_DETAILS_VERSION`, which is `ACTIVITY_DETAIL_VERSION` (`src/sync/activity-detail.ts`) |

A range says only how far back the backfill goes (`rangeStart`). Every new day is kept whatever the
range, because a routine sync fetches the timelines of its days inside the range (`intradayFor` in
the runner). Each set's `changes` say what a version added, for the update dialog; bumping a
version follows [Data versions](CONTRIBUTING.md#data-versions).

The setup recommends `all` for both (`RECOMMENDED` in `ui/setup-flow.ts`). The defaults,
`DEFAULT_DAY_DETAILS` and `DEFAULT_ACTIVITY_DETAILS`, are narrower on purpose: `dataOf` in
`plugin-data.ts` falls back to them for a range it can't read, and a fallback must never widen a
download already agreed to.

`estimate.ts` turns a scan and a choice into bytes, requests and time per set, for the setup and
Settings → History. Its sizes are `DAY_FILE_BYTES`, `TIMELINE_BYTES` and `DETAIL_BYTES`, measured on a
vault of 439 days and 233 runs. The times follow the sync speed, the ten-second units
(`CHUNK_SECONDS`) and the hourly budget.

### Coverage

The chart indexes keep their own span in each `index.json`. The other two sets each keep a file
beside their data (`coverage.ts`, read and written by `series-store.ts`):
- **`days/index.json`:** spans `[from, to, version]` of days whose details were fetched whole at that
  version of Day details. A day is whole (`DayResult.full`) when every request the run's groups ask
  of it came back, with data or without, and nothing failed to write.
- **`activity-details/index.json`:** each activity file's version, by activity id, updated by every
  write of a file.

Both are built the first time from the files already there. A copy another device overwrote can only
have lost entries, never claim one it didn't fetch. Home ignores both files.

### The consent ledger

`data.accepted` and `data.deferred` in the settings hold consent keys of the form
`<store>@<version>` (`consentKey`):
- `days@1` and `activity-details@6`;
- `activities@…`, `daily-stats@…` and `sleep@…`;
- `index:<kind>@<version>`;
- `runs@5`, Run details' key from when only runs had a page.

A new index, or a version bump, is a key the ledger hasn't seen.

- **`planBackfill` (`backfill.ts`)** walks a chart index once its key at today's version is agreed
  to: a bump reads as no index at all. Missing days and activities are fetched under any agreed
  version of their key, since they come back in today's shape. Those held at an older version are
  fetched only once today's key is agreed to. `runs@5` counts for runs only.
- **`debtItems` (`debt.ts`)** lists what has something to fetch and isn't agreed to at today's
  version: a chart index never walked, days or activities an older version saved, and the gaps in a
  set never agreed to. The first Garmin view of a session, signed in, shows those not put off in
  **New data for your history** (`askForUpdates` in `main.ts`). Settings → History lists them all.
- **The setup's choices** (`agreement` in `setup-flow.ts`). **Download all history**, or **Start
  download** under **Advanced options**, agrees to every chart key and both details keys, with the
  ranges chosen. Choosing a range in Settings → History agrees to its set's key.
- **Settings version 5** (`PluginData.migrate`, `plugin-data.ts`) takes a vault with a saved
  session as set up: Day details `30d`, Activity details from `downloadRuns`, and the chart keys
  agreed to. It leaves `days@1` out, so the first update dialog offers the recent days an older
  build saved without their timelines.
- **`onExternalSettingsChange`** takes only `setup` and `data` from another device's `data.json`.

### The account scan

`scanAccount` (`scan.ts`, run by `SyncRunner.scan` as foreground work) finds where the account's
history starts and ends, in about a request a year plus four (see
[Garmin API](garmin-api.md#account-scan)). It writes `scan.json` even when a request stopped it
early. The estimates read it, `planBackfill` leaves out the weeks it found empty, and every history
walk stops past the earlier of its first day and the oldest activity (`notBefore`). The setup also
starts the whole activity list and **Sync recent days** right after the scan.

### The backfill

The runner works through `planBackfill`'s tasks in order, a unit at a time, each about ten seconds
of work:

| Task | One unit |
| --- | --- |
| `activities` | the whole activity list, a request per hundred |
| `walk` | a segment (a year of windows, `segments.ts`) of as many chart walks side by side as the speed's `parallelDays`, each merged as it lands |
| `days` | a chunk of Day details sized to about `CHUNK_SECONDS` (`chunkDays`): each day's file and full timelines, written a year file at a time and booked in the coverage |
| `details` | one activity's page (`loadActivityFor`), at least two seconds after the last |

**Before each unit** the runner reads `backfill.json`, fresh rather than cached, and checks:
1. **A pause still holds** (table below).
2. **Another device's lease is younger than `LEASE_MS`** (ten minutes): this device looks again in
   five.
3. **Anything is left to do.**
4. **The unit fits the hourly budget.** `RequestBudget` keeps the last hour's requests under
   `HOURLY_BUDGET` (`src/sync/estimate.ts`), counting every request the client made: syncs, units,
   page loads and retries. Its hour is kept in local storage, so a restart doesn't reset it.
5. **Then** it renews its lease (at most once a minute: an id in local storage, a label such as
   "Mac", a heartbeat) and runs the unit.

| Pause | Set when | Holds |
| --- | --- | --- |
| `user` | **Pause** | until **Resume**, on every device sharing the file |
| `sign-in` | the session ended | until a sign-in |
| `rate-limit` | a 429 outlasted the client's retries | 5 minutes, doubling to an hour (`rateLimitWait`) |
| `blocked` | Garmin's edge refused the device | 30 minutes, doubling to 12 hours (`blockedWait`) |
| `error` | a unit failed for another reason | ten minutes; a unit that fails three times in a row is skipped for the session (`MAX_UNIT_FAILURES`) |
| this device only | a failed token refresh (`GarminRefreshError`) | 5 minutes doubling to an hour, without touching `backfill.json` |
| this device only (`update`) | `NewerDataError`: another device runs a newer build | until the plugin is updated here |

Days, activities and walks whose requests failed are left for the next session.

The backfill starts in these cases:
- 8 s after the layout is ready (`STARTUP_BACKFILL_DELAY_MS`);
- after every sync that finished;
- when a choice changes, after a sign-in, or when another device's settings arrive.

`stop()` on unload ends the unit in hand at its next day or window. `onBackfill` reports a
`BackfillProgress` to Home's pill, Settings → History and, on a computer, the status bar.

### The runner lock

`RunnerLock` (`runner-lock.ts`) gives the runner to one piece of work at a time, by priority:
1. **foreground:** a sync, a history command or the scan. It waits for the holder and goes next. A
   second foreground request is turned away while one holds or waits, so two syncs never queue.
   **Run diagnostics** checks that need the session are refused the same way.
2. **page:** an on-view load. It goes after any foreground work that is waiting.
3. **background:** a backfill unit. It starts only when nothing waits, so it delays nothing for
   longer than the unit in hand.

The lock passes from holder to waiter inside the release, so nothing slips in between. The drain
(`drainIntraday`) takes a page's day, then a page's activity, then a backfill unit.

## Deleting and the uninstall watch

**Delete synced data** (`owned-paths.ts`, `delete-data.ts`) removes the folders the sync writes:
`OWNED_FOLDERS` plus the registered indexes' folders. Each folder goes whole only when everything in
it is the plugin's. It also removes the top-level files in `OWNED_FILES`, conflict copies included,
and then the data folder and its parent once each is empty. With the box ticked, it also takes the
`garmin-probe-*.md` and `garmin-debug-*.md` notes in the log folder. Nothing else is touched, since
the data folder may hold notes. The plugin then resets `setup` and `data`, so no backfill fetches the data
straight back.

Obsidian has no uninstall hook: uninstalling runs `onunload` and then deletes the plugin's folder,
while a disable or an update leaves the folder.
- **The check.** `watchForUninstall` (`uninstall-watch.ts`) looks again at 1.5, 4, 10 and 15 s
  (`UNINSTALL_CHECKS`), with plain timers. It acts only when the folder is missing two checks in a
  row.
- **What it clears.** `forgetThisDevice` (`main.ts`) deletes the map tiles' IndexedDB (`TILE_DB`) and
  the local-storage keys `garmin-connect-device`, `garmin-connect-hide-sign-in`,
  `garmin-connect-budget` and `garmin-connect-had-session`, and empties the keychain secret.
- **The prompt.** While the data folder still holds the plugin's files, it opens "Garmin Connect was
  removed" (`removed-data-modal.ts`), which brings its own styles. A folder deleted by hand, or an
  uninstall on another device, gets no prompt.

## Extending the sync

### Add a metric

1. Add the field to the payload interface in `src/garmin/endpoints.ts`.
2. Map it in `mapDay` (`src/sync/metrics.ts`), using `metric()` so negative sentinels are dropped.
3. If the endpoint is in the daily contract check, add the field's path to `reads` on its entry in
   `api/endpoints.json`, or to `critical` if the plugin can't do without it. See
   [api/README.md](../api/README.md).
4. Add a test in `tests/metrics.test.ts`.
5. Document the key in the [Data reference](properties.md).
6. If the days a vault already holds should get it too, bump `DAY_DETAILS_VERSION` (see
   [Data versions](CONTRIBUTING.md#data-versions)). The shape test doesn't see a new field from an
   endpoint already called.

### Add a metric group

As above, plus:
1. A new member of `MetricGroup` and `ALL_GROUPS` (display order), and an entry in `endpointsFor()`
   so its requests are made only while the group is on. All of these are in `src/sync/metrics.ts`.
2. Its cost for the settings tab, in the same file:
   - `REQUESTS_PER_DAY`;
   - or `FREE_GROUPS` when it rides along in the daily summary;
   - `REQUESTS_PER_SYNC` for a once-a-sync group;
   - `RANGE_GROUPS` for one range request a sync.
3. Its row in `GROUPS` (`src/settings.ts`): a short name, what it holds in a few words, and search
   aliases for what the line leaves out.
4. Bump `SETTINGS_VERSION` (`src/settings-data.ts`) and switch the group on in
   `PluginData.migrate` (`src/plugin-data.ts`), so an existing vault gets it once while a group
   someone turned off stays off. Extend `tests/plugin-data.test.ts`.
5. Put the group on the endpoint's entry in `api/endpoints.json` (`groups`).
6. A new request changes what Day details fetch, so `tests/dataset-shapes.test.ts` fails until
   `DAY_DETAILS_VERSION` is bumped and the shape recorded. Add the `changes` line too: no test
   checks it.

A new page with its own history is a day index instead: see [Building pages](building-pages.md).

## Testing

The tests are bundled with esbuild and run on Node's built-in runner, with no network and no
Obsidian. `pretest` clears `tests/.build` first, so a deleted test can't keep passing from an old
bundle.

Nothing of ours is mocked. The fixtures sit at the **transport** seam: `FixtureHttpClient` replays
canned responses in order, which is how "401, then refresh, then success" is written. The engine's
doubles sit at the **day-target** seam. What is under test is the real code.

- **Golden numbers.** Each page's view-model tests assert the figures the phone showed when the page
  was specified. A change that moves one needs a reason, not a new expected value.
- **`data.json`.** `tests/plugin-data.test.ts` covers the allowlist read, the migrations, and moving
  an old session to the keychain.
- **Data versions.** `tests/dataset-shapes.test.ts` snapshots what each store keeps beside its
  version (`tests/fixtures/dataset-shapes.json`).
- **The API catalogue, offline.** `tests/api-catalogue.test.ts` and its neighbours check
  `api/endpoints.json` against the probes and the recorded shapes.
- **Release notes.** `tests/release-notes.test.ts` reads the real `CHANGELOG.md`.

```bash
npm test                          # the suite, no network
scripts/dev/test.sh 'stress-*'    # only the matching tests, in their own tests/.build-<slug>/
```

`npm run build` also fails if a node or electron import reaches the bundle
(`scripts/check-mobile-safe.mjs`); that is what backs `isDesktopOnly: false`. CI runs the build on
every pull request and every push to `main`.

## Two things a port must get right

- **`requestUrl` throws on status ≥ 400** unless you pass `throw: false`, and a 403's body is exactly
  what you need when diagnosing a challenge.
- **`requestUrl` keeps no cookie jar,** and its `headers` is `Record<string, string>`, so several
  `Set-Cookie` values arrive comma-joined. Cookie expiry dates contain commas too, so
  `splitSetCookie` splits only on a comma followed by a `token=`.
