# Troubleshooting

Keyed by symptom. If your problem is authentication, run the probe first — it
tells you which of four layers broke, which is most of the diagnosis.

## The probe

*Run connectivity probe* from the command palette opens a modal with four
checks. Every run writes its log to `garmin-probe-logs/` in the vault, because
**on a phone there is no console** and a file in the vault syncs back to your
desktop like any other note.

| Check | What it proves |
| --- | --- |
| **1. Network fingerprint** | What this platform looks like on the wire. Asks `tls.peet.ws` for the User-Agent the server actually saw, JA3/JA4, and the HTTP version. If `requestUrl` dropped your UA override, nothing below matters. |
| **2. Test login** | Reachability without credentials, then the login POST, then MFA if demanded, then the ticket exchange, then a live API call. |
| **3. Test session persistence** | Simulates a cold start: drops the in-memory access token, reloads the refresh token from `data.json`, mints a new access token from it alone, then makes two real calls. |
| **4. Inspect fitness endpoints** | Prints the raw keys `maxMetrics`, `racePredictions` and `enduranceScore` return, then what the mapper makes of them. |

Checks 1 and 4 need no password. Check 2 costs a login attempt — see the lockout
warning below.

### Verdicts

| Verdict | Meaning |
| --- | --- |
| `SUCCESS` | This platform can authenticate. |
| `BLOCKED` | Garmin's edge refused the client, not your credentials. If step 0 passed and step 1 got a 403, the path is open and it is the credential POST being scored. Retrying will not help. |
| `RATE-LIMITED` | A 429. Not a verdict — wait 15–30 minutes. Do not retry in a loop. |
| `BAD-CREDENTIALS` | Wrong email or password. Fix it before re-running; repeated failures can lock the account. |
| `FAILED` | Read the step that failed. Step 3 failing after step 1 succeeded means Garmin rotated the DI client IDs. |

---

## Sign-in fails

**Check the verdict first.** `BLOCKED` and `BAD-CREDENTIALS` are different
problems and the fix for one makes the other worse.

`BLOCKED` means Cloudflare scored the request, not that your password is wrong.
There is no workaround from inside Obsidian. If it persists, the things worth
trying — all present in `python-garminconnect`, none needing TLS forgery — are
the Android client (`GCM_ANDROID_DARK` with the `/gcm/android` service URL)
instead of iOS, matching more of the real app's header set and ordering, or the
SSO embed widget flow, which lands in a different rate-limit bucket.

**Do not retry in a loop.** Garmin limits login attempts per IP and can lock an
account after repeated failures.

## "MFA required" and sync stops

Expected. `verifyMfa()` is written and typechecked but **has never run** against
a live challenge, so `login()` raises `GarminMfaRequiredError` rather than
pretending to handle it. There is no workaround yet; see [TODO.md](../TODO.md).

## The session dies after a few days

Garmin may hand back a **new** refresh token when the old one is used. Dropping
that rotated token strands the session days later for no visible reason. The
client persists rotation, so if this happens, probe check 3 is the one to run —
it exercises exactly that path.

If check 3 fails while check 2 passes, the DI client IDs have rotated. Compare
`DI_CLIENT_IDS` in `src/garmin/constants.ts` against `python-garminconnect`
master; they rotate roughly quarterly and the list is tried in order.

## Rate limited (429)

Wait 15–30 minutes. Then:

- Raise `pauseBetweenDays` (default 250 ms) before retrying a long backfill.
- Turn off metric groups you do not need — that genuinely removes requests. Note
  `activity`, `heart` and `stress` share one request, so switching off one of
  the three saves nothing.
- Remember the sync runs **newest day first**, so a run cut short by a rate limit
  already covered the days you care about most.

A 429 or a dead session abandons the whole range immediately, because every
later request would fail the same way.

## VO2 Max is always empty

**Known open bug.** Not a range-length problem.

Evidence from a 407-day vault: endurance score present in 393 notes, race
predictions present in exactly the 5 days of the recent-sync window, VO2 Max in
zero. The same short window that successfully fetched race predictions got no
VO2 Max — and since race predictions are *derived* from VO2 Max, Garmin plainly
has the data. That points at a wrong URL or a wrong field name in
`GarminApi.maxMetrics` or `mapDay`, not at an absent metric.

To diagnose, run **probe check 4, "Inspect fitness endpoints"**. It prints the
raw keys the endpoint returned and then what the mapper extracted. If a value is
there under a different name, that name is the fix — change it in
`src/sync/metrics.ts`. If the mapper reports "nothing mapped", the field names
do not match at all.

## Nothing gets written in daily-notes mode

By design, a day with nowhere to go costs nothing: the target decides whether a
day is writable **before any request is made**. With `createMissingNotes` off, a
day without an existing note is skipped for free.

So a sparse range legitimately writes nothing. Either turn on
`createMissingNotes`, or switch to data-folder mode, where every day is writable
and backfill works with nothing existing first.

Also check that `dailyNoteFolder` and `dailyNoteFormat` match your actual daily
notes. Left empty, they follow the core Daily Notes plugin.

## Properties do not appear, or appear as plain text

The sync writes real frontmatter properties, not a markdown table. If you are
looking at a markdown table you built yourself, Dataview and Bases cannot query
it — they query properties. That is why the plugin generates a Bases view rather
than writing a table.

In daily-notes mode every key carries the `garmin_` prefix. Querying `steps`
instead of `garmin_steps` returns nothing.

## A backfill stopped early and said it "found nothing"

Working as intended. After 45 consecutive empty days (`stopAfterEmptyDays`, `0`
disables) the sync gives up and reports where, on the assumption it has run off
the start of your Garmin history. Since it walks newest to oldest, that empty
region is always the tail.

Nothing bogus is written for those days — a day with no usable numbers is
skipped, not stored as zeroes.

## Re-syncing keeps touching files / sync churn

It should not. Incoming properties are diffed against the existing frontmatter
and an identical day leaves the file untouched, precisely because Obsidian Sync
and LiveSync both treat a bumped mtime as a change to propagate.

If files *are* being rewritten every run, a value is changing — Garmin revising
a recent day is the usual reason, and is why the default window is three days.

## The graph view freezes

`linkToBase` gives every day note a link to one base file. With hundreds of day
notes that is one hub with hundreds of edges, which has been observed to make
the graph simulation struggle. Turn `linkToBase` off in settings; existing notes
keep the property until rewritten.

## It works on desktop but breaks on mobile

Almost always a node or electron import that leaked into the bundle. `npm run
build` fails on exactly this (`scripts/check-mobile-safe.mjs`) because it is the
bug class that loads fine on the desktop and throws on the phone, where it is
hardest to debug.

If you are not building from source, run probe check 1 on the phone — if
`requestUrl` dropped the User-Agent override there, that is the difference.

The two devices keep **separate sessions**; signing in on desktop does not sign
you in on mobile.

## Reading a probe log on a phone

Open `garmin-probe-logs/` in the vault. It is a normal note and syncs back to
your desktop. Set `autoSaveLog` off if you do not want them kept.
