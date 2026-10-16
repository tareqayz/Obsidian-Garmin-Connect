# Garmin Connect for Obsidian

Garmin Connect, rebuilt inside Obsidian. The plugin syncs your Garmin data into
the vault and draws it as the phone app does:

- **Home**: Garmin's three presets, In Focus and At a Glance.
- **Activities**: per sport, with personal records, and All Activities with
  Garmin's search, sort and filters.
- **A page for every activity**, whatever the sport: a run's or a ride's map,
  stats, laps and charts, a pool swim's intervals and lengths, and the rest.
- **Steps, Floors and Intensity Minutes.**
- **Sleep**, including the Sleep Coach.
- **Health Stats**: Health Status, Heart Rate, Stress, Body Battery,
  Respiration, Pulse Ox, Weight, Blood Pressure, Fitness Age and more.

It runs on **desktop and mobile**.

Everything stays in your vault as ordinary JSON files in one data folder
(`Garmin/data` by default). The sync writes no notes, so your own notes are
never touched. How much room it takes depends on how much history you keep:
- **Charts & trends**, every page's 7-day, 4-week and 1-year history: under
  1 MB a year of history, always all of it.
- **Day details**, each day's numbers and its timelines: about 44 KB a day,
  16 MB a year.
- **Activity details**, an activity's map, charts and laps, every sport: about
  150 KB a run, less for most others. By default only the activities you open.

With Obsidian Sync, turn on **Sync all other types** so the JSON reaches your
other devices.

## Before you install

- **You need a Garmin Connect account.** The plugin signs in to it the way
  Garmin's mobile app does. Your password is used for the sign-in and never
  stored. The session stays on the device, in Obsidian's keychain, never in
  the vault.
- **Network use.**
  - The plugin talks only to Garmin's own servers: `sso.garmin.com`,
    `diauth.garmin.com` and `connectapi.garmin.com`, or their `garmin.cn`
    counterparts for the China region.
  - The one exception is the **Run diagnostics** network check, which asks
    `tls.peet.ws` what your connection looks like. It runs only when you
    press it.
  - **Activity maps** draw OpenStreetMap's map under an activity's route, from
    `tile.openstreetmap.org`. That server sees which part of the map you open
    — roughly where the activity was — and each request names this plugin.
    Turn **Map tiles** off in the settings and the route is drawn on its own,
    with no request at all.
  - There is no telemetry or analytics.
- **It is in beta.** Install it with BRAT. See [Installation](docs/INSTALLATION.md).
- **Obsidian 1.11.4 or later.**

Not affiliated with or endorsed by Garmin. Garmin, Garmin Connect, Body Battery
and the other Garmin names are trademarks of Garmin Ltd. or its subsidiaries.

## The beta

The plugin is in beta: it has met one Garmin account in depth, and yours will
differ. It is careful with your data — it never writes over a file it can't
read, and it asks before downloading history — and gentle with Garmin, but
expect rough edges.

**Known limitations**
- English only, and times on a 12-hour clock whatever your account says.
- Imperial units are drawn but unverified; a UK account (statute_uk) shows
  pounds and °F.
- Weeks follow fixed starts (Monday for steps, Sunday for some performance
  charts), not your account's first day of the week.
- Multisport activities get the generic page, without their legs
  ([#23](https://github.com/tareqayz/Obsidian-Garmin-Connect/issues/23)).
- Untested: Android, garmin.cn accounts, and multi-factor sign-in against a
  live challenge.
- With a scale or a second Garmin device, data a watch uploads days late may
  need **Sync a date range…**.
- Data refreshes when you sync (Home's ↻, or **Sync on startup**); there is no
  background interval.

**Sign in on one device** if you can — usually the computer — and let your
other devices show what it syncs. Each device holds its own session, and two
devices syncing the same files at once is how sync services make conflict
copies.

**Worth testing:** signing in with multi-factor authentication; Android;
imperial and UK accounts; accounts whose week starts on Monday; five to ten
years of history; sports other than running; phones and tablets.

**Reporting:** run **Copy debug info** and paste it into the
[bug report form](https://github.com/tareqayz/Obsidian-Garmin-Connect/issues/new/choose).
It needs no password, makes no request and removes your email, tokens, IP
address and Garmin names. Don't paste screenshots of maps that show where you
live.

## Setting up

Enabling the plugin opens a setup over Home:
1. **Sign in** to your Garmin account.
2. **Scan**: a few requests find where your Garmin history starts.
3. **Choose** how much history to keep. Each choice shows its size and how
   long it takes.
4. **Start**: the history downloads in the background, under an hourly request
   limit, and carries on after a restart. Home shows how far it has got.

Run it again with **Set up Garmin Connect…** or from **Settings → Data**. An
update that can fill in more of your history asks before it downloads
anything. See the [Guide](docs/GUIDE.md).

## Removing the plugin

Uninstalling deletes the plugin's folder, and your settings and Garmin session
with it. The synced data stays in the vault: on the device you uninstall from,
the plugin then offers to keep it or move it to the trash. **Settings → Danger
zone → Delete synced data…** removes it without uninstalling. See the
[FAQ](docs/FAQ.md#how-do-i-uninstall-it-and-remove-the-data).

## Documentation

| Page | What it answers |
| --- | --- |
| [Installation](docs/INSTALLATION.md) | How to install it, with BRAT or by hand |
| [Guide](docs/GUIDE.md) | How to use it: the setup, the pages, the commands, where the data goes |
| [Troubleshooting](docs/troubleshooting.md) | Something is broken — start here |
| [FAQ](docs/FAQ.md) | Common questions |
| [Properties](docs/properties.md) | Every value a day file holds, and its units |
| [Settings](docs/settings.md) | Every setting and what changing it does |
| [Security](docs/SECURITY.md) | What is stored, what leaves your device, how to report a vulnerability |
| [Architecture](docs/architecture.md) | How the code fits together |
| [Garmin API](docs/garmin-api.md) | Every endpoint called, and the request budget |
| [API catalogue](api/README.md) | The full endpoint list, the recorded response shapes, and the daily check |
| [Contributing](docs/CONTRIBUTING.md) | Branches, commits and releases |
| [Changelog](CHANGELOG.md) | What changed in each release |
| [TODO](TODO.md) | Known gaps and open questions |

## Acknowledgements

- [Garmin Health Sync](https://github.com/fcandi/Garmin-Health-Sync): the
  inspiration for the project, and I *believe* the first Garmin–Obsidian
  plugin. I took a lot of its ideas, like file properties on daily notes, but
  wanted headless sign-in, cross-platform support and data visualisation. I
  started by seeing if headless authentication was possible and kept building
  from there.
- [cyberjunky/python-garminconnect](https://github.com/cyberjunky/python-garminconnect):
  an actively maintained Garmin Connect library that saved a huge amount of
  reverse-engineering work.
- [Tabler Icons](https://tabler.io/icons) (MIT): the sport figures on the
  Activities pages. Everything else uses Obsidian's own Lucide icons.
- [Leaflet](https://leafletjs.com) (BSD-2-Clause): the activity maps, bundled
  with the plugin.
- [OpenStreetMap](https://www.openstreetmap.org/copyright): the map under a
  route, © OpenStreetMap contributors, available under the Open Database
  License.
