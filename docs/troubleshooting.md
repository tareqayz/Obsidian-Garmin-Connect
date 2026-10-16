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
| **3. Test session persistence** | Simulates a cold start: drops the in-memory access token, reloads the refresh token from this device's keychain, mints a new access token from it alone, then makes two real calls. |
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

A refresh that fails for a reason other than the token — a Garmin outage, a bot
check — keeps the session, and the next sync tries again. Only Garmin saying the
token is spent ends it. The session lives in this device's keychain, so another
device signing in or out never touches it.

## Rate limited (429)

Wait 15–30 minutes. Then:

- **Slow a long date range down.** Set **Settings → Advanced → Sync speed** to
  **Gentle** before retrying it.
- **Turn off metric groups you do not need.** That genuinely removes requests,
  with one exception: `activity`, `heart`, `stress`, `respiration` and `spo2`
  share one daily summary request, so switching off some of the five saves
  nothing.
- **Mind the history download.** What you chose in the setup downloads in the
  background, under an hourly budget (5,000 to 15,000 requests by sync speed).
  A 429 pauses it for five minutes, doubling up to an hour, and it carries on
  by itself with what it already fetched kept. See
  [The history download is paused](#the-history-download-is-paused).
- **Nothing recent was lost.** The sync runs **newest day first**, so a run cut
  short by a rate limit already covered the days you care about most.

A 429 or a dead session abandons the whole sync immediately, because every later
request would fail the same way.

## The history download is paused

The download shows on Home under the title, in **Settings → Data**, and on a
computer in the status bar. What it says, and what to do:

| On Home | Why | What to do |
| --- | --- | --- |
| Sign in to keep downloading | The Garmin session ended | Sign in, from the pill, **Settings → Data** or **Sign in to Garmin Connect**. It carries on by itself |
| Garmin asked for a pause · resumes 14:05 | Garmin answered 429, past the client's own retries | Nothing. It waits 5 minutes, then 10, 20 and so on up to an hour while 429s keep coming. **Gentle** sync speed asks less of Garmin |
| Download resting · resumes 14:05 | It spent its hourly budget, or a piece of it failed and it tries again in ten minutes | Nothing |
| Download paused | You paused it, on this device or another sharing the vault | **Resume** |
| Downloading history on iPhone | Another device with this vault is downloading | Nothing. If that device stops, this one takes over once it has been quiet for ten minutes |

Settings → Data says the same in longer words, and the status bar in shorter
ones ("Garmin · sign in to continue").

If nothing downloads at all, there may be nothing to fetch: **Settings → Data**
shows what is missing from your Day details and Activity details ranges, and **Keep
new days only** in the setup fetches no history. The download also waits for
the setup to have run and for a session.

## Home says "No Garmin data on this device"

The plugin is set up and signed in here, but the data folder holds no days and
no activities: usually the settings came from another device and the data did
not. With Obsidian Sync, turn on **Sync all other types** (off by default): the
data is JSON, which Obsidian Sync counts as another type. Or press **Set up**
and download the history on this device.

## Home still shows yesterday after midnight

Home works out "today" when it opens, and again whenever one of its own data
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

**Only the days inside Day details get curves** from a routine sync or the
history download (before the setup, only the newest seven days of each sync).
**Sync a date range…** fetches the curves of every day it covers. Older days
work like this:
- **Heart rate, stress, Body Battery and the Health Stats curves** are fetched
  the first time you open the day. That needs you signed in and the right group
  on: `intraday` for Home's charts, the page's own group for a Health Stats page.
- **Steps, floors and intensity minutes** only show what a sync wrote. Widen
  **Day details** in **Settings → Data** to reach the day, and the download
  fetches it. Before the setup, run **Sync a date range…** over that week, seven
  days or fewer at a time.

**Garmin does not keep every day's detail.** If a day still has no curve after
that, Garmin has none for it. Older days often have only the totals.

## A night has a score but no timeline, factors or coach

The night's sleep page reads its timeline, factors and Sleep Coach from that
day's series file. Nights synced before the Sleep pages existed (2026-10-07) have
none. Inside your Day details range the history download fetches them again. A
vault that was syncing before the setup existed is asked first, in the update
dialog ("days saved by an older version"), or in **Settings → Data** after
**Later**. For older nights, widen Day details, or run **Sync a date range…**
over them with the **intraday** group on: every night in the range gets them,
however long it is.

## A metric is always empty

Either its group is off in **Settings → Metrics**, your watch doesn't record it,
or Garmin renamed a field.

For the fitness metrics, **diagnostics check 4** prints the raw keys
`maxMetrics`, `racePredictions` and `enduranceScore` return, and then what the
mapper extracted. If a value is there under a different name, that name is the
fix, in `src/sync/metrics.ts`. Please open an issue with the log.

## Days synced by an older version are missing after an upgrade

Older builds kept each day as a note, with the numbers as properties. The
plugin now reads days only from `Garmin/data/days/<year>.json`. On the first
load of a new build, once the vault is indexed, it copies the old notes' days
into those files and shows a notice with the count.

The copy runs only while `days/` does not exist. If a sync ran first and made
the folder, or the notes were somewhere it does not look, the copy is skipped:
- It reads notes in the data folder, and daily notes whose properties carry
  the `garmin_` prefix. A custom prefix is only known on the first load after
  the upgrade, before the settings are saved again.
- To run it again, close Obsidian, delete the `days/` folder, and reopen the
  vault. Days already in JSON are never overwritten, so nothing is lost by
  re-running it, but the days only come back from notes that still exist.
- **Sync a date range…** over the missing days fetches them from Garmin
  instead.

Once the pages show your history, the old day notes, their `garmin_`
properties and `Garmin Health.base` can be deleted. The plugin no longer reads
or writes them.

## A date range stopped early and said it "found nothing"

Working as intended. After 45 consecutive empty days (**Stop after empty days**,
`0` disables) **Sync a date range…** gives up and reports where, on the
assumption it has run off the start of your Garmin history. Since it walks
newest to oldest, that empty region is always the tail.

Nothing bogus is written for those days: a day with no usable numbers is
skipped, not stored as zeroes.

## Re-syncing keeps touching files / sync churn

It should not. A day's year file is rewritten only when its text changes, so
an identical day leaves it untouched, and a sync writes it once, after its days
are in. That matters because Obsidian Sync and LiveSync both treat a bumped
modification time as a change to propagate. The history and series files are
only rewritten when their content changes, too.

If files *are* being rewritten every run, a value is changing. Garmin revising a
recent day is the usual reason, and is why a recent sync always covers
yesterday too.

## A data file "couldn't be read" and was kept as …unreadable…

The sync never writes over a file it can't read. A save cut short by a crash, a
half-downloaded copy from a sync service, or git's `<<<<<<<` conflict markers
make a file unreadable, and replacing it would have lost everything it held. So
the plugin renames it beside where it was, for example
`days/2026.unreadable-20261016-113005.json`, writes what the sync fetched into
a fresh `2026.json`, and fetches the rest again:

- **A day file:** its days drop out of the history download's coverage, so the
  download fetches them again, within the **Day details** range you chose.
  Older days come back with **Sync a date range…**.
- **A chart index file** (activities, sleep, steps and the rest): the index is
  walked again from the start, which costs a few requests a year.

The renamed file is yours to open or delete; nothing reads it. **Delete synced
data…** removes it with the rest.

## Conflict copies ("2026 2.json")

When two devices change one file before they sync, iCloud and Obsidian Sync
keep both and name one `2026 2.json`. Syncthing names it
`2026.sync-conflict-….json` and Dropbox `2026 (… conflicted copy …).json`. The
plugin reads only `2026.json`, so a day only the copy holds goes unseen. The
first copy found in a session gets a notice.

- **The history download runs on one device at a time** already: the others
  say which device has it.
- **Sync from one device when you can**, and let the others read what it
  syncs. Two devices changing a file before their vault sync catches up is
  what makes a copy.
- If days are missing, **Sync a date range…** fetches them again. Then delete
  the copy.

## "Written by a newer version of Garmin Connect"

Another device updated the plugin and wrote its files in a newer format. This
device stops rather than writing its older format over them, which would make
the two devices undo each other's work. Update the plugin here (BRAT: **Check
for updates**), and the sync and the history download carry on.

## It works on desktop but breaks on mobile

Almost always a node or electron import that leaked into the bundle. `npm run
build` fails on exactly this (`scripts/check-mobile-safe.mjs`), because it is
the bug class that loads fine on the desktop and throws on the phone, where it
is hardest to debug.

If you are not building from source, run diagnostics check 1 on the phone. If
`requestUrl` dropped the User-Agent override there, that is the difference.

A phone that says "Not signed in on this device" while the desktop works has no
session of its own: each device signs in on its own. It still shows what the
desktop syncs; sign in there only to sync from the phone too.

## Reading a diagnostics log on a phone

Open the **Log folder** (`Garmin/diagnostics`, or `garmin-probe-logs` in older
vaults). Each run is a normal note and syncs back to your desktop. Turn off
**Save every diagnostics run to the vault** if you do not want them kept.
