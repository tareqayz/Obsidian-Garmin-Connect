# FAQ

## Is my password stored?

No. It's used for one sign-in request and dropped. Only an OAuth2 refresh token
and its client ID are written, to the plugin's `data.json`. See
[Security](SECURITY.md).

## Does it work on mobile?

Yes — that was the point. Same plugin, same pages.

## Do I have to sign in on every device?

It depends on your vault sync. The session is the refresh token in
`.obsidian/plugins/garmin-connect/data.json`, beside the plugin's settings.
- **Your sync copies that file to the other device:** the device shares the
  session and is signed in already.
- **It doesn't:** sign in on that device too.

The data is separate: ordinary files in the vault, which travel with it.
Obsidian Sync carries them only with **Sync all other types** on, and it is off
by default. Without it, Home on the second device says "No Garmin data on this
device".

## Is this official? Will Garmin ban me?

It's not official, and not affiliated with Garmin. It signs in the way the
mobile app does. Garmin limits login attempts per IP and can lock an account
after repeated failures, so sign in deliberately and don't retry in a loop.

After that it makes ordinary API reads, and how many depends on the metric
groups you turn on:
- **Every day it syncs:** nine requests with everything on.
- **Each of those days inside Day details** (every day, for **Sync a date
  range…**): six more, for the day's curves.
- **Each sync:** about fifteen more, for your profile and the range calls.
- **Once, for the history you choose in the setup:** about 150 a year of
  history for Charts & trends, 15 a day for Day details and 10 a run for Run
  details. It downloads in the background, paced by the **Sync speed** setting
  and kept under an hourly budget: 10,000 requests at Normal.

The [Guide](GUIDE.md#what-gets-collected) has the breakdown.

## Why does a sync cover more than one day?

Garmin keeps revising a day after it ends: sleep is finalised late, and a watch
that syncs in the morning rewrites yesterday. So **Sync recent days** covers
everything since the watch's last upload as the previous sync saw it, from the
day before through today: at least yesterday and today, at most 30 days. There
is no setting; see [Settings → Sync](settings.md#sync).

## Will it overwrite my daily notes?

No. The sync writes no notes at all: everything goes to JSON files in its own
`Garmin/data` folder.

## I used an older version. Where did my day notes go?

Nowhere; they are still there. Older builds wrote each day as a note with the
numbers in its properties (in `Garmin/data`, your daily notes, or both) and
generated a `Garmin Health.base` table view. The plugin now keeps days in
`Garmin/data/days/<year>.json` instead.

The first time a new build loads, once the vault is indexed, it copies the days
from those notes into the day files and shows a notice saying how many. It only
does this while `days/` doesn't exist yet, and it never overwrites a day the
JSON already holds. It reads both the data-folder notes and daily notes with
the old `garmin_` prefix.

It doesn't delete anything. Once you've checked Home and the pages show your
history, you can delete the old day notes and `Garmin Health.base` yourself. In
daily notes, that means removing the `garmin_` properties; the plugin no longer
reads them.

## What files does it create?

All of them JSON under `Garmin/data/` (the default):
- **Day files.** `days/<year>.json`, each day's numbers keyed by date.
- **History and series files:**
  - `series/<date>.json` for a day's curves;
  - `account.json` for your profile;
  - `activities/`, `daily-stats/` and `sleep/`;
  - `activity-details/<id>.json`, a run's page;
  - one folder per Health Stats and Performance Stats history.
- **Bookkeeping:** `sync-state.json`, `scan.json`, `backfill.json`,
  `days/index.json` and `activity-details/index.json`, which say how far the
  syncs and the history download have got.
- **Diagnostics logs**, notes under `Garmin/diagnostics`, only if you run the
  diagnostics with saving on.

The [Guide](GUIDE.md#where-the-data-goes) lists every path and the metric group
that fills it.

## Can I backfill years of data?

Yes. Choose **All history** for Day details and **All runs** for Run details,
in the setup or **Settings → Data**, and the history download fetches them in
the background; the setup says how long that takes. Charts & trends always
cover your whole history.

**Sync a date range…** fetches a stretch by hand, back as far as 2010, and shows
the request count and time before you start. It walks newest to oldest and stops
after 45 consecutive empty days, so asking for 2010 won't hammer the API past
the start of your history.

## What is the "history isn't synced" banner?

The pages read history files — your activities, steps, sleep, stress and so on —
that a routine sync only keeps topped up. Until a history is complete, its pages
say so, with a rough request count and a **Sync history** button.

The history download fills them in the background once you have agreed to
Charts & trends, in the setup or the update dialog. A download cut short keeps
what it fetched and carries on next time.

## Will an update download things without asking?

No. A release that adds data for your history — a page with a history of its
own, or more detail for days you already keep — asks once, the first time a
Garmin page opens after it: **New data for your history** lists each item with
its size and time. **Download now** fetches the ticked ones in the background;
**Later** leaves them in **Settings → Data**, and nothing asks again.

What you already agreed to carries on without a question: new days, and gaps in
your Day details and Run details ranges, keep filling. Only what an older
version saved is asked about again.

## How do I uninstall it and remove the data?

Obsidian's **Uninstall** deletes the plugin's folder, with `data.json` in it:
your settings and the Garmin session. The data folder (`Garmin/data`) is part of
your vault, so it stays.

On the device you uninstall from, the plugin notices its folder has gone and
asks: **Keep data**, or **Move to trash**, which sends the plugin's own files in
the data folder to the trash and leaves anything else there. It also clears the
map tiles that device cached. It can't ask when the folder goes another way,
deleted by hand or uninstalled on another device; delete the data folder
yourself then.

To remove the data and keep the plugin, use **Settings → Danger zone → Delete
synced data…**, which can take the diagnostics notes too. Neither touches your
Garmin account. See [Security](SECURITY.md#removing-the-plugin-and-its-data).

## Why does a page differ from the phone app?

A few reasons, most of them temporary:
- **Garmin revises days late.** Sleep and Health Status are rescored, sometimes
  days afterwards. The next sync that covers the day catches up. The histories
  Garmin is known to revise (Health Status, weight, blood pressure, fitness age,
  respiration) re-read their latest days on every sync.
- **Some states are inferred.** The pages were rebuilt from screenshots of the
  app and its web data. Some states never appeared on the accounts they were
  built from, so they are inferred. [TODO.md](../TODO.md) lists every one still
  waiting for a check against the phone.
- **The curve may be missing.** A day page's curve needs that day's series file.
  See [Troubleshooting](troubleshooting.md).

## Where did the classic dashboard go?

It was retired in 0.2, replaced by the Garmin Connect pages:
- its layouts, the history charts for HRV, readiness, training load, VO₂ max,
  endurance and race predictions, the activity detail, the heatmap and the data
  table are gone;
- the data is all still there, in the day files, and Home's At a Glance cards
  show the latest values.

A tab of the old dashboard left open reopens as Home.

## A metric is always empty. Why?

Either its group is off in settings, your watch doesn't record it, or Garmin
renamed a field. **Run diagnostics** → check 4 prints the raw keys the fitness
endpoints actually return, next to what the mapper extracted. If the value is
there under a different name, that's the fix — open an issue.

## Does re-syncing the same day cost anything?

It costs the requests, but not a file write. A day file is rewritten only when
its text changes, so Obsidian Sync doesn't see a change to propagate.

## Sign-in fails. What now?

Run **Run diagnostics** and read the verdict:
- `BLOCKED` means Garmin's edge refused the client, not your password, and
  retrying won't help.
- `BAD-CREDENTIALS` means stop and fix the credentials.
- `RATE-LIMITED` means wait 15–30 minutes.

The full table is in [Troubleshooting](troubleshooting.md).

## Does a sync ever ask for an MFA code?

No. A sync runs on the stored refresh token; only *signing in* is challenged. If
a sync stops with an auth error, the session is dead and the fix is to sign in
again.

## Can I query the data with Dataview or Bases?

Not directly any more. Both query note properties, and the plugin no longer
writes notes. The days are plain JSON in `Garmin/data/days/`, one line a day,
so a script or another plugin that reads JSON can use them. See the
[property reference](properties.md) for names and units.

## Does it work with a Garmin China account?

Set **Settings → Connection → Region** to `garmin.cn`; every host changes
accordingly.

## Why no chart library?

An Obsidian plugin can't load external scripts, and a bundled chart library
would be dead weight on a phone. The charts are hand-drawn SVG.

The one library is Leaflet, for the activity maps: panning and pinching a map
on a phone is where hand-rolled code breaks. It is bundled with the plugin and
loads only when a map is drawn.

## Why does an activity map talk to OpenStreetMap?

Garmin's app draws Google's map, which a plugin can't use without each user
setting up a paid Google key. The plugin draws OpenStreetMap's map instead,
from `tile.openstreetmap.org`, and that server sees which part of the map you
open. Turn **Map tiles** off in the settings and the route is drawn on its own,
with no request at all; that is also what you see offline.

## What are the diagnostics logs in my vault?

Each **Run diagnostics** run, saved as a note, because a phone has no console.
They are saved while **Save every diagnostics run to the vault** is on.
- **Where:** the **Log folder** setting, `Garmin/diagnostics` in vaults set up
  since 0.2. Older vaults keep the folder they had, usually
  `garmin-probe-logs`.
- **Redacted:** the email is masked, tokens truncated and the IP address
  shortened before anything is written.

Turn the setting off if you'd rather not keep them.
