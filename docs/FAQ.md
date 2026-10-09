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

## Is this official? Will Garmin ban me?

It's not official, and not affiliated with Garmin. It signs in the way the
mobile app does. Garmin limits login attempts per IP and can lock an account
after repeated failures, so sign in deliberately and don't retry in a loop.

After that it makes ordinary API reads, and how many depends on the metric
groups you turn on:
- **Every day it syncs:** nine requests with everything on.
- **The newest seven days of each sync:** six more each, for the day's curves.
- **Each sync:** about fifteen more, for your profile and the range calls.
- **Once, when it fills its history files:** about 130 per year of history,
  with a pause between requests.

The [Guide](GUIDE.md#what-gets-collected) has the breakdown.

## Why does it sync three days instead of one?

Garmin keeps revising a day after it ends: sleep is finalised late, and a watch
that syncs in the morning rewrites yesterday. Three is the default; change it in
**Settings → Sync → Days to sync**.

## Will it overwrite my daily notes?

The default mode doesn't touch your notes at all: it writes to its own
`Garmin/data` folder.

In daily-notes mode it only writes frontmatter properties, all prefixed
`garmin_` so they can't collide. It writes only to notes that already exist,
unless you turn on **Create missing notes**. Your body text is never touched.

## What files does it create?

All of them under the `Garmin/` folder (the defaults):
- **Day notes.** `Garmin/data/<date>.md` in the default mode.
- **The table view.** `Garmin/Garmin Health.base`.
- **History and series files** under `Garmin/data/`:
  - `series/<date>.json` for a day's curves;
  - `account.json` for your profile;
  - `activities/`, `daily-stats/` and `sleep/`;
  - one folder per Health Stats history.
- **Diagnostics logs**, only if you run the diagnostics with saving on.

The [Guide](GUIDE.md#where-the-data-goes) lists every path and the metric group
that fills it.

## Can I backfill years of data?

Yes. **Sync a date range…** goes back as far as 2010 and shows the request count
and time before you start. It walks newest to oldest and stops after 45
consecutive empty days, so asking for 2010 won't hammer the API past the start
of your history.

## What is the "history isn't synced" banner?

The pages read history files — your activities, steps, sleep, stress and so on —
that a routine sync only keeps topped up. Until a history is complete, its pages
say so, with a rough request count and a **Sync history** button.

The plugin also fills them by itself after the first sync of each session. A run
cut short keeps what it fetched and carries on next time.

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
- the data is all still there, in the day notes and the table view, and Home's
  At a Glance cards show the latest values.

Performance Stats and an activity detail screen are next to be rebuilt. A tab of
the old dashboard left open reopens as Home.

## A metric is always empty. Why?

Either its group is off in settings, your watch doesn't record it, or Garmin
renamed a field. **Run diagnostics** → check 4 prints the raw keys the fitness
endpoints actually return, next to what the mapper extracted. If the value is
there under a different name, that's the fix — open an issue.

## Does re-syncing the same day cost anything?

It costs the requests, but not a file write. Incoming properties are diffed
against what's already there, and an unchanged file isn't touched, so Obsidian
Sync doesn't see a change to propagate.

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

## Why not a markdown table instead of properties?

A markdown table is inert text. Dataview and Bases both query *properties*,
which is what lets you ask "resting HR on days I ran more than 10 km". The
generated table view gives you the table anyway.

## Can I query the data with Dataview?

Yes — everything is standard frontmatter. See the
[property reference](properties.md) for names, units and examples.

## Does it work with a Garmin China account?

Set **Settings → Connection → Region** to `garmin.cn`; every host changes
accordingly.

## Why no chart library?

An Obsidian plugin can't load external scripts, and a bundled chart library
would be dead weight on a phone. The charts are hand-drawn SVG.

## What are the diagnostics logs in my vault?

Each **Run diagnostics** run, saved as a note, because a phone has no console.
They are saved while **Save every diagnostics run to the vault** is on.
- **Where:** the **Log folder** setting, `Garmin/diagnostics` in vaults set up
  since 0.2. Older vaults keep the folder they had, usually
  `garmin-probe-logs`.
- **Redacted:** the email is masked, tokens truncated and the IP address
  shortened before anything is written.

Turn the setting off if you'd rather not keep them.
