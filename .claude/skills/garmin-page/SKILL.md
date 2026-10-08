---
name: garmin-page
description: Rebuild a Garmin Connect page in this plugin end to end — capture the iPhone app through iPhone Mirroring and the web app's network calls, write the spec, build the 1:1 Garmin page and the Obsidian twin in Figma, implement, verify live and commit — with subagents and no approval stops. Use for "/garmin-page <area> <stat>", "/garmin-page resume", "rebuild the <stat> page", or any new Garmin screen (Health Stats, Activities, Home detail screens).
---

# /garmin-page — the Garmin page pipeline

`/garmin-page <area> <stat>` (e.g. `health-stats stress`) runs one page through every
phase. `/garmin-page resume` reads `ref/<area>/STATUS.md` and continues where it stopped.
You are the **orchestrator**: you dispatch the agents below, own every shared file, and are
the only one who builds in the live tree, reloads the plugin and commits.

The working tree is a live plugin folder in a real vault (see CLAUDE.md). Never read or
print `data.json` or `.garmin-token.json`. `ref/` is local-only (`.git/info/exclude`).

## Phases and definitions of done

| Phase | Agent (`.claude/agents/`) | Output under `ref/<area>/<stat>/` | Done when |
|---|---|---|---|
| P1 phone | `garmin-phone-capture` — one at a time | `phone/<range>[-prev]/NN-slug.png` + `.ocr.json`, `phone/INDEX.md` | Every range at offsets 0 and −1, every tab / chip / overlay / sub-page / info sheet, scrolled to the end |
| P1 web | `garmin-web-capture` — one at a time | `web/text-*.txt`, `web/*.png`, `web/endpoints.md`, `web/bodies/` | Every web state captured, or "no web page" noted |
| P2 spec | `garmin-spec` | `README.md` (template: `spec-template.md`) | Every golden number reproduces from the payloads; endpoints verified with `live-api.sh` |
| P3 Figma Garmin | `figma-garmin-page` (parallel with P2) | Garmin page; ids in README | Side-by-side with the phone shots; frames annotated 1:1 / Inferred |
| P4 Figma Obsidian | `figma-obsidian-twin` | Obsidian page: Light/Dark wrappers + 1190 pane | Bound to the Obsidian variables |
| P5 code | `health-stat-builder` in a worktree | Branch `feature/<area-prefix>-<stat>`; data layer after P2, UI after P4 | Full `npm run build` passes in the worktree |
| P6 finish | you | Registrations, `verify/*.png`, commit | `verify.md` checks pass |

There is **no approval stop** between Figma and code. Frames not seen on the phone are marked
"Inferred" in Figma and listed in `TODO.md`; the run continues.

## Order for a batch (e.g. all Health Stats)

1. **Survey:** `garmin-web-capture` for every stat (unattended) → endpoint inventory.
2. **API batch** (you): every wrapper, catalogue entry, probe, schema (`api.md`) in one
   commit, so per-stat builders never touch shared API files.
3. **Foundation** (one builder, then you): whatever shared code removes per-stat edits to
   shared files. Take baseline captures of existing pages first.
4. **Pilot** one stat end to end; fold the lessons into this skill and the agents.
5. **Phone sitting** for the rest (unattended, `capture.md`), then waves of ≤3 stats.
6. **Per wave:** integrate + commit each stat, one `plugin:reload`, live verification against
   a same-day web capture, fixes via `git commit --fixup` + `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash <base>`.

## Concurrency and safety

- One agent at a time on each of: the phone, the browser, the live vault, `live-api.sh`.
- At most 2 Figma agents and 3 spec/builder agents at once.
- Builders work in `~/Dev/garmin-connect-wt/<stat>` (outside iCloud), never run git in the
  live tree, and own only their stat's files. **Only you** edit shared files (registries,
  `Home.svelte`, `home-view.ts`, `main.ts`, `src/garmin/endpoints.ts`, `api/`, `scripts/api/probes.ts`,
  `tests/engine.test.ts`), build in the live tree, reload the plugin and commit.
- Figma: stat-specific components live on the stat's own page; only you add shared
  components or variables (`figma.md`).
- Phone: navigation only; allow-listed taps (`capture.md`). Lifestyle Logging logs on a
  single tap — nothing inside it is tapped except the range control and back.
- Web: `scripts/dev/b.sh` only (read-only wrapper, own profile outside iCloud).
- Live API: `scripts/dev/live-api.sh` only (GET / GraphQL queries, locked, paced).

## Worktrees for builders

```bash
WT=~/Dev/garmin-connect-wt/<stat>
git worktree add "$WT" -b feature/health-<stat> feature/health-stats   # from the live tree
ln -s "$PWD/node_modules" "$WT/node_modules"
# after the builder commits:
git cherry-pick --no-commit feature/health-<stat>   # in the live tree, then registrations + build + commit
git worktree remove "$WT" && git branch -D feature/health-<stat>
```

## Lessons from the Stress pilot (2026-10-08)

- **Custom agent types load at session start.** In the session that created or changed
  `.claude/agents/*.md`, dispatch `general-purpose` agents told to "act as `<agent>`" and to
  read its file first.
- **Usage limits.** Keep ≤3 agents running at once. An agent stopped by a limit keeps its
  transcript: resume it with `SendMessage` once the limit resets — don't start over.
- **Two-pass specs.** Pass 1 (web + API: endpoints, caps, golden numbers, rules) can run
  before the phone capture; pass 2 adds the phone anatomy and settles the phone-only items
  its "phone pass to-do" lists.
- **Two-phase builders.** Phase 1 (index, view model, geometry, golden tests) right after
  the spec; phase 2 (Svelte) once the Obsidian twin exists — resume the same agent so it
  keeps its context. Then `git cherry-pick --no-commit <phase commits>` → one per-stat commit.
- **Cross-stat facts travel.** Findings in one spec often change another stat's build
  (Body Battery's curve rides in Stress's `dailyStress`; no HR/stress intraday before
  2026-06-01). Pass them on when dispatching or resuming.
- **Scratch files collide.** Agents share the session scratchpad: give each its own
  subfolder (`scratchpad/<stat>/`) and file names prefixed with the stat.
- **Rounding differs per stat** (Stress floors; Body Battery, Heart Rate, Respiration round
  half-up/nearest). Never assume; every spec proves its own rule.

## Dispatching agents

Give each agent: the stat, its output directory (absolute paths), the inputs it may read,
the files it owns, and where to write detail (files, not the reply). Ask for a ≤15-line
return. Run capture agents in the background and keep working.

## Commits

Conventional Commits on the area branch, one per stat: `feat(health): <stat> pages`.
Tooling, API batches and shared refactors get their own commits. Never push.

## Status board

`ref/<area>/STATUS.md`: one row per stat — phase reached, Figma page ids, branch/commit,
open items. Update it after every phase so `/garmin-page resume` can continue.

## Reference files

- `capture.md` — phone and web capture procedures, shot list, naming, deep links
- `spec-template.md` — the README a spec agent writes
- `figma.md` — file ids, variables, component sheets, build quirks
- `verify.md` — live-vault verification method and gotchas
- `api.md` — adding endpoints: wrappers, catalogue, probes, schemas without a token
