# Security

I'm sure the largest concern for everyone is security. So here's exactly what is stored and what isn't. Anything stored is local, in `data.json` beside the plugin.

**What isn't stored**

- Your **password**. It's used for one sign-in request and dropped — never written anywhere.
- The **access token**. It lives in memory and is re-minted from the refresh token after a restart.

**What is stored**

- The OAuth2 **refresh token**
- The DI client ID that token belongs to
- Your settings, including the account email

## The refresh token is durable account access

That token can mint new access tokens for your Garmin account. It's what saves you signing in every time — but it sits in a file your vault synchronises, so anyone with your vault has it. If you sync to a shared drive, a public git repo, or a device you don't control, treat it as a live credential.

- **Sign out from settings** when you're finished with a device. That clears the stored token.
- **Don't commit `data.json`.** It's in `.gitignore`; keep it there.
- Each device keeps a **separate session**, so signing out on one doesn't sign you out on the other.

## What leaves your device

| Destination | When | What |
| --- | --- | --- |
| `sso.garmin.com`, `diauth.garmin.com`, `connectapi.garmin.com` | Sign-in and sync | Credentials at sign-in; bearer token thereafter |
| `tls.peet.ws` | Only when you press the fingerprint button in the probe | A User-Agent string. Nothing else. |

`tls.peet.ws` is a third-party TLS echo service. It's in the probe to report what your platform looks like on the wire, which is the first thing you need when diagnosing a bot-wall refusal. It's never contacted during a normal sync.

All Garmin traffic is HTTPS. The plugin loads no external scripts — charts are hand-drawn SVG precisely because a plugin can't and shouldn't pull in a CDN.

## Probe logs

Probe runs write to `garmin-probe-logs/` in your vault, because a phone has no console and a file syncs back to your desktop.

They're **redacted before they're written**: the email is masked, tokens keep their first 10 characters and length, and the public IP is truncated. They're still diagnostic output about your account — read one before pasting it into an issue, and set `autoSaveLog` off if you'd rather they weren't kept.

## Account lockout

Garmin limits login attempts per IP and **can lock an account after repeated failures**.

- Sign in deliberately, not in a retry loop.
- On a 429, wait 15–30 minutes.
- Probe check 2 costs a real login attempt. Checks 1 and 4 don't.
- `BAD-CREDENTIALS` means stop and fix the credentials, not retry.

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through GitHub's [security advisory form](https://github.com/tareqayz/Obsidian-Garmin-Connect/security/advisories/new), which lets us discuss and fix it before anything is disclosed.

Useful things to include: what an attacker would gain, the conditions needed, and a redacted probe log if the network layer is involved.

Expect an acknowledgement within a week. This is a spare-time project, so a fix may take longer — you'll be kept informed either way. Only the latest release is supported; fixes ship forward rather than being backported.
