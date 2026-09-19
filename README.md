# Garmin Connect for Obsidian

An Obsidian plugin to sync and store your Garmin Connect data in your vault. Your data is stored as 
[properties](https://obsidian.md/help/properties) and collected into a [bases](https://obsidian.md/help/bases)
file. You can visualize the data through a dashboard – access via the garmin connect ribbon or command palette. The plugin is functional on **mobile and desktop**. 

## Navigating

Jump straight to the section you want. I think we all hate reading long docs...

### For using the plugin

| Page | What it answers |
| --- | --- |
| [Installation](docs/INSTALLATION.md) | How to **install** the plugin |
| [Guide](docs/GUIDE.md) | How to **use** the plugin |
| [Troubleshooting](docs/troubleshooting.md) | Start here when something is broken |

### For working on the plugin

| Page | What it answers |
| --- | --- |
| [Architecture](docs/ARCHITECTURE.update.md) | Understanding the codebase and what happens under the hood |
| [Garmin API](docs/GARMIN-API.update.md) | Every endpoint called, which metric group triggers it, and the request budget. |
| [Contributing](docs/CONTRIBUTING.md) | A guide to contributing – branch conventions, commit format, and both release runbooks |

### Elsewhere in the repo

| File | Contents |
| --- | --- |
| [SECURITY.md](docs/SECURITY.md) | What is stored, what leaves your device, and how to report a vulnerability |
| [TODO.md](/TODO.md) | Known gaps and open questions |
| [FAQ.md](docs/FAQ.md) | See if we answered your question here |

## Acknowledgement 

- [Garmin Health Sync](https://github.com/fcandi/Garmin-Health-Sync): The inspiration for the project. I *believe* this was the first Garmin-Obsidian plugin. I used a lot of his ideas, like file properties on daily notes. However, I wanted headless sign-in, cross-platform compatibility, and data visualization. I started by seeing if headless authentication was possible and just continued building from there. 
- [cyberjunky/python-garminconnect](https://github.com/cyberjunky/python-garminconnect): an actively maintained Garmin Connect library that saved a huge amount of reverse-engineering work.
