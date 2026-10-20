# Installation

How to install the plugin: from Obsidian's community plugins, with BRAT for betas, or by hand. It
works on **desktop and mobile** and needs **Obsidian 1.13.0 or later**.

## From the community plugins (recommended)

The plugin is in Obsidian's [community plugin directory](https://community.obsidian.md/plugins/garmin-connect).

1. In Obsidian, open **Settings → Community plugins**. If asked, turn on community plugins.
2. Choose **Browse** and search for **Garmin Connect**.
3. Choose **Install**, then **Enable**.

Obsidian updates it with your other plugins: **Settings → Community plugins → Check for updates**.

## Betas with BRAT

Betas are GitHub pre-releases, which the directory doesn't offer. To get them:
1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from the community plugins.
2. In BRAT, choose **Add a beta plugin** and enter `tareqayz/Obsidian-Garmin-Connect`.
3. Enable **Garmin Connect** in **Settings → Community plugins**.

BRAT installs the newest release, pre-releases included, and keeps you on the newest one when it
checks for updates. To return to stable releases only, remove the plugin from BRAT's list; Obsidian
then updates it from the directory.

### Going back to an earlier beta

If a beta breaks something for you, BRAT can install a given release and stay on it:
1. Remove the plugin from BRAT's list.
2. **Add a beta plugin** again, with the same repository and the release's tag under **Frozen
   version**. Type the tag exactly as the [Releases](https://github.com/tareqayz/Obsidian-Garmin-Connect/releases)
   page shows it, with no `v`: for example `0.2.0-beta.2`.

Your data folder is untouched either way. A newer version may have written files in a newer format;
an older one then stops and says so rather than writing over them, so go back only as far as you
need.

## By hand

1. Open the [Releases](https://github.com/tareqayz/Obsidian-Garmin-Connect/releases) page and pick
   the newest release, or the newest *Pre-release* for a beta.
2. Download `main.js`, `manifest.json` and `styles.css` from its assets.
3. Put them in `<your vault>/.obsidian/plugins/garmin-connect/`, creating the folder if it isn't
   there.
4. In Obsidian, go to **Settings → Community plugins → Reload**, then enable **Garmin Connect**.

To update, replace the three files with a newer release's and reload the plugin.

> [!IMPORTANT]
> Take the files from a release, not from a clone of the repository: `main.js` is a build output
> that only the releases carry.

## On a phone or a second computer

There is no separate mobile download. The plugin folder reaches the phone through your vault sync
like any other folder; then enable the plugin in **Settings → Community plugins** there too.

Your Garmin session doesn't travel with that folder: it stays in each device's keychain. A second
device shows what your other devices sync, with a **Not signed in on this device** card. Sign in
there only if you want to sync from it too.

## From source

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

## Next

Enabling the plugin opens its setup: sign in, scan your Garmin history, and choose what to keep. See
the [Guide](GUIDE.md).
