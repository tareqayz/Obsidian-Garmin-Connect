# Changelog

All notable changes, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Each section below `[Unreleased]` is a
published release, headed by its tag. From the next release on, a GitHub release takes its notes
from its section; see [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md#releasing).

## [Unreleased]

### Changed

- **A simpler setup.** After the scan it recommends one thing: download your whole history, with its
  size and how long it takes. **Advanced options** holds the ranges and the sync speed, for anyone
  who wants less. The step indicator, the separate Choose and Start steps and **Keep new days only**
  are gone.
- **Shorter settings.** The main page keeps your account, Sync on startup, Units and Map tiles. The
  rest moved to three pages, **History**, **Metrics** and **Advanced**, which Obsidian's settings
  search still finds. The Garmin email row is gone: the account row says who is signed in.
- **Normal is the default sync speed** for a new vault, so the recommended download takes about half
  as long. A vault set to Gentle keeps it.
- **Clearer, shorter text** in every plugin dialog, Home's setup cards, the sign-in form and
  diagnostics.

### Fixed

- **The sign-in saves your email once it succeeds**, rather than on every keystroke, and diagnostics
  no longer saves it.
- **The setup's size for every activity no longer comes up short** when the activity list's download
  gave way to a sync.
- **A setup that can't work out its estimate** now offers **Try again** instead of stopping on the
  scan.

## [1.1.0] — 2026-10-21

### Added

- **Open health stats**, a command for the Health Stats list, as Activities and Performance Stats
  have.

### Changed

- **Finding your way around.** The ⋯ button and its More page are gone.
  - **In a wide pane,** a rail down the left lists Home, Activities, Health Stats and Performance
    Stats. The area you're in opens to its pages, with the one you're on lit, so any page is one
    click away. It collapses to icons (« / ») and has the page's own background. Sync (↻) sits at
    the top right of every page, beside Layout on Home.
  - **On a phone,** the four areas are tabs across the top of Home and of each area's page.
- **Obsidian's tab is named after the area you're in:** Garmin Home, Garmin Health Stats, and so on.
- **Open commands open a page inside its area,** so Back goes to the area's list. **Open home** and
  the ribbon icon now return to Home from whichever page the view was on.
- **README and INSTALLATION docs** The plugin is now listed in the
  [community plugin directory](https://community.obsidian.md/plugins/garmin-connect); the docs
  describe that install first, and BRAT for betas.
- **README SVG Plugin icon**

## [1.0.3] — 2026-10-20

### Changed

- **Settings show up in Obsidian's settings search.** The tab is now drawn by Obsidian from a list
  of its rows, so it looks like Obsidian's own settings, with the same rows and text as before.
- **Needs Obsidian 1.13.0 or later,** the first version that can search plugin settings.
- **Copy debug info is now Save debug info.** It saves the debug info as a note in the Log folder
  and opens it, on every device. The command id is unchanged, so hotkeys keep working.

### Removed

- **The diagnostics' Copy log button.** Save to vault does the same job. The plugin no longer touches
  the clipboard.

## [1.0.2] — 2026-10-19

### Changed

- **Two command names** no longer repeat the plugin's name, which the command palette already shows:
  **Sign in** and **Set up…**. Command ids are unchanged, so hotkeys keep working.

### Removed

- **The one-time copy of old day notes,** which 0.1.0-beta.1 and 0.2.0-beta.1 wrote. The notes stay
  where they are, and the history download fetches those days from Garmin again.

### Fixed

- **The Community directory's review** no longer warns about the plugin's code or the map styles.

## [1.0.1] — 2026-10-19

### Fixed

- **The plugin's description** no longer says "Obsidian" or starts with the plugin's name, which
  the Community directory's release check rejected.

## [1.0.0] — 2026-10-19

The first stable release, and the first in the Obsidian Community directory. It has the same
features as [1.0.0-beta.1](https://github.com/tareqayz/Obsidian-Garmin-Connect/releases/tag/1.0.0-beta.1).

## [1.0.0-beta.1] — 2026-10-18

### Added

- **A page for every activity,** whatever the sport, from every list that shows one.
  - **Rides:** the route by power zone, Power and Cycling Dynamics, and charts down to the power
    phases and the Power Curve.
  - **Pool swims:** the interval table and a bar a length.
  - **Open-water swims:** the route and charts.
  - **Every other sport:** the sections the sports share.
- **Sensors and badges** on every activity's Overview, named as the app names them.
- **An "All … Activities" link under every activity,** not only runs ("All Walking Activities"
  under a walk), opening the hub's page for its group or All Activities filtered to it.
- **All Activities, as Garmin's new page.**
  - A search that ignores case and accents.
  - A Filters sheet: activity groups, dates, distance, time, ascent, event type, favourites,
    records.
  - Chips, the exact count, and four sorts.
- **Copy debug info:** what a bug report needs, redacted, with no request and no sign-in.
- **Stop syncing**, **Pause the history download** and **Resume the history download** commands.

### Changed

- **The Garmin session stays on the device,** in Obsidian's keychain rather than `data.json`.
  - Each device signs in once.
  - A device that only reads what another syncs says "Not signed in on this device".
  - Needs Obsidian 1.11.4.
- **Gentler on Garmin by default.** New installs sync at Gentle. The history download keeps to
  2,500, 5,000 or 8,000 requests an hour by speed, down from 5,000–15,000, counting everything the
  device asked.
- **Run details is now Activity details,** for every sport. A Run details range carries on for
  runs; the other sports are offered once in **New data for your history**.
- **The activity index is version 3** (event type, favourites, records, a pool's unit), and **an
  activity's file is version 6.**
  - The index is listed again once you agree.
  - A run saved before asks only its summary and badges again.
- **Sport names are the app's,** from a table of Garmin's activity types.
- **Region on the sign-in step,** so a China account signs in against garmin.cn from the start.
- **Diagnostics are safe to paste.**
  - Emails, tokens and IP addresses are scrubbed, and names become placeholders.
  - New installs save a run only when you ask: **Save every diagnostics run to the vault** is now
    off by default.
  - The checks that use the session don't run during a sync.
- **A generic icon:** Lucide's watch instead of a trace of Garmin's logo.
- **The data and log folder settings** save on Enter or on leaving the field, and refuse the vault's
  root, hidden folders and the settings folder.
- **The uninstall prompt** waits until the plugin's folder is gone at two checks in a row, and can
  take the diagnostics notes too.
- **An unknown answer at sign-in** now names Garmin's status, instead of "Unexpected login
  response".

### Fixed

- **A failed token refresh signed every device out.** Only Garmin saying the token is spent ends a
  session now.
- **Garmin's bot check refusing the device** didn't stop the history download. It now pauses for half
  an hour, doubling up to twelve hours.
- **A JSON 403, or a privacy-protected day,** read as a dead session. Now only that request fails,
  with a warning.
- **An unexpected payload aborted the whole sync** and wedged the download. The day now fails alone,
  and a download piece that fails three times waits for the next session.
- **A request that never answered** held the sync until Obsidian restarted. Requests give up after a
  minute.
- **The history download booked today as fetched.** Today is never booked as whole.
- **An unreadable data file was written over,** losing its history. It is now set aside as
  `….unreadable-….json` and fetched again.
- **An older version on another device wrote over a newer version's files.** It now stops and asks
  to be updated.
- **A short page partway down the activity list** replaced the index. A listing now replaces it only
  when it is about as long as Garmin's count.
- **Sync services' conflict copies went unnoticed.** The first gets a notice, and **Delete synced
  data** now also removes Syncthing's and Dropbox's copies and set-aside unreadable files.
- **A page that threw blanked Home,** even after a restart. It now shows a card with **Copy debug
  info** and **Back to Home**.
- **A Home tab left open past midnight** kept yesterday. It moves to the new day within a minute.
- **An update left the old version's dialogs open.** Unloading closes them.
- **Every sync's notice said "Garmin returned no rows"** for accounts without VO₂ Max or race
  predictions. That stays in the log now.
- **An activity file could put HTML into a lap marker.** Lap numbers are drawn as text.
- **Perceived Effort's dot colours** now go in the app's pairs.

## [0.2.0-beta.2] — 2026-10-15

### Added

- **Performance Stats.** More → Performance Stats rebuilds Garmin's performance pages, most with a
  history of their own in the data folder. Load and Heat Acclimation open from Training Status:
  - Training Status, Load, Training Readiness, HRV Status;
  - VO₂ Max, Race Predictor, Endurance Score, Hill Score, Heat Acclimation;
  - Training Effect, Cycling Power Curve, Running Tolerance, FTP;
  - Running Lactate Threshold, Running Economy;
  - Critical Swim Speed and HRV Stress, which show Garmin's empty state until a result exists.
- **A run's own page:** Overview with its map and weather, Stats, Laps, Gear, and Charts against time
  or distance. It loads the first time it opens and is kept in `activity-details/`.
- **Activity maps:** OpenStreetMap under the route, coloured by pace, heart rate, power, elevation or
  run/walk. **Settings → Maps → Map tiles** turns the tiles off.
- **A setup.** Sign in, scan where your Garmin history starts, and choose three data sets, each with
  its size and time:
  - Charts & trends;
  - Day details;
  - Run details.
- **The history download.** What you choose downloads in the background, under an hourly limit:
  - it pauses after a 429 or until you sign in again;
  - it carries on after a restart, and runs on one device at a time.
- **New data for your history:** an update that can fill in more of your history asks once.
- **Settings → Data,** in place of Storage, and **Delete synced data** under Settings → Danger zone.
- **After an uninstall,** the plugin asks whether to keep the synced data or move it to the trash.
- **"No Garmin data on this device"** on Home, when the settings reached a device and the data didn't.

### Changed

- **Sync speed** (Settings → Advanced): Gentle, Normal (the default) or Fast. A sync fetches several
  days at once and slows itself down when Garmin answers 429.
- **Sync recent days covers what changed since the last sync:** from the day before the watch's last
  upload through today, at most 30 days. The **Days to sync** setting is gone.
- **Everything is JSON now.**
  - A day's numbers go to `days/<year>.json` instead of a note's frontmatter.
  - The days already in your notes are copied over once.
  - The notes stay where they are.
- **History downloads only when you say so,** in the setup or the update dialog. A vault signed in
  before counts as set up.
- **Timelines follow Day details:** a sync fetches the timelines of every day it covers inside the
  range.
- **Hill score and running tolerance sync a year at a time.**
- **Home's cards read as the app's:** the VO₂ Max dial's scale, "Well-recovered", "Well-Trained", and
  the lactate threshold pace.
- **The activity index** keeps each activity's training effect, benefit, load and a ride's best
  powers.
- **Network use:** activity maps load tiles from `tile.openstreetmap.org`.
- **Dragging a card on See All** follows the pointer, and the other cards slide out of its way.

### Removed

- **Day notes and daily notes as storage,** with their settings.
- **The Bases table view** (`Garmin Health.base`) and its command.

### Fixed

- **Re-syncing an older day erased its timelines.** A sync now changes only what it asked for.
- **Closing Obsidian during a history walk** lost what the walk had fetched. Walks keep each year as
  it comes in.

## [0.2.0-beta.1] — 2026-10-09

The plugin is now Garmin Connect, rebuilt inside Obsidian: the phone app's Home, Activities, daily
stats, Sleep and Health Stats pages, drawn from data the sync keeps in your vault. The configurable
dashboard that came before it is gone.

### Added

- **Home:** Garmin Connect's home screen, with the app's three presets and At a Glance. See All can
  remove, reorder and add stats.
- **Activities:** a page per sport, with totals over a week, four weeks or a year, a page per month,
  All Activities and Personal Records.
- **Steps, Floors and Intensity Minutes:** a day, a week, four weeks and a year.
- **Sleep:** the night's score, stages and timeline, its factors and the Sleep Coach, plus the
  longer views.
- **Health Stats:**
  - Health Status, Weight, Pulse Ox and Pulse Ox Acclimation;
  - Respiration, Heart Rate, Blood Pressure, Stress and Body Battery;
  - Fitness Age, Health Snapshot, and Lifestyle Logging.
- **Commands** to open each page and to sync each history.
- **Three metric groups:** `intraday` (the day's curves), `health` (Health Status and Health
  Snapshots) and `profile` (`account.json`). A vault that predates them gets them switched on once.
- **For contributors:** CI on every pull request, release notes from this file, and the
  `/garmin-page` pipeline.

### Changed

- **Command and ribbon names.** **Open dashboard** became **Open home**, and **Run connectivity
  probe** became **Run diagnostics**. Command ids are unchanged, so hotkeys keep working.
- **Settings:** the Diagnostics section is now **Advanced**, and new vaults save diagnostics runs to
  `Garmin/diagnostics`.
- **Requires Obsidian 1.9.10 or later.**

### Fixed

- **VO₂ Max and training status now reach the day notes.**

### Removed

- **The classic dashboard:** its layouts, history charts, activity detail, heatmap, data table and
  **Backfill…** button. The data is all still there, and a tab of it left open reopens as Home.

## [0.1.0-beta.1] — 2026-09-19

The first build published for testers.

### Added

- **Sign-in that works on desktop and mobile:** Garmin's mobile-app sign-in, multi-factor
  authentication in the same dialog, and a session that survives restarts.
- **Sync** into a data folder, your daily notes, or both: newest day first, skipping unchanged days,
  tolerant of one failed request.
- **Thirteen metric groups as note properties,** from steps and sleep to training load and race
  predictions.
- **A generated Bases table view** (`Garmin Health.base`).
- **A configurable dashboard** of cards with saved layouts.
- **Run connectivity probe:** a step-by-step check of sign-in and connectivity that saves its log in
  the vault.
- **The Garmin API, written down and checked daily:** the endpoint catalogue, a recorder for response
  shapes, and a workflow that opens an issue when a field the plugin reads stops arriving.
- **Releases:** a tag-driven pipeline with stable and beta channels. MIT licence.

[Unreleased]: https://github.com/tareqayz/Obsidian-Garmin-Connect/compare/1.0.2...HEAD
[1.0.2]: https://github.com/tareqayz/Obsidian-Garmin-Connect/compare/1.0.1...1.0.2
[1.0.1]: https://github.com/tareqayz/Obsidian-Garmin-Connect/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/tareqayz/Obsidian-Garmin-Connect/compare/1.0.0-beta.1...1.0.0
[1.0.0-beta.1]: https://github.com/tareqayz/Obsidian-Garmin-Connect/compare/0.2.0-beta.2...1.0.0-beta.1
[0.2.0-beta.2]: https://github.com/tareqayz/Obsidian-Garmin-Connect/compare/0.2.0-beta.1...0.2.0-beta.2
[0.2.0-beta.1]: https://github.com/tareqayz/Obsidian-Garmin-Connect/compare/0.1.0-beta.1...0.2.0-beta.1
[0.1.0-beta.1]: https://github.com/tareqayz/Obsidian-Garmin-Connect/releases/tag/0.1.0-beta.1
