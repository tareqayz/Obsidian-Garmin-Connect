# FAQ

## Is my password stored?

No. It's used for one sign-in request and dropped. Only an OAuth2 refresh token and its client ID are written to `data.json`. See [Security](SECURITY.md).

## Does it work on mobile?

Yes — that was the point. Same plugin, same features, including the dashboard. Each device keeps its own session, so sign in on each.

## Is this official? Will Garmin ban me?

It's not official. It authenticates the same way the mobile app does. Garmin limits login attempts per IP and can lock an account after repeated failures, so sign in deliberately and don't retry in a loop. Normal syncing is a handful of ordinary API reads.

## Why does it sync three days instead of one?

Garmin keeps revising a day after it ends — sleep is finalised late, and a watch that syncs in the morning rewrites yesterday. Three is the default; change it in settings.

## Will it overwrite my daily notes?

In daily-notes mode it only writes frontmatter properties, all prefixed `garmin_` so they can't collide, and only to notes that already exist unless you turn on *Create missing notes*. Your body text is never touched. The default mode doesn't touch your notes at all — it writes to its own `Garmin/` folder.

## Can I backfill years of data?

Yes. **Sync a date range…** is unbounded and shows a request estimate first. It walks newest to oldest and stops after 45 consecutive empty days, so asking for 2010 won't hammer the API past the start of your history.

## A metric is always empty. Why?

Either the group is off in settings, your watch doesn't record it, or Garmin renamed a field. Run **Run connectivity probe** → check 4, which prints the raw keys the endpoints actually return next to what the mapper extracted. If the value is there under a different name, that's the fix — open an issue.

## Does re-syncing the same day cost anything?

It costs the requests, but not a file write. Incoming properties are diffed against what's already there, and an unchanged file isn't touched — so Obsidian Sync doesn't see a change to propagate.

## Sign-in fails. What now?

Run the probe and read the verdict. `BLOCKED` means Garmin's edge refused the client, not your password — retrying won't help. `BAD-CREDENTIALS` means stop and fix the credentials. `RATE-LIMITED` means wait 15–30 minutes. Full table in [Troubleshooting](troubleshooting.md).

## Does a sync ever ask for an MFA code?

No. Sync runs on the stored refresh token; only *signing in* is challenged. If a sync stops with an auth error, the session is dead and the fix is to sign in again.

## Why not a markdown table instead of properties?

A markdown table is inert text. Dataview and Bases both query *properties*, which is what lets you ask "resting HR on days I ran more than 10 km". The generated Bases view gives you the table anyway.

## Can I query the data with Dataview?

Yes — everything is standard frontmatter. See the [property reference](properties.md) for names, units and examples.

## Does it use a Garmin China account?

Set the `domain` setting to `garmin.cn`; every host changes accordingly.

## Why no chart library?

An Obsidian plugin can't load external scripts, and a bundled chart library would be dead weight on a phone. The charts are hand-drawn SVG.

## What are the probe logs in my vault?

Diagnostics written to `garmin-probe-logs/`, because a phone has no console. They're redacted before writing — email masked, tokens truncated, IP truncated. Turn off `autoSaveLog` if you'd rather not keep them.
