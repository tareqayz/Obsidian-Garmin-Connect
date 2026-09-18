# Garmin API reference

Every Garmin endpoint this plugin calls, which metric group triggers it, and
what the request budget works out to. Source: `src/garmin/endpoints.ts` and
`src/garmin/constants.ts`.

For the full surface — all 135 endpoints Garmin exposes, their request shapes,
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

## Available but unused

Implemented and tested, not currently wired into the sync:

| Method | Path |
| --- | --- |
| `heartRate(date)` | `/wellness-service/wellness/dailyHeartRate/{who}` |
| `stress(date)` | `/wellness-service/wellness/dailyStress/{date}` |
| `bodyBattery(start, end)` | `/wellness-service/wellness/bodyBattery/reports/daily?startDate=&endDate=` |
| `restingHeartRate(date)` | `/userstats-service/wellness/daily/{who}` |

These return intraday series where the daily summary returns a single number.
Wiring one in means adding properties — see
[architecture → extending](architecture.md#add-a-metric).

## Request budget

Roughly:

```
(per-day endpoints needed) × (days with a writable note)  +  a small constant
```

The constant is the range endpoints — one call each for `maxMetrics` and
`racePredictions`, plus however many pages the activity list takes.

With all thirteen groups on, a day costs **seven** per-day requests: the daily
summary (which alone serves five groups), sleep, HRV, readiness, endurance,
training status and body composition. Days that are not writable cost **nothing
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
`.github/workflows/api-contract.yml` runs every morning, fetches the sixteen
endpoints above through this plugin's own `GarminApi`, and compares what comes
back with the shapes recorded in [`api/schema/`](../api/schema/). A field the
plugin depends on that stops arriving opens an issue the same day; a field it
merely reads is reported without failing the run.

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
