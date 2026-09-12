# Garmin Connect for Obsidian — phase 0 probe

A throwaway diagnostic. It answers one question before any real work starts:

> **Can Obsidian's HTTP stack authenticate against Garmin Connect — on the desktop, and on a phone?**

Everything else about this project (sync engine, daily notes, token storage) is
ordinary work. This is the part that can kill it, so it goes first.

---

## Why this is in doubt

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

So: does what we *can* send pass on its own?

## What is already known before you run anything

Measured from this machine with plain `curl` (an obviously non-browser TLS
fingerprint), on 2026-09-12:

| Endpoint | Result |
| --- | --- |
| `sso.garmin.com/portal/sso/en-US/sign-in` (human sign-in page) | **403** — Cloudflare `Just a moment…` interstitial |
| `sso.garmin.com/mobile/api/login` (the app's JSON API — what we need) | **405 `Method Not Allowed`** from Garmin's own origin |

The two paths sit in different protection buckets. The human-facing HTML page is
challenged aggressively; the mobile API path let a raw `curl` straight through to
the origin. That is the single most encouraging fact available about this
project, and it is why the probe targets the mobile flow only.

`npm run probe:node` reproduces the second row through this repo's own auth
module, so the port itself is known to work end-to-end over `fetch`.

What remains untested is the **credentialed POST** — Cloudflare may score that
request differently from a bare GET — and whether **Obsidian's** stack fares the
same as `curl`. That is what you are about to find out.

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

## The two checks

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
- **The password.** *Remember password* is off by default. Turning it on writes
  the password to `data.json` in plain text, which then syncs with your vault.
  It is there because retyping a password on a phone for every test run is
  miserable — turn it off and delete `data.json` when you are done.
- **`tls.peet.ws`.** A third-party echo service, contacted only when you press
  the fingerprint button, and only ever sent a User-Agent string.

---

## How this is built, and why it survives into the real plugin

The layering is the part worth keeping:

```
src/http.ts            HttpClient interface, CookieJar     — no imports at all
src/garmin/*.ts        the Garmin auth flow                — depends only on HttpClient
src/obsidian-http.ts   requestUrl adapter                  — the only Obsidian import in the auth path
src/fetch-http.ts      fetch adapter                       — for Node and tests
src/probe.ts, ui/      plugin layer                        — Obsidian freely
```

HTTP is injected rather than imported, which is what lets `scripts/node-probe.ts`
run the real auth code under Node without launching Obsidian, and what will let
the same core publish as an npm package later. The reason "build
`node-garminconnect` first, consume it from the plugin" fails is not that
libraries are wrong — it is that a Node library bakes in Node assumptions
(`https`, `tough-cookie`, `axios`) you then cannot remove for a mobile WebView.
Starting transport-agnostic gets both.

Two things a port must get right, both already handled:

- **`requestUrl` throws on status ≥ 400** unless you pass `throw: false`, and a
  403 body is exactly what you need to read when diagnosing a challenge.
- **`requestUrl` keeps no cookie jar**, and `headers` is `Record<string, string>`,
  so multiple `Set-Cookie` values arrive joined by commas — and cookie expiry
  dates contain commas too. `splitSetCookie` in `src/http.ts` splits only on a
  comma followed by a `token=`. Garmin's SSO leg needs this: the MFA verify POST
  must carry the cookies from the login POST.

## If the probe passes

1. Grow `src/garmin/` into the full core: token store interface, refresh
   (`grant_type=refresh_token` at the same DI endpoint), and endpoint wrappers.
2. Add a test suite running the core against recorded fixtures via
   `FetchHttpClient`.
3. Replace the probe UI with a real settings tab, login modal and token
   persistence. **Store the refresh token only, never the password** — that token
   is durable account access sitting in a synced vault, and the README of the
   real plugin should say so plainly.
4. Build the sync engine onto daily notes.

`Garmin Health Sync` (also in this vault) is the closest prior art: same goal,
but `isDesktopOnly: true`, because it authenticates through an Electron
`BrowserWindow` and uses the old OAuth1 `preauthorized` / `exchange/user/2.0`
endpoints. Mobile is the gap.

## If the probe fails

Before abandoning it, the cheap things left to try are: the Android client
(`GCM_ANDROID_DARK` + the `/gcm/android` service URL) instead of iOS; matching
more of the real app's header set and ordering; and the SSO embed widget flow,
which uses an HTML form and lands in a different rate-limit bucket. All three are
in python-garminconnect and none of them need TLS forgery.
