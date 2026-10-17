# CLAUDE.md

Obsidian plugin that syncs Garmin Connect data into the vault as JSON and rebuilds Garmin Connect's
pages inside Obsidian: Home, Activities and each activity's page, Sleep, Health Stats and
Performance Stats. `docs/CONTRIBUTING.md` is the full rulebook; this file is the short version that
matters while making changes.

## Docs map

| Task | Read | Code |
| --- | --- | --- |
| Understand the system, a sync, the backfill | [architecture](docs/architecture.md) | `src/main.ts`, `src/sync/` |
| Add or change a page inside Home | [building-pages](docs/building-pages.md) | `src/dashboard/`, `src/ui/svelte/` |
| Add a stat's history (a day index) | [building-pages → Day indexes](docs/building-pages.md#day-indexes) | `src/sync/<stat>-index.ts` |
| Add a metric or a metric group | [architecture → Extending the sync](docs/architecture.md#extending-the-sync) | `src/sync/metrics.ts` |
| Call a new Garmin endpoint | [garmin-api](docs/garmin-api.md), [api/README → Adding an endpoint](api/README.md#adding-an-endpoint-to-the-check) | `src/garmin/endpoints.ts`, `api/endpoints.json` |
| Store new data for days a vault already holds | [CONTRIBUTING → Data versions](docs/CONTRIBUTING.md#data-versions) | `src/sync/datasets.ts` |
| Know every file and key the sync writes | [Data reference](docs/properties.md) | `src/sync/metrics.ts`, `src/sync/series-store.ts` |
| Know every setting and `data.json` key | [settings](docs/settings.md) | `src/settings-data.ts`, `src/plugin-data.ts` |
| Release a beta or a stable | [CONTRIBUTING → Releasing](docs/CONTRIBUTING.md#releasing) | `.github/workflows/release.yml`, `scripts/release/` |
| Verify a UI change in the live vault | [obsidian-cli](docs/obsidian-cli.md), [verify.md](.claude/skills/garmin-page/verify.md) | `scripts/dev/` |
| Change a doc | [CONTRIBUTING → Writing docs](docs/CONTRIBUTING.md#writing-docs): one home per topic, updated in the same PR | — |

## UI

Any update to UI should be managed in the relevant Figma file:
https://www.figma.com/design/8D338zFIJ1a2zrsuligjva/Obsidian-Garmin

This is relevant for:
- designing new components;
- updating components;
- creating alternative views for components;
- new UI-related features or changes.

Always cross-check a UI implementation in the live vault with the Obsidian CLI: the commands are in
`docs/obsidian-cli.md`, the method in `.claude/skills/garmin-page/verify.md`.

## Git

- `main` is the only long-lived branch. Never commit to it directly; branch first. The one exception
  is the version commit `npm version` makes for a stable release.
- Branches are one level deep and named after the outcome:
  `feature/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`, `refactor/<slug>`.
- There is no `staging`, `develop` or `hotfix/*`, on purpose. Release channels are tags, not
  branches. An urgent fix is a `fix/*` branch released as a patch tag.
- Conventional Commits. Pull requests squash-merge.

## Releases: do not improvise these

- The git tag equals `manifest.json`'s `version` exactly, **with no `v` prefix**.
- Stable: a PR renames `## [Unreleased]` in `CHANGELOG.md` to `## [x.y.z] — date`. Then run
  `npm version patch|minor|major` and `git push origin main --follow-tags`. Never hand-edit
  `manifest.json`'s version; `version-bump.mjs` owns it.
- Beta: a PR renames `## [Unreleased]` to `## [x.y.z-beta.N] — date`. Then tag that commit on
  `main`: `git tag -a x.y.z-beta.N -m "x.y.z-beta.N"`. **Never commit a pre-release version to
  `manifest.json` on `main`**: Obsidian reads that file at the head of the default branch, and would
  ship the beta to every user. CI stamps it into the release asset instead.
- Never add `## [x.y.z]` to the changelog before tagging that stable: every later beta would publish
  its notes.
- Do not create `manifest-beta.json`. BRAT v1.1.0+ ignores it.

## This repo is a live plugin folder

The working tree is `.obsidian/plugins/garmin-connect` in a real vault.

- `data.json` here holds the plugin's settings, including the account email; older builds also kept
  the Garmin session in it. It is gitignored. Never commit, print, or paste its contents. The same
  goes for `.garmin-token.json` (a refresh token from `npm run api:token`) and `ref/` (personal phone
  screenshots and specs).
- A build here replaces the live plugin's `main.js`. Hot Reload isn't enabled, so the build takes
  effect on `obsidian plugin:reload id=garmin-connect`, and iCloud carries it to the phone. Prefer a
  `git worktree` outside iCloud for parallel work.
- `node_modules` is kept out of iCloud with `xattr -w 'com.apple.fileprovider.ignore#P' 1
  node_modules`. `npm ci` recreates the folder, so re-apply it after one.

## Build

`npm run build` chains `tsc` → `svelte-check` → tests → esbuild → `check-mobile-safe`. That last
step is what backs `isDesktopOnly: false`; if a change pulls in a node or electron import, fix the
import rather than the check. `scripts/dev/test.sh '<glob>'` runs only the matching tests.

## Data versions

Storing new data for days or activities a vault already holds means:
1. Bump that set's version:
   - `DAY_DETAILS_VERSION` in `src/sync/datasets.ts`;
   - `ACTIVITY_DETAIL_VERSION` in `src/sync/activity-detail.ts`;
   - or the index's own `version`.
2. For Day details or Activity details, add a `changes` line in `datasets.ts`.
3. Run `UPDATE_SHAPES=1 npm test` to record the shape in `tests/fixtures/dataset-shapes.json`.

The update dialog then offers the data again. `tests/dataset-shapes.test.ts` fails when a store
changes without a bump. It can't see a new field from an endpoint already called, though, so bump
by hand then. Details: `docs/CONTRIBUTING.md`, "Data versions".

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt,
invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
- Figma → invoke figma:figma-use
- Garmin page rebuild (capture the phone/web app, spec, Figma 1:1 + Obsidian twin, implement, verify) → invoke /garmin-page
