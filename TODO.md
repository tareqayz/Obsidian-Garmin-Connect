# TODO

Known gaps and open questions, by area.
- **Inferred** means built without a phone screenshot to compare against.
- **Check on the phone** means comparing against the Garmin Connect app.
- Specs named as `ref/…` live only on the maintainer's machine (`ref/` is
  gitignored, because it holds personal screenshots).

## Next up

- **Performance Stats and the activity detail screen.**
  - The classic dashboard, retired in 0.2 (d32f311), was the only place with
    history charts for HRV, training readiness, recovery, training status and
    load, VO₂ max, endurance and race predictions. It also had the
    per-activity detail (splits, heart-rate zones, elevation).
  - Home's At a Glance cards show the latest values, and the notes keep the
    history.
  - Rebuild them as Garmin's Performance Stats pages and activity detail,
    through `/garmin-page`.
  - Activity and record rows are not clickable until the detail exists.
- **Edit Home**: choosing the cards for Essentials and In Focus.
- **An in-app way to backfill.** The classic dashboard's "Backfill…" button was
  the only one; "Sync a date range…" is now reachable from the command palette
  alone. Design it in Figma first.
- **Remove `LegacyDashboardView`** (`src/dashboard/legacy-view.ts`) in the
  release after 0.2. It only turns tabs saved with the classic dashboard into
  Home.

## Home

- Home's "today" is fixed when the view opens. A Home view left open past
  midnight keeps yesterday's date until it is reopened or the plugin reloads,
  so every page's offsets and "Yesterday"/"Today" labels are a day behind (seen
  2026-10-08 01:30). Recompute today on a timer or on focus.
- **Health Status's onboarding prompt.**
  - Home's Health Status card shows only its onboarding prompt ("Wear your
    device while sleeping for about 3 weeks") while any metric is still
    ONBOARDING, as the app did on 2026-09-24.
  - On this account that is for good: Pulse Ox has been ONBOARDING since
    2026-09-02 ("Not enabled during sleep") while the other metrics have data.
  - The card's data state is designed (Figma) but has not been seen on the
    phone. Check what the app's Home shows and match it.
- At a Glance's edit mode copies the app's other edit screens (Cancel / Save,
  red remove badges, grips) plus the Add a Stat sheet that was captured.
  Garmin's own At a Glance edit screen was never captured. Check on the phone.
- Running Economy has no history in the sync (only `runningeconomy/latest`), so
  its card leaves out the app's "Last 4w" trend line. The marker's place inside
  its class comes from limits inferred from one reading (223–224,
  Intermediate).
- VO₂ Max cards look back 28 days, matching the app hiding a cycling VO₂ Max
  from October 2025. The exact window Garmin uses is a guess.
- Challenges has no endpoint in the sync; the card is Garmin's empty state.
- **Links to connect.garmin.com.** These still use `/modern/...` paths and have
  never been checked:
  - Find a Plan, Find a Challenge;
  - At a Glance's Add a Reading (`/modern/blood-pressure`);
  - Track Hydration (`/modern/hydration`);
  - Start your Free Trial (`/modern/nutrition`);
  - the Weight card's + (`/modern/weight`).

  The web app's own deep links are `/app/...`.

## Activities

- Create Manual Activity, Epics and Golf are not built.
- **Inferred**, with no phone screenshot to check against:
  - the Time, Ascent and Calories tabs;
  - the 1y list and the month page;
  - the sub-type picker;
  - every sport but Running.

  In particular check:
  - the Time chart's minutes for a day and hours for a month;
  - the period label's year once a period is not this year's;
  - Gym's records opening on Strength;
  - Multisport getting the running tabs.
- **Check on the phone:**
  - that yoga, stair climbing and mobility appear under Gym & Fitness
    Equipment, and meditation under Other;
  - whether October 2025's running total is about 161 km (the index leaves the
    70.3's legs out, as the list does) or about 182 km.
- Strength records are formatted as kilograms on a guess (grams above 1000): no
  account here has one to check.
- The Cycling records tab's "2" badge in the app is not built; its source is
  unknown.
- Sub-type names come from Garmin's type keys, with a few of the app's own names
  (Road Cycling, Pool Swimming); others may differ from the app.
- On macOS the sub-type picker is Obsidian's menu, which follows the "Native
  menus" setting, so it can look nothing like the Figma sheet.

## Steps, Floors and Intensity Minutes

Every number on the 18 phone screenshots reproduces from the daily stats index.
These are inferred:
- Steps 1y by the week, a past day that met its goal (green ring and check), an
  Intensity day that crosses the goal, and a week short of it (blue ring, no
  message, the message's line left empty).
- Steps and Floors 7d / 4w are taken to be the days ending today, and
  Intensity's to be calendar weeks: the screenshots were taken on a Sunday, when
  the two agree. Check on a weekday.
- The day label for older days ("Thu, Oct 1"), and a same-month range written
  "Jan 12 - 18".
- Floors' axis keeps the goal off its top edge (one floor with a goal of 10 draws
  20/10/0, as the app did): one screenshot's worth of evidence.
- Tapping a day in a list opens its 1d page. Unchecked in the app.
- Intensity weeks run Monday to Sunday although this account's `firstDayOfWeek`
  is Sunday; check with an account set to start on Monday whether anything moves.

Two more:
- **Old series files.** Files written before 2026-10-04 have no floors, minutes
  or `dayStart`. Their day charts sit on this computer's clock, and Intensity's
  week falls back to a step at each day's start. They fill in only when a sync
  covers those days among its newest seven, so sync a range over them.
- Steps' Help, the ⋮ menu and Edit Goal are not built.

## Sleep

Every number on the 36 phone screenshots reproduces from the sleep index and the
series file. These are inferred and need checking on the phone:
- **The 4w page** (no screenshot):
  - the nights ending today, with cards for each night;
  - the score line broken at a night without sleep;
  - the bedtime axis starting on the odd hour at or before the earliest
    bedtime (7 PM when one night began at 8:54 PM; the Figma frame drew 9 PM).
- **The Sleep Coach with an adjusted need.**
  - Its wording ("You need a little less sleep tonight…"), the dashed box
    between need and baseline, and the Sleep History card and sheet.
  - Oct 7's need (6h 30m, DECREASED by sleep history) is the only adjusted
    night on this account.
  - HRV, training and nap adjustments get a card each with no sheet behind it.
- Phrase tables: only `POSITIVE_HIGHLY_RECOVERING` and one personalized insight
  were seen; any other key shows its words read plainly ("Long and deep" for
  `POSITIVE_LONG_AND_DEEP`).
- Awake/Restlessness is rated the worse of Garmin's awakeCount and restlessness
  verdicts; both were Excellent on every night seen.
- The overlay chips appear only with data: Breathing Variations and Pulse Ox
  never do on this watch, and `breathingDisruptionSeverity` is a documented field
  name not yet observed.

Not inferred, but still to do:
- **Nights synced before 2026-10-07** have no `sleep` block in their series
  file. Their 1d page shows the index's summary (score, verdict, stages ring,
  metrics) without factors, timeline or coach. Re-sync a range to fill them.
- The factor pages leave out Garmin's articles and links; Add Notes, Help and the
  ⋮ menu are not built.

## Health Stats

All built through `/garmin-page`; each stat's golden numbers reproduce live. Still
provisional:

- **Stress** (spec `ref/health-stats/stress/`):
  - **The 1d timeline drawing** — Active as full-height grey bars, Unmeasurable
    blank, the clock marker, GMT offsets on 23/25 h days. The first capture
    ran between midnight and 04:00, when the app shows no timeline; a re-shoot
    is in `phone/1d-r/`.
  - A 1d day before 2026-06-01 (no intraday samples on this account): numbers
    with an empty plot is inferred.
  - Copy for the STRESSFUL, *_AWAKE and VERY_STRESSFUL qualifiers, and CALM's
    present tense, is unseen; they fall back to the web's "Your stress level
    was N out of 100."
  - Lowest / Highest (web only) are computed but not shown, as on the phone.
  - Dark "Low" uses Home's stress-glance colour (#986732). A paler #F2C18C
    reads more like Garmin's but would not match Home.
- **Heart Rate:**
  - The 1d gradient stops use Garmin's DEFAULT zones for a max HR of 204,
    because pages can't read the account's zones. `zoneFloorsOf`/`zoneOf`,
    which read them, were removed unused in e4a6a74; restore them from there
    when the line is coloured by zone.
  - Move IQ and activity rows under the 1d figures are not drawn.
  - Pane chart frames reuse Stress's measurements.
- **Body Battery:**
  - The factor sheets lack the impact chart and time range, because the series
    block drops the event arrays.
  - Timeline activity markers are not drawn.
  - The pane factor dialog is a page overlay, not an Obsidian Modal.
  - The copy is known for 6 of about 50 feedback types.
  - Dial and chart frames are estimated.
- **Respiration:**
  - The 1d "Active" chip and blocks have an unknown source.
  - The High/Low Rates chip isn't remembered.
  - Pane layouts are checked only by tests.
  - Low dots and Active grey read alike.
- **Health Status:**
  - The out-of-range states and the Pulse Ox detail are inferred, in Figma and
    in code (no shots).
  - The HRV sheet omits "HRV Status Range", which is not in the sleep index.
- **Fitness Age, Health Snapshot and Weight:**
  - Their panes stretch the phone chart instead of using the pane frames.
- **Weight:**
  - The index stores height on every row (`h`); move it to `account.json`'s
    `profile.heightCm`.
  - 7d/4w "Change" (last − first day) is inferred.
- **Pulse Ox Acclimation:**
  - Uses the segmented control, not the twin's underlined tabs.
  - Its elevation area groups by UTC day (inferred).
- **Blood Pressure:** the reading layout is inferred; this account has no
  readings.
- **Lifestyle Logging** is Garmin's empty state only.

## Sync and the Garmin API

- **Schema re-records and catalogue notes** listed in each stat's spec are not
  done yet (`npm run api:record-file`, from the samples in `ref/`):
  - stress, heart-rate, body-battery;
  - fitness-age, health-snapshot, health-status;
  - lifestyle-logging, pulse-ox, pulse-ox-acclimation.

  Related gaps:
  - the catalogue note on `daily-acclimation-stats` is probably wrong;
  - `blood-pressure-last` has no schema file;
  - `graphql-health-status` and `daily-weigh-ins` have no `reads`.
- **Eighteen checked endpoints have no caller in the plugin.** The daily
  contract check spends a request on each:
  - activities-for-day, daily-events, lifestyle-logging-data, naps
  - blood-pressure-day, blood-pressure-last, weekly-blood-pressure
  - health-snapshot-detail, health-status-summary
  - heart-rate-zones, hrv-data-range, rhr-day, weekly-heart-rate
  - weekly-fitnessage, weekly-stress
  - weekly-weigh-ins, weight-goal, weight-latest

  Wire them up, or set `check: false` in `api/endpoints.json`.
- **Unobserved paths.** The recording (`npm run api:record`, 2026-09-26)
  confirmed every path `mapDay` reads except these:
  - `maxMetrics.cycling.*`, null on this account;
  - `maxMetrics.generic.fitnessAge`, only ever null;
  - the sleep SpO2 and breathing fields.

  `api/endpoints.json` still lists stale `reads` for training status (top-level
  `latestTrainingStatusData`, `acuteTrainingLoadDTO.*`) and for max metrics
  (`[].calendarDate`).
- **Verify MFA against a live challenge.**
  - The flow is wired end to end: `loginWithMfa()` in `src/garmin/auth.ts` asks
    for a code through `LoginOptions.onMfaRequired`, and retries up to
    `MFA_MAX_ATTEMPTS` on a refusal. The sign-in modal and diagnostics steps 2
    and 3 all supply the prompt. Fixtures in `tests/auth.test.ts` cover it.
  - Fixtures cannot settle two things, both needing an account with MFA on.
    First, whether Garmin honours the `CASTGC` / `GARMIN-SSO` / `SESSION`
    cookies `CookieJar` carries from the login POST into the verify POST: phase
    0 confirmed they arrive, not that they work. Second, the exact
    `responseStatus.type` a wrong code comes back with.
  - Until that second one is observed, any refusal the flow cannot classify by
    shape is treated as a retryable bad code. That is right for a typo and
    wrong for a dead SSO session; the attempt cap bounds the difference. If a
    live run shows a distinct type for "your code was wrong", classify on it
    and make the rest fatal.
- Check behaviour under sync load: many `connectapi` calls in sequence, now
  that the history syncs walk years of data in a session.
- **One session for every device.**
  - The refresh token lives in `data.json`, which travels with the vault when
    its sync copies plugin settings, so every device shares one session.
  - Find out whether two devices refreshing the same token conflict.
  - If they do, decide whether the session should stay per device.

## Platform and release

- Test on Android: a different native HTTP stack, so a third TLS fingerprint
  after desktop and iOS ([measured ones](docs/garmin-api.md#tls-fingerprints)).
- **Before a community directory submission:**
  - use `setHeading()` for the settings headings rather than raw `<h3>`;
  - a sentence-case pass over UI text;
  - replace `setDynamicTooltip()`, deprecated in Obsidian 1.13's typings;
  - bump to 1.0.0.

  See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md#before-the-first-directory-submission).
