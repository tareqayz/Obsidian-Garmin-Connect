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

`enduranceScore` is per-day deliberately: the range form of that endpoint
returns weekly averages, not daily values.

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

### More range calls (28-day windows)

| Method | Path | Group |
| --- | --- | --- |
| `hillScores(start, end)` | GraphQL `hillScoreScalar` | `fitness` |
| `runningTolerance(start, end)` | `/metrics-service/metrics/runningtolerance/stats?aggregation=daily` | `training` |
| `healthSnapshots(start, end)` | GraphQL `healthSnapshotScalar` | `health` |

The web app asks for 28 days of hill score and a week of snapshots, and nobody
has published these routes' limits. Staying within what it asks for is the
safe side of an unknown cap.

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

These go to `<dataFolder>/series/<date>.json`, not frontmatter. See
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

The pages inside Home read history indexes the sync keeps beside the notes (see
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

A routine sync takes the daily stats of the days it writes from the summaries it
fetched anyway. It asks the three stats routes only for days it could not
write, and for any gap since the index's newest day.

## Health Stats pages

The Health Stats pages read routes the Garmin Connect web app uses, seen in its
own traffic on 2026-10-08, not the note sync's. A range route per page fills
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

## Available but unused

These are implemented, tested and catalogued, and the daily check fetches them
too. Nothing in the plugin calls them yet:

| Method | Path | Notes |
| --- | --- | --- |
| `restingHeartRate(date)` | `/userstats-service/wellness/daily/{who}` | The daily summary already carries resting heart rate. |
| `healthStatusSummary(date)` | `/healthstatus-service/healthstatus/summary/{date}` | One night; 204 (null) until the night is scored. |
| `hrvDaily(start, end)` | `/hrv-service/hrv/daily/{start}/{end}` | 367-day cap. `{hrvSummaries}`, and 204 (null) when no night has any. |
| `stressWeekly(end, weeks = 52)` | `/usersummary-service/stats/stress/weekly/{end}/{weeks}` | 52 weeks. The 1y pages average the daily index instead. |
| `heartRateWeekly(end, weeks = 52)` | `/usersummary-service/stats/heartRate/weekly/{end}/{weeks}` | 52 weeks. |
| `fitnessAgeWeekly(end, weeks = 52)` | `/fitnessage-service/stats/weekly/{end}/{weeks}` | 52 weeks. |
| `weightWeekly(start, end)` | `/weight-service/weight/weeklyRange/{start}/{end}` | Exactly 52 weeks. |
| `bloodPressureWeekly(start, end)` | `/bloodpressure-service/bloodpressure/weeklyRange/{start}/{end}` | Exactly 52 weeks. |
| `weightLatest(date)` | `/weight-service/weight/latest?date=&ignorePriority=true` | The newest weigh-in on or before the date. |
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
(per-day requests) × (days with a writable note)
  + 6 × (the newest seven of those days, for intraday)
  + a few per sync
```

- **Per day**, with every group on, **nine** requests: the daily summary
  (which alone serves five groups), sleep, HRV, readiness, endurance, fitness
  age, training status, body composition and Health Status. Days that are not
  writable cost **nothing at all**, because `exists()` is consulted before any
  request is made.
- **Per sync**:
  - about nine for `profile`;
  - one each for `maxMetrics` and `racePredictions` (one per year of a longer
    run);
  - one per 28 days of the run each for hill score, running tolerance and
    Health Snapshots;
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

The sync runs **newest day first**, so a run cut short by a rate limit has
already covered the days you care about most. `pauseBetweenDays` (default
250 ms) throttles between days.

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

- **Transient failures are retried, rate limits are not.** A request that comes
  back 5xx, or does not come back at all, is tried up to three times in all,
  with a jittered backoff (`MAX_ATTEMPTS` in `src/garmin/client.ts`). A 429 is
  not retried: retrying is the precise wrong response to Garmin asking us to
  stop. A 4xx means the same thing however many times it is asked.
- **`expires_in` is not fixed.** It was 66,341 s on one run and 97,344 s on
  another, so the lifetime is always read from the response.
- **The login response glues seven cookies into one `Set-Cookie` header**, and
  cookie expiry dates contain commas, so the jar splits only on a comma followed
  by a `token=`.
- **Garmin does not enforce TLS fingerprinting on `/mobile/api/*`**, as
  measured below. That is a server-side policy, not a guarantee.
- **Rate limits are per IP** for login attempts, and repeated failures can lock
  an account.

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
