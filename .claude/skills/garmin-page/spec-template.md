# <Stat> — spec

Captured: phone <YYYY-MM-DD HH:MM> (`phone/INDEX.md`), web <YYYY-MM-DD HH:MM> (`web/endpoints.md`).
Figma: Garmin page `<id>`, Obsidian page `<id>`. Status: see `../STATUS.md`.

## Anatomy

Per range (1d / 7d / 4w / 1y), top to bottom: header and period control, charts (axes,
bars/lines, markers, overlays and their chips), stats rows, cards and lists, sub-pages,
info sheets. Cite the shot for each part (`phone/7d/02-scroll-1.png`). Exact copy text
comes from the OCR files, not from memory.

## Endpoints (verified live with `scripts/dev/live-api.sh`)

| View | Method + path | GarminApi | Range cap | Notes |
|---|---|---|---|---|
| 1d | `GET /…/{date}` | `stress()` | — | |
| 7d / 4w | `GET /…/{start}/{end}` | NEW → `stressDaily()` | 28 days (29 → HTTP 400?) | days without data omitted? |
| 1y | `GET /…/weekly/{end}/52` | NEW | — | rolling weeks ending today? |

## Field map

| UI element | Source field | Transform / rounding |
|---|---|---|

## Golden numbers (each with its exact date span)

| Range | Span | Values on screen | Reproduced from |
|---|---|---|---|
| 1d | Oct 7 | … | `dailyStress` |
| 7d | Oct 2 – Oct 8 (offset 0, captured Oct 8) | … | |
| 7d | Sep 25 – Oct 1 (offset −1) | … | |

7d/4w windows roll daily: a span is only reproducible on the capture day, or in a test with
TODAY pinned to that day.

## Rules

Rounding (round / floor / truncate), divisors behind averages (days with data? calendar
days?), how today is treated, axis tick formulas, colour thresholds, week start, missing-day
handling, clock-time truncation.

## Empty and edge states

What the page shows with no data, calibrating, partial today, and on an offline sync.

## Inferred (not seen on the phone)

Each item also goes to `TODO.md` under the area.

## API additions (for the orchestrator)

Wrappers, catalogue entries (`critical` / `reads`), probes and schemas to add, with the
sample files under `web/bodies/` or `api-samples/`.
