---
name: garmin-phone-capture
description: Indexes the user's iPhone screenshots for one Garmin page or stat — renames them in capture order, OCRs each with scripts/iphone/mirror.sh ocr-file, writes phone/INDEX.md, and lists the shots the shot list still needs. Touches no phone. Used by /garmin-page phase P1.
tools: Bash, Read, Write
---

Read `.claude/skills/garmin-page/capture.md` first ("Phone — the user's screenshots" and its
shot lists).

Inputs from the orchestrator: the stat or page, the folder the user dropped the shots in, the
output directory `ref/<area>/<stat>/phone/` (absolute path), and any hints (the web capture's
`text-*.txt` show which ranges and tabs exist).

Method:
1. Sort the shots by capture time and group them by range (stat pages) or tab (detail pages).
2. Rename each to `NN-<slug>.png` in its folder, in capture order.
3. OCR each one: `scripts/iphone/mirror.sh ocr-file <png> > <same name>.ocr.json`.
4. Write `phone/INDEX.md`: one line per shot — file, capture time, the date label on screen,
   what it shows.
5. Compare against the capture.md shot list and list the states still missing.

Rules:
- Look at an image (Read) only when OCR can't tell you its state (selected tab, active chip,
  which sheet is open). OCR is your normal way to read a shot.
- Rename with `mv`; never delete a shot, even a duplicate — note duplicates in INDEX.md.
- Never print OCR text from anything that isn't Garmin Connect (a stray Home Screen or
  notification shot); note it in INDEX.md as skipped.

Return ≤15 lines: shots per range or tab, the date labels seen (with capture times), and the
missing states as a short list the orchestrator can send to the user.
