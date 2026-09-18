# Recorded response shapes

One file per endpoint the daily check covers, written by `npm run api:record`.
Each is the **union of every response ever observed** at that path, not the last
one — which is what lets the check tell "Garmin dropped a field" apart from "the
account had a quiet day".

```jsonc
{
  "endpoint": "training-readiness",
  "path": "/metrics-service/metrics/trainingreadiness/{date}",
  "plugin": "GarminApi.trainingReadiness",
  "firstRecorded": "2026-09-18T06:17:04.000Z",
  "updatedAt": "2026-09-19T06:17:11.000Z",
  "samples": 6,                       // cumulative responses folded in
  "shape": {
    "type": ["array"],
    "items": {
      "type": ["object"],
      "fields": {
        "score":  { "type": ["null", "number"] },
        "level":  { "type": ["string"] },
        "feedbackShort": { "type": ["string"], "optional": true }
      }
    }
  }
}
```

- `type` is the sorted union of everything seen at that position.
- `optional` marks a field that was absent from at least one object that had
  siblings — so its absence is never reported as a removal.
- `items` is every array element merged into one shape.

No response *values* are stored, only field names and types. These files are
safe to read in a pull request and safe to paste into an issue.

The shape language and the diff live in `scripts/api/schema.ts`, with tests in
`tests/api-schema.test.ts`.
