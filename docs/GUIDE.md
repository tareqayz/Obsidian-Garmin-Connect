# Guide

How to use the plugin once it's [installed](INSTALLATION.md).

## 1. Sign in

Run **Sign in to Garmin Connect** from the command palette, or press the button in settings.

Your password is used for one request and never written anywhere. If your account has MFA on, the same dialog asks for the code next — three tries before the sign-in starts over.

## 2. Sync

| Command | What it does |
| --- | --- |
| **Sync recent days** | The last *N* days (default 3) |
| **Sync today** | Just today |
| **Sync a date range…** | Backfill. Shows a request estimate before you commit |
| **Open dashboard** | The charts pane |
| **Rebuild the Garmin table view** | Regenerates the Bases view from current settings |
| **Run connectivity probe** | Diagnostics — see [Troubleshooting](troubleshooting.md) |

The ribbon icon opens the dashboard, where **Sync** and **Backfill…** also live.

## Where the data goes

By default, one note per day in `Garmin/`, with the metrics as frontmatter properties:

```yaml
---
date: 2026-09-12
steps: 8432
distance_km: 6.21
resting_hr: 48
sleep_hours: 7.5
sleep_score: 82
hrv_avg: 42
training_readiness: 71
---
```

On the first sync that writes something, a **Bases view** is generated next to it (`Garmin/Garmin Health.base`) so the folder reads as a sortable table. It's created once and never overwritten, so any columns you change by hand survive.

**Settings → Storage** switches the mode:

| Mode | Behaviour |
| --- | --- |
| **Data folder** (default) | One note per day in `Garmin/`. Never touches notes you wrote. Every day is writable, so backfill works from nothing. |
| **Daily notes** | Properties go into your existing daily note, prefixed `garmin_`. Only writes to notes that already exist unless you turn on *Create missing notes*. |
| **Both** | Writes to each. |

Every property, with units and query examples, is in the [property reference](properties.md).

## What gets collected

Thirteen metric groups, each switchable in settings, writing around ninety properties: activity, heart, sleep, stress and Body Battery, HRV, training readiness, fitness, races, respiration, pulse ox, body composition, training load, and workouts.

Turning a group off stops its request **when it has one**. Five groups share the daily summary call, so respiration and pulse ox cost nothing at all. The settings screen marks which is which. With everything on, a day costs seven requests.

## The dashboard

**Open dashboard** draws charts from whatever has been synced: goal rings, stat tiles with week-over-week deltas, then five collapsible sections — Activity, Sleep, Recovery, Fitness, Body — holding around thirty-six cards.

A range row (30 days / 90 days / 1 year / custom) scopes everything below it, and a **Table** toggle swaps the whole view for the same numbers as text. Every card has an **i** button explaining the metric; every chart has an **⤢** to expand it.

### Layouts

Default is only the starting point. The pill bar at the top switches between layouts, and **Edit layout** lets you drag widgets to move them, drag a corner to resize, add from a picker of every widget, or remove anything. There's no Save button — edits apply as you make them, and **Reset** puts the shipped layout back.

A layout is saved with the plugin, not the device, so the same one opens on your phone. Widths are a span of a four-column grid, and the **pane** decides how many columns exist:

| Pane width | Columns |
| --- | --- |
| 900px and up | 4 |
| 560–899px | 2 |
| under 560px | 1 (stat tiles stay two-up) |

Resizing the pane never changes the stored layout.

## How syncing behaves

- **A day with nowhere to go costs nothing.** Whether a day is writable is decided before any request is made.
- **Re-syncing is free.** If nothing would change, the file isn't touched — which matters with Obsidian Sync.
- **It syncs more than one day on purpose.** Garmin keeps revising a day after it ends; sleep is finalised late.
- **It backs off rather than digging in.** A 429 or a dead session abandons the whole range. One endpoint failing for one day is just a warning — the rest of that day still gets written.
- **It stops at the end of your history.** After 45 consecutive empty days (configurable; 0 disables) a backfill gives up and says so. Nothing bogus is ever written.
- **Newest day first**, so a run cut short still covered the days you care about.

## Next

- Something broken → [Troubleshooting](troubleshooting.md)
- Every setting → [Settings reference](settings.md)
- Common questions → [FAQ](FAQ.md)
