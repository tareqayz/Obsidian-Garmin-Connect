# Garmin API reference

Every Garmin endpoint this plugin calls, which metric group triggers it, and
what the request budget works out to. Source: `src/garmin/endpoints.ts` and
`src/garmin/constants.ts`.

For the full surface — all 167 catalogued endpoints, their request shapes,
and the response fields observed at each one — see
[`api/endpoints.json`](../api/endpoints.json) and
[`api/README.md`](../api/README.md). This page is the narrow, prose version:
what the plugin uses and why.

This mirrors [`cyberjunky/python-garminconnect`](https://github.com/cyberjunky/python-garminconnect)
at master — specifically the post-2026-03 rewrite that dropped `garth`. The old
OAuth1 `preauthorized` / `exchange/user/2.0` flow is gone.

## Hosts

Derived from the `domain` setting (`garmin.com`, or `garmin.cn` for China):

| Name | Host | Role |
| --- | --- | --- |
| `sso` | `sso.{domain}` | Login and MFA |
| `diToken` | `diauth.{domain}/di-oauth2-service/oauth/token` | Ticket → bearer token |
| `connectApi` | `connectapi.{domain}` | Everything below |
| `iosService` | `mobile.integration.{domain}/gcm/ios` | The service URL the ticket is bound to |

## Authentication

No OAuth1, no HMAC signing, which is why it ports to TypeScript cleanly.

| Step | Request |
| --- | --- |
| 0 | `GET {sso}/mobile/api/login` — credential-free reachability check. The endpoint is POST-only, so a JSON `405` means the edge let you through. A `403` means it did not. |
| 1 | `POST {sso}/mobile/api/login` — JSON body, iOS client. Returns a service ticket. |
| 2 | `POST {sso}/mobile/api/mfa/verifyCode`, when step 1 answers `MFA_REQUIRED`. Carries the cookies step 1 set — the two POSTs share one `CookieJar`, because `requestUrl` keeps no jar of its own. Up to `MFA_MAX_ATTEMPTS` codes per sign-in. |
| 3 | `POST {diToken}` — exchanges the ticket for OAuth2 bearer tokens, HTTP Basic with an empty password. |
| 4 | Any `connectapi` call, to confirm the API tier accepts the token. |

The service URL at step 3 **must match** the one used at login, or DI rejects
the ticket.

### Client IDs

`DI_CLIENT_IDS` is tried in order; the first returning 200 wins. **Garmin rotates
these roughly quarterly**, so a step-3 failure after a successful step 1 usually
means the list is stale — check it against `python-garminconnect` master.

```
GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2
GARMIN_CONNECT_MOBILE_ANDROID_DI_2024Q4
GARMIN_CONNECT_MOBILE_ANDROID_DI
GARMIN_CONNECT_MOBILE_IOS_DI
```

### Headers

Authenticated calls carry the Android app's header set (`nativeHeaders()`):
`User-Agent: GCM-Android-5.23`, `X-Garmin-User-Agent`,
`X-Garmin-Paired-App-Version`, `X-Garmin-Client-Platform`, `X-App-Ver`,
`X-Lang`, `X-GCExperience`, `Accept-Language`.

Login uses an iOS User-Agent instead (`IOS_LOGIN_UA`) with the `GCM_IOS_DARK`
SSO client.

## Profile

| Method | Path | Notes |
| --- | --- | --- |
| `socialProfile()` | `/userprofile-service/socialProfile` | Caches `displayName`, which most wellness URLs interpolate. |
| `userSettings()` | `/userprofile-service/userprofile/user-settings` | The `auto` unit setting, the account's sex for `profile`, and the height Weight's BMI needs. |

`requireDisplayName()` **URL-encodes** the display name before interpolating it,
so a hostile or corrupted profile response cannot inject path segments.

## Per-day endpoints

One request per day synced, for the groups that are on.

| Method | Path | Group |
| --- | --- | --- |
| `dailySummary(date)` | `/usersummary-service/usersummary/daily/{who}?calendarDate=` | `activity`, `heart`, `stress`, `respiration`, `spo2` |
| `sleep(date)` | `/wellness-service/wellness/dailySleepData/{who}` | `sleep` |
| `hrv(date)` | `/hrv-service/hrv/{date}` | `hrv` |
| `trainingReadiness(date)` | `/metrics-service/metrics/trainingreadiness/{date}` | `readiness` |
| `enduranceScore(date)` | `/metrics-service/metrics/endurancescore?calendarDate=` | `fitness` |
| `fitnessAge(date)` | `/fitnessage-service/fitnessage/{date}` | `fitness` |
| `trainingStatus(date)` | `/metrics-service/metrics/trainingstatus/aggregated/{date}` | `training` |
| `bodyComposition(date)` | `/weight-service/weight/dayview/{date}?includeAll=true` | `body` |
| `healthStatus(date)` | `POST /graphql-gateway/graphql` — `healthStatusSummary` | `health` |

`dailySummary` serves **five groups from one request**, so switching off just
one of them saves nothing. Respiration and pulse ox in particular cost no
requests at all.

`enduranceScore` stays per day: only the day route sends the day's class and
feedback phrase. The Endurance Score history comes from the range form with
`aggregation=daily` (see [History index endpoints](#history-index-endpoints)).

`dailySummary` throws `GarminAuthError` if the response comes back
`privacyProtected: true`. That means the session is not fully authorised, which
is a different problem from a 401.

### GraphQL

`graphql(query)` posts to `/graphql-gateway/graphql`, the gateway the web app
uses, with the same Bearer token as everything else. The sync uses it for
Health Status, Health Snapshots, hill score, cycling ability and the My Day
event list. Queries are inline strings, as the web app sends them. Health
Status and Health Snapshots also have REST routes, which the
[Health Stats pages](#health-stats-pages) use.

### More range calls

| Method | Path | Group | Window |
| --- | --- | --- | --- |
| `hillScores(start, end)` | GraphQL `hillScoreScalar` (a proxy of `/metrics-service/metrics/hillscore/stats`) | `fitness` | 365 days (Garmin's cap is 401) |
| `runningTolerance(start, end)` | `/metrics-service/metrics/runningtolerance/stats?aggregation=daily` | `training` | 365 days (Garmin's cap is 366) |
| `healthSnapshots(start, end)` | GraphQL `healthSnapshotScalar` | `health` | 28 days |

The web app asks for a week of snapshots, and nobody has published that
route's limit; staying within what it asks for is the safe side of an unknown
cap. The others' caps were measured on 2026-10-12: hill score takes 401 days
(402 is HTTP 400), running tolerance 366 (367 is HTTP 400, across a Feb 29
too).

### Once per sync (`profile`)

About nine requests, written to `account.json`:
- `lastUsedDevice`, `lactateThreshold`, `runningEconomy`, `trainingPlans`,
  `personalRecords` and `userSettings`;
- `powerToWeight`, one call with no sport filter, which returns a row per
  sport;
- `cyclingAbility` and `upcomingEvents`, both GraphQL.

See [properties → profile](properties.md#profile--accountjson).

### Intraday (newest seven days of a sync only)

Six requests a day, for the `intraday` group:

| Method | Path | Fills |
| --- | --- | --- |
| `stress(date)` | `/wellness-service/wellness/dailyStress/{date}` | stress and Body Battery |
| `heartRate(date)` | `/wellness-service/wellness/dailyHeartRate/{who}?date=` | heart rate |
| `stepsChart(date)` | `/wellness-service/wellness/dailySummaryChart/{who}?date=` | steps |
| `floorsChart(date)` | `/wellness-service/wellness/floorsChartData/daily/{date}` | floors, in 15-minute buckets |
| `intensityMinutesChart(date)` | `/wellness-service/wellness/daily/im/{date}` | intensity minutes, in 15-minute buckets |
| `bodyBatteryEvents(date)` | `/wellness-service/wellness/bodyBattery/events/{date}` | Body Battery events |

These go to `<dataFolder>/series/<date>.json`, not the day files. See
[properties → intraday](properties.md#intraday). `INTRADAY_DAYS` in
`src/sync/engine.ts` sets the window. A Health Stats page opening an older day
asks for that day's blocks when it opens, one day at a time, and only while
nothing else is syncing.

## Range endpoints

These are called once for the whole run, in windows of up to a year.

| Method | Path | Group |
| --- | --- | --- |
| `maxMetrics(start, end)` | `/metrics-service/metrics/maxmet/daily/{start}/{end}` | `fitness` |
| `racePredictions(start, end)` | `/metrics-service/metrics/racepredictions/daily/{who}?fromCalendarDate=&toCalendarDate=` | `races` |
| `activities(start, limit)` | `/activitylist-service/activities/search/activities?start=&limit=` | `workouts` |

`racePredictions` **rejects ranges longer than a year**, so a long backfill is
cut into years (`RANGE_CHUNK_DAYS`).

`activities` is paged rather than dated. A sync pages back through it, 50 at a
time, to the run's oldest day, and files each activity under the local calendar
day it started on.

## History index endpoints

The pages inside Home read history indexes the sync keeps beside the day files (see
[properties → history indexes](properties.md#history-indexes)). These routes
fill the ones that are not Health Stats:

| Method | Path | Index | Per request |
| --- | --- | --- | --- |
| `dailyStepStats(start, end)` | `/usersummary-service/stats/steps/daily/{start}/{end}` | `daily-stats/` | 28 days |
| `dailyFloorStats(start, end)` | `/usersummary-service/stats/floors/daily/{start}/{end}` | `daily-stats/` | 28 days |
| `dailyIntensityStats(start, end)` | `/usersummary-service/stats/im/daily/{start}/{end}` | `daily-stats/` | 28 days |
| `sleepStats(start, end)` | `/sleep-service/stats/sleep/daily/{start}/{end}` | `sleep/` | 28 nights |
| `activityCount()` | `/activitylist-service/activities/count` | `activities/` | how long the list is |
| `activities(start, limit)` | as above | `activities/` | 100 activities |
| `hrvDaily(start, end)` | `/hrv-service/hrv/daily/{start}/{end}` | `hrv-status/` | 367 days, Garmin's cap |
| `trainingStatusWeekly(start, end)` | `/metrics-service/metrics/trainingstatus/weekly/{who}`: a row a day, despite the name | `training-status/` | 365 days (no cap found) |
| `enduranceStats(start, end, "daily")` | `/metrics-service/metrics/endurancescore/stats?aggregation=daily` | `endurance-score/` | 365 days (Garmin's cap is 401) |
| `runningTolerance(start, end, "weekly")` | `/metrics-service/metrics/runningtolerance/stats?aggregation=weekly`: Sunday weeks, to date | `running-tolerance-weeks/` | 350 days, widened to whole weeks (Garmin's cap is 366) |
| `trainingReadinessRange(start, end)` | `/metrics-service/metrics/trainingreadiness/{start}/{end}`: every reading, newest first | `training-readiness/` | 367 days, Garmin's cap |
| `functionalThresholdPowerRange(start, end)`, `powerToWeightRange(start, end)` | `/biometric-service/stats/functionalThresholdPower/range/{start}/{end}`, `/biometric-service/stats/powerToWeight/range/{start}/{end}?aggregation=daily`: change points, every sport | `ftp/` | 367 days (Garmin's cap: end − start ≤ 366), two requests a window |
| `lactateThresholdHeartRateRange(start, end)`, `lactateThresholdSpeedRange(start, end)` | `/biometric-service/stats/lactateThresholdHeartRate/range/{start}/{end}`, `…/lactateThresholdSpeed/range/{start}/{end}`: change points, sport `RUNNING` | `lactate-threshold/` | 367 days (Garmin's cap: end − start ≤ 366), two requests a window |
| `runningEconomyDaily(start, end)` | `/metrics-service/metrics/runningeconomy/daily?startDate=&endDate=` | `running-economy/` | 366 days (Garmin's cap: one calendar year) |
| `criticalSwimSpeedRange(start, end)` | `/biometric-service/criticalSwimSpeed/range/{start}/{end}` | `critical-swim-speed/` | 367 days (Garmin's cap: end − start ≤ 366) |
| `hrvStressDaily(start, end)` | `/metrics-service/internal/manualstresslevel/daily/{pk}/{start}/{end}`: the manual HRV stress tests | `hrv-stress/` | 3660 days (no cap found); a reversed window is HTTP 500, so the wrapper refuses one |
| `heatAltitudeAcclimationDaily(start, end)` | `/metrics-service/metrics/heataltitudeacclimation/daily/{start}/{end}` | `heat-acclimation/` | 365 days (no cap found) |

A routine sync takes the daily stats of the days it writes from the summaries it
fetched anyway. It asks the three stats routes only for days it could not
write, and for any gap since the index's newest day. The Performance Stats
indexes take a routine sync's days from what it fetched anyway (the day routes
and the range calls above), so the last eleven routes serve their history walks (running economy's, which the
day sync never asks, costs one request a sync); running tolerance's weeks
ask for the last two weeks again on each sync, one request.

## Health Stats pages

The Health Stats pages read routes the Garmin Connect web app uses, seen in its
own traffic on 2026-10-08, not the day sync's. A range route per page fills
that page's history index. A few day routes fill a 1d page when it opens. None
is GraphQL.

### Ranges

Days without data are left out rather than zero-filled. Past its cap a route
answers HTTP 400, and the caps differ by route. "None found" means a ten-year
span still answered; the indexes ask for up to ten years at a time from these.

| Method | Path | Index | Cap |
| --- | --- | --- | --- |
| `stressDaily(start, end)` | `/usersummary-service/stats/stress/daily/{start}/{end}` | `stress/` | 28 days |
| `bodyBatteryDaily(start, end)` | `/usersummary-service/stats/bodybattery/daily/{start}/{end}` | `body-battery/` | 28 days |
| `bodyBattery(start, end)` | `/wellness-service/wellness/bodyBattery/reports/daily?startDate=&endDate=` | `body-battery/`, with the above | 28 days asked |
| `heartRateDaily(start, end)` | `/usersummary-service/stats/heartRate/daily/{start}/{end}` | `heart-rate/` | 28 days |
| `fitnessAgeDaily(start, end)` | `/fitnessage-service/stats/daily/{start}/{end}` | `fitness-age/` | 29 days |
| `respirationDaily(start, end)` | `/usersummary-service/stats/respiration/daily/{start}/{end}` | `respiration/` | 31 days |
| `healthStatusRange(start, end)` | `/healthstatus-service/healthstatus/summary/{start}/{end}` | `health-status/` | none found |
| `weighIns(start, end)` | `/weight-service/weight/range/{start}/{end}?includeAll=true` | `weight/`, with `userSettings` for the height | none found |
| `acclimationDaily(start, end)` | `/wellness-service/stats/daily/acclimation?fromDate=&untilDate=` | `pulse-ox/` | none found |
| `bloodPressureRange(start, end)` | `/bloodpressure-service/bloodpressure/range/{start}/{end}?includeAll=true` | `blood-pressure/` | none found |

The `stats/…/daily` rows are `{calendarDate, values}`, except respiration's,
which are flat.

### Days and the 1d pages

| Method | Path | For |
| --- | --- | --- |
| `stress(date)`, `heartRate(date)` | as in [intraday](#intraday-newest-seven-days-of-a-sync-only) | a past day's Stress and Heart Rate 1d |
| `respiration(date)` | `/wellness-service/wellness/daily/respiration/{date}` | Respiration 1d, every two minutes |
| `spo2Acclimation(date)` | `/wellness-service/wellness/daily/spo2acclimation/{date}` | Pulse Ox 1d, with elevation |
| `fitnessAge(date)` | as in [per-day](#per-day-endpoints) | Fitness Age's Current page |
| `healthSnapshotList(until, start = 1, limit = 20)` | `/wellnessactivity-service/activity/summary/list` | the snapshot list, newest first; `start` counts from 1 |
| `wellnessActivities(date)` | `/wellnessactivity-service/activity/summary/{date}` | a day's snapshots |
| `healthSnapshotEpochs(uuid)` | `/wellnessactivity-service/activity/epoch/{uuid}` | a snapshot's samples, one a second |

## Activity details

An activity's page loads when it opens, never in a sync (see
[architecture](architecture.md#activity-details-on-view)). Ten requests the
first time — eight together, then the two that need the summary — and none
after: the answer is kept in the vault. With **Download runs** on, every run
without a file is loaded the same way between syncs, at least two seconds
apart.

| Method | Path | Gives the page |
| --- | --- | --- |
| `activity(id)` | `/activity-service/activity/{id}` | the summary: Overview and Stats, the notes, the device's id |
| `activityDetails(id, 2000, 4000)` | `/activity-service/activity/{id}/details?maxChartSize=&maxPolylineSize=` | the samples behind every chart and the route; past 2000 Garmin thins them (a 56-minute run's 3,363 come back as 1,694, extremes and averages kept) |
| `activitySplits(id)` | `/activity-service/activity/{id}/splits` | the laps, and where each ended for the map |
| `activityTypedSplits(id)` | `/activity-service/activity/{id}/typedsplits` | run/walk detection and workout intervals |
| `activityHrZones(id)` | `/activity-service/activity/{id}/hrTimeInZones` | time in each heart rate zone, with the zones' floors |
| `activityPowerZones(id)` | `/activity-service/activity/{id}/powerTimeInZones` | the same for power |
| `activityWeather(id)` | `/activity-service/activity/{id}/weather` | the map's weather chip; every field null indoors |
| `activityGear(id)` | `/gear-service/gear/filterGear?activityId=` | the Gear tab |
| `deviceAppInfo(versionPk)` | `/device-service/deviceservice/app-info/{deviceVersionPk}` | the watch's name and the firmware the activity was recorded on; the device list only knows today's |
| `weightLatest(date)` | `/weight-service/weight/latest?date=&ignorePriority=true` | the weight on the activity's day, for Power (W/kg) |

A treadmill run has no GPS columns, no elevation or grade-adjusted pace, and
null weather. Ids are positive integers, so they can only add digits to a path.

## Available but unused

These are implemented, tested and catalogued, and the daily check fetches them
too. Nothing in the plugin calls them yet:

| Method | Path | Notes |
| --- | --- | --- |
| `cyclingPowerCurve(start, end)` | `/fitnessstats-service/powerCurve?startDate=&endDate=` | Both dates inclusive, no cap; without dates, the all-time Record. Cycling Power Curve builds the same curves from the activity list's best powers instead, so it asks nothing. Catalogued, not checked. |
| `criticalSwimSpeedLatest(date)` | `/biometric-service/criticalSwimSpeed/latest/{date}` | The newest CSS result on or before the day; 204 (null) without one. Critical Swim Speed reads its index's newest row instead. |
| `heatAltitudeAcclimationWeekly(start, end)` | `/metrics-service/metrics/heataltitudeacclimation/weekly/{start}/{end}` | The daily rows sampled every seventh day, plus today. |
| `hillScoreStats(start, end, aggregation)` | `/metrics-service/metrics/hillscore/stats?startDate=&endDate=&aggregation=` | The REST route the hill score GraphQL query proxies; 401 days a call. |
| `maxMetricsLatest(date, sport)` | `/metrics-service/metrics/maxmet/latest/{date}?sport=` | The newest VO₂ Max per sport as of the day. |
| `maxMetricsWeekly(start, end, sport)`, `maxMetricsMonthly(start, end, sport)` | `/metrics-service/metrics/maxmet/weekly/{start}/{end}?sport=`, `…/monthly/…` | A row a week (Sunday to Saturday) or a month with a reading; VO₂ Max works its periods out from the daily index. |
| `racePredictionsLatest()` | `/metrics-service/metrics/racepredictions/latest/{who}` | Today's four predictions, in seconds. |
| `racePredictionsMonthly(start, end)` | `/metrics-service/metrics/racepredictions/monthly/{who}?fromCalendarDate=&toCalendarDate=` | A row a month, dated by its last day; Race Predictor samples its daily index at month ends instead. |
| `runningEconomyWeekly(start, end)` | `/metrics-service/metrics/runningeconomy/weekly?startDate=&endDate=` | 7-day blocks from `startDate`, each the block's lowest score: what Running Economy works out from its daily index. |
| `trainingLoadBalance(date)` | `/metrics-service/metrics/trainingloadbalance/latest/{date}` | Load focus as of a day, per device; Load Focus reads the day sync's values. |
| `trainingStatusDaily(date)` | `/metrics-service/metrics/trainingstatus/daily/{date}` | The aggregated route's day, plus `sinceDate`. |
| `trainingStatusMonthly(start, end)` | `/metrics-service/metrics/trainingstatus/monthly/{who}?fromCalendarDate=&toCalendarDate=` | Despite the name, a row every seventh day. |
| `healthStatusSummary(date)` | `/healthstatus-service/healthstatus/summary/{date}` | One night; 204 (null) until the night is scored. |
| `stressWeekly(end, weeks = 52)` | `/usersummary-service/stats/stress/weekly/{end}/{weeks}` | 52 weeks. The 1y pages average the daily index instead. |
| `heartRateWeekly(end, weeks = 52)` | `/usersummary-service/stats/heartRate/weekly/{end}/{weeks}` | 52 weeks. |
| `fitnessAgeWeekly(end, weeks = 52)` | `/fitnessage-service/stats/weekly/{end}/{weeks}` | 52 weeks. |
| `weightWeekly(start, end)` | `/weight-service/weight/weeklyRange/{start}/{end}` | Exactly 52 weeks. |
| `bloodPressureWeekly(start, end)` | `/bloodpressure-service/bloodpressure/weeklyRange/{start}/{end}` | Exactly 52 weeks. |
| `weightGoal(start, end)` | `/goal-service/goal/user/effective/weightgoal/{start}/{end}` | |
| `bloodPressureDay(date)` | `/bloodpressure-service/bloodpressure/dayview/{date}` | A day's readings. |
| `bloodPressureLast(start, end)` | `/bloodpressure-service/bloodpressure/daily/last/{start}/{end}` | Always an empty list on the recording account. |
| `heartRateZones()` | `/biometric-service/heartRateZones/` | Zone floors per sport profile, for shading the Heart Rate 1d line. |
| `healthSnapshotDetail(date, uuid)` | `/wellnessactivity-service/activity/summary/{date}/{uuid}` | 204 unless `date` is the snapshot's own. |
| `naps(date)` | `/sleep-service/sleep/naps/{date}?includeOverlaps=true` | Naps, on the web's 1d timelines. |
| `dailyEvents(date)` | `/wellness-service/wellness/dailyEvents/{who}?calendarDate=` | Move IQ events, on the timelines. |
| `activitiesForDay(date)` | `/activitylist-service/activities/fordailysummary/{who}?calendarDate=` | Activities, on the timelines. |
| `lifestyleLog(date)` | `/lifestylelogging-service/dailyLog/{date}` | Lifestyle Logging, which shows Garmin's empty state for now. |

Weekly rows are dated by the week's first day: stress sends a single `value`,
heart rate and fitness age a `values` map. The two weekly date-pair routes take
exactly 52 weeks, `end` 363 days after `start`, as the web's 2025-10-10 →
2026-10-08; every other span tried is a 400.

Wiring one in means a page or a property to put it in; see
[architecture](architecture.md).

## Request budget

A sync costs roughly:

```
(per-day requests) × (days in the range)
  + 6 × (the newest seven of those days, for intraday)
  + a few per sync
```

- **Per day**, with every group on, **nine** requests: the daily summary
  (which alone serves five groups), sleep, HRV, readiness, endurance, fitness
  age, training status, body composition and Health Status.
- **Per sync**:
  - about nine for `profile`;
  - one each for `maxMetrics` and `racePredictions` (one per year of a longer
    run);
  - one per year of the run each for hill score and running tolerance, one
    for running tolerance's weeks, and one per 28 days for Health Snapshots;
  - one per 50 activities in the run;
  - for each history index whose days the summaries do not cover, about one
    window request, plus its refresh window.

Five of the sixteen groups are free in request terms: `activity`, `heart`,
`stress`, `respiration` and `spo2` share the daily summary. The settings screen
marks each group's cost.

**History walks.** Once per account, each index fetches the whole history,
starting after the first sync of a session:

| Index | Cost |
| --- | --- |
| Activities | the count, then one request per 100 activities |
| Daily stats | three requests per 28 days, about 40 a year |
| Sleep | one per 28 nights, about 14 a year |
| Stress, Heart Rate, Fitness Age, Respiration | one per window, about 12–13 a year |
| Body Battery | two per window, about 26 a year |
| Health Status, Weight, Pulse Ox, Blood Pressure | one per ten years (Weight two: the height comes from `userSettings`) |

The walks run one after another, never beside a sync. A 429 stops a walk, and
the next session carries on from where it stopped.

**On view.** A page that needs what a sync didn't fetch asks for it when it
opens: a day's intraday blocks (one or two requests a day), or an activity's
page (ten requests, once per activity). These wait for any sync, run one at a
time at the same pace, and a 429 that outlasts the pause answers every one still waiting. **Download
runs** queues every run behind them (ten requests each, two seconds or more
apart) and stops at a 429 until the next sync.

The sync runs **newest day first**, so a run cut short by a rate limit has
already covered the days you care about most. Every request goes through one
throttle on the client (`src/garmin/throttle.ts`), paced by the **Sync speed**
setting; see [Request pace](#request-pace).

## Keeping this honest

Garmin ships changes to these payloads without notice and without a version, so
none of the above is guaranteed to still be true tomorrow.
`.github/workflows/api-contract.yml` runs every morning. It fetches the 69
checked endpoints, the unused ones included, through this plugin's own
`GarminApi`, and compares what comes back with the shapes recorded
in [`api/schema/`](../api/schema/).
- A field the plugin depends on that stops arriving opens an issue the same day.
- A field it merely reads is reported without failing the run.

`api/README.md` covers the verdicts, the setup, and how to accept a change.

## Behaviour worth knowing

- **Transient failures are retried at once; rate limits after a pause.** A
  request that comes back 5xx, or does not come back at all, is tried up to
  three times in all, with a jittered backoff (`MAX_ATTEMPTS` in
  `src/garmin/client.ts`). A 429 pauses *every* request the client makes for
  Garmin's `Retry-After` (30 s, then 60 s, without one), halves the pace, and
  tries again — twice at most (`RATE_LIMIT_RETRIES`), and never after a
  `Retry-After` over five minutes. Only then does it end the run. Another 4xx
  means the same thing however many times it is asked.
- **`expires_in` is not fixed.** It was 66,341 s on one run and 97,344 s on
  another, so the lifetime is always read from the response.
- **The login response glues seven cookies into one `Set-Cookie` header**, and
  cookie expiry dates contain commas, so the jar splits only on a comma followed
  by a `token=`.
- **Garmin does not enforce TLS fingerprinting on `/mobile/api/*`**, as
  measured below. That is a server-side policy, not a guarantee.
- **Rate limits are per IP** for login attempts, and repeated failures can lock
  an account.

## Request pace

Garmin publishes no rate limit for the API the plugin uses, so one was
measured: `npm run api:ramp` (or `api:ramp:eval`, inside Obsidian on the
plugin's own session) asks for the per-day endpoints a backfill does, at a
rising rate, and stops at the first 429, edge refusal, p95 latency three times
the first stage's, or 5% server errors.

On 2026-10-12, from a home connection, every stage ran clean:

| Stage (calls/s × in flight) | HTTP requests/s | Requests | p50 | p95 |
| --- | --- | --- | --- | --- |
| 1 × 3 | 2.0 | 121 | 256 ms | 533 ms |
| 4 × 9 | 8.0 | 479 | 257 ms | 616 ms |
| 8 × 15 | 15.9 | 957 | 257 ms | 484 ms |
| 12 × 20 | 23.7 | 1,433 | 256 ms | 430 ms |
| 16 × 24 | 31.7 | 1,910 | 262 ms | 539 ms |
| 24 × 36 | 47.4 | 2,862 | 254 ms | 405 ms |

About 8,800 requests in half an hour, no 429 and no slowdown. 47 requests a
second for a minute is a floor on the limit, not the limit. What a minute-long
test cannot see — a quota over hours, or an account flagged for the pattern —
is why the speeds stay well under it:

| Sync speed | Pace | Days at once | 30-day sync, measured |
| --- | --- | --- | --- |
| Gentle | 8 requests/s | 1 | 43 s |
| Normal (default) | 20 requests/s | 3 | 17 s |
| Fast | 32 requests/s | 5 | 12 s |

The old fixed 250 ms pause between days took 34 s for the same 30 days (344
requests): a day's requests go out together and the day lands with the slowest,
about 0.85 s, so the pace was set by latency and the pause, not by Garmin.
The days are now fetched a few at a time, and the calls before and after them
(the range endpoints, the index feeds, the account) side by side.

## TLS fingerprints

`python-garminconnect` installs `curl_cffi` to forge TLS fingerprints, and sleeps
10–20 s before login POSTs so Cloudflare's WAF does not flag the burst. From
Obsidian you get `requestUrl` — Electron's stack on the desktop, the OS HTTP
client on mobile — and you do not choose the fingerprint.

Measured 2026-09-12, both platforms authenticate end to end:

| | Desktop (Electron) | iOS (OS stack) | curl |
| --- | --- | --- | --- |
| JA4 | `t13d1516h2_8daaf6152771_02713d6af862` | `t13d2013h2_a09f3c656075_7f0f34a4126d` | — |
| UA override honoured | yes | yes | n/a |
| Login POST | 200 `SUCCESSFUL` | 200 `SUCCESSFUL` | 405 on GET |

Three different fingerprints all passed — including the desktop's, which is
Chromium TLS carrying an iPhone `User-Agent`, a mismatch Cloudflare did not
punish. **Garmin is not enforcing TLS fingerprinting on `/mobile/api/*`**, which
is why this works without `curl_cffi`. The human-facing sign-in page at
`/portal/sso/en-US/sign-in` returns a 403 challenge even to plain curl: the two
paths are in different protection buckets. Android, a third native stack, is
still unmeasured.

## If the edge tightens

Cheap things to try, all present in `python-garminconnect`, none needing TLS
forgery:

1. The Android client (`GCM_ANDROID_DARK` with the `/gcm/android` service URL)
   instead of iOS.
2. Matching more of the real app's header set and ordering.
3. The SSO embed widget flow, which uses an HTML form and lands in a different
   rate-limit bucket.
