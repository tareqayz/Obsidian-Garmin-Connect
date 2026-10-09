# Installation

The plugin is not in Obsidian's [community plugin
directory](https://community.obsidian.md/search?type=plugin) yet. Until it is,
releases are betas: GitHub pre-releases you install with BRAT, or by hand.

It works on **desktop and mobile**, and needs **Obsidian 1.9.10 or later**. That
is the first release with Bases, which the generated table view uses.

## With BRAT (recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from the
   community plugins.
2. In BRAT, **Add a beta plugin** and enter `tareqayz/Obsidian-Garmin-Connect`.
3. Enable **Garmin Connect** in **Settings → Community plugins**.

BRAT installs the newest release, pre-releases included, and keeps you on the
newest one when it checks for updates.

## By hand

1. Open the [Releases](https://github.com/tareqayz/Obsidian-Garmin-Connect/releases)
   page and pick the newest release. It is marked *Pre-release*: there is no
   stable release yet, so a "latest release" link finds nothing.
2. Download `main.js`, `manifest.json` and `styles.css` from its assets.
3. Put them in `<your vault>/.obsidian/plugins/garmin-connect/`. Create the
   folder if it isn't there.
4. In Obsidian, **Settings → Community plugins → Reload**, then enable **Garmin
   Connect**.

Take the three files from a release, not from a clone. `manifest.json` and
`styles.css` are in the repository, but `main.js` is a build output that only
the releases carry.

To update by hand, replace the three files with a newer release's and reload the
plugin.

## On a phone or a second computer

There is no separate mobile download. The plugin folder reaches the phone through
your vault sync like any other folder; then enable the plugin in **Settings →
Community plugins** there too.

Your Garmin session is the refresh token in the plugin's `data.json`, in that
same folder, so whether you sign in again depends on your sync:
- **It copies `data.json`:** the other device has the same session and
  settings, and is signed in already.
- **It does not:** sign in on that device as well.

## From source

```bash
git clone https://github.com/tareqayz/Obsidian-Garmin-Connect.git
cd Obsidian-Garmin-Connect
npm install
npm run build
```

`npm run build` type-checks, runs the tests, then writes `main.js`. Copy
`main.js`, `manifest.json` and `styles.css` into the plugin folder as above, or
clone straight into `.obsidian/plugins/garmin-connect/`.

## Next

Sign in and run your first sync: see the [Guide](GUIDE.md).
