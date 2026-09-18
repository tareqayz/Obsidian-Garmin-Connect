# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Version numbers here match the git tag and the `version` in `manifest.json` —
see [CONTRIBUTING.md](CONTRIBUTING.md) for how a release is cut.

## [Unreleased]

### Added

- **Multi-factor authentication.** Signing in now asks for the verification code
  when Garmin demands one, in the same dialog. A refused code is re-asked in
  place — up to three tries — so a typo costs a re-type rather than a second
  login attempt against a per-IP rate limit. A cancelled prompt is reported
  distinctly from a failed one, and leaves any working session untouched. Probe
  checks 2 and 3 use the same prompt and the same retry budget.
- **Four times the metrics, most of them free.** Around forty-five new
  properties come out of responses the sync already fetched — the day split into
  active, highly active and sedentary minutes; the four stress bands; Body
  Battery charged and drained rather than only high and low; the night's own
  resting heart rate, respiration, SpO2 and recharge; the HRV baseline range that
  makes last night's number readable; the factors behind the readiness score.
  Four new metric groups join them: `respiration` and `spo2` ride along in the
  daily summary at no extra cost, while `body` (weight, BMI, body fat, muscle and
  bone mass) and `training` (status, acute and chronic load, load ratio) each add
  one request per day. A vault that predates them gets them switched on once.
- **A dashboard that can hold it.** Thirty-six cards in five collapsible
  sections — Activity, Sleep, Recovery and stress, Fitness and training, Body —
  behind a headline strip of goal rings and tiles. New components: a calendar
  heatmap with a metric picker, an activity list (workouts were being synced into
  every note and shown nowhere), composition bars for the day, the stress bands
  and the sleep mix, goal rings for steps, intensity minutes and floors, a
  baseline chart that puts HRV inside its own personal range, and a two-series
  line chart for acute against chronic training load.
- **Transient failures are retried.** A request that comes back 5xx or does not
  come back at all is retried up to three times with a jittered backoff. A 429 is
  not: retrying is the precise wrong response to Garmin asking us to stop.
- **A written-down Garmin API, and a daily check against the live one.**
  `api/endpoints.json` catalogues all 135 endpoints Garmin exposes — request
  shape, which ones this plugin calls, and the response fields it reads —
  generated from `python-garminconnect` by `scripts/api/extract-endpoints.py`.
  `api/schema/` records the response shapes actually observed.
  `.github/workflows/api-contract.yml` fetches them every morning through the
  plugin's own client and opens an issue the same day a field the plugin reads
  stops arriving. Garmin ships breaking changes without notice or a version;
  this is how we hear about them before a user does.
- Trunk-based git conventions and a tag-driven release pipeline
  (`.github/workflows/release.yml`), with separate stable and BRAT beta channels.
- `version-bump.mjs`, `versions.json` and an `.npmrc` that pins
  `tag-version-prefix` to empty, so `npm version` produces Obsidian-compatible
  tags.
- `LICENSE` (MIT).
- Documentation set under `docs/`: property reference, settings reference,
  troubleshooting, architecture, and a Garmin API map.

### Fixed

- README stated 177 tests, seven metric groups and three probe checks. The actual
  figures are 236, nine and four.

## [0.0.1] — 2026-09-13

The pre-release development history, before tagging began.

### Added

- Garmin Connect authentication using the mobile-app flow: SSO login, service
  ticket exchange, and OAuth2 bearer tokens. Works on desktop **and mobile**,
  which was the gap in existing plugins.
- Session persistence across restarts from a stored refresh token, with rotation
  handling, refresh-ahead-of-expiry, and single-flight refresh for concurrent
  callers.
- Typed API layer over the Garmin endpoints, with a taxonomy separating edge
  refusals from credential failures.
- Sync engine with injected note targets, newest-first traversal, per-day
  dirty-checking, partial-failure tolerance, and an empty-day cutoff for
  unbounded backfills.
- Three storage modes: a dedicated data folder, your existing daily notes, or
  both.
- Generated Obsidian Bases view (`Garmin Health.base`), created once and never
  overwritten.
- Nine metric groups: activity, heart, sleep, stress and Body Battery, HRV,
  training readiness, fitness (VO2 Max, fitness age, endurance score), race
  predictions, and workouts.
- Svelte 5 dashboard: stat tiles with week-over-week deltas and sparklines,
  hand-drawn SVG charts, range filtering, a table view, and in-place sync and
  backfill controls.
- Link property giving each day note a wikilink to the base file, so the notes
  form a hub in the graph view.
- Four-part connectivity probe writing its log into the vault, because a phone
  has no console.
- Garmin Connect ribbon icon.

### Known issues

- **MFA is not supported.** `verifyMfa()` is written and typechecked but has
  never run against a live challenge, so `login()` raises
  `GarminMfaRequiredError` rather than pretending to handle it.
- **VO2 Max never populates**, even where Garmin plainly has the data. Probably a
  wrong URL or field name rather than an absent metric — see
  [docs/troubleshooting.md](docs/troubleshooting.md#vo2-max-is-always-empty).
- The graph simulation can struggle when many day notes link to one hub note.
  Turn off `linkToBase` if that bites.
- Android is untested — a third TLS fingerprint. Desktop and iOS are confirmed.
