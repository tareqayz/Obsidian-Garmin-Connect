# Security

This plugin holds credentials for your Garmin Connect account and writes health
data into your vault. This page says exactly what is stored, what leaves your
device, and what to be careful about.

## What is stored, and where

### The session: `data.json`

The plugin's own state persists to `data.json` beside the plugin, inside your
vault's `.obsidian/plugins/garmin-connect/`.

| Stored | Not stored |
| --- | --- |
| OAuth2 **refresh token** | Your **password** |
| The DI client ID that token belongs to | The access token (memory only) |
| Your settings, including the account email | |
| Home's state: the preset, hidden sections, At a Glance order | |

**Your password is never written anywhere.** It is used for one sign-in request
and dropped. The access token lives in memory and is re-minted from the refresh
token after a restart.

Persistence reads a narrow set of known keys rather than spreading whatever it
finds, so a stray secret cannot survive the next save.

### Your health data: the data folder

The sync writes into the vault itself, under the data folder (`Garmin/data` by
default), into your daily notes, or both:

| What | Where | Holds |
| --- | --- | --- |
| Day notes | the data folder, your daily notes, or both | the day's numbers as properties |
| Series files | `<data folder>/series/<date>.json` | the day's heart rate, stress, Body Battery and other curves, sleep stages, and what the pages loaded on view |
| Indexes | `<data folder>/activities/`, `daily-stats/`, `sleep/`, and one folder per Health Stats index (`stress/`, `heart-rate/`, `weight/`, `blood-pressure/` and the rest) | your activities, and a row a day of each metric's history |
| Account file | `<data folder>/account.json` | your full name and display name, avatar URLs, sex, your watch's name and last upload, lactate threshold, FTP, running economy, cycling ability, training plans, upcoming events and personal records |

`account.json` never holds the sign-in email or a token. Garmin's `userName` is
the sign-in email, so it is deliberately left out.

This is health data, and it travels wherever your vault travels. Treat a vault
with the data folder in it the way you would treat a medical record.

## The refresh token is durable account access

This is the part worth taking seriously.

That token can mint new access tokens for your Garmin account, and it sits in a
file your vault synchronises. Anyone with your vault has it. If you sync your
vault to a shared drive, a public git repository, or a device you do not
control, treat it as a live credential.

- **Sign out from settings** when you are finished with a device. That deletes
  the stored token from `data.json`. It does not contact Garmin, so a copy of
  the file taken earlier still holds a working token.
- **Do not commit `data.json`.** It is in `.gitignore`; keep it there.
- **The session belongs to the vault, not to the device.** It lives in
  `data.json`, so if your sync copies plugin folders (iCloud copies the whole
  `.obsidian` folder; Obsidian Sync can, depending on its settings), every
  device uses the same session, and signing out on one removes it for all of
  them once the file syncs. A device that is already running keeps its session
  in memory until the plugin reloads, and writes it back the next time it
  refreshes the token or saves a setting.

## What leaves your device

| Destination | When | What |
| --- | --- | --- |
| `sso.garmin.com`, `diauth.garmin.com`, `connectapi.garmin.com` | Sign-in and sync | Credentials at sign-in; bearer token thereafter |
| `tls.peet.ws` | Only when you run **Network fingerprint** in the diagnostics | A User-Agent string. Nothing else. |

`tls.peet.ws` is a third-party TLS echo service. It is in the diagnostics to report
what your platform looks like on the wire, which is the first thing you need when
diagnosing a bot-wall refusal. It is never contacted during a normal sync.

Set the `domain` setting to `garmin.cn` for Garmin China accounts; every host
changes accordingly.

The pages load no images or scripts from anywhere. A few of them link to Garmin
Connect's website or to a health reference; those open in your browser only
when you click them.

## Diagnostics logs

**Run diagnostics** can save each run as a note in your vault, because a phone has
no console and a file syncs back to your desktop. The folder is **Log folder** in
the Advanced settings (`Garmin/diagnostics` in a new vault). **Save every
diagnostics run to the vault** saves each run as it finishes; with it off, only
the runs you save with the panel's **Save to vault** button are kept.

Logs are **redacted before they are written**:

- The account email is masked to its first three characters and its domain.
- Tokens keep their first 10 characters and length — enough to correlate across
  runs, not enough to use.
- The public IP keeps only its first three parts; an IPv6 address is masked
  whole.

They are still diagnostic output about your account. Read one before pasting it
into an issue.

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
- A `privacyProtected` daily summary is treated as an authorisation failure
  rather than silently mapped as empty data.
- The plugin loads no external scripts. Charts are hand-drawn SVG precisely
  because an Obsidian plugin cannot and should not pull in a CDN.
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
    token.
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
