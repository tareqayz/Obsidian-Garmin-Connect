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

One branch per unit of work, named after the outcome, one level deep. `feature/ui/layouts`
and `feature/layouts` once existed for the same work — that is the failure this rule exists
to prevent, and one level keeps `git branch --list 'feature/*'` predictable.

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

## Releasing

Both channels are driven by the tag alone. `.github/workflows/release.yml` tells them apart
by whether the tag contains a `-`.

### Stable — community directory users

```bash
npm version patch|minor|major     # bumps package.json; version-bump.mjs syncs manifest.json
                                  # and versions.json; commits; tags with no "v" prefix
git push origin main --follow-tags
```

The workflow builds, attests, and opens a **draft** release with `main.js`, `manifest.json`
and `styles.css` attached. Write the release notes, then publish.

### Beta — BRAT testers

There is no `npm version` step here, by design:

```bash
git tag -a 1.2.0-beta.1 -m "1.2.0-beta.1"
git push origin 1.2.0-beta.1
```

The workflow stamps `1.2.0-beta.1` into `manifest.json` **inside the runner** and publishes a
pre-release. The bump is never committed, because Obsidian reads `manifest.json` at the HEAD
of the default branch to decide the published version — committing a beta bump would ship it
to every community-directory user.

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
   `minAppVersion` moves. `version-bump.mjs` handles that.
5. Submission is through [community.obsidian.md](https://community.obsidian.md) with an
   Obsidian account and a linked GitHub account — not a pull request to `obsidian-releases`.

## Before the first directory submission

Each of these will fail the automated review:

- [ ] `manifest.json` `name` drops `(probe)`.
- [ ] `manifest.json` `description` becomes user-facing: 250 characters maximum, ending in a
      period, ideally opening with a verb — "Sync Garmin Connect health and activity data
      into daily notes."
- [ ] `version` bumped to `1.0.0`.
- [ ] `isDesktopOnly: false` still holds. `scripts/check-mobile-safe.mjs` runs in `npm run
      build` and is what backs that claim — keep it in the CI gate.
- [ ] Repo Settings → Actions → General → Workflow permissions set to **Read and write**,
      or the workflow cannot create a release.

`id` is already valid: lowercase and hyphens only, no `obsidian`, no `plugin` suffix.

## Local development

This repository *is* `.obsidian/plugins/garmin-connect` inside a live vault, which has two
consequences:

- Checking out a branch hot-swaps the plugin Obsidian is running — `.hotreload` is present,
  so the change is picked up immediately. For parallel work use `git worktree add` against a
  scratch vault rather than switching branches in place.
- `data.json` sits in this folder and holds live Garmin credentials and tokens. It is
  gitignored and must stay that way. Never commit it, and never test a beta install against
  the primary vault.

```bash
npm install
npm run dev     # watch build
npm run build   # tsc → svelte-check → tests → esbuild → mobile-safety check
npm test
```
