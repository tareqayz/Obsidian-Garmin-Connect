# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Version numbers match the git tag and the `version` in `manifest.json`. Each
GitHub release takes its notes from the matching section here — see
[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md#releasing) for how a release is cut.

## [Unreleased]

## [0.2.0] — 2026-10-09

The plugin is now Garmin Connect, rebuilt inside Obsidian: the phone app's
Home, Activities, daily stats, Sleep and Health Stats pages, drawn from data
the sync keeps in your vault. The configurable dashboard that came before it is
gone.

### Added

- **Home.** Garmin Connect's home screen, opened by the ribbon icon or **Open
  home**. All three of the app's presets (Be healthy, Stay active, Track my
  training), and At a Glance with 36 cards. Its See All page has an edit mode:
  remove, reorder (drag or arrow keys) and Add a Stat, up to 20 cards.
- **Activities.** From Home's ⋯ menu, More → Activities:
  - one page per sport, with distance, time, ascent and calorie totals over a
    week, four weeks or a year, and a page per month;
  - All Activities and Personal Records.

  They read an activity index the sync keeps in `<data folder>/activities/`.
- **Steps, Floors and Intensity Minutes.** Pages for a day, a week, four weeks
  and a year, read from a daily stats index in `<data folder>/daily-stats/`.
- **Sleep.** The night's score, stages and timeline, its factors, and the Sleep
  Coach, plus the weekly, four-week and yearly views. Read from a sleep index in
  `<data folder>/sleep/`.
- **Health Stats.** From More → Health Stats, a hub with these pages. They read
  the histories the sync keeps under `<data folder>/`; Health Snapshot loads on
  view.
  - Health Status, Weight, Pulse Ox, Pulse Ox Acclimation
  - Respiration, Heart Rate, Blood Pressure, Stress, Body Battery
  - Fitness Age, Health Snapshot
  - Lifestyle Logging (Garmin's empty state for now)
- **Commands.**
  - A command to open each page: **Open activities**, **Open steps**, **Open
    sleep**, **Open stress** and so on.
  - A command to sync each history: activity; step, floor and intensity;
    sleep; and each of the nine Health Stats indexes. Each history also fills
    in by itself after the first sync of a session, until it is complete.
- **Three metric groups.**
  - `intraday`: the day's heart rate, stress, Body Battery, steps, floors and
    intensity curves, kept in `<data folder>/series/<date>.json` for
    the newest seven days of a sync.
  - `health`: Health Status and Health Snapshots.
  - `profile`: the watch, personal records, lactate threshold and training plan
    in `<data folder>/account.json`, about nine requests a sync.

  A vault that predates them gets them switched on once.
- The API catalogue now covers the Activities and Health Stats endpoints: 167
  in all, 69 of them checked against the live service every day.
- For contributors:
  - CI builds and tests every pull request;
  - release notes come from this file;
  - the `/garmin-page` pipeline (`.claude/skills/garmin-page/`) rebuilds a
    Garmin page from the phone and web app.

### Changed

- **Command and ribbon names.** The ribbon icon is **Open Garmin Home**, and:
  - **Open dashboard** → **Open home**;
  - **Run connectivity probe** → **Run diagnostics**;
  - **Rebuild the Garmin table view** → **Rebuild the table view**.

  Command ids are unchanged, so hotkeys keep working.
- **Settings.**
  - The Diagnostics section is now **Advanced**.
  - Races and workouts show what they cost: one request per sync, not one a
    day.
  - New vaults save diagnostics runs to `Garmin/diagnostics`.
- **Requires Obsidian 1.9.10 or later**, the first release with Bases, which
  the generated table view needs.

### Fixed

- VO₂ Max and training status now reach the day notes. The sync was looking
  for them in the wrong place in Garmin's responses.

### Removed

- **The classic dashboard.** The following are gone:
  - **Open classic dashboard** and its layouts;
  - the history charts for HRV, readiness, recovery, training load, VO₂ max,
    endurance and race predictions;
  - the per-activity detail (splits, heart-rate zones, elevation);
  - the calendar heatmap and the data table;
  - its **Backfill…** button.

  The data is all still there:
  - your day notes and the Bases table keep every value;
  - Home's At a Glance cards show the latest;
  - **Sync a date range…** still backfills.

  Performance Stats and an activity detail screen are next to be rebuilt (see
  [TODO.md](https://github.com/tareqayz/Obsidian-Garmin-Connect/blob/main/TODO.md)).
  Hotkeys bound to **Open classic dashboard** no longer do anything, and a tab
  of it left open reopens as Home.
- The one-off clean-up, and its notice, for settings written by pre-release
  builds.
- For contributors: `npm run probe:node` and `npm run preview:dashboard`.

## [0.1.0-beta.1] — 2026-09-19

The first build published for testers. It includes everything from the
development builds before it.

### Added

- **Sign-in that works on desktop and mobile.**
  - Garmin's mobile-app sign-in flow: SSO login, service ticket exchange, and
    OAuth2 bearer tokens.
  - Multi-factor authentication, asked for in the same dialog. A refused code
    is asked again, up to three times.
  - The session survives restarts through a stored refresh token, refreshed
    ahead of expiry.
- **Sync.**
  - Into a data folder of its own, your daily notes, or both.
  - Newest day first, skipping days that did not change, tolerant of one
    failed request.
  - A backfill stops after a run of empty days.
  - A request that fails with a 5xx or no response is retried, with jittered
    backoff. A 429 is never retried.
- **Thirteen metric groups as note properties:** activity, heart, sleep,
  stress and Body Battery, HRV, readiness, fitness (VO₂ Max, fitness age,
  endurance), race predictions, respiration, pulse ox, body composition,
  training load and status, and workouts.
- **A generated Bases table view** ("Garmin Health.base"). Each day note can
  also link to it, so the notes form a hub in the graph view.
- **A configurable dashboard** of 36 cards with saved layouts. It was removed
  in the release after this one.
- **Run connectivity probe.** A four-step check of sign-in and connectivity
  that saves its log into the vault, because a phone has no console.
- **The Garmin API, written down and checked daily.**
  - `api/endpoints.json` catalogues the endpoints Garmin exposes.
  - `api/schema/` records the response shapes actually seen.
  - A daily workflow opens an issue when a field the plugin reads stops
    arriving.
- **Releases.** A tag-driven pipeline with stable and BRAT beta channels.
- **Licence.** MIT.

### Known issues at the time

- VO₂ Max never populated. Fixed since.
- Android was untested: a third TLS fingerprint after desktop and iOS.
- The graph view can struggle when many day notes link to one hub note. Turn
  off "Link every day to the table view" if it does.

[Unreleased]: https://github.com/tareqayz/Obsidian-Garmin-Connect/compare/0.2.0...HEAD
[0.2.0]: https://github.com/tareqayz/Obsidian-Garmin-Connect/compare/0.1.0-beta.1...0.2.0
[0.1.0-beta.1]: https://github.com/tareqayz/Obsidian-Garmin-Connect/releases/tag/0.1.0-beta.1
