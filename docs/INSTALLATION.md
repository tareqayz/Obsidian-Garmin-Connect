# Installation

As of now, this is not a [publicly listed plugin](https://community.obsidian.md/search?type=plugin). Only manual installation is available until then.

Works on **desktop and mobile**. Obsidian 1.5.7 or newer.

## Manual

1. Download `main.js`, `manifest.json` and `styles.css` from the
   [latest release](https://github.com/tareqayz/Obsidian-Garmin-Connect/releases/latest).
2. Put them in `<your vault>/.obsidian/plugins/garmin-connect/` — create the folder if it isn't there.
3. In Obsidian: **Settings → Community plugins → Reload**, then enable **Garmin Connect**.

These three files are built by CI and attached to the release — they aren't in the repo tree, so downloading them from Releases is the intended route, not copying them out of a clone.

## BRAT

If you use [BRAT](https://github.com/TfTHacker/obsidian42-brat), add
`tareqayz/Obsidian-Garmin-Connect` as a beta plugin and it will keep you on the latest release.

## Mobile

There's no separate download. The plugin folder arrives through vault sync like any other file — enable it in **Settings → Community plugins** and sign in there too. Each device keeps its own session.

## From source

```bash
git clone https://github.com/tareqayz/Obsidian-Garmin-Connect.git
cd Obsidian-Garmin-Connect
npm install
npm run build
```

Copy `main.js`, `manifest.json` and `styles.css` into the plugin folder as above, or clone straight into `.obsidian/plugins/garmin-connect/`.

## Next

Sign in and run your first sync — see the [Guide](GUIDE.md).
