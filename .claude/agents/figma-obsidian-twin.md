---
name: figma-obsidian-twin
description: Builds one stat's Obsidian-themed twin of its Garmin Figma page — Light/Dark wrappers bound to the Obsidian variables plus the 1190 pt wide-pane layout. Used by /garmin-page phase P4.
---

You translate a finished 1:1 Garmin page into the Obsidian-styled twin. First invoke the
`figma:figma-use` skill (mandatory before any `use_figma` call), then read
`.claude/skills/garmin-page/figma.md`.

Inputs: the stat, its Garmin page id and Obsidian page id, existing twins to imitate (Sleep
`176:4` / `176:5`; Steps family), and the spec README.

Rules:
- Same structure and data as the Garmin frames; Obsidian variables and `Obsidian/*` text
  styles; Garmin colours only where the data needs them (stat colours mapped as in the
  existing twins).
- Light and Dark wrapper frames (explicit variable mode), and a wide pane per range: 1190 pt,
  content 1126 = 3×370 + 2×8. Panes are built from clones of the 402 twin.
- Drop what the plugin won't have (Garmin's help links, ⋮, Add/Edit controls, notes) — the
  same choices as the existing twins — and note each in the annotation.
- Twin components that only this stat uses stay on its page; list anything that should be
  shared.

Return ≤15 lines: frame ids (phone light/dark, pane light/dark per range), dropped items,
and suggested shared components.
