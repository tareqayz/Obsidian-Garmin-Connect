# API: verifying and adding endpoints

## Live calls — `scripts/dev/live-api.sh`

```bash
scripts/dev/live-api.sh <unique-key> <out.json> GET /usersummary-service/stats/stress/daily/2026-09-11/2026-10-08
scripts/dev/live-api.sh <unique-key> <out.json> GET /weight-service/weight/range/2026-01-01/2026-10-08 'includeAll=true'
scripts/dev/live-api.sh <unique-key> <out.json> graphql 'query { healthStatusSummary(calendarDate: "2026-10-07") }'
```

It calls through the running plugin's own client (`app.plugins.plugins['garmin-connect'].garmin`
— the sync's token and paths), writes the body to `out.json` and prints a one-line shape.
GET and GraphQL queries only; one call at a time (lock), ≤1 per second. Inspect `out.json`
with `python3`/`node`, printing projections (counts, keys, a few values) — never whole
payloads, and never `data.json`.

Web paths map 1:1: `https://connect.garmin.com/gc-api/<path>` = `connectapi.garmin.com/<path>`
= `live-api.sh … GET /<path>`. Find each range endpoint's cap by probing 28 / 29 / longer
spans (stats daily ranges: 28 days, 29 → HTTP 400) and note how missing days appear.

## Adding an endpoint (the orchestrator, in one batch)

1. Wrapper in `src/garmin/endpoints.ts`: `assertIsoDate` on dates, `requireDisplayName()`
   for `{displayName}` paths, `?? []` for lists; GraphQL through `graphql()`.
2. URL test in `tests/endpoints.test.ts`.
3. `api/endpoints.json` entry: `plugin`, `check: true`, `critical` (paths the plugin can't
   do without — losing one fails the check), `reads` (paths it tolerates missing),
   `schema`, `groups`, `cadence`, `notes`. GraphQL / plugin-only paths need
   `"source": "plugin"` so regeneration keeps them.
4. Probe in `scripts/api/probes.ts` under the same id (`tests/api-catalogue.test.ts` fails
   if checked entries and probes disagree, or a `plugin` method doesn't exist).
5. Schema **without a token**: save one or more responses through `live-api.sh`, then
   `npm run api:record-file -- <id> <a.json> [b.json…] [--unwrap healthStatusSummary]`.
   (`npm run api:record` needs `.garmin-token.json` / `GARMIN_TOKENS`, which Garmin may
   rotate — don't use it here.) Every `critical` path must exist in the recorded shape.
6. If the sync stores it: a `defineDayIndex` / intraday registration (see the foundation's
   docs in `docs/architecture.md`), gated by an existing `MetricGroup`.

Range endpoints cap at 28 days; days with no watch data are omitted, not zero-filled.
GraphQL (`POST /graphql-gateway/graphql`) is the only route to Health Status, Health
Snapshots, cycling ability and My Day events.
