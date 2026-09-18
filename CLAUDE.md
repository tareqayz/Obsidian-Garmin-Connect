# CLAUDE.md

Obsidian plugin that syncs Garmin Connect data into the vault. `CONTRIBUTING.md` is the full
rulebook; this file is the short version that matters while making changes.

## Git

- `main` is the only long-lived branch. Never commit to it directly — branch first.
- Branches are one level deep and named after the outcome:
  `feature/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`, `refactor/<slug>`.
- There is no `staging`, `develop` or `hotfix/*`, on purpose. Release channels are tags, not
  branches. An urgent fix is a `fix/*` branch released as a patch tag.
- Conventional Commits. Pull requests squash-merge.

## Releases — do not improvise these

- The git tag equals `manifest.json`'s `version` exactly, **no `v` prefix**.
- Stable: `npm version patch|minor|major` then `git push origin main --follow-tags`. Never
  hand-edit `manifest.json`'s version; `version-bump.mjs` owns it.
- Beta: tag directly, e.g. `git tag -a 1.2.0-beta.1 -m "1.2.0-beta.1"`. **Never commit a
  pre-release version to `manifest.json` on `main`** — Obsidian reads that file at the HEAD
  of the default branch and would ship the beta to every user. CI stamps it into the release
  asset instead.
- Do not create `manifest-beta.json`. BRAT v1.1.0+ ignores it.

## This repo is a live plugin folder

The working tree is `.obsidian/plugins/garmin-connect` in a real vault.

- `data.json` here holds live Garmin credentials and tokens. It is gitignored. Never commit,
  print, or paste its contents.
- Switching branches hot-swaps the running plugin. Prefer `git worktree` for parallel work.

## Build

`npm run build` chains `tsc` → `svelte-check` → tests → esbuild → `check-mobile-safe`. That
last step is what backs `isDesktopOnly: false`; if a change pulls in a node or electron
import, fix the import rather than the check.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

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
