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
| `userSettings()` | `/userprofile-service/userprofile/user-settings` | Used for the `auto` unit setting. |

`requireDisplayName()` **URL-encodes** the display name before interpolating it,
so a hostile or corrupted profile response cannot inject path segments.

## Per-day endpoints

One request per day synced.

| Method | Path | Group |
| --- | --- | --- |
| `dailySummary(date)` | `/usersummary-service/usersummary/daily/{who}?calendarDate=` | `activity`, `heart`, `stress` |
| `sleep(date)` | `/wellness-service/wellness/dailySleepData/{who}` | `sleep` |
| `hrv(date)` | `/hrv-service/hrv/{date}` | `hrv` |
| `trainingReadiness(date)` | `/metrics-service/metrics/trainingreadiness/{date}` | `readiness` |
| `enduranceScore(date)` | `/metrics-service/metrics/endurancescore?calendarDate=` | `fitness` |
| `trainingStatus(date)` | `/metrics-service/metrics/trainingstatus/aggregated/{date}` | `training` |
| `bodyComposition(date)` | `/weight-service/weight/dayview/{date}?includeAll=true` | `body` |
| `fitnessAge(date)` | `/fitnessage-service/fitnessage/{date}` | `fitness` |
| `healthStatus(date)` | `POST /graphql-gateway/graphql` — `healthStatusSummary` | `health` |

### GraphQL

`graphql(query)` posts to `/graphql-gateway/graphql`, the gateway the web app
uses, with the same Bearer token as everything else. Some metrics have no REST
route at all: Health Status, Health Snapshots, cycling ability, the My Day event
list. Queries are inline strings, as the web app sends them.

### More range calls (28-day windows)

| Method | Path | Group |
| --- | --- | --- |
| `hillScores(start, end)` | GraphQL `hillScoreScalar` | `fitness` |
| `runningTolerance(start, end)` | `/metrics-service/metrics/runningtolerance/stats?aggregation=daily` | `training` |
| `healthSnapshots(start, end)` | GraphQL `healthSnapshotScalar` | `health` |

### Once per sync (`profile`)

`lastUsedDevice`, `lactateThreshold`, `powerToWeight` (×2), `runningEconomy`,
`cyclingAbility`, `trainingPlans`, `upcomingEvents`, `personalRecords` and
`userSettings` → `account.json`. See [properties → profile](properties.md#profile--accountjson).

### Intraday (newest seven days of a sync only)

| Method | Path | Group |
| --- | --- | --- |
| `stress(date)` | `/wellness-service/wellness/dailyStress/{date}` | `intraday` — stress and Body Battery |
| `heartRate(date)` | `/wellness-service/wellness/dailyHeartRate/{who}?date=` | `intraday` |
| `stepsChart(date)` | `/wellness-service/wellness/dailySummaryChart/{who}?date=` | `intraday` |
| `bodyBatteryEvents(date)` | `/wellness-service/wellness/bodyBattery/events/{date}` | `intraday` |

These go to `<dataFolder>/series/<date>.json`, not frontmatter. See
[properties → intraday](properties.md#intraday). `INTRADAY_DAYS` in
`src/sync/engine.ts` sets the window.

`dailySummary` serves **five groups from one request** — `activity`, `heart`,
`stress`, `respiration` and `spo2` — so switching off just one of them saves
nothing. Respiration and pulse ox in particular cost no requests at all.

`enduranceScore` is per-day deliberately: the range form of that endpoint returns
weekly averages, not daily values.

`dailySummary` throws `GarminAuthError` if the response comes back
`privacyProtected: true` — that means the session is not fully authorised, which
is a different problem from a 401.

## Range endpoints

Called **once for the whole window**, however long it is.

| Method | Path | Group |
| --- | --- | --- |
| `maxMetrics(start, end)` | `/metrics-service/metrics/maxmet/daily/{start}/{end}` | `fitness` |
| `racePredictions(start, end)` | `/metrics-service/metrics/racepredictions/daily/{who}?fromCalendarDate=&toCalendarDate=` | `races` |
| `activities(start, limit)` | `/activitylist-service/activities/search/activities?start=&limit=` | `workouts` |

`racePredictions` **rejects ranges longer than a year**, so long backfills are
chunked.

`activities` is paged rather than dated: the engine pages through it once for the
whole range and buckets results by the local calendar day each activity started
on.

## Health Stats pages

The Health Stats pages read the routes the Garmin Connect web app uses (captured
2026-10-08, `ref/health-stats/web-survey.md`), not the note sync's. None of
them is GraphQL: Health Status has a REST route too.

### Ranges

Days, and weeks, without data are left out rather than zero-filled, oldest
first except for weight. Past its cap a route answers HTTP 400, and the caps
differ by route. "None found" means a three-year span (Health Status) or a
ten-year one still answered.

| Method | Path | Cap |
| --- | --- | --- |
| `stressDaily(start, end)` | `/usersummary-service/stats/stress/daily/{start}/{end}` | 28 days |
| `bodyBatteryDaily(start, end)` | `/usersummary-service/stats/bodybattery/daily/{start}/{end}` | 28 days |
| `heartRateDaily(start, end)` | `/usersummary-service/stats/heartRate/daily/{start}/{end}` | 28 days |
| `fitnessAgeDaily(start, end)` | `/fitnessage-service/stats/daily/{start}/{end}` | 29 days |
| `respirationDaily(start, end)` | `/usersummary-service/stats/respiration/daily/{start}/{end}` | 31 days |
| `stressWeekly(end, weeks = 52)` | `/usersummary-service/stats/stress/weekly/{end}/{weeks}` | 52 weeks |
| `heartRateWeekly(end, weeks = 52)` | `/usersummary-service/stats/heartRate/weekly/{end}/{weeks}` | 52 weeks |
| `fitnessAgeWeekly(end, weeks = 52)` | `/fitnessage-service/stats/weekly/{end}/{weeks}` | 52 weeks |
| `hrvDaily(start, end)` | `/hrv-service/hrv/daily/{start}/{end}` | 367 days |
| `healthStatusRange(start, end)` | `/healthstatus-service/healthstatus/summary/{start}/{end}` | none found |
| `weighIns(start, end)` | `/weight-service/weight/range/{start}/{end}?includeAll=true` | none found |
| `weightWeekly(start, end)` | `/weight-service/weight/weeklyRange/{start}/{end}` | exactly 52 weeks |
| `weightGoal(start, end)` | `/goal-service/goal/user/effective/weightgoal/{start}/{end}` | — |
| `acclimationDaily(start, end)` | `/wellness-service/stats/daily/acclimation?fromDate=&untilDate=` | none found |
| `bloodPressureRange(start, end)` | `/bloodpressure-service/bloodpressure/range/{start}/{end}?includeAll=true` | none found |
| `bloodPressureWeekly(start, end)` | `/bloodpressure-service/bloodpressure/weeklyRange/{start}/{end}` | exactly 52 weeks |
| `bloodPressureLast(start, end)` | `/bloodpressure-service/bloodpressure/daily/last/{start}/{end}` | none found |

- The `stats/…/daily` rows are `{calendarDate, values}`, except respiration's,
  which are flat. Weekly rows are dated by the week's first day: stress sends a
  single `value`, heart rate and fitness age a `values` map.
- The two weekly date-pair routes take exactly 52 weeks: `end` 363 days after
  `start`, as the web's 2025-10-10 → 2026-10-08. Every other span tried is a 400.
- `hrvDaily` is `{hrvSummaries}`, and HTTP 204 (null) when no night has any.

### Days and the 1d timelines

| Method | Path | For |
| --- | --- | --- |
| `healthStatusSummary(date)` | `/healthstatus-service/healthstatus/summary/{date}` | Health Status; 204 (null) until the night is scored |
| `respiration(date)` | `/wellness-service/wellness/daily/respiration/{date}` | Respiration 1d, every two minutes |
| `spo2Acclimation(date)` | `/wellness-service/wellness/daily/spo2acclimation/{date}` | Pulse Ox 1d, with elevation |
| `bloodPressureDay(date)` | `/bloodpressure-service/bloodpressure/dayview/{date}` | Blood Pressure 1d |
| `weightLatest(date)` | `/weight-service/weight/latest?date=&ignorePriority=true` | the newest weigh-in on or before the date |
| `heartRateZones()` | `/biometric-service/heartRateZones/` | zone floors per sport profile |
| `healthSnapshotList(until, start = 1, limit = 20)` | `/wellnessactivity-service/activity/summary/list` | newest first; `start` counts from 1 |
| `healthSnapshotDetail(date, uuid)` | `/wellnessactivity-service/activity/summary/{date}/{uuid}` | 204 unless `date` is the snapshot's own |
| `healthSnapshotEpochs(uuid)` | `/wellnessactivity-service/activity/epoch/{uuid}` | a sample a second |
| `wellnessActivities(date)` | `/wellnessactivity-service/activity/summary/{date}` | the day's snapshots, on the timeline |
| `naps(date)` | `/sleep-service/sleep/naps/{date}?includeOverlaps=true` | naps, on the timeline |
| `dailyEvents(date)` | `/wellness-service/wellness/dailyEvents/{who}?calendarDate=` | Move IQ events, on the timeline |
| `activitiesForDay(date)` | `/activitylist-service/activities/fordailysummary/{who}?calendarDate=` | activities, on the timeline |
| `lifestyleLog(date)` | `/lifestylelogging-service/dailyLog/{date}` | Lifestyle Logging, which has no web page |

The Stress, Body Battery and Heart Rate 1d pages call the four timeline routes
(snapshots, naps, Move IQ events, activities); Respiration's does not.

## Available but unused

Implemented and tested, not currently wired into the sync:

| Method | Path |
| --- | --- |
| `bodyBattery(start, end)` | `/wellness-service/wellness/bodyBattery/reports/daily?startDate=&endDate=` |
| `restingHeartRate(date)` | `/userstats-service/wellness/daily/{who}` |

Both duplicate what the sync already gets: `dailyStress` carries the Body
Battery series, and the daily summary carries resting heart rate. Wiring one in
means adding properties — see
[architecture → extending](architecture.md#add-a-metric).

## Request budget

Roughly:

```
(per-day endpoints needed) × (days with a writable note)  +  a small constant
```

The constant is the range endpoints — one call each for `maxMetrics` and
`racePredictions`, plus however many pages the activity list takes.

With all fourteen groups on, a day costs **eight** per-day requests: the daily
summary (which alone serves five groups), sleep, HRV, readiness, endurance,
fitness age, training status and body composition — plus **four more** for each
of the newest seven days, for the intraday series. Days that are not writable cost **nothing
at all**, because `exists()` is consulted before any request is made.

Four of the thirteen groups are free in request terms — `respiration`, `spo2`,
`heart` and `stress` all ride along in a call `activity` already makes. The
settings screen marks which is which.

The sync runs **newest day first**, so a run cut short by a rate limit has
already covered the days you care about most. `pauseBetweenDays` (default 250 ms)
throttles between days.

## Keeping this honest

Garmin ships changes to these payloads without notice and without a version, so
none of the above is guaranteed to still be true tomorrow.
`.github/workflows/api-contract.yml` runs every morning, fetches the 69 checked
endpoints (the ones above and the Health Stats routes) through this plugin's own
`GarminApi`, and compares what comes back with the shapes recorded in
[`api/schema/`](../api/schema/). A field the plugin depends on that stops
arriving opens an issue the same day; a field it merely reads is reported
without failing the run.

`api/README.md` covers the verdicts, the setup, and how to accept a change.

## Behaviour worth knowing

- **Transient failures are retried, rate limits are not.** A request that comes
  back 5xx or does not come back at all is retried up to three times with a
  jittered backoff (`MAX_ATTEMPTS` in `src/garmin/client.ts`). A 429 is not:
  retrying is the precise wrong response to Garmin asking us to stop, and a 4xx
  means the same thing however many times it is asked.
- **`expires_in` is not fixed.** Observed at 66,341 s on one run and 97,344 s on
  another, so the lifetime is always read from the response.
- **The login response glues seven cookies into one `Set-Cookie` header**, and
  cookie expiry dates contain commas, so the jar splits only on a comma followed
  by a `token=`.
- **Garmin is not enforcing TLS fingerprinting on `/mobile/api/*`.** Three
  different fingerprints authenticated end to end on 2026-09-12, including
  Chromium TLS carrying an iPhone User-Agent — an obvious mismatch Cloudflare
  did not punish. That is a server-side policy, not a guarantee. The human-facing
  sign-in page at `/portal/sso/en-US/sign-in` returns a 403 challenge even to
  plain curl, so the two paths are in different protection buckets.
- **Rate limits are per IP** for login attempts, and repeated failures can lock
  an account.

## If the edge tightens

Cheap things to try, all present in `python-garminconnect`, none needing TLS
forgery:

1. The Android client (`GCM_ANDROID_DARK` with the `/gcm/android` service URL)
   instead of iOS.
2. Matching more of the real app's header set and ordering.
3. The SSO embed widget flow, which uses an HTML form and lands in a different
   rate-limit bucket.
