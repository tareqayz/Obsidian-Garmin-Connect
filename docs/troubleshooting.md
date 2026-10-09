# Troubleshooting

Keyed by symptom. If your problem is signing in, run the diagnostics first: they
tell you which of four layers broke, which is most of the diagnosis.

## Diagnostics

**Run diagnostics** from the command palette opens a modal with four checks.
While **Save every diagnostics run to the vault** is on (the default), every run
is saved as a note in the **Log folder**, because **on a phone there is no
console**. That is `Garmin/diagnostics` in vaults set up since 0.2; older vaults
keep the folder they had, usually `garmin-probe-logs`. The note syncs back to
your desktop like any other.

| Check | What it proves |
| --- | --- |
| **1. Network fingerprint** | What this platform looks like on the wire. Asks `tls.peet.ws` for the User-Agent the server actually saw, JA3/JA4 and the HTTP version. If `requestUrl` dropped your UA override, nothing below matters. |
| **2. Test login** | Reachability without credentials, then the login POST, then MFA if demanded, then the ticket exchange, then a live API call. |
| **3. Test session persistence** | Simulates a cold start: drops the in-memory access token, reloads the refresh token from `data.json`, mints a new access token from it alone, then makes two real calls. |
| **4. Inspect fitness endpoints** | Prints the raw keys `maxMetrics`, `racePredictions` and `enduranceScore` return, then what the mapper makes of them. |

Checks 1 and 4 need no password. Check 2 costs a login attempt — see the lockout
warning below.

### Verdicts

| Verdict | Meaning |
| --- | --- |
| `SUCCESS` | This platform can sign in. |
| `BLOCKED` | Garmin's edge refused the client, not your credentials. If step 0 passed and step 1 got a 403, the path is open and it is the credential POST being scored. Retrying will not help. |
| `RATE-LIMITED` | A 429. Not a verdict — wait 15–30 minutes. Do not retry in a loop. |
| `BAD-CREDENTIALS` | Wrong email or password. Fix it before re-running; repeated failures can lock the account. |
| `BAD-MFA-CODE` | The email and password were accepted; three verification codes were not. Re-run with the newest code Garmin sends. |
| `CANCELLED` | Stopped at the code prompt. Costs the one login attempt already spent, nothing more. |
| `FAILED` | Read the step that failed. Step 3 failing after step 1 succeeded means Garmin has rotated its client IDs: save the run and open an issue with it. |

---

## Sign-in fails

**Check the verdict first.** `BLOCKED` and `BAD-CREDENTIALS` are different
problems, and the fix for one makes the other worse.

`BLOCKED` means Cloudflare scored the request, not that your password is wrong.
There is no workaround from inside Obsidian. If it persists, the things worth
trying are all present in `python-garminconnect`, and none needs TLS forgery:
- the Android client (`GCM_ANDROID_DARK` with the `/gcm/android` service URL)
  instead of iOS;
- matching more of the real app's header set and ordering;
- the SSO embed widget flow, which lands in a different rate-limit bucket.

**Do not retry in a loop.** Garmin limits login attempts per IP and can lock an
account after repeated failures.

## Multi-factor authentication

**A sync is never challenged.** Sync runs on the stored refresh token, and only
*signing in* asks for a code. If a sync stops with an auth error, the session is
dead and the fix is to sign in again — code and all.

At sign-in the challenge appears in the same dialog: a code field, a line saying
where the code was sent, and three tries. A refused code is re-asked in place,
because a mistyped code must not cost a second login attempt against an endpoint
that rate-limits per IP.

Expect the challenge on **every** sign-in. Garmin's "remember this browser"
depends on a cookie the plugin deliberately does not keep, so it cannot be
skipped — but a sign-in is once per session, not once per sync.

If the codes are certainly right and Garmin keeps refusing them, the error
carries Garmin's own word for the refusal (`INVALID_MFA_CODE`, or something not
seen before). That string is the useful half of a bug report. Any refusal the
flow cannot classify by shape is treated as a retryable bad code: right for a
typo, wrong for, say, an SSO session that expired mid-sign-in.

"MFA required" as a hard error means something tried to sign in with no way to
ask for a code. That is a wiring bug, not an account problem.

## The session dies after a few days

Garmin may hand back a **new** refresh token when the old one is used. Dropping
that rotated token strands the session days later for no visible reason. The
client saves the new token straight away, so if this happens, diagnostics check
3 is the one to run: it exercises exactly that path.

If check 3 fails while check 2 passes, Garmin has probably rotated its client
IDs. They rotate roughly quarterly; open an issue with the saved run.

The session lives in the plugin's `data.json`. If your vault sync copies that
file between devices, they share one session.

## Rate limited (429)

Wait 15–30 minutes. Then:

- **Slow a long backfill down.** Raise **Settings → Advanced → Pause between
  days** (250 ms by default) before retrying it.
- **Turn off metric groups you do not need.** That genuinely removes requests,
  with one exception: `activity`, `heart`, `stress`, `respiration` and `spo2`
  share one daily summary request, so switching off some of the five saves
  nothing.
- **Mind the first session.** After its first sync, a new vault also fills its
  history files, about 130 requests per year of history. If those hit the
  limit, they keep what they fetched and carry on next session, or when you
  press **Sync history** on a page.
- **Nothing recent was lost.** The sync runs **newest day first**, so a run cut
  short by a rate limit already covered the days you care about most.

A 429 or a dead session abandons the whole run immediately, because every later
request would fail the same way.

## Home still shows yesterday after midnight

Home works out "today" when it opens, and again whenever a note or one of its own
files changes. A Home tab left open past midnight, with nothing changing, keeps
yesterday's date, labels, offsets and all. Run **Sync recent days** (Home's ↻),
or close Home and run **Open home**.

## Home's Health Status card only says "Wear your device while sleeping for about 3 weeks"

The card shows Garmin's onboarding prompt while **any** Health Status metric is
still building its baseline, as the app does. Pulse Ox is the usual one: its
baseline never finishes if your watch's Pulse Ox mode is off during sleep, even
though the other metrics have data.

**More → Health Stats → Health Status** still shows each metric and its status.

## "This page isn't in this version of the plugin"

Home remembers which page it was on. This appears when that saved page belongs to
a version of the plugin that had it, typically after going back to an older
build. Press **Back**, or update the plugin.

## A day page has figures but no chart

A day's chart comes from its series file, which the **intraday** group fills.
Two limits apply.

**Only the newest seven days of each sync get curves.** Older days work like
this:
- **Heart rate, stress, Body Battery and the Health Stats curves** are fetched
  the first time you open the day. That needs you signed in and the right group
  on: `intraday` for Home's charts, the page's own group for a Health Stats page.
- **Steps, floors and intensity minutes** only show what a sync wrote. Run
  **Sync a date range…** over that week, seven days or fewer at a time.

**Garmin does not keep every day's detail.** If a day still has no curve after
that, Garmin has none for it. Older days often have only the totals.

## A night has a score but no timeline, factors or coach

The night's sleep page reads its timeline, factors and Sleep Coach from that
day's series file. Nights synced before the Sleep pages existed (2026-10-07) have
none. Run **Sync a date range…** over those nights with the **intraday** group
on. Every night in the range gets them, however long it is.

## A metric is always empty

Either its group is off in **Settings → Metrics**, your watch doesn't record it,
or Garmin renamed a field.

For the fitness metrics, **diagnostics check 4** prints the raw keys
`maxMetrics`, `racePredictions` and `enduranceScore` return, and then what the
mapper extracted. If a value is there under a different name, that name is the
fix, in `src/sync/metrics.ts`. Please open an issue with the log.

## Nothing gets written in daily-notes mode

By design, a day with nowhere to go costs nothing: the target decides whether a
day is writable **before any request is made**. With **Create missing notes**
off, a day without an existing note is skipped for free.

So a sparse range legitimately writes nothing. Either turn on **Create missing
notes**, or switch to data-folder mode, where every day is writable and backfill
works with nothing existing first.

Also check that the daily notes **Folder** and **Date format** settings match
your actual daily notes. Left empty, they follow the core Daily Notes plugin.

## Properties do not appear, or appear as plain text

The sync writes real frontmatter properties, not a markdown table. If you are
looking at a markdown table you built yourself, Dataview and Bases cannot query
it — they query properties. That is why the plugin generates a Bases table view
rather than writing a table.

In daily-notes mode every key carries the `garmin_` prefix. Querying `steps`
instead of `garmin_steps` returns nothing.

## A backfill stopped early and said it "found nothing"

Working as intended. After 45 consecutive empty days (**Stop after empty days**,
`0` disables) the sync gives up and reports where, on the assumption it has run
off the start of your Garmin history. Since it walks newest to oldest, that
empty region is always the tail.

Nothing bogus is written for those days: a day with no usable numbers is
skipped, not stored as zeroes.

## Re-syncing keeps touching files / sync churn

It should not. Incoming properties are diffed against the existing frontmatter,
and an identical day leaves the file untouched. That matters because Obsidian
Sync and LiveSync both treat a bumped modification time as a change to
propagate. The history and series files are only rewritten when their content
changes, too.

If files *are* being rewritten every run, a value is changing. Garmin revising a
recent day is the usual reason, and is why the default window is three days.

## The graph view freezes

**Link every day to the table view** gives every day note a link to one base
file. With hundreds of day notes that is one hub with hundreds of edges, which
has been observed to make the graph simulation struggle. Turn the setting off;
existing notes keep the property until they are rewritten.

## It works on desktop but breaks on mobile

Almost always a node or electron import that leaked into the bundle. `npm run
build` fails on exactly this (`scripts/check-mobile-safe.mjs`), because it is
the bug class that loads fine on the desktop and throws on the phone, where it
is hardest to debug.

If you are not building from source, run diagnostics check 1 on the phone. If
`requestUrl` dropped the User-Agent override there, that is the difference.

A phone signed out while the desktop works usually just has no session: sign in
there. Its vault sync may not be copying the plugin's `data.json`.

## Reading a diagnostics log on a phone

Open the **Log folder** (`Garmin/diagnostics`, or `garmin-probe-logs` in older
vaults). Each run is a normal note and syncs back to your desktop. Turn off
**Save every diagnostics run to the vault** if you do not want them kept.
