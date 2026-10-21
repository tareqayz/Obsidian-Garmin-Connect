# FAQ

Short answers, each with a link to the full story.

## Is my password stored?

No. It is used for the sign-in and dropped. Only the session (an OAuth2 refresh token and its client
ID) is kept, in Obsidian's keychain on that device, never in the vault. See
[Security](SECURITY.md).

## Does it work on mobile?

Yes. It is the same plugin with the same pages, on desktop and mobile.

## Do I have to sign in on every device?

Only on the devices you want to sync from. Each device keeps its own session in its keychain, so a
session never travels with your vault.
- **Sign in on one device,** and the others show what it syncs: the data is ordinary files in the
  vault. Home there says **Not signed in on this device**, with **Not now** to put that away.
- **Sign in on another device too** to sync from it as well.

The data needs your vault sync to carry it. With Obsidian Sync, that means turning on **Sync all
other types**, which is off by default.

## Is this official? Will Garmin ban me?

It is not official, and not affiliated with Garmin. It signs in the way Garmin's mobile app does,
then makes ordinary reads, at a deliberately gentle pace.
- With every metric group on, a day costs nine requests, plus six for its timelines.
- A sync costs about 30 more. An automatic one that finds nothing new costs two.
- Your history downloads once, in the background, under 8,000 requests an hour, halved for a day
  after Garmin asks it to slow down.

Garmin does limit login attempts per IP and can lock an account after repeated failures, so sign in
deliberately and never retry in a loop. The breakdown is in
[Settings → Metrics](settings.md#metrics).

## Why does a sync cover more than one day?

Garmin keeps revising a day after it ends: sleep is finalised late, and a watch that syncs in the
morning rewrites yesterday. So **Sync recent days** covers everything since the watch's last upload,
at least yesterday and today, and at most 30 days. See
[the Guide](GUIDE.md#how-sync-recent-days-picks-its-days).

## Does it sync on its own?

Yes, unless you turn off **Sync automatically** in Settings. It syncs when Obsidian starts and when
you open Home, once the last sync is 15 minutes old. When nothing changed on Garmin, that costs two
requests and writes nothing. See [Sync automatically](GUIDE.md#sync-automatically).

## Will it overwrite my daily notes?

No. The sync writes no notes at all. Everything goes into JSON files in its own data folder,
`Garmin/data` by default.

## I used an older version. Where did my day notes go?

Nowhere: they are still there. 0.1.0-beta.1 and 0.2.0-beta.1 wrote each day as a note with the
numbers as properties, and generated a `Garmin Health.base` table. The plugin now keeps days in
`Garmin/data/days/<year>.json`, and from 1.0.2 on it no longer reads those notes: the history
download fetches the days from Garmin again, as far back as your **Day details** range goes.

Once Home and the pages show your history, you can delete the old notes and `Garmin Health.base`
yourself. If days are missing, see
[Troubleshooting](troubleshooting.md#days-synced-by-an-older-version-are-missing-after-an-upgrade).

## What files does it create?

Only JSON files in the data folder (`Garmin/data` by default):
- a file per year of days;
- the pages' histories and timelines;
- a few bookkeeping files.

It also writes diagnostics notes in the **Log folder**, but only when you ask it to. Every path is in
the [Data reference](properties.md).

## Can I backfill years of data?

Yes, and it's what the setup recommends: **Download all history** fetches every day and every
activity in the background, and says how long that takes. Later, choose **All history** and **All
activities** in **Settings → History**. Charts & trends always cover your whole history.

**Sync a date range…** also fetches any stretch by hand, back as far as 2010, and says how long it
takes before you start. See [Date ranges](GUIDE.md#date-ranges).

## What is the "history isn't synced" banner?

A page whose history isn't complete yet says so, with a **Sync history** button that fetches it at
once. Otherwise the history download fills it in the background, once you have agreed to Charts &
trends.

## Will an update download things without asking?

No. A release that adds data for your history asks once, the first time a Garmin page opens after
it. **Download now** fetches the ticked items; **Later** leaves them in **Settings → History**. What
you already agreed to, such as new days and the gaps in your ranges, keeps filling without a
question. See [After an update](GUIDE.md#after-an-update).

## How do I uninstall it and remove the data?

Obsidian's **Uninstall** deletes the plugin's folder, with your settings. Your data folder stays,
because it is part of your vault. On the device you uninstall from, the plugin then offers to **Keep
data** or **Move to trash**, and clears its session and map tiles from that device. To remove the data
and keep the plugin, use **Settings → Advanced → Delete synced data**. See
[Security](SECURITY.md#removing-the-plugin-and-its-data).

## Why does a page differ from the phone app?

A few reasons, most of them temporary:
- **Garmin revises days late.** Sleep and Health Status are rescored, sometimes days afterwards. The
  histories Garmin revises re-read their latest days on every sync (the **Re-read** column in
  [Data reference → Day indexes](properties.md#day-indexes)).
- **Some states are inferred.** The pages were rebuilt from screenshots of the app and its web
  data, and some states never appeared on the accounts they were built from. Those states are
  inferred until someone checks them against the phone.
- **The curve may be missing.** See
  [Troubleshooting](troubleshooting.md#a-day-page-has-figures-but-no-chart).

## Where did the classic dashboard go?

It was retired in 0.2. Its layouts, heatmap and data table are gone. Its charts came back as Garmin's
own pages: HRV Status, Training Readiness, Load, VO₂ Max, Endurance Score and Race Predictor, with
each activity on its own page. All the data is still there, and a tab of the old dashboard left open
reopens as Home.

## Does re-syncing the same day cost anything?

It costs the requests, but not a file write. A file is rewritten only when its content changes, so
Obsidian Sync sees nothing to send.

## Sign-in fails. What now?

Run **Run diagnostics** and read the verdict:
- `BLOCKED` means Garmin's edge refused the client, not your password; retrying won't help.
- `BAD-CREDENTIALS` means stop and fix the credentials.
- `RATE-LIMITED` means wait 15–30 minutes.

The full table is in [Troubleshooting](troubleshooting.md#verdicts).

## Does a sync ever ask for an MFA code?

No. A sync runs on the stored session; only signing in is challenged. If a sync stops because Garmin
ended the session, sign in again. A refresh that fails for another reason, such as Garmin being down,
keeps the session, and the next sync tries again.

## Can I query the data with Dataview or Bases?

Not directly. Both query note properties, and the plugin no longer writes notes. The days are plain
JSON in `Garmin/data/days/`, one line a day, so a script or a plugin that reads JSON can use them. The
[Data reference](properties.md) lists every key and unit.

## Does it work with a Garmin China account?

Choose **garmin.cn** under **Region** when you sign in, or in **Settings → Advanced → Region**: every
Garmin host changes accordingly, and changing it signs you out. It is untested, because nobody with a China
account has tried it yet, so a report either way helps.

## Why no chart library?

An Obsidian plugin can't load external scripts, and a bundled chart library would be dead weight on a
phone, so the charts are hand-drawn SVG. The one drawing library is Leaflet, for the activity maps: panning
and pinching a map on a phone is where hand-rolled code breaks. It is bundled with the plugin and
loads only when a map is drawn.

## Why does an activity map talk to OpenStreetMap?

Garmin's app draws Google's map, which a plugin can't use without each user setting up a paid key. So
the plugin draws OpenStreetMap's, from `tile.openstreetmap.org`, which sees which part of the map you
open. Turn **Map tiles** off and the route is drawn on its own, with no request at all. Offline, a
map draws the tiles this device has cached, and the route alone elsewhere.

## What are the diagnostics logs in my vault?

They are **Run diagnostics** runs you saved as notes, because a phone has no console. A run is saved
when you press **Save to vault**, or whenever a check ends in a verdict while **Save diagnostics
runs** is on (it is off by default). They go in the **Log folder**, `Garmin/diagnostics` in
vaults set up since 0.2, and they are redacted before they are written. See
[Security](SECURITY.md#diagnostics-logs).

For a bug report, **Save debug info** is usually what's wanted: it needs no password and makes no
request.
