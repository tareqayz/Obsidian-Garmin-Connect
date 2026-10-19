# Troubleshooting

Problems by symptom. If signing in is the problem, run the diagnostics first: they tell you which of
four layers broke, which is most of the diagnosis.

> [!TIP]
> **Reporting a bug?** Run **Copy debug info** and paste it into the
> [bug report form](https://github.com/tareqayz/Obsidian-Garmin-Connect/issues/new/choose). It needs
> no password and makes no request, and it removes your email, tokens, IP addresses and Garmin names.
> A page that couldn't be drawn has the same button on its error card.

## Diagnostics

**Run diagnostics**, from the command palette, opens four checks:

| Check | What it proves | Costs a login attempt |
| --- | --- | --- |
| **1. Network fingerprint** | What this platform looks like on the wire. It asks `tls.peet.ws` for the User-Agent the server actually saw, the TLS fingerprint and the HTTP version. If `requestUrl` dropped the User-Agent override, nothing below matters. | no |
| **2. Test login** | Reachability without credentials, then the login, MFA if Garmin asks for it, the ticket exchange, and a live API call. | yes |
| **3. Test session persistence** | A cold start: drops the in-memory access token, reloads the session from this device's keychain, mints a new access token from it alone, then makes two real calls. | only without a saved session |
| **4. Inspect fitness endpoints** | The keys and value types `maxMetrics`, `racePredictions` and `enduranceScore` return, then which properties the mapper makes of them. | no |

- **Checks 3 and 4 use the plugin's own session,** so they don't run during a sync. If one is
  running, they stop with `CANCELLED`; run them again once it has finished.
- **The password** you type for check 2 is cleared after each check.
- **Saving a run:** **Save to vault** keeps it as a note in the **Log folder** (`Garmin/diagnostics`,
  or `garmin-probe-logs` in vaults set up before 0.2), because a phone has no console.
- **Saving every run:** **Save every diagnostics run to the vault** saves each check that ends in a
  verdict. Check 1 has none.

### Verdicts

| Verdict | Meaning |
| --- | --- |
| `SUCCESS` | This platform can sign in. |
| `BLOCKED` | Garmin's edge refused the client, not your credentials. If step 0 passed and step 1 got a 403, the path is open and the credential POST is what was refused. Retrying won't help. |
| `RATE-LIMITED` | A 429. Wait 15–30 minutes, and don't retry in a loop. |
| `BAD-CREDENTIALS` | In check 2: wrong email or password; fix them before running it again, since repeated failures can lock the account. In check 3: a session Garmin ended. In check 4: no session on this device, or one Garmin ended. Sign in again. |
| `BAD-MFA-CODE` | The email and password were accepted; three verification codes weren't. Run it again with the newest code Garmin sends. |
| `CANCELLED` | Stopped at the code prompt (costing only the login attempt already spent), or a sync was running, or check 3 had no session and no email and password to make one. |
| `FAILED` | Read the step that failed. Step 3 failing after step 1 succeeded means Garmin has rotated its client IDs: save the run and open an issue with it. |

## Signing in

### Sign-in fails

**Check the verdict first.** `BLOCKED` and `BAD-CREDENTIALS` are different problems, and the fix for
one makes the other worse.
- **`BLOCKED`** means Garmin's edge refused the request, not that your password is wrong. There is no
  workaround from inside Obsidian. If it persists, open an issue with the saved run. The changes the
  plugin could try are listed in [Garmin API → If the edge tightens](garmin-api.md#if-the-edge-tightens).
- **Don't retry in a loop.** Garmin limits login attempts per IP and can lock an account after
  repeated failures.

### Multi-factor authentication

**A sync is never asked for a code.** It runs on the stored session, and only *signing in* asks for
one. If a sync stops with an authentication error, the session is dead and the fix is to sign in
again, code and all.

At sign-in, the challenge appears in the same dialog, with three tries. A refused code is asked
again in place, so a typo doesn't cost a second login attempt. If Garmin's sign-in session expires
while you type, the sign-in ends and asks you to start again.

- **Expect the challenge on every sign-in.** Garmin's "remember this browser" depends on a cookie the
  plugin deliberately doesn't keep. A sign-in happens once per session, though, not once per sync.
- **If the codes are right and Garmin keeps refusing them,** the error carries Garmin's own word for
  the refusal. That word is the useful half of a bug report.
- **"MFA required" as a hard error** means something tried to sign in with no way to ask for a code.
  That is a bug in the plugin, not a problem with your account.

### The session dies after a few days

Garmin may hand back a **new** refresh token each time the session is refreshed, and the plugin saves
it straight away. If a session still dies after a few days, run diagnostics check 3: it tests exactly
that path. If check 3 fails while check 2 passes, Garmin has probably rotated its client IDs (roughly
quarterly); open an issue with the saved run.

A refresh that fails for another reason, such as a Garmin outage or a bot check, keeps the session,
and the next sync tries again. Only Garmin saying the token is spent ends it. The session lives in
this device's keychain, so another device signing in or out never touches it.

### Rate limited (429)

Wait 15–30 minutes. Then:
- **Slow down:** set **Settings → Advanced → Sync speed** to **Gentle**, the default, before a long
  date range.
- **Turn off metric groups you don't need.** That removes requests, except among `activity`,
  `heart`, `stress`, `respiration` and `spo2`, which share one daily request.
- **Nothing recent was lost.** A sync goes newest day first, so a run cut short already covered the
  days that matter most.

A 429, Garmin's bot check, or a dead session ends a sync at once, because every later request would
fail the same way. **Stop syncing** stops a sync you started after the day it is on, keeping what came
in.

## Syncing and the history download

### The history download is paused

The download shows on Home under the title, in **Settings → Data**, and on a computer in the status
bar. What it says, and what to do:

| On Home | Why | What to do |
| --- | --- | --- |
| Sign in to keep downloading | The Garmin session ended | Sign in from the pill, **Settings → Data** or the **Sign in** command. It carries on by itself. |
| Garmin asked for a pause · resumes 14:05 | Garmin answered 429, past the client's own retries | Nothing. It waits 5 minutes, then 10, 20 and so on up to an hour while 429s keep coming. **Gentle** sync speed asks less of Garmin. |
| Refused by Garmin's bot check · resumes 14:35 | Garmin's edge refused this device | Nothing. It waits half an hour, doubling up to twelve hours, because asking again soon keeps a block in place. Run diagnostics if it keeps happening. |
| Update the plugin to keep downloading | Another device runs a newer version and wrote the files in its format | Update the plugin on this device. |
| Download resting · resumes 14:05 | It spent its hourly budget, or a piece of it failed (it tries again in ten minutes), or refreshing the session failed (5 minutes, doubling to an hour). A piece that fails three times is left for the next session. | Nothing. |
| Download paused | You paused it, on this device or another sharing the vault | **Resume** |
| Downloading history on iPhone | Another device with this vault is downloading | Nothing. If that device stops, this one takes over once it has been quiet for ten minutes. |

**Resume the history download** lifts every pause, Garmin's included.

If nothing downloads at all, there may be nothing to fetch: **Settings → Data** shows what is missing
from your Day details and Activity details ranges. The download also waits for the setup to have run
and for a session.

### A date range stopped early: "nothing found for 45 days running"

Working as intended. After 45 empty days in a row (**Stop after empty days**; `0` turns it off),
**Sync a date range…** gives up and says where. It walks newest to oldest, so the empty stretch is the
start of your Garmin history. Nothing is written for those days.

### Re-syncing keeps touching files

It shouldn't. A file is rewritten only when its text changes, and a sync writes each year file once,
after its days are in. That matters because Obsidian Sync and other sync tools send a changed file
everywhere. If files *are* rewritten every run, a value is changing: usually Garmin revising a recent
day, which is why a recent sync always covers yesterday too.

### "Written by a newer version of Garmin Connect"

Another device updated the plugin and wrote its files in a newer format. This device stops rather
than write its older format over them, which would make the two devices undo each other's work.
Update the plugin here (in BRAT, **Check for updates**), and the sync and the history download carry
on.

## Pages and charts

### Home says "No Garmin data on this device"

This device is set up and signed in, but the data folder is empty: usually the settings came from
another device and the data didn't. With Obsidian Sync, turn on **Sync all other types** (off by
default): the data is JSON, which Obsidian Sync counts as another type. Or press **Set up** and
download the history on this device.

A device that isn't signed in shows **Sign in to Garmin Connect** instead. If the data already
arrived through your vault sync and this device has never signed in, it shows **Not signed in on
this device**, and **Not now** puts that away.

### Home still shows yesterday after midnight

An open Home moves to the new day within a minute of midnight. If today's numbers aren't there yet,
Home says "Today isn't synced yet" and shows the last day it has. Run **Sync recent days** (Home's ↻).

### Home's Health Status card only says "Wear your device while sleeping for about 3 weeks"

As in the app, the card shows Garmin's onboarding prompt while **any** Health Status metric is still
building its baseline. Pulse Ox is the usual one: its baseline never finishes if your watch's Pulse
Ox mode is off during sleep. **More → Health Stats → Health Status** still shows each metric.

### "This page isn't in this version of the plugin"

Home remembers which page it was on. This appears when that page belongs to a version of the plugin
that had it, typically after going back to an older build. Press **Back**, or update the plugin.

### A day page has figures but no chart

A day's chart comes from its timelines, which the **intraday** group fills. Only the days inside
**Day details** get them from a routine sync or the history download. **Sync a date range…** fetches
them for every day it covers.

For older days:
- **Heart rate, stress, Body Battery and the Health Stats curves** are fetched the first time you
  open the day. You need to be signed in, with the right group on: `intraday` for Home's charts, the
  page's own group for a Health Stats page.
- **Steps, floors and intensity minutes** show only what a sync wrote. Widen **Day details** in
  **Settings → Data** to reach the day, or run **Sync a date range…** over it.

If a day still has no curve after that, Garmin has none for it: older days often have only the totals.

### A night has a score but no timeline, factors or coach

A night's sleep page reads its timeline, factors and Sleep Coach from that day's timelines. Nights
synced by a release before 0.2.0-beta.1 have none.
- **Inside your Day details range**, the history download fetches them again. A vault that was
  syncing before the setup existed is asked first, in the update dialog, or in **Settings → Data**
  after **Later**.
- **For older nights**, widen Day details, or run **Sync a date range…** over them with the
  **intraday** group on.

### A metric is always empty

Either its group is off in **Settings → Metrics**, your watch doesn't record it, or Garmin renamed a
field. For the fitness metrics, **diagnostics check 4** prints the raw keys Garmin returns next to
what the mapper extracted. If a value is there under a different name, that name is the fix: please
open an issue with the log.

## Files and devices

### Days synced by an older version are missing after an upgrade

Older builds kept each day as a note, with the numbers as properties. The plugin now reads days only
from `Garmin/data/days/<year>.json`. On the first load of a new build, once the vault is indexed, it
copies the old notes' days into those files and shows a notice with the count.

The copy runs only while `days/` doesn't exist, so it is skipped if a sync ran first or the notes
were somewhere it doesn't look. It reads notes in the data folder, and daily notes whose properties
carry the `garmin_` prefix.
- **To run it again,** close Obsidian, move the `days/` folder out of the vault, and reopen it.
  Careful: this drops every day the JSON held, including days synced since the upgrade. Only the
  days whose notes still exist come back, and the history download fetches your Day details range
  again.
- **Or fetch the days from Garmin** instead, with **Sync a date range…**.

Once the pages show your history, you can delete the old day notes, their `garmin_` properties and
`Garmin Health.base`. The plugin no longer reads or writes them.

### A data file "couldn't be read" and was kept as …unreadable…

The sync never writes over a file it can't read. A save cut short by a crash, a half-downloaded copy
from a sync service, or git's `<<<<<<<` conflict markers make a file unreadable. The plugin renames
it beside where it was (for example `days/2026.unreadable-20261016-113005.json`), writes what it
fetched into a fresh file, and fetches the rest again:
- **A day file:** its days drop out of the history download's coverage, so the download fetches
  them again within your **Day details** range. Older days come back with **Sync a date range…**.
- **A chart history:** it is walked again from the start, which costs a few requests a year.

The renamed file is yours to open or delete; nothing reads it. **Delete synced data** removes it
with the rest.

### Conflict copies ("2026 2.json")

When two devices change one file before they sync, the sync service keeps both:
- iCloud and Obsidian Sync name the copy `2026 2.json`;
- Syncthing names it `2026.sync-conflict-….json`;
- Dropbox names it `2026 (… conflicted copy …).json`.

The plugin reads only `2026.json`, so a day only the copy holds goes unseen. The first copy found in a
session gets a notice.
- **The history download runs on one device at a time** already: the others say which device has
  it.
- **Sync from one device when you can,** and let the others read what it syncs.
- **If days are missing,** **Sync a date range…** fetches them again. Then delete the copy.

### It works on desktop but breaks on mobile

A phone that says **Not signed in on this device** while the desktop works has no session of its own:
each device signs in separately. It still shows what the desktop syncs; sign in there only to sync
from the phone too.

Otherwise, run diagnostics check 1 on the phone. If `requestUrl` dropped the User-Agent override
there, that is the difference. Building from source, a node or electron import that leaked into the
bundle loads fine on a desktop and fails on a phone; `npm run build` catches exactly that.

### Reading a diagnostics log on a phone

Open the **Log folder** (`Garmin/diagnostics`, or `garmin-probe-logs` in older vaults). Each saved
run is a normal note, and it syncs to your desktop. Turn off **Save every diagnostics run to the
vault** if you don't want them kept.
