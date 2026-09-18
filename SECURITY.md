# Security

This plugin holds credentials for your Garmin Connect account and writes health
data into your vault. This page says exactly what is stored, what leaves your
device, and what to be careful about.

## What is stored, and where

Everything persists to `data.json` beside the plugin, inside your vault.

| Stored | Not stored |
| --- | --- |
| OAuth2 **refresh token** | Your **password** |
| The DI client ID that token belongs to | The access token (memory only) |
| Your settings, including the account email | |

**Your password is never written anywhere.** It is used for one sign-in request
and dropped. The access token lives in memory and is re-minted from the refresh
token after a restart.

Persistence deliberately reads a narrow set of known keys rather than spreading
whatever it finds, so a stray secret cannot survive a round trip through the
file.

## The refresh token is durable account access

This is the part worth taking seriously.

That token can mint new access tokens for your Garmin account, and it sits in a
file your vault synchronises. Anyone with your vault has it. If you sync your
vault to a shared drive, a public git repository, or a device you do not
control, treat it as a live credential.

- **Sign out from settings** when you are finished with a device. That clears the
  stored token.
- **Do not commit `data.json`.** It is in `.gitignore`; keep it there.
- The two devices keep **separate sessions**, so signing out on one does not sign
  you out on the other.

## If you ran the phase 0 build

An early build **did store your password** in `data.json`. The plugin now deletes
it on load and tells you so with a notice, but it sat in a synced vault for a
while.

**Changing your Garmin password is the cautious move** if you used that build.

## What leaves your device

| Destination | When | What |
| --- | --- | --- |
| `sso.garmin.com`, `diauth.garmin.com`, `connectapi.garmin.com` | Sign-in and sync | Credentials at sign-in; bearer token thereafter |
| `tls.peet.ws` | Only when you press the fingerprint button in the probe | A User-Agent string. Nothing else. |

`tls.peet.ws` is a third-party TLS echo service. It exists in the probe to report
what your platform looks like on the wire, which is the first thing you need when
diagnosing a bot-wall refusal. It is never contacted during a normal sync.

Set the `domain` setting to `garmin.cn` for Garmin China accounts; every host
changes accordingly.

## Probe logs

Probe runs write to `garmin-probe-logs/` in your vault, because a phone has no
console and a file syncs back to your desktop.

Logs are **redacted before they are written**:

- The account email is masked.
- Tokens keep their first 10 characters and length — enough to correlate across
  runs, not enough to use.
- The public IP is truncated.

They are still diagnostic output about your account. Read one before pasting it
into an issue, and set `autoSaveLog` off if you would rather they were not kept.

## Account lockout

Garmin limits login attempts per IP and **can lock an account after repeated
failures**.

- Sign in deliberately, not in a retry loop.
- On a 429, wait 15–30 minutes.
- Probe check 2 costs a real login attempt. Checks 1 and 4 do not.
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

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately through GitHub's
[security advisory form](https://github.com/tareqayz/Obsidian-Garmin-Connect/security/advisories/new),
which lets us discuss and fix it before anything is disclosed.

Useful things to include: what an attacker would gain, the conditions needed, and
a redacted probe log if the network layer is involved. Please redact tokens even
though the logger does — belt and braces.

Expect an acknowledgement within a week. This is a spare-time project, so a fix
may take longer than that; you will be kept informed either way.

## Supported versions

Only the latest release is supported. Fixes ship forward as a new release rather
than being backported.
