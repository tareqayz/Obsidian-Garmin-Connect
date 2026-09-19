- Verify MFA against a live challenge
  - The flow is wired end to end: `loginWithMfa()` in `src/garmin/auth.ts` asks
    for a code through `LoginOptions.onMfaRequired`, retries up to
    `MFA_MAX_ATTEMPTS` on a refusal, and the sign-in modal and probe checks 2
    and 3 all supply the prompt. Covered by fixtures in `tests/auth.test.ts`.
  - Two things fixtures cannot settle, both needing an account with MFA on:
    whether Garmin accepts the `CASTGC` / `GARMIN-SSO` / `SESSION` cookies
    `CookieJar` carries from the login POST into the verify POST — phase 0
    confirmed they arrive, not that they are honoured here — and the exact
    `responseStatus.type` a wrong code comes back with.
  - Until that second one is observed, any refusal the flow cannot classify by
    shape is treated as a retryable bad code. Right for a typo, wrong for a dead
    SSO session; the attempt cap is what bounds the difference. If a live run
    shows a distinct type for "your code was wrong", classify on it and make the
    rest fatal.
- Test on Android — different native HTTP stack, so a third TLS fingerprint.
  Desktop and iOS JA4s are recorded in the README.
- Check behaviour under sync load — many `connectapi` calls in sequence.
- Verify payload shapes against a live account. `npm run api:record` now does
  this in one command: it fetches every endpoint the sync uses and writes the
  observed field names and types to `api/schema/`, and
  `tests/api-catalogue.test.ts` then fails if any path below is not in that
  recording. Until it has been run once, these remain inferred from the endpoint
  paths rather than observed:
  `hrvSummary.lastNightAvg` / `.status`, `readiness[0].score`,
  `maxMetrics.generic.vo2MaxPreciseValue` / `.fitnessAge`,
  `maxMetrics.cycling.vo2MaxPreciseValue`, `enduranceScore.overallScore`, and
  `racePredictions[].time5K` / `time10K` / `timeHalfMarathon` / `timeMarathon`.
  If a property never appears in a note, that is the first place to look.
- Cycling VO2 Max is synced and appears in the table, but has no card of its own.
  Fitness age now has one. The awkward part is that it is only meaningful for
  accounts that ride, so a card would be empty for most people — the availability
  filter already handles that, it just has not been written.
- OPEN: VO2 Max never populates, and it is NOT the range-length bug.
  Evidence from a 407-day vault: endurance score in 393 notes, race predictions in
  exactly the 5 days of the recent-sync window (syncDays=5), VO2 Max in 0.
  So the same short window that successfully fetched race predictions got no VO2
  Max — and since race predictions are derived from VO2 Max, Garmin plainly has
  the data. That points at a wrong URL or a wrong field name in
  `GarminApi.maxMetrics` / `mapDay`, not at an absent metric.
  Run probe step 4 ("Inspect fitness endpoints") and compare the printed keys
  with what `src/sync/metrics.ts` reads — or run `npm run api:record` and read
  `api/schema/max-metrics-range.json`, which answers the same question and
  leaves the answer committed.
- Layouts: two follow-ups deliberately left out of the first cut.
  - A layout cannot pin its own date range. A "Sleep" layout probably always
    wants 90 days, but the filter bar is global, and making it per-layout means
    the range chips have to say which of the two they are obeying. Per-*widget*
    range overrides do exist, under the widget's ⋯ menu.
  - No import or export. The stored shape in `data.json` is already portable, so
    this is small, but it needs the reader to be exercised against hand-written
    input — `readLayouts` drops unknown block types and unknown card ids today,
    which is the behaviour an import has to rely on.
- The new mappings in `mapDay` for `body`, `training`, respiration, pulse ox and
  the extra sleep, stress and readiness fields were written from Garmin's field
  names rather than from observed responses. They are listed under `reads` in
  `api/endpoints.json`, so one `npm run api:record` run reports exactly which of
  them are real — anything coming back `missing` is reading a key Garmin does not
  send. That is the same failure mode as the VO2 Max item above.