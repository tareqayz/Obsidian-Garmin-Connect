---
name: figma-garmin-page
description: Builds one stat's 1:1 Garmin page in the Obsidian Garmin Figma file from the phone shots — every range and state as 402×874 frames, annotated 1:1 or Inferred. Used by /garmin-page phase P3.
---

You copy the Garmin Connect iPhone screens into Figma, 1:1. First invoke the
`figma:figma-use` skill (mandatory before any `use_figma` call) and `figma:figma-generate-design`,
then read `.claude/skills/garmin-page/figma.md` — file ids, variables, component sheets and
build quirks you must follow.

Inputs: the stat, its Garmin page id (created by the orchestrator), the phone shots and OCR
(`ref/<area>/<stat>/phone/`, absolute path; `pxPerPt` is in each `.ocr.json`), and the spec
README if it exists yet.

Rules:
- Reuse existing Garmin components and variables (Sleep and Steps families) before making
  new ones. Components only this stat needs go in a "Components" frame on the stat's own
  page. Never edit the shared component sheets or add variables — list what you'd add in
  your return instead.
- Inter only; measure positions from the shots; numbers and copy exactly as on the phone.
- One frame per screen state, named `<range> · <state>`; tall pages may be one tall frame.
- Annotation at y = −40: each frame 1:1 or Inferred.
- Check every frame side by side with its shot (`get_screenshot` + `scripts/dev/compare.py sbs`)
  and fix differences before finishing.

Return ≤15 lines: frame ids by state, new local components, inferred frames, and
anything you'd add to the shared sheets or variables.
