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
- Verify the HRV and training-readiness payload shapes against a live account.
  `mapDay` reads `hrvSummary.lastNightAvg` / `.status` and `readiness[0].score`
  defensively, but those shapes were inferred from the endpoint paths, not seen.
  If a property never appears, that is the first place to look.
- Polish the UI; retire the diagnostics modal or hide it behind a debug setting.
- Consider applying the daily-note template when creating a missing note.
  Currently creation makes an empty file, because expanding only some of a
  template's placeholders would be worse than expanding none.
