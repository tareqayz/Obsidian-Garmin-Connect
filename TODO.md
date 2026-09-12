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
- Dashboard: the workouts group has no chart yet — only the table view shows it.
- The "stop after empty days" guard cannot tell a genuine gap (a month without
  the watch) from the end of your history. It names the date it stopped at so you
  can re-run a narrower range, but detecting the account's real start date — if
  Garmin exposes one — would be better.
- Dashboard: consider a distance/calories chart; both are synced but unplotted.
- Consider applying the daily-note template when creating a missing note.
  Currently creation makes an empty file, because expanding only some of a
  template's placeholders would be worse than expanding none.
- CI/CD pipeline : run automated tests on Garmin API and auth, ensuring nothing has changed - if something has, flag it and see if you can run an agent for an immediate to PR.
