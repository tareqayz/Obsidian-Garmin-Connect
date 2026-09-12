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
- Sync engine: date range → frontmatter → daily notes, idempotent.
- Real sign-in UI; retire the diagnostics modal or hide it behind a debug setting.
