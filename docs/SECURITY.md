# Security

This plugin holds credentials for your Garmin Connect account and writes health
data into your vault. This page says exactly what is stored, what leaves your
device, and what to be careful about.

## What is stored, and where

### The session: Obsidian's keychain

The Garmin session is kept in Obsidian's keychain on each device (**Settings →
Keychain**, the secret `garmin-connect-session`), not in the vault. Obsidian
keeps the keychain in that device's local storage for the vault, so the session
never travels with a vault sync, a backup or a repository of the vault.

| Stored in the keychain | Not stored anywhere |
| --- | --- |
| OAuth2 **refresh token** | Your **password** |
| The DI client ID that token belongs to | The access token (memory only) |

**Your password is never written anywhere.** It is used for one sign-in request
and dropped. The access token lives in memory and is re-minted from the refresh
token after a restart.

### Settings: `data.json`

The plugin's settings persist to `data.json` beside the plugin, inside your
vault's `.obsidian/plugins/garmin-connect/`: your settings, including the
account email, when the setup ran and what you agreed to download, and Home's
state (the preset, hidden sections, At a Glance order). No token.

`data.json` is read by a narrow set of known keys rather than spreading whatever
it finds, so a stray value cannot survive the next save. A session an older
version left in it moves to the keychain on load and drops out of the file.

### Your health data: the data folder

The sync writes into the vault itself, under the data folder (`Garmin/data` by
default). The sync writes no notes:

| What | Where | Holds |
| --- | --- | --- |
| Day files | `<data folder>/days/<year>.json` | each day's numbers, keyed by date |
| Series files | `<data folder>/series/<date>.json` | the day's heart rate, stress, Body Battery and other curves, sleep stages, and what the pages loaded on view |
| Activity details | `<data folder>/activity-details/<id>.json` | one file per activity whose page you opened, and each activity in the **Activity details** range: its samples, laps, zones and weather, the sensors it used (by name, never a serial number), its badges, and its GPS route — where you ran, rode or swam |
| Indexes | `<data folder>/activities/`, `daily-stats/`, `sleep/`, and one folder per Health Stats index (`stress/`, `heart-rate/`, `weight/`, `blood-pressure/` and the rest) | your activities, and a row a day of each metric's history |
| Account file | `<data folder>/account.json` | your full name and display name, avatar URLs, sex, your watch's name and last upload, lactate threshold, FTP, running economy, cycling ability, training plans, upcoming events and personal records |
| Bookkeeping | `<data folder>/scan.json`, `backfill.json`, `sync-state.json`, `days/index.json`, `activity-details/index.json` | where your Garmin history starts, how many days of each week hold data, your activity count, the oldest activity's day and the watch's last upload; which device runs the history download (a random id, a name such as "Mac" or "iPhone", and when it last checked in); which days and runs the vault holds |

`account.json` never holds the sign-in email or a token. Garmin's `userName` is
the sign-in email, so it is deliberately left out.

This is health data, and it travels wherever your vault travels. Treat a vault
with the data folder in it the way you would treat a medical record.

## The refresh token is durable account access

This is the part worth taking seriously.

That token can mint new access tokens for your Garmin account. It stays on the
device, in the keychain, so a copy of your vault does not hold it. Anyone with
access to the device's Obsidian does.

- **Sign out from settings** when you are finished with a device. That empties
  the keychain entry. It does not contact Garmin.
- **One session per device.** Each device signs in on its own and refreshes its
  own token. Signing out on one leaves the others signed in.
- **Versions before 1.0** kept the token in `data.json`. If you shared or
  committed a vault while on one of them, sign out and in again: a new sign-in
  issues a new token.

## Removing the plugin and its data

- **Uninstalling deletes `data.json`** with your settings, because Obsidian
  deletes the plugin's folder. On the device you uninstall from, the plugin
  also empties its keychain entry. Garmin is not contacted.
- **The data folder stays.** It is part of your vault, not the plugin. On the
  device you uninstall from, the plugin then asks once whether to keep it or
  move its files to the trash, and deletes that device's map tile cache, its
  Garmin session and the id it used for the history download. There is no prompt when the plugin's
  folder is deleted by hand, or the plugin is uninstalled on another device:
  delete the data folder yourself.
- **Delete synced data…** (**Settings → Danger zone**) moves the plugin's own
  files in the data folder to the trash, and the diagnostics notes if you tick
  the box. Anything else in that folder stays. It does not sign you out.
- **The trash still holds them.** Files moved to the system trash or the vault's
  `.trash` folder stay on the disk until it is emptied, and a vault sync or a
  backup may keep its own copies.

## What leaves your device

| Destination | When | What |
| --- | --- | --- |
| `sso.garmin.com`, `diauth.garmin.com`, `connectapi.garmin.com` | Sign-in and sync | Credentials at sign-in; bearer token thereafter |
| `tls.peet.ws` | Only when you run **Network fingerprint** in the diagnostics | A User-Agent string. |
| `tile.openstreetmap.org` | When a page draws an activity's map, while **Map tiles** is on | Requests for the map tiles around the route — so, roughly where the activity was — and a User-Agent naming this plugin. |

Like any server, each of these also sees your IP address, and `tls.peet.ws`
sees what your connection looks like (its TLS fingerprint): that is what it is
for.

`tls.peet.ws` is a third-party TLS echo service. It is in the diagnostics to report
what your platform looks like on the wire, which is the first thing you need when
diagnosing a bot-wall refusal. It is never contacted during a normal sync.

Set the `domain` setting to `garmin.cn` for Garmin China accounts; every host
changes accordingly.

The pages load no scripts from anywhere, and no images but the map tiles above.
Tiles are kept on the device that drew them, outside the vault, for a week or
as long as the server allows, so a map opened again asks for nothing, and an
uninstall on that device deletes them. With
**Map tiles** off the route is drawn on its own. A few pages link to Garmin
Connect's website or to a health reference; those open in your browser only
when you click them.

## Diagnostics logs

**Run diagnostics** can save a run as a note in your vault, because a phone has no
console and a file syncs back to your desktop. The folder is **Log folder** in
the Advanced settings (`Garmin/diagnostics` in a new vault). Runs are saved only
when you press the panel's **Save to vault**, unless you turn on **Save every
diagnostics run to the vault** (off by default: a vault syncs).

**Copy debug info** gathers what a bug report needs — versions, platform,
settings without the email, the history download's state, the last sync this
session with its warnings, request counts, what the data folder holds — with no
network request and no sign-in.

Both are **redacted before anything is written or copied**:

- Email addresses are masked to their first three characters and their domain.
- Tokens keep their first 10 characters and length — enough to correlate across
  runs, not enough to use. Service tickets aren't logged at all.
- IP addresses are masked whole.
- Your display name and account id are replaced with placeholders in request
  paths and error messages.
- The fitness check prints field names and types, not values; the session check
  says whether steps and resting heart rate came back, not what they were.
- A sign-in answer the plugin doesn't know is described by its status, not
  repeated.

They are still about your account. Read one before pasting it into an issue.

## Account lockout

Garmin limits login attempts per IP and **can lock an account after repeated
failures**.

- Sign in deliberately, not in a retry loop.
- On a 429, wait 15–30 minutes.
- In the diagnostics, **Test login** costs a real login attempt every time, and
  **Test session persistence** costs one when there is no saved session.
  **Network fingerprint** and **Inspect fitness endpoints** cost none.
- `BAD-CREDENTIALS` means stop and fix the credentials, not retry.

## Network handling

- All Garmin traffic is HTTPS.
- The display name is URL-encoded before being interpolated into request paths,
  so a hostile or corrupted profile response cannot inject path segments.
- A `privacyProtected` daily summary fails that day with a warning rather than
  being silently mapped as empty data.
- The plugin loads no external scripts. Charts are hand-drawn SVG precisely
  because an Obsidian plugin cannot and should not pull in a CDN. The activity
  maps' Leaflet is bundled, not fetched.
- `npm run build` fails if a node or electron require reaches the bundle.

## For contributors

Working on the plugin puts a few more secrets within reach. None of them may be
committed, printed or pasted:

- **`.garmin-token.json`**, written by `npm run api:token` for the API contract
  check. It is the credential: a refresh token, written with owner-only
  permissions and gitignored.
- **The contract check's CI secrets**, set on the repository:
  - `GARMIN_TOKENS`: the token file's contents.
  - `GARMIN_EMAIL` and `GARMIN_PASSWORD`: a fallback sign-in when there is no
    token. Don't set them: a stored password is the one secret worth not
    having, and a non-interactive sign-in can't answer MFA anyway.
  - `GH_SECRETS_TOKEN`: a fine-grained token with "Secrets: write", so the
    workflow can save a rotated refresh token back to `GARMIN_TOKENS`.

  Without them the live check skips rather than fails. See
  [api/README.md](../api/README.md).
- **`ref/`**, the phone screenshots and specs the page pipeline works from. It is
  personal health data, kept on the machine that captured it and listed in
  `.gitignore`.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately through GitHub's
[security advisory form](https://github.com/tareqayz/Obsidian-Garmin-Connect/security/advisories/new),
which lets us discuss and fix it before anything is disclosed.

Useful things to include: what an attacker would gain, the conditions needed, and
a redacted diagnostics log if the network layer is involved. Please redact tokens
even though the logger does — belt and braces.

Expect an acknowledgement within a week. This is a spare-time project, so a fix
may take longer than that; you will be kept informed either way.

## Supported versions

Only the latest release is supported. Fixes ship forward as a new release rather
than being backported.
