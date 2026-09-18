# Settings reference

Every setting, its default, and what changing it actually does. Defaults come
from `DEFAULT_SETTINGS` in `src/settings.ts`.

Settings live in `data.json` beside the plugin, along with the refresh token.
See [security](../SECURITY.md) before you sync that file anywhere public.

## Account

| Setting | Default | Effect |
| --- | --- | --- |
| `email` | `""` | The Garmin Connect account to sign in as. |
| `domain` | `garmin.com` | Switch to `garmin.cn` for Garmin China accounts. Changes every host the plugin talks to. |

Your **password is never stored**. It is used for one sign-in request and
dropped. Only a refresh token and the DI client ID it belongs to are written.

If the account has multi-factor authentication on, the sign-in dialog asks for
the verification code as a second step. The code is not stored either, and
because "remember this browser" needs a cookie the plugin deliberately does not
keep, expect the challenge on every sign-in — which is once per session, not
once per sync.

## What gets collected

| Setting | Default | Effect |
| --- | --- | --- |
| `groups` | all nine | Which metric groups to sync. |
| `units` | `auto` | `metric` writes `distance_km`, `imperial` writes `distance_mi`, `auto` follows your Garmin account. |

The nine groups are `activity`, `heart`, `sleep`, `stress`, `hrv`, `readiness`,
`fitness`, `races`, `workouts`. See [properties](properties.md) for what each
one writes.

**Turning a group off also stops the request that fetches it**, so a narrow
selection is genuinely cheaper, not just quieter. It also drops that group's
columns from a rebuilt table view. `activity`, `heart` and `stress` share one
request, so switching off only one of the three saves nothing.

## Storage

| Setting | Default | Effect |
| --- | --- | --- |
| `storageMode` | `dataFolder` | `dataFolder`, `dailyNotes`, or `both`. |
| `dataFolder` | `Garmin/data` | Where per-day notes go in data-folder mode. |
| `dataFolderPrefix` | `""` | Prefix for properties in data-folder mode. |
| `prefix` | `garmin_` | Prefix for properties in daily-notes mode. |
| `dailyNoteFolder` | `""` | Overrides the core Daily Notes folder. Empty means follow it. |
| `dailyNoteFormat` | `""` | Overrides the core Daily Notes date format. Empty means follow it. |
| `createMissingNotes` | `false` | Whether daily-notes mode may create a note that does not exist. |

Mode behaviour:

| Mode | What it does |
| --- | --- |
| **Data folder** | One note per day in `dataFolder`. Never touches notes you wrote. Every day is writable, so backfill works with nothing existing first. |
| **Daily notes** | Properties go into the daily note you already keep, prefixed so they cannot collide. Only writes to notes that already exist unless `createMissingNotes` is on. |
| **Both** | Writes to each. A day counts as written if either target took it. |

`createMissingNotes` is **off by default on purpose**: writing into notes you
already have is safe, inventing notes in someone's daily-note folder is not.

In daily-notes mode a note you have moved is still found by name, the way
Obsidian itself resolves it.

## Table view

| Setting | Default | Effect |
| --- | --- | --- |
| `createBasesView` | `true` | Generate `Garmin Health.base` on the first sync that writes something. |
| `basesFolder` | `Garmin` | Where that view file lives — usually the parent of the data folder. |

The view is **created once and never overwritten**, so columns and filters you
change by hand survive every later sync. Run *Rebuild the Garmin table view* to
regenerate it from current settings when you actually want that.

## Graph linking

| Setting | Default | Effect |
| --- | --- | --- |
| `linkToBase` | `true` | Give every day note a property pointing at the base file. |
| `linkProperty` | `link` | The property name to use. |

The value is written as a wikilink (`[[Garmin/Garmin Health.base]]`) rather than
a plain path, which is what puts an edge in the graph view and a backlink on the
target. The property is written **unprefixed** even in daily-notes mode — it is
yours, not a metric.

> With a large vault this gives you one note linking to hundreds of others. That
> hub shape is the point, but it has been observed to make the graph simulation
> struggle. Turn `linkToBase` off if your graph view becomes unusable.

## Sync behaviour

| Setting | Default | Effect |
| --- | --- | --- |
| `syncDays` | `3` | How many days back *Sync recent days* covers. |
| `syncOnStartup` | `false` | Run a recent sync when Obsidian loads the plugin. |
| `pauseBetweenDays` | `250` | Milliseconds to wait between days. |
| `stopAfterEmptyDays` | `45` | Give up after this many consecutive empty days. `0` disables. |

**Why three days and not one.** Garmin keeps revising a day after it ends —
sleep is finalised late, and a watch that syncs in the morning rewrites
yesterday. Re-syncing an unchanged day costs nothing to write, because the
incoming properties are diffed against the frontmatter and an identical day
leaves the file untouched. That matters with Obsidian Sync or LiveSync, which
both treat a bumped mtime as a change to propagate.

**Why `stopAfterEmptyDays` exists.** Backfills are unbounded — you can ask for
2010 — but a range reaching past the start of your Garmin history would keep
asking, several requests a day, until Garmin rate-limits you. The sync walks
newest to oldest, so that empty region is always the tail. After the configured
run of empty days it stops and tells you where it gave up. Nothing bogus is
written for those days.

**Raising `pauseBetweenDays`** is the first thing to try if you are hitting 429s
on long backfills.

## Diagnostics

| Setting | Default | Effect |
| --- | --- | --- |
| `logFolder` | `garmin-probe-logs` | Where probe logs are written in the vault. |
| `autoSaveLog` | `true` | Write a log file on every probe run. |

Logs go into the vault rather than the console because **on a phone there is no
console**, and a file in the vault syncs back to your desktop like any other
note. See [troubleshooting](troubleshooting.md).
