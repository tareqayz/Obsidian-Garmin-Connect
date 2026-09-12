# Garmin Connect for Obsidian

Syncs Garmin Connect health data into Obsidian — **on mobile as well as the
desktop**, which is the part nobody had solved.

**Status: phase 1.** Authentication, session persistence and the typed API core
are done and tested. The sync engine and the real UI are not built yet; the
plugin currently ships a diagnostics modal.

It started with one question that could have killed the project:

> **Can Obsidian's HTTP stack authenticate against Garmin Connect — on the desktop, and on a phone?**

It can. Both.

---

## Why it was in doubt

`cyberjunky/python-garminconnect` is the reference implementation, and since its
post-garth rewrite it authenticates like the mobile app: a JSON POST to
`sso.garmin.com/mobile/api/login`, then a service-ticket exchange at
`diauth.garmin.com` for OAuth2 bearer tokens. No OAuth1, no HMAC signing — the
hard crypto is gone, and the flow ports to TypeScript cleanly.

The problem is how it gets past the front door. It installs `curl_cffi` to
**forge TLS fingerprints** (rotating `safari_ios`, `chrome120`, `edge101`) and
sleeps 10–20 s before login POSTs so Cloudflare's WAF does not flag the burst.
From Obsidian you get `requestUrl`, which is Electron's network stack on the
desktop and the OS HTTP client on mobile. You do not choose the fingerprint.

So the question was whether what we *can* send passes on its own. It does.

## Result — phase 0 passed on both platforms (2026-09-12)

Full end-to-end authentication succeeded on **macOS desktop** and on **iOS**:
SSO login → service ticket → DI bearer token → a live `connectapi` call
returning profile data. Logs are in `garmin-probe-logs/`.

What the fingerprint check measured:

| | Desktop (Electron) | iOS (OS network stack) | curl (baseline) |
| --- | --- | --- | --- |
| JA4 | `t13d1516h2_8daaf6152771_02713d6af862` | `t13d2013h2_a09f3c656075_7f0f34a4126d` | — |
| HTTP version | h2 | h2 | h2 |
| UA override honoured | yes | yes | n/a |
| `/mobile/api/login` | **200 SUCCESSFUL** | **200 SUCCESSFUL** | 405 (GET) |

Three completely different TLS fingerprints all passed, including the desktop's
— Chromium TLS carrying an iPhone `User-Agent`, an obvious mismatch that
Cloudflare did not punish. **Garmin is not enforcing TLS fingerprinting on the
`/mobile/api/*` path**, which is why this works without `curl_cffi`. That is a
server-side policy, not a guarantee: Garmin can tighten it at any time, and from
inside Obsidian there would be no workaround. Design for that — surface an auth
403 as an auth 403, never as a generic "sync failed".

Also worth carrying forward:

- The manual cookie jar works against real traffic. Step 1 returned seven
  cookies joined into one `Set-Cookie` header (`CASTGC`, `GARMIN-SSO`,
  `SESSION`, `__cf_bm`, …) and `splitSetCookie` split them correctly.
- `GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2` — the first DI client ID in the
  list — was accepted on both platforms.
- `expires_in` came back **66341 s on one run and 97344 s on another** (~18 h vs
  ~27 h). The access token lifetime is not fixed, so never hardcode it: read
  `expires_in`, refresh with margin, and treat a 401 as "refresh once, retry
  once" rather than "log in again".

### Still unverified

- **The MFA leg never ran.** This account was not challenged, so `verifyMfa()`
  is written, typechecked and never executed. Tracked in the TODO below.
- **Android is untested.** Same `requestUrl` abstraction, different native stack,
  so a different JA4 again.
- **Behaviour under sync load** — many `connectapi` calls in sequence — is
  unknown.

Token refresh *was* on this list and is now implemented and tested; check 3
below verifies it against the live service.

---

## Running it

### Desktop

```bash
npm install
npm run build      # typechecks, bundles, and verifies the bundle is mobile-safe
```

Then in Obsidian: **Settings → Community plugins → Reload**, enable
**Garmin Connect (probe)**, and open it from the ribbon (activity icon) or the
command palette (*Garmin Connect probe: Run connectivity probe*).

Fill in your Garmin email and password, then run the two checks in order.

`npm run dev` leaves esbuild watching. With the Hot Reload plugin already in this
vault, saved changes reload the plugin without restarting Obsidian.

### Mobile

The plugin is already inside an iCloud-synced vault, so `main.js`, `manifest.json`
and `styles.css` reach the phone on their own — give iCloud a minute. On the
phone: **Settings → Community plugins → Turn on community plugins**, enable
**Garmin Connect (probe)**, and run it the same way.

There is no console on iOS, which is why every run writes its log into the vault
under `garmin-probe-logs/`. That file syncs back to the desktop like any other
note, so you read the phone's results from your Mac. *Copy log* also works if you
would rather paste it somewhere directly.

Build tooling is kept in `node_modules.nosync` with `node_modules` symlinked to
it — iCloud skips any path ending in `.nosync`, so 43 MB of TypeScript and
esbuild never reaches your phone. `npm install` follows the symlink and still
works normally.

---

## The three checks

**1. Check network fingerprint** — asks `tls.peet.ws` what this platform looks
like on the wire. Sends the iOS `User-Agent` and nothing else; no credentials
leave the device. It reports:

- **the UA the server actually saw** — if `requestUrl` silently drops our
  `User-Agent` override, Garmin sees Obsidian and the rest is moot;
- **JA3/JA4** — the TLS fingerprint Cloudflare scores. Record it on desktop and
  on mobile. A mismatch here is the likeliest reason one platform works and the
  other does not;
- **HTTP version** — an iPhone UA arriving over HTTP/1.1 is itself a tell.

**2. Test Garmin login** — the real flow, in four steps:

| Step | What it does | Sends credentials? |
| --- | --- | --- |
| 0 | GET the POST-only login endpoint; a JSON `405` means the edge let us through | no |
| 1 | `POST /mobile/api/login` with email + password | yes |
| 2 | `POST /mobile/api/mfa/verifyCode` if Garmin asks (prompts inline) | code only |
| 3 | Exchange the service ticket at `diauth.garmin.com` for bearer tokens | no |
| 4 | `GET /userprofile-service/socialProfile` to confirm the API tier accepts the token | no |

Step 4 exists because a token can come back `200` from the auth host and still be
refused by `connectapi` — account- and region-dependent. Success is only real
once a live call returns data.

**3. Test session persistence** — the phase 1 path, end to end against the live
service. It reuses a saved session if there is one, otherwise signs in once, then
simulates a cold start: the in-memory access token is dropped, the refresh token
is reloaded from `data.json`, a new access token is minted from it alone, and two
typed endpoint calls are made on the other side. Fixtures can prove the logic;
only this proves Garmin agrees.

## Reading the verdict

| Verdict | What it means |
| --- | --- |
| `SUCCESS` | This platform can authenticate. Run the other platform before designing around it. |
| `BLOCKED` | Cloudflare refused the client. If step 0 passed and step 1 got a 403, the *path* is open and it is the credential POST being scored — retrying will not help. |
| `RATE-LIMITED` | A 429. Not a verdict. Wait 15–30 minutes; do not retry in a loop. |
| `BAD-CREDENTIALS` | Wrong email/password. Fix it before re-running — repeated failures can lock the account. |
| `FAILED` | Read the step that failed. Step 3 failing after step 1 succeeded means Garmin rotated the DI client IDs; re-check `DI_CLIENT_IDS` against python-garminconnect master. |

## Please be careful with

- **Rate limits and lockout.** Garmin limits login attempts per IP and can lock
  an account after repeated failures. Run the probe deliberately.
- **The password is never stored.** It is typed into the diagnostics modal,
  used for that one sign-in, and dropped when the modal closes. Only a refresh
  token and its DI client ID are written to `data.json`.
  *If you ran the phase 0 build*, it did store your password there. The plugin
  now deletes it on load and says so with a notice — but it did sit in a synced
  vault for a while, so changing your Garmin password is the cautious move.
- **`tls.peet.ws`.** A third-party echo service, contacted only when you press
  the fingerprint button, and only ever sent a User-Agent string.

---

## How this is built, and why it survives into the real plugin

The layering is the part worth keeping:

```
src/http.ts              HttpClient, CookieJar, Log           — imports nothing
src/log.ts               the Log interface + probe renderer
src/garmin/
  constants.ts           endpoints, client IDs, native headers
  errors.ts              typed failures (Auth / Blocked / RateLimit / Api / Network)
  auth.ts                sign-in flow: login, MFA, ticket exchange
  tokens.ts              TokenStore, expiry, refresh
  client.ts              authenticated transport: refresh, 401 retry
  endpoints.ts           typed API wrappers (extends client)
src/obsidian-http.ts     requestUrl adapter   — the only Obsidian import in the auth path
src/fetch-http.ts        fetch adapter        — Node harness and tests
src/testing/             fixture transport for tests
src/probe.ts, ui/, …     plugin layer         — Obsidian freely
```

HTTP is injected rather than imported, which is what lets `scripts/node-probe.ts`
run the real auth code under Node without launching Obsidian, and what will let
the same core publish as an npm package later. The reason "build
`node-garminconnect` first, consume it from the plugin" fails is not that
libraries are wrong — it is that a Node library bakes in Node assumptions
(`https`, `tough-cookie`, `axios`) you then cannot remove for a mobile WebView.
Starting transport-agnostic gets both.

### What the client does for you

`GarminApi` is one object: `login()`, `restore()`, `logout()`, `request()`, and
typed endpoints on top. Behind them:

- **Refresh ahead of expiry**, with a five-minute margin, reading `expires_in`
  from the response rather than assuming a lifetime.
- **One refresh for concurrent callers.** A sync touching six endpoints at once
  triggers a single token exchange, not six.
- **401 → refresh once → retry once**, then give up. If another request already
  refreshed past the token that failed, the retry uses theirs instead of
  refreshing again.
- **Rotation is persisted.** Garmin may hand back a new refresh token on use;
  dropping it would strand the session days later for no visible reason.
- **A failed re-login leaves a working session alone.** A 429 while signing in
  again should not sign you out of the session you had.
- **403 is triaged.** A JSON 403 is the API declining; a non-JSON 403 is the edge
  declining. Different problems, different errors.

Two things a port must get right, both already handled:

- **`requestUrl` throws on status ≥ 400** unless you pass `throw: false`, and a
  403 body is exactly what you need to read when diagnosing a challenge.
- **`requestUrl` keeps no cookie jar**, and `headers` is `Record<string, string>`,
  so multiple `Set-Cookie` values arrive joined by commas — and cookie expiry
  dates contain commas too. `splitSetCookie` in `src/http.ts` splits only on a
  comma followed by a `token=`. Garmin's SSO leg needs this: the MFA verify POST
  must carry the cookies from the login POST.

## Tests

```bash
npm test          # 61 tests, no network, no Obsidian
npm run build     # typecheck → tests → bundle → mobile-safety check
npm run probe:node  # runs the real auth module under Node, step 0 only
```

Tests bundle with esbuild and run on Node's built-in runner. `FixtureHttpClient`
replays canned responses in order, which is how sequences like "401, then
refresh, then success" and "first DI client ID rejected, second accepted" are
expressed. No mocks of our own code — the fixtures sit at the transport seam, so
what is under test is the real client.

## What comes next

1. **Sync engine** — pull a date range, map Garmin's payloads onto frontmatter,
   write into daily notes idempotently.
2. **Real UI** — a sign-in flow that is not a diagnostics modal, connection
   status, sync-on-open, manual re-sync.
3. **Then the probe modal goes away**, or hides behind a debug setting.

See [TODO.md](TODO.md) for what is deliberately unfinished, MFA above all.

## If it ever stops working

If Garmin tightens the edge later, the cheap things to try before giving up are: the Android client
(`GCM_ANDROID_DARK` + the `/gcm/android` service URL) instead of iOS; matching
more of the real app's header set and ordering; and the SSO embed widget flow,
which uses an HTML form and lands in a different rate-limit bucket. All three are
in python-garminconnect and none of them need TLS forgery.
