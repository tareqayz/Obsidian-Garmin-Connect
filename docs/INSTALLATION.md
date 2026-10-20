# Installation

Choose the installation method that suits you:

- **[Community plugins](#community-plugins-recommended):** install the latest stable release. Recommended for most users.
- **[BRAT](#beta-releases-with-brat):** try beta releases and get early access to experimental features.
- **[Manual installation](#manual-installation):** download and install a release yourself.
- **[Build from source](#build-from-source):** build the plugin locally for development or testing.

> [!IMPORTANT]
> Requires **Obsidian 1.13.0 or later** on each device where you use the plugin.

## Community plugins (recommended)

The plugin is in Obsidian's [community plugin directory](https://community.obsidian.md/plugins/garmin-connect).

1. In Obsidian, open **Settings → Community plugins**. If asked, turn on community plugins.
2. Choose **Browse** and search for **Garmin Connect**.
3. Choose **Install**, then **Enable**.

To update the plugin, open **Settings → Community plugins → Check for updates** and install any available update.

## Beta releases with BRAT

Beta releases are published as GitHub pre-releases and are not available through Obsidian's community plugin directory. To install them with BRAT:

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from the community plugins.
2. In BRAT, choose **Add a beta plugin** and enter `tareqayz/Obsidian-Garmin-Connect`.
3. Enable **Garmin Connect** in **Settings → Community plugins**.

BRAT installs the newest release, pre-releases included, and keeps you on the newest one when it
checks for updates. To return to stable releases only, remove the plugin from BRAT's list; Obsidian
then updates it from the directory.

### Going back to an earlier beta

If you run into a problem with a beta, use BRAT to install a specific release and keep it pinned:

1. Remove the plugin from BRAT's list.
2. **Add a beta plugin** again, with the same repository and the release's tag under **Frozen
   version**. Type the tag exactly as the [Releases](https://github.com/tareqayz/Obsidian-Garmin-Connect/releases)
   page shows it, for example `0.2.0-beta.2`.

Changing versions does not remove your data folder. However, a newer version may have saved data
in a format an older version cannot read. If that happens, the older version stops and displays a
message to prevent it from overwriting your data.

## Manual installation

1. Open the [Releases](https://github.com/tareqayz/Obsidian-Garmin-Connect/releases) page and pick
   the newest release, or the newest *Pre-release* for a beta.
2. Download `main.js`, `manifest.json` and `styles.css` from its assets.
3. Put them in `<your vault>/.obsidian/plugins/garmin-connect/`, creating the folder if it isn't
   there.
4. Restart Obsidian, then enable **Garmin Connect** in **Settings → Community plugins**.

To update, replace the three files with those from the newer release and restart Obsidian.

> [!IMPORTANT]
> Take the files from a release, not from a clone of the repository: `main.js` is a build output
> that only the releases carry.

## On a phone or a second computer

The same plugin works on desktop and mobile. Install it on each device using one of the methods
above, or sync the plugin folder if your sync service supports it and is configured to include it.
Then enable **Garmin Connect** in **Settings → Community plugins** on that device.

Your Garmin session stays in each device's keychain and is not synced with your vault. You can
browse data synced from another device without signing in; the plugin displays a **Not signed in on this device** card. Sign in if you also want to fetch data from Garmin Connect on that device.

## Build from source

```bash
git clone https://github.com/tareqayz/Obsidian-Garmin-Connect.git
cd Obsidian-Garmin-Connect
npm install
npm run build
```

`npm run build` type-checks, runs the tests, then writes `main.js`. Copy `main.js`, `manifest.json`
and `styles.css` into the plugin folder as above, or clone straight into
`.obsidian/plugins/garmin-connect/`. A build from source reports the version in `manifest.json`,
because beta version numbers are only stamped into the release files.

## Get started

Enable the plugin to open setup, sign in to Garmin Connect, scan your history and choose how much
data to keep. See the [Guide](GUIDE.md) for the full walkthrough.
