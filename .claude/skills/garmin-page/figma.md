# Figma: the 1:1 Garmin page and its Obsidian twin

File: **Obsidian Garmin** — https://www.figma.com/design/8D338zFIJ1a2zrsuligjva/Obsidian-Garmin
(`fileKey 8D338zFIJ1a2zrsuligjva`). **Invoke the `figma:figma-use` skill before every
`use_figma` call**, and `figma:figma-generate-design` when building a screen.

## Structure

- Pages: Cover · Foundations · `Garmin / …` · `Obsidian / …`. Each Obsidian page has
  "Light mode preview" / "Dark mode preview" wrapper frames (explicit variable mode on the
  frame) and a wide **pane** frame: 1190 pt, content 1126 = 3×370 + 2×8 (the code's 640 /
  1000 container-query breakpoints).
- Phone frames are **402 × 874 pt** (iPhone 16/17 Pro at 3x; mirrored shots are 2x).
- Variables: collection `Garmin` (`VariableCollectionId:8:2`, one mode Dark `8:0`) and
  `Obsidian` (`VariableCollectionId:8:47`, Light `8:1` / Dark `8:2`; names = CSS variables,
  code syntax `var(--background-primary)`). Text styles `Garmin/*` and `Obsidian/*`, Inter.
- Component sheets: Garmin `8:119`, Obsidian `8:128`. Bands already used: Activities
  y≈1620 / 1470, Steps-Floors-Intensity y≈3400 / 3200, Sleep y≈3900 / 3700.
- Health Stats so far: Sleep — Garmin `176:2` (1d), `176:3` (7d·4w·1y); Obsidian `176:4`,
  `176:5`. Sleep's Garmin components (Tabs 179:121, Half Tabs 179:132, Segmented 179:141,
  Collapsible 179:148, Factor Card 179:149, Stat 180:121, Chip 180:126, Legend Item 180:161,
  Day Card 180:162, Week Card 180:173, Group Header 180:183, Health Group Label 180:186,
  Health List Row 180:188, Chart Marker 180:199) have Obsidian twins 202:388…202:527.
  Steps-family components: Range Control 127:106, Header 127:130, Day Card 127:152, Month
  Row 127:153, Totals Toggle 127:164, Legend Item 127:177; Obsidian 139:369…139:467.
- Each stat has pages `Garmin / <Stat>` and `Obsidian / <Stat>` after the Sleep pages, in the
  phone's order (created 2026-10-08: Garmin 239:2–239:13, Obsidian 239:14–239:25 — Health
  Status, Lifestyle Logging, Weight, Pulse Ox, Pulse Ox Acclimation, Respiration, Heart Rate,
  Blood Pressure, Stress, Body Battery, Fitness Age, Health Snapshot). The hub frames are on
  the Sleep 1d pages: Garmin `194:30269`, Obsidian `207:32591` (light) / `209:32867` (dark). Components only that stat uses sit on its own page (a "Components" frame at
  the top left). Shared components and new variables are added by the orchestrator only.

## Conventions

- Every page gets an annotation at y = −40 labelling each frame **1:1** (copied from a
  phone shot) or **Inferred**. Inferred items also go to `TODO.md`. Update the Cover's
  KNOWN GAPS.
- Build the twin from the Garmin frames: same structure, Obsidian variables and text
  styles, Garmin brand colours only where the data needs them (stat colours).
- Measure from the phone shots at 402 pt (mirrored 2x shots: divide pixels by `pxPerPt`
  from the `.ocr.json`). Placing Inter text from a measured cap top:
  `y = capTop − (lineHeight/2 − 0.3643 × fontSize)`.
- Check each frame side by side: `get_screenshot` caps at 1x (402 wide); compose with
  `scripts/dev/compare.py sbs <phone.png> <figma.png> <out.png>`.

## Build quirks (all verified — trust them)

- **SF Pro can't be measured** by the plugin runtime (width 0, renders nothing). Build with
  Inter.
- **Bound paints keep a cached colour.** Assign a plain solid first, then the bound paint;
  put fades on layer `opacity` (paint-level opacity is lost on fills, and when the node is
  cloned in the same call). A `screenshot()` in the same call shows the stale colour —
  re-check in a new call.
- `combineAsVariants` merges same-named TEXT props and keeps the first variant's default:
  call `setProperties` per instance. After it, set `primaryAxisSizingMode` and
  `counterAxisSizingMode` to `"AUTO"` before `layoutMode`, or the set clips its variants.
- `resize()` resets sizing modes to FIXED: set sizing modes after resizing.
- `swapComponent` keeps nested instance-swap overrides: re-swap exposed nested instances.
  Swap top-down and re-query children after each swap (old nested ids vanish).
- Instance children can't be moved ("relative-transform"): hide them and draw a sibling.
- `vectorPaths` positions the node at the path's bbox: write coordinates in the parent's
  space. Re-setting `vectorPaths` on an existing vector shifts it — delete and recreate.
  Children appended to a cloned chart frame use that frame's own coordinates.
- Gradient fills can't bind variables. `createNodeFromSvg` works for icons (move children
  into a component, bind strokes). Raster icons: `upload_assets` with `nodeIds`.
- Nested exposed instances: `inst.findOne(n => n.name === "…").setProperties({…})`.
- A failed `use_figma` script commits nothing (atomic). `get_metadata` on a full page is too
  large — list top-level children with a read-only `use_figma` instead.
- No `--background-modifier-cover` variable: backdrops are black at 50 % layer opacity.
