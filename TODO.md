- Verify MFA
  - `verifyMfa()` in `src/garmin/auth.ts` is written and typechecked but has
    never run — the test account is never challenged.
  - `GarminClient.login()` raises `GarminMfaRequiredError` rather than
    pretending to handle it, so nothing silently half-works.
  - The leg depends on cookie continuity between the login POST and the verify
    POST. `CookieJar` carries `CASTGC` / `GARMIN-SSO` / `SESSION` across them;
    phase 0 confirmed those cookies arrive, but not that Garmin accepts them here.
  - Needs an account with MFA switched on to finish and verify.
- Test on Android — different native HTTP stack, so a third TLS fingerprint.
  Desktop and iOS JA4s are recorded in the README.
- Check behaviour under sync load — many `connectapi` calls in sequence.
- Verify payload shapes against a live account. `mapDay` reads these defensively,
  but they were inferred from the endpoint paths rather than observed:
  `hrvSummary.lastNightAvg` / `.status`, `readiness[0].score`,
  `maxMetrics.generic.vo2MaxPreciseValue` / `.fitnessAge`,
  `maxMetrics.cycling.vo2MaxPreciseValue`, `enduranceScore.overallScore`, and
  `racePredictions[].time5K` / `time10K` / `timeHalfMarathon` / `timeMarathon`.
  If a property never appears in a note, that is the first place to look.
- Fitness age and cycling VO2 Max are synced and appear in the table, but have no
  tile or chart of their own yet.
- OPEN: VO2 Max never populates, and it is NOT the range-length bug.
  Evidence from a 407-day vault: endurance score in 393 notes, race predictions in
  exactly the 5 days of the recent-sync window (syncDays=5), VO2 Max in 0.
  So the same short window that successfully fetched race predictions got no VO2
  Max — and since race predictions are derived from VO2 Max, Garmin plainly has
  the data. That points at a wrong URL or a wrong field name in
  `GarminApi.maxMetrics` / `mapDay`, not at an absent metric.
  Run probe step 4 ("Inspect fitness endpoints") and compare the printed keys
  with what `src/sync/metrics.ts` reads.
- Customizable layouts - resizeable widgets - advanced widget settings - default layout + can make multiple different layouts (different dashboard pages)