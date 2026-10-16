# TODO

Known gaps and open questions, by area.
- **Inferred** means built without a phone screenshot to compare against.
- **Check on the phone** means comparing against the Garmin Connect app.
- Specs named as `ref/…` live only on the maintainer's machine (`ref/` is
  gitignored, because it holds personal screenshots).

## Next up

- **Performance Stats: check the Inferred items.** Every page is built (see
  "Performance Stats" below; status board `ref/performance-stats/STATUS.md`).
  What's left is checking the Inferred items against the phone — above all a
  weekday set of shots and the previous periods — and the Figma follow-ups
  listed there.
- **Cycling Ability and Altitude Acclimation** were left out of Performance
  Stats (2026-10-11): no phone shots, and no altitude data at sea level. Each
  gets its own branch when shots exist.
- **Edit Home**: choosing the cards for Essentials and In Focus.
- **Remove `LegacyDashboardView`** (`src/dashboard/legacy-view.ts`) in the
  release after 0.2. It only turns tabs saved with the classic dashboard into
  Home.

## Performance Stats

Built from the 2026-10-11 phone shots (`ref/performance-stats/`). **Inferred**
items, to check on the phone:

- **All pages:** previous periods (‹) were not shot; the shots are from a
  Sunday, so rolling 4w / 12w spans and Monday-aligned weeks look the same —
  a weekday set settles it; Help sheets are left out; the wide-pane layouts
  are ours.
- **VO₂ Max:** the cycling tab's ranges show Garmin's web copy "You have no
  data for this time period."; Current with no reading shows "No data
  available"; the y step becomes 2 past a spread of 4; the copy for Good,
  Fair and Poor; no "Yesterday" label; the running dial's marker sits about 3°
  short of the shot's (the rule's 279.8° against 283.0°), and Hill Score's VO₂
  sheet inherits it.
- **HRV Status:** the dial's band gaps are fixed fractions (no linear rule
  fits) and its marker sits 1.5° short; the copy is known for 2 of Garmin's 21
  feedback phrases; Unbalanced and Low dials were never seen; the 7d axis's
  bottom tick rule is a guess; gaps in a night's readings are bridged.
- **Race Predictor:** turning a chip off keeps the axis (the twin's choice)
  and the last chip stays on; a period without data hides the legend and
  chips; imperial units.
- **Hill Score:** the copy for 19 of 21 phrases; factor words other than
  "Low"; the marker's colour where the drawn band and the class disagree
  (scores 25, 50–51, 70–71, 85); calibrating and pre-history days; October's
  month page.
- **Training Status:** 6m was not shot (the daily strip over 182 days, labels
  every 26 days); the copy for 27 of Garmin's 28 status phrases, and the Load
  Focus words other than "Low Aerobic Shortage"; "…Cycling VO₂ Max Trend";
  the Paused status, and the No Status and Paused colours; Current before the
  watch syncs (yesterday's row).
- **Load:** the Load Focus titles and copy other than Low Aerobic Shortage,
  and the load copy for every status but Optimal; the bars' stacking order
  (legend order from the bottom); list rows for sports other than running
  (ours: a chevron to the page, as a run's; no distance on stair climbing); a
  ratio above 2.3 ("2+"); miles.
- **Endurance Score:** the 1y Endurance Score tab was not shot; days other
  than today, and today before the watch syncs; a week without a scored day;
  the colours of groups and types not seen here (ours: a type of its own is
  pink, Multisport purple); the class ids of Recreational, Intermediate and
  Elite; where the phone's 1d legend wraps.
- **Heat Acclimation:** only "Trending up" was shot — the other trends' glyph,
  line and copy are ours ("Trending down from N%.", "Maintaining
  acclimation.", no copy); 72°F for imperial accounts; a day without a row,
  and the 0% state; the line bridging the history's Jan 5–9 gap.
- **Training Readiness:** a past day on the phone (ours: the first reading
  after waking, as the web shows it — and the first of several wake-ups);
  the words after "Updated @" for a realtime update; recovery hours floored,
  and "Low Need" / "Moderate Need"; factor words for unseen bands; the title
  and copy for 35 of Garmin's 38 titles and 78 of its 80 copy keys, and most
  sheets' copy; the dial below 4.1 or above 97.9 and the marker colour per
  level; the HRV sheet's Overnight Averages chip; the Sleep Score sheet below
  its legend; empty, onboarding and no-sleep states.
- **Training Effect:** a day with several activities (ours: each chart's day
  maximum, as the web draws it); benefit labels other than Threshold, and the
  band titles and copy other than aerobic 4.x and anaerobic 0.x; the related
  activity's disc for sports the phone hasn't shown (ours: the type table's
  colour, else neutral) and what it opens (ours: the activity's page); a
  detail whose activity is gone; a 0.0 / 0.0 activity (a card, no bar); the
  640–999 pt layout.
- **Running Tolerance:** the current week's header on a weekday (ours: "OCT 11
  - 12") and past years' headers; the copy for 7 of Garmin's 8 phrases; the
  ring at or over the tolerance (ours: orange, full); Help. Garmin's own
  weekly rows disagree with its days six times between Jul 19 and Sep 12,
  2026; the page shows the weeks as sent, as the app does.
- **FTP:** Current once an FTP is over a year old (Cycling's is from
  2026-10-13; ours: Garmin's empty state, as Cross Country Skiing shows it)
  and Cross Country Skiing with a fresh FTP; Cross Country Skiing's 4w / 12w
  / 1y in Watts; previous periods and the empty period; the y axis beyond
  these shots; a week block with two different rows (ours: the last); 12w and
  1y blocks on a weekday; the unit after a range change (ours: back to
  Watts); where "Learn how to update your … FTP" leads; Help.
- **Running Lactate Threshold:** previous periods; 12w's block rule (ours:
  each block's last change) and 12w / 1y on a weekday; the empty states and
  "--" on Current, and Current with only some figures; the chip after a range
  change (ours: back to Pace); imperial paces; tapping or scrubbing a point;
  the axis rule beyond these shots; Help.
- **Running Economy:** previous periods; the empty and single-point periods;
  Current with no reading ever, and "Today" for a same-day reading; the copy
  for six of Garmin's seven classes; the dots, line and legend colours for
  classes other than Intermediate and Trained; y steps other than 1 and 5;
  the 1y axis when the last block starts after the last month; the marker on
  a class boundary; tapping a point; Help.
- **Cycling Power Curve:** previous periods; 3m and 1y scrolled; the 1y empty
  line's wording; a tap on a record's date (ours: its ride's page) or the
  chart (ours: none); other cycling types counting, and a ride left out of the
  power curve; the 5-hour row filling; ties (ours: the earliest ride); the y
  axis above 1,000 W; spans on a weekday; a multisport bike leg with power. A
  record deleted on Garmin keeps showing until that ride is listed again
  (Sync activity history).
- **Critical Swim Speed and HRV Stress** have never had data on this account,
  so only their empty states are 1:1. Inferred: everything with data — CSS's
  dated pace, its points (a day on 7d, a week block on 12w / 1y), the y axis
  and the results rows (date format unknown), several results on a day; HRV
  Stress's daily 0–100 bars and anything under them; the index field names
  (bump each index's `version` when the first real row arrives); statute
  units; the ⋮ menu and Help; "‹" stops at an empty history (ours; the phone
  keeps it on).
- **Figma follow-ups** (file 8D338zFIJ1a2zrsuligjva; the shared Performance band
  was tidied on 2026-10-12 — new shared Period Arrow / Nav, Segmented, More
  Button, Glyph Disc, Stats, Legend Row, Chart Heading, an Economy dial kind,
  48 variables and 13 text styles): swap each page's local copies (Period
  Arrow / Nav above all) for the shared ones; re-link page text to the new
  styles; move existing Title Bars to the new Action variants (None / Help /
  More) and re-measure an Edit variant; a wide stepper with a 17 pt Semi Bold
  label for Training Effect.

## Home

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
- Type names come from the type table (`src/dashboard/activity-types.ts`): the
  phone's where a shot shows them, else the web's type select; five are
  Inferred.
- On macOS the sub-type picker is Obsidian's menu, which follows the "Native
  menus" setting, so it can look nothing like the Figma sheet. So is All
  Activities' Sort.
- **All Activities** (`ref/activities/all-activities/`, Figma `87:5` and twin
  `87:9`). **Inferred**, no shot to check against:
  - a ticked type row; "All <Group>" and its sub-types unticking each other;
  - chips other than types, their order (as chosen) and the row's end;
  - the footer with filters set ("Show 1 Activity") and Clear All enabled;
  - a picked date range, in the fields and on the calendar;
  - moved slider thumbs, the track outside them, typed values, the steps;
  - an event type chosen, and whether several can be;
  - Favorites and Personal Records on, and what the records switch counts;
  - a typed search, its results, its clear button and the no-results state;
  - the unopened groups' type names (the web's; Safety's guessed);
  - the discs of every group but Running, Cycling, Gym and Swimming;
  - a card from another year, a long name, imperial units, a yard pool;
  - the singular count, "1 ACTIVITY"; the shot's third chip, "All Hiking";
  - in the twin: both Sort menus (never rendered); the month and year pickers.
- **All Activities, shots still wanted:** a typed search, an event type chosen,
  Favorites and Personal Records on, the chip row scrolled to its end, and the
  Parasports, Water, Team, Racket, Other and Safety groups opened.
- After an index's version moves (the activity index's to 3), its pages say
  "<X> history isn't synced" while they still show its rows, until the history
  is listed again. Words such as "needs updating" would fit better.

## Activity details

Every sport has a page, each built from one activity's shots
(`ref/activity-details/`): runs (outdoor, trail, track, treadmill) from an
outdoor run (`outdoor-run/`, Figma `364:2` and twin `402:2`); rides from a road
ride with power pedals (`road-cycling/`, `886:2` and `886:5`); the swims from a
pool and an open-water swim (`pool-swim/` and `open-water-swim/`, `886:3` and
`886:6`); every other sport from a Stair Stepper session (`basic/`, `886:4` and
`886:7`).

- **Check on the phone** (again after the 2026-10-11 fixes):
  - the map: tiles load, a finger scrolls the page past the Overview map, the
    full-screen map pinches and pans without Obsidian's sidebar swipe taking
    over (it didn't pinch before: the map stopped the touches Leaflet follows on
    the document), and offline it draws the route alone;
  - the sheets (Map Settings, This Activity's Benefit): on the bottom edge, as
    tall as their content, and dragged down by the header to close. Map
    Settings with seven overlays is about 80% of the screen: tighter rows, or
    half height with the list scrolling, if that is still too tall;
  - every page's end scrolls clear of the floating navigation bar;
  - a treadmill run's page (no map, no weather; respiration, GCT balance and
    step speed loss rows; whether the phone keeps the Impact Load Factor chart
    as the web does);
  - the Power (W/kg) chart's axis and labels.
- **Inferred on every page**, no shot to check against:
  - the Gear tab, empty (the web's "No gear added" copy) and filled;
  - the Overview below Devices & Apps, how notes show, and whether a run's
    Devices & Apps lists its sensors as a ride's does (ours: it does);
  - Zone 1 and Zone 5 bar colours; the Heart Rate Zones line's colour stops;
  - what ends the Charts tab below the zones (ours: nothing);
  - Feel words other than Normal; Perceived Effort words other than 3, 4 and 6,
    and its colours other than 3 (green) and 5–6 (yellow); Primary Benefit
    names other than Threshold, Tempo, Recovery and Base, and the benefit
    sheet's copy for all but Threshold;
  - weather icons other than a clear day's sun and Mostly Cloudy, the wind's
    unit (shown as knots × 1.852 because 5 shows "9"), and what tapping the
    weather chip opens;
  - the lock for `subscribers` and `public` activities;
  - badge descriptions but `cycle_climb_500ft`'s, badge art (ours: a medal),
    and what a badge opens (ours: nothing);
  - sensor battery words other than "OK", and a sensor with a battery level;
  - every pane, and the 640–999 pt Overview: Garmin has neither.
- **Runs, Inferred** (`outdoor-run/`):
  - every Data Overlay but Pace on the full map, their legends, and Laps off;
  - the landscape chips past Heart Rate Zones, the chart Avg Pace opens, and
    whether a chip toggles off.
- **Rides, Inferred** (`road-cycling/`):
  - the charts on the Distance axis (the twin doesn't draw them either);
  - Map Settings' overlays (None, Speed, Heart Rate, Power, Elevation), legends;
  - the colours of Power Zones 3, 6 and 7;
  - the Power Phase pickers' sheets and words; does one choice switch both?
  - the peak keys' second line in Power Phase and Balance;
  - a ride without power, with one-sided pedals or no cycling dynamics;
  - the landscape opened from cards but Elevation, and its swap view;
  - which chart each chart badge on Overview and Stats opens;
  - the expanded charts' layout, as the twin draws them;
  - Position's marks 6–7 s early, and Garmin's clock after a pause (kept);
  - Heart Rate's axis top, Stamina's 0–102 overlay, the 0.428 pad;
  - "--" for a PCO average of 0 (kept); the Power Curve axis past this ride.
- **Pool swims, Inferred** (`pool-swim/`):
  - what tapping an interval opens (the web lists its lengths);
  - the landscape chips (ours: Pace, Strokes, Swolf, Heart Rate, its zones);
  - Heart Rate Zones on Distance; that axis in fifths, open water's in steps;
  - the pace axes' 0.45 pad and 5:00 cap;
  - yard pools and imperial units;
  - the twin's choices: rest rows unstyled, the pinned header, the Total row.
- **Open-water swims, Inferred** (`open-water-swim/`):
  - Map Settings without a Data Overlay;
  - the Heart Rate picker's sheet, and Heart Rate Zones;
  - Temperature and the zones on the Distance axis; Zone 1;
  - the temperature axis rule and the pace's slow-end cap;
  - the landscape chips (ours: Pace, Strokes, Temperature, Heart Rate, zones);
  - imperial units, and a hero of 1,000 m or more ("1,234 m").
- **Every other sport, Inferred** (`basic/`):
  - every sport but the Stair Stepper: a walk or hike with a map, yoga, strength;
  - the Heart Rate picker's sheet (the pool's) and Heart Rate Zones;
  - the landscape chips (ours: Heart Rate, its zones, Pace and Elevation);
  - the long group name cut short in Navigation; the Charts pane's padding.
- **Shots still wanted:** a ride on the Distance axis, its Gear, Map Settings
  and HELP sheets, and a ride without power; pool intervals 12–18 and what
  tapping an interval opens; open water's Map Settings; another sport on the
  basic page, such as Strength or Yoga.
- **Help copy not captured:** the HELP sheets and Charts "?" sheets of every
  sport, among them a run's nine and twelve. Their links are left out until it
  is; only the Primary Benefit "?" opens a sheet.
- **Primary Benefit in Stats** wraps "Tempo / (High Aerobic)" where the twin
  has "Tempo (High / Aerobic)": the shared `StatRow`.
- **One swimmer glyph** draws both swims; the phone draws a pool swimmer and an
  open-water one.
- **A run's axis rules not settled:** Stride, Vertical Ratio and GCT start at
  their first sample, which reads 0:08 where the phone shows 0:09; Run/Walk
  drops its last time label; Power's top (≈1.66 × max) and Impact Load
  Factor's (≈2 × max); the Distance ticks (nice steps — shooting the 8.01 km
  run of Oct 3 would settle it).
- **The map's pace colours** bin in equal steps of pace from the best pace to a
  slow end mirrored about the average (84% of the phone's samples exactly, 95%
  within a slot); the exact slow end is not proved.
- **Sleep History's sheet** still hides the modal's header and draws its own,
  so on a phone it neither sits on the bottom edge nor drags down to close.
  Give it `SheetModal`'s header treatment.
- **Left out on purpose:** writing anything to Garmin (rename, notes, likes,
  photos, sharing, self-evaluation), Garmin's map provider, Map / Satellite /
  Terrain, every sport's Reports (no plugin page), the watch's product image,
  the rotate glyph on Laps and Charts and the landscape laps table it opens.

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

Not built: Steps' Help, the ⋮ menu and Edit Goal.

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

Not inferred, but still to do: the factor pages leave out Garmin's articles and
links; Add Notes, Help and the ⋮ menu are not built.

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

## Onboarding and backfill

The setup, the history download and the update dialog were checked live in the
development vault, and a disable and re-enable show no removal prompt. Still
open:
- **A first install and an uninstall in a throwaway vault**, signed in to a real
  account: the setup opening on enable, the whole download, then Uninstall and
  the "Garmin Connect was removed" prompt. Never uninstall from the development
  vault: its plugin folder is this repository.
- **The same on the iPhone**: the setup as a bottom sheet, the download pausing
  in the background and resuming, the update dialog, and two devices sharing one
  download.
- **Figma**: the page "Obsidian / Setup & Data" (`858:2`) holds the setup,
  Home's card and pill, Settings → Data, the three dialogs and the status bar.
  Keep it in step with the code.
- **Settings rows in Figma** use classic hairline rows, while Obsidian 1.14
  draws settings as grouped cards (the file has no `setting-items-*`
  variables). Redraw them, or note the difference on the page.

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
- Check behaviour under sync load: hours of `connectapi` calls, now that the
  history download can fetch years of Day details under its hourly budget
  (2,500 to 8,000 requests by sync speed; Gentle is the default).
- **A scale or a second Garmin device moves the recent sync's mark.** The mark
  is the last-used device's upload, so a watch that uploads days late after the
  scale synced leaves those days to **Sync a date range…**. Fixing it needs
  each device's last upload; find an endpoint that lists them.

## Platform and release

- Test on Android: a different native HTTP stack, so a third TLS fingerprint
  after desktop and iOS ([measured ones](docs/garmin-api.md#tls-fingerprints)).
- **Before a community directory submission:**
  - a sentence-case pass over UI text;
  - replace `setDynamicTooltip()`, deprecated in Obsidian 1.13's typings;
  - bump to 1.0.0.

  See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md#before-the-first-directory-submission).
