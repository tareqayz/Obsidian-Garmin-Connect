# Figma: the 1:1 Garmin page and its Obsidian twin

File: **Obsidian Garmin** — https://www.figma.com/design/8D338zFIJ1a2zrsuligjva/Obsidian-Garmin
(`fileKey 8D338zFIJ1a2zrsuligjva`). **Invoke the `figma:figma-use` skill before every
`use_figma` call**, and `figma:figma-generate-design` when building a screen.

## Structure

- Pages: Cover · Foundations · `Garmin / …` · `Obsidian / …`. Each Obsidian page has
  "Light mode preview" / "Dark mode preview" wrapper frames (explicit variable mode on the
  frame) and a wide **pane** frame: 1190 pt, content 1126 = 3×370 + 2×8 (the code's 640 /
  1000 container-query breakpoints).
- Phone frames are **402 × 874 pt** (iPhone 16/17 Pro at 3x); landscape full-screen charts
  are 874 × 402 pt.
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
- Performance Stats (2026-10-11, details and measurements in `ref/performance-stats/figma-foundation.md`):
  pages `430:6062` (Garmin hub) … `430:6096` and `430:6098` (Obsidian hub) … `430:6132`, one
  pair per stat in phone order incl. hidden Load / Heat Acclimation (no Cycling Ability or
  Altitude). Shared "Performance" band on 8:119 from y 4400 (twins 200 higher on 8:128): Range
  Control 432:166→442:933 (Compact 34 tall at y 122.33; Wide 36 tall at y 116.33 — VO₂ Max,
  Training Effect), Tabs 433:210→442:1159, Stat Dial 434:196→442:1349 (8 kinds; **dials sweep
  300°, ends at ±150°**; Value/Label/Unit/Marker props), Dial Marker 434:107→441:562, Factor Card
  435:120→443:420, Chip 435:125→443:431, Shape Marker 435:134→443:452, Legend Item
  435:135→443:453, Optimal Range 435:144→443:470, Optimal Band 435:149→443:481, Status Dot /
  Segment / Strip / Row 436:124 / 436:157 / 436:184 / 436:205 (twins 443:522 / 603 / 682 / 735),
  Table Header / Row / Title 436:223 / 436:246 / 436:251 (443:773 / 824 / 835), Bottom Sheet
  Full/Half 437:140→444:427. Variables `performance/*` (Garmin 431:2–431:24, Obsidian
  431:25–431:47); text styles Dial Value L 43, Dial Unit 20, Sheet Title 22 SB (both prefixes).
  A dial's marker can't move inside an instance: turn Marker off and place a Dial Marker.

## Conventions

- Every page gets an annotation at y = −40 labelling each frame **1:1** (copied from a
  phone shot) or **Inferred**. Inferred items also go to `TODO.md`. Update the Cover's
  KNOWN GAPS.
- Build the twin from the Garmin frames: same structure, Obsidian variables and text
  styles, Garmin brand colours only where the data needs them (stat colours).
- Measure from the phone shots at 402 pt (native shots are 3x: divide pixels by 3; the
  `.ocr.json` boxes are already in points). Placing Inter text from a measured cap top:
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
  `setProperties` after `swapComponent` + `resetOverrides` drops the instance's name: rename last.
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
- Cloning a component set resets every variant's text to the set's default: to twin a set,
  detach, convert back to components and re-combine. Per-variant preview text in a set also
  resets to the default when the file commits; instances keep their own values (set them with
  `setProperties` per instance).
