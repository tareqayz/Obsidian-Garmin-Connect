# Garmin Connect for Obsidian

Garmin Connect, rebuilt inside Obsidian. The plugin syncs your Garmin data into
the vault and draws it as the phone app does:

- **Home**: Garmin's three presets, In Focus and At a Glance.
- **Activities**: per sport, with personal records.
- **Steps, Floors and Intensity Minutes.**
- **Sleep**, including the Sleep Coach.
- **Health Stats**: Health Status, Heart Rate, Stress, Body Battery,
  Respiration, Pulse Ox, Weight, Blood Pressure, Fitness Age and more.

It runs on **desktop and mobile**.

Everything stays in your vault as ordinary files:
- **Day notes:** one note per day, with the day's numbers as
  [properties](https://obsidian.md/help/properties) you can query.
- **History files:** JSON indexes and per-day series files beside the notes,
  which the pages read.
- **A table view:** an optional generated [Bases](https://obsidian.md/help/bases)
  table, `Garmin Health.base`.

## Before you install

- **You need a Garmin Connect account.** The plugin signs in to it the way
  Garmin's mobile app does. Your password is used for the sign-in and never
  stored.
- **Network use.**
  - The plugin talks only to Garmin's own servers: `sso.garmin.com`,
    `diauth.garmin.com` and `connectapi.garmin.com`, or their `garmin.cn`
    counterparts for the China region.
  - The one exception is the **Run diagnostics** network check, which asks
    `tls.peet.ws` what your connection looks like. It runs only when you
    press it.
  - There is no telemetry or analytics.
- **It is in beta.** Install it with BRAT. See [Installation](docs/INSTALLATION.md).
- **Obsidian 1.9.10 or later**, the first release with Bases.

Not affiliated with or endorsed by Garmin. Garmin, Garmin Connect, Body Battery
and the other Garmin names are trademarks of Garmin Ltd. or its subsidiaries.

## Documentation

| Page | What it answers |
| --- | --- |
| [Installation](docs/INSTALLATION.md) | How to install it, with BRAT or by hand |
| [Guide](docs/GUIDE.md) | How to use it: the pages, the commands, where the data goes |
| [Troubleshooting](docs/troubleshooting.md) | Something is broken — start here |
| [FAQ](docs/FAQ.md) | Common questions |
| [Properties](docs/properties.md) | Every property a day note gets, its units, and how to query it |
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
