# Contributing

## Branches

`main` is the only long-lived branch. Everything else is short-lived and deleted on merge.

| Prefix | For |
| --- | --- |
| `feature/<slug>` | new capability |
| `fix/<slug>` | bug fix |
| `chore/<slug>` | tooling, dependencies, CI |
| `docs/<slug>` | documentation only |
| `refactor/<slug>` | no behaviour change |

### What this repo deliberately does not use

- **No `staging` or `develop`.** A plugin has no servers, so there is no environment to
  stage into. What staging buys you elsewhere — putting a change in front of some users
  before all of them — is done here by the beta tag channel below. A second integration
  branch would mean two pull requests per change and protect nothing.
- **No `hotfix/*`.** An urgent fix is a `fix/*` branch off `main`, released as a patch tag.
  A separate prefix only earns its place next to `release/x.y` maintenance branches, and
  there are none. Add them only once users are pinned to an older `minAppVersion`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `chore:`,
`docs:`, `refactor:`, `test:`. Pull requests squash-merge, so one commit lands on `main` per
pull request and release notes can be assembled from the log.

## Continuous integration

| Workflow | Runs | Does |
| --- | --- | --- |
| `.github/workflows/ci.yml` | every pull request, every push to `main` | `npm ci` and `npm run build`: tsc, svelte-check, the tests, the bundle and the mobile-safety check |
| `.github/workflows/api-contract.yml` | daily, by hand, and on pull requests touching the API | the catalogue's offline checks; the live contract check against Garmin (see [api/README.md](../api/README.md)) |
| `.github/workflows/release.yml` | every pushed tag | builds, attests and publishes a release (below) |

## Releasing

Both channels are driven by the tag alone. `.github/workflows/release.yml` tells them apart
by whether the tag contains a `-`. Either way the release's notes are a section of
[CHANGELOG.md](../CHANGELOG.md), so keep its `[Unreleased]` section current as changes land.

### Release notes

`npm run --silent release:notes -- <tag>` prints what a release would carry: the tag's own
section if there is one (`## [1.2.0-beta.1]`), else its version's (`## [1.2.0]`), else
`[Unreleased]`. A beta of a version still being written therefore gets the notes so far.
When none of them has anything in it, the workflow falls back to GitHub's generated notes
and warns.

A release page cannot resolve a relative link, so links inside a version's section must be
absolute URLs.

### Stable — community directory users

First promote the notes, in a pull request like any other change: rename `[Unreleased]` to
`## [x.y.z] — YYYY-MM-DD`, start a fresh empty `[Unreleased]` above it, and update the
compare links at the foot of the file. `npm version` refuses a dirty working tree, so this
has to be merged before the next step. Then, on `main`:

```bash
npm version patch|minor|major     # bumps package.json; version-bump.mjs syncs manifest.json
                                  # and versions.json; commits; tags with no "v" prefix
git push origin main --follow-tags
```

The workflow builds, attests, and opens a **draft** release with `main.js`, `manifest.json`
and `styles.css` attached and the version's section as its notes. Check it, then publish.

### Beta — BRAT testers

There is no `npm version` step here, by design:

```bash
git tag -a 1.2.0-beta.1 -m "1.2.0-beta.1"
git push origin 1.2.0-beta.1
```

The workflow stamps `1.2.0-beta.1` into `manifest.json` **inside the runner** and publishes a
pre-release, with `[Unreleased]` as its notes. The bump is never committed, because Obsidian
reads `manifest.json` at the HEAD of the default branch to decide the published version —
committing a beta bump would ship it to every community-directory user.

Testers install it by adding `tareqayz/Obsidian-Garmin-Connect` in BRAT.

> `manifest-beta.json` is obsolete. BRAT v1.1.0 and later ignore it and read betas straight
> from GitHub pre-releases. Do not add one back.

### Gotcha: Obsidian does not implement full semver precedence

A tester on `1.2.0-beta.1` will **not** be auto-offered `1.2.0`. They stay on the beta until
`1.2.1`. Either tell testers to update through BRAT, or graduate a beta as the next patch.

## Release rules worth not relearning

1. The git tag equals `manifest.json`'s `version` exactly, with **no `v` prefix**. `.npmrc`
   pins `tag-version-prefix=""` because npm defaults it to `v`, which would silently break
   every install.
2. `manifest.json`'s committed version is always plain `x.y.z`. `version-bump.mjs` refuses
   anything else.
3. Release assets are `main.js`, `manifest.json` and `styles.css`, attached individually.
   Obsidian cannot read a zip.
4. `versions.json` maps plugin version to `minAppVersion` and only needs a new entry when
   `minAppVersion` moves. `version-bump.mjs` handles that. It is empty until the first stable
   release, whose `npm version` seeds it.
5. Submission is through [community.obsidian.md](https://community.obsidian.md) with an
   Obsidian account and a linked GitHub account — not a pull request to `obsidian-releases`.

## Before the first directory submission

Each of these will fail the automated review or the guidelines it checks:

- [x] `manifest.json` `name` has no `(probe)`.
- [x] `manifest.json` `description` is user-facing: under 250 characters, opens with a verb,
      ends in a period, and does not say "Obsidian".
- [x] `minAppVersion` is honest: 1.9.10, the first release with Bases, which the generated
      table view needs.
- [x] `isDesktopOnly: false` still holds. `scripts/check-mobile-safe.mjs` runs in `npm run
      build`, and CI runs that on every pull request.
- [x] The release workflow can create releases: `release.yml` asks for `contents: write`,
      and it published 0.1.0-beta.1.
- [x] The README discloses what the developer policies require: a Garmin account is needed,
      and the plugin talks to Garmin's servers over the network.
- [ ] `version` bumped to `1.0.0`.

- [ ] UI text in sentence case throughout (commands, settings, notices).
- [ ] Settings headings through `setHeading()` rather than raw `<h3>` elements.

`id` is already valid: lowercase and hyphens only, no `obsidian`, no `plugin` suffix.

## Local development

This repository *is* `.obsidian/plugins/garmin-connect` inside a live vault, which has a few
consequences:

- **A build replaces the live plugin's `main.js`.** Hot Reload is not enabled in the
  development vault, so nothing changes in the running app until the plugin is reloaded:
  `obsidian plugin:reload id=garmin-connect` (see [obsidian-cli.md](obsidian-cli.md)), or
  turn it off and on in settings. A load also runs a sync when **Sync on startup** is on.
  The vault lives in iCloud, so the new `main.js` reaches the phone too.
- **Parallel work goes in a `git worktree` outside iCloud**, not in a second branch checked
  out here. Switching branches in place changes the source the next build uses.
- **Secrets and personal data live beside the code.** Never commit, print or paste them:
  - `data.json`: live Garmin credentials and tokens. Gitignored, and must stay that way.
  - `.garmin-token.json`: a refresh token, written by `npm run api:token`.
  - `ref/`: the phone screenshots and specs the pipeline works from. It is personal health
    data, so it stays on the machine that captured it; `.gitignore` lists it.

  Never test a beta install against the primary vault.
- **`node_modules` stays out of iCloud** through File Provider's ignore attribute:
  `xattr -w 'com.apple.fileprovider.ignore#P' 1 node_modules`. The older `node_modules.nosync`
  symlink does not survive npm 11, which replaces the symlink with a real folder. `npm ci`
  recreates the folder too, so re-apply the attribute after one.

```bash
npm install
npm run dev     # watch build
npm run build   # tsc → svelte-check → tests → esbuild → mobile-safety check
npm test
```

### npm scripts

| Script | Does |
| --- | --- |
| `dev` | esbuild in watch mode |
| `build` | the full gate: tsc, `svelte-check`, `test`, the production bundle, `check` |
| `check` | `scripts/check-mobile-safe.mjs`: fails if a node or electron require reached `main.js` |
| `test` | bundles `tests/*.test.ts` into `tests/.build/` (cleared first) and runs Node's test runner |
| `svelte-check` | type-checks the Svelte components |
| `version` | npm's version hook: `version-bump.mjs`, see [Releasing](#releasing) |
| `release:notes` | prints a tag's release notes from `CHANGELOG.md` |
| `api:extract` / `api:extract:check` | regenerate the request half of `api/endpoints.json` from a `python-garminconnect` checkout, or only check it has not drifted |
| `api:check` / `api:record` | the live contract check, and the same folding today's shapes into `api/schema/` |
| `api:token` | sign in once and write `.garmin-token.json` for the contract check |
| `api:record-file` | record shapes from saved responses, without a token |
| `iphone:build` | builds the iPhone Mirroring helper (`scripts/iphone/`) |

The `api:*` scripts are described in [api/README.md](../api/README.md).

### Development scripts

`scripts/dev/` drives the running app and the Garmin web app. They are what the page
pipeline and its agents use, and work as well by hand:

| Script | Does |
| --- | --- |
| `ev.sh` | `obsidian eval` with retries; the CLI drops its output now and then |
| `click.sh` | a real click through the Chrome DevTools Protocol; synthetic clicks do not reach Svelte 5 handlers inside Obsidian |
| `capture-view.sh` | opens Home at a route and captures it at phone (402) or pane (1190) width, light or dark |
| `live-api.sh` | calls Garmin through the running plugin's own client, read-only, and saves the response |
| `b.sh` | gstack's browser for the Garmin web app, read-only commands only |
| `compare.py` | stitches captures and lays a page beside its reference; needs Pillow |
| `test.sh` | runs only the matching tests in `tests/.build-<slug>/`, so parallel runs do not collide |

`scripts/garmin-web/` holds what `b.sh` injects into the web app (the GraphQL recorder, page
text) and `summarize.mjs`, which turns a web capture into an endpoint inventory.
`scripts/iphone/` is the iPhone Mirroring helper; its `mirror.sh ocr-file` also OCRs
screenshots taken on the phone by hand.

### Rebuilding a Garmin page

New Garmin screens go through the `/garmin-page` pipeline: capture the phone and web app,
write the spec, build the 1:1 Garmin page and its Obsidian twin in Figma, implement, verify
in the live vault, commit. Its instructions are in
[.claude/skills/garmin-page/SKILL.md](../.claude/skills/garmin-page/SKILL.md). The design
source is the [Obsidian Garmin Figma file](https://www.figma.com/design/8D338zFIJ1a2zrsuligjva/Obsidian-Garmin);
UI changes are designed there first.
