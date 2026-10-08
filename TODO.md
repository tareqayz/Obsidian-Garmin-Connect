- Home (Garmin Connect rebuild), shipped 2026-09-25 on `feature/home-dashboard`:
  - Not built yet: Edit Home (choosing cards for Essentials and In Focus), and
    tapping a card through to its detail screen.
  - At a Glance's See All page, its edit mode and all 36 cards landed
    2026-09-26. Garmin's own edit screen for At a Glance was not in the
    reference screenshots, so it follows the app's other edit screens (Cancel /
    Save, red remove badges, grips) plus the Add a Stat sheet that was
    captured. Check it against the phone.
  - Running Economy has no history in the sync (only `runningeconomy/latest`),
    so its card leaves out the app's "Last 4w" trend line. The marker's place
    inside its class comes from limits inferred from one reading (223–224,
    Intermediate); more readings would confirm or correct them.
  - Health Status only ever shows the onboarding prompt while any metric is
    still ONBOARDING, as the app did on 2026-09-24. Its data state is designed
    (Figma) but has not been seen on the phone.
  - VO2 Max cards look back 28 days, matching the app hiding a cycling VO2 Max
    from October 2025. The exact window Garmin uses is a guess.
  - Challenges has no endpoint in the sync; the card is Garmin's empty state.
  - These links point at connect.garmin.com pages that have not been checked:
    Find a Plan, Find a Challenge, and At a Glance's Add a Reading
    (`/modern/blood-pressure`), Track Hydration (`/modern/hydration`), Start
    your Free Trial (`/modern/nutrition`) and the Weight card's + (`/modern/weight`).
  - Retire the classic dashboard once Home and the detail screens cover it.
- Activities (Garmin Connect rebuild), built 2026-10-03 on `feature/activites`:
  - Next: the activity detail screen (activity and record rows are not
    clickable until it exists), then Create Manual Activity, Epics and Golf.
  - Inferred, with no phone screenshot to check against: the Time, Ascent and
    Calories tabs, the 1y list and month page, the sub-type picker, and every
    sport but Running. In particular: the Time chart's minutes for a day and
    hours for a month, the period label's year once a period is not this
    year's, Gym's records opening on Strength, and Multisport getting the
    running tabs. Check them against the phone.
  - Check on the phone that yoga, stair climbing and mobility appear under Gym &
    Fitness Equipment and meditation under Other, and whether October 2025's
    running total is about 161 km (the index leaves the 70.3's legs out, as
    the list does) or about 182 km.
  - Strength records are formatted as kilograms on a guess (grams above
    1000): no account here has one to check.
  - The Cycling records tab's "2" badge in the app is not built; its source
    is unknown.
  - Sub-type names come from Garmin's type keys, with a few of the app's own
    names (Road Cycling, Pool Swimming); others may differ from the app.
  - On macOS the sub-type picker is Obsidian's menu, which follows the
    "Native menus" setting, so it can look nothing like the Figma sheet.
- Steps, Floors and Intensity Minutes (Garmin Connect rebuild), built
  2026-10-04 on `feature/activites`. Every number on the 18 phone screenshots
  reproduces from the daily stats index; these are inferred and need checking
  on the phone:
  - Steps 1y by the week, a past day that met its goal (green ring and check),
    an Intensity day that crosses the goal, and a week short of it (blue ring,
    no message, the message's line left empty).
  - Steps and Floors 7d / 4w are taken to be the days ending today, and
    Intensity's to be calendar weeks: the screenshots were taken on a Sunday,
    when the two agree. Check on a weekday.
  - The day label for older days ("Thu, Oct 1"), and a same-month range
    written "Jan 12 - 18".
  - Floors' axis keeps the goal off its top edge (one floor with a goal of 10
    draws 20/10/0, as the app did): one screenshot's worth of evidence.
  - Tapping a day in a list opens its 1d page. Unchecked in the app.
  - Intensity weeks run Monday to Sunday although this account's
    `firstDayOfWeek` is Sunday; check with an account set to start on Monday
    whether anything moves.
  - Series files written before 2026-10-04 have no floors, minutes or
    `dayStart`: their day charts sit on this computer's clock, and Intensity's
    week falls back to a step at each day's start. They fill in as days sync.
  - Steps' Help, the ⋮ menu and Edit Goal are not built.
- Sleep (Garmin Connect rebuild, Health Stats), built 2026-10-07 on
  `feature/health-stats`. Every number on the 36 phone screenshots reproduces
  from the sleep index and the series file; these are inferred and need checking
  on the phone:
  - The 4w page (no screenshot): the nights ending today, cards for each night,
    the score line broken at a night without sleep, and the bedtime axis
    starting on the odd hour at or before the earliest bedtime (7 PM when one
    night began at 8:54 PM; the Figma frame drew 9 PM).
  - The Sleep Coach with an adjusted need: its wording ("You need a little less
    sleep tonight…"), the dashed box between need and baseline, and the Sleep
    History card and sheet. Oct 7's need (6h 30m, DECREASED by sleep history)
    is the only adjusted night on this account. HRV, training and nap
    adjustments get a card each with no sheet behind it.
  - Phrase tables: only `POSITIVE_HIGHLY_RECOVERING` and one personalized
    insight were seen; any other key shows its words read plainly
    ("Long and deep" for `POSITIVE_LONG_AND_DEEP`).
  - Awake/Restlessness is rated the worse of Garmin's awakeCount and
    restlessness verdicts; both were Excellent on every night seen.
  - The overlay chips appear only with data: Breathing Variations and Pulse Ox
    never do on this watch, and `breathingDisruptionSeverity` is a documented
    field name not yet observed.
  - Nights synced before 2026-10-07 have no `sleep` block in their series file:
    their 1d page shows the index's summary (score, verdict, stages ring,
    metrics) without factors, timeline or coach. Re-sync a range to fill them.
  - The factor pages leave out Garmin's articles and links; Add Notes, Help and
    the ⋮ menu are not built.
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
- DONE 2026-09-25: VO2 Max and training status fixes confirmed live (vo2max in
  153 of 420 notes, training_status in 419). History of the bug:
- (was OPEN) VO2 Max never populates, and it is NOT the range-length bug.
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
- Home's "today" is fixed when the view opens: a Home view left open past midnight keeps
  yesterday's date until it is reopened or the plugin reloads, so every page's offsets
  and "Yesterday"/"Today" labels are a day behind (seen 2026-10-08 01:30). Recompute
  today on a timer or on focus.
- Stress (Garmin Connect rebuild, Health Stats), built 2026-10-08 on `feature/health-stats`
  through the /garmin-page pipeline. Every golden number in `ref/health-stats/stress/README.md`
  reproduces live; these still need the phone:
  - The 1d timeline drawing (Active as full-height grey bars, Unmeasurable blank, the clock
    marker, GMT offsets on 23/25 h days): the first capture ran between midnight and 04:00,
    when the iPhone app shows no timeline. A re-shoot is in `phone/1d-r/`.
  - A 1d day before 2026-06-01 (no intraday samples on this account): numbers with an empty
    plot is inferred.
  - Copy for the STRESSFUL, *_AWAKE and VERY_STRESSFUL qualifiers, and CALM's present tense:
    unseen; they fall back to the web's "Your stress level was N out of 100."
  - Lowest / Highest (web only) are computed but not shown, as on the phone.
  - Dark "Low" uses Home's stress-glance colour (#986732); a paler #F2C18C reads more like
    Garmin's but would not match Home.
