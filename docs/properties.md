# Property reference

Every frontmatter property the sync can write, what it comes from, and what its
value means, followed by the files the sync keeps beside the notes for the
pages. Maintained by hand from `src/sync/metrics.ts`, where the labels live
(`METRIC_LABELS`). If the two ever disagree, the code is right.

## Naming and prefixes

The mapper produces *canonical* keys (`steps`, `resting_hr`). The storage target
decides whether they get a prefix, because namespacing is the target's problem:

| Mode | Prefix | Example key |
| --- | --- | --- |
| Data folder (default) | none (`dataFolderPrefix`, default `""`) | `steps` |
| Daily notes | `garmin_` (`prefix`) | `garmin_steps` |

A dedicated folder has nothing to collide with, so the columns read cleanly. A
daily note is full of your own properties, so the prefix keeps them apart.

## How absent values behave

Three rules, and they matter more than they look:

- **Absent stays absent.** A day Garmin has no data for does not gain a row of
  empty properties. The key is simply not written.
- **Negative means "not measured", not a value.** Garmin reports unmeasured
  fields as negatives — `averageStressLevel: -1` is the common one. Those are
  dropped rather than written, because a `-1` stress score would quietly poison
  any chart built on it.
- **Non-finite is dropped.** `NaN` and `Infinity` never reach a note.

So `steps == null` in a query means "no data", never "zero steps".

## activity

From `/usersummary-service/usersummary/daily/{displayName}`.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `steps` | integer | count | `totalSteps` |
| `steps_goal` | integer | count | `dailyStepGoal` |
| `distance_km` | number, 2 dp | km | `totalDistanceMeters` ÷ 1000 |
| `distance_mi` | number, 2 dp | miles | `totalDistanceMeters` ÷ 1609.344 |
| `calories` | integer | kcal | `totalKilocalories` |
| `calories_active` | integer | kcal | `activeKilocalories` |
| `floors` | integer | floors | `floorsAscended` |
| `intensity_moderate` | integer | minutes | `moderateIntensityMinutes` |
| `intensity_vigorous` | integer | minutes | `vigorousIntensityMinutes` |
| `intensity_minutes` | integer | minutes | `moderate + vigorous × 2` |
| `intensity_goal` | integer | minutes | `intensityMinutesGoal` |
| `calories_bmr` | integer | kcal | `bmrKilocalories` |
| `floors_descended` | integer | floors | `floorsDescended` |
| `floors_goal` | integer | floors | `userFloorsAscendedGoal` |
| `active_minutes` | integer | minutes | `activeSeconds` ÷ 60 |
| `highly_active_minutes` | integer | minutes | `highlyActiveSeconds` ÷ 60 |
| `sedentary_minutes` | integer | minutes | `sedentarySeconds` ÷ 60 |
| `calories_consumed` | integer | kcal | `consumedKilocalories` — only for accounts that log food |

`calories` includes the resting burn; `calories_active` is what you moved for
and `calories_bmr` is what your body would have used lying still. The three
activity-band minutes plus sleep account for the whole day, which is what makes
them worth reading as proportions rather than as separate numbers.

Only one distance key is ever written — whichever the unit setting selects.
`intensity_minutes` uses **Garmin's own weighting**, where a vigorous minute
counts double; it is written whenever either component exists, treating the
missing one as zero.

`distance_km` is the day's whole distance, rides and swims included. The Steps
page shows only what was walked or run (`wellnessDistanceMeters`), which is why
it reads the daily stats index below rather than the notes.

### The daily stats index — `daily-stats/`

The Steps, Floors and Intensity Minutes pages (Home → ⋯ → Activities, or the
Steps card) read neither the notes nor their properties. A year of the app's
charts needs a year of days, which the notes only have once a sync has reached
each one, and the notes' distance includes rides. So the `activity` group also
keeps an index of every day on the account, with Garmin's own daily figures:

```
<dataFolder>/daily-stats/index.json
<dataFolder>/daily-stats/2025.json
<dataFolder>/daily-stats/2026.json
```

```jsonc
// 2026.json — oldest first, one day per line, keys always in this order.
{
	"version": 1,
	"year": 2026,
	"days": [
		{"date":"2026-10-03","steps":11710,"stepGoal":6770,"distance":11465,"calories":2606,"floorsUp":32,"floorsDown":18,"floorsGoal":10,"moderate":13,"vigorous":45,"intensityGoal":150}
	]
}
```

| Key | Unit | Source field |
| --- | --- | --- |
| `steps`, `stepGoal` | count | `totalSteps`, `dailyStepGoal` / `stepGoal` |
| `distance` | metres, on foot | `wellnessDistanceMeters` / `totalDistance` |
| `calories` | kcal | `totalKilocalories`. Only the daily summary has it; the pages fall back to the note's `calories` |
| `floorsUp`, `floorsDown`, `floorsGoal` | whole floors | `floorsAscended`, `floorsDescended` rounded down / `wellnessFloorsAscended`… |
| `moderate`, `vigorous` | minutes | `moderateIntensityMinutes`, `vigorousIntensityMinutes` / `moderateValue`, `vigorousValue` |
| `intensityGoal` | minutes a week | `intensityMinutesGoal` / `weeklyGoal` |

A day the watch recorded nothing has no row, which is what a year's "Avg Daily"
divides by. `index.json` holds `from` and `to`, the stretch fetched end to end,
and `complete`, whether fetching further back found nothing.

How it fills:

- **Every sync** takes the days it writes from the daily summaries it fetches
  anyway: no extra requests. A day it could not write (no note to put it in, a
  summary that failed) is asked of the range endpoints instead —
  `/usersummary-service/stats/{steps,floors,im}/daily/{start}/{end}`, three
  requests for up to 28 days — and so is any stretch between the index's newest
  day and the sync, so a vault left closed for a fortnight has no hole.
- **The whole history** comes once, walking back 28 days at a time until four
  windows in a row have no steps, past the oldest activity: about 40 requests a
  year. It starts by itself after the first sync of a session while `complete`
  is false, or with the **Sync step, floor and intensity history** command, and
  a run cut short by a 429 carries on from where it stopped next time.
- A year file is rewritten only when its text changes.

## heart

From the same daily summary call as `activity`.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `resting_hr` | integer | bpm | `restingHeartRate` |
| `resting_hr_7d` | integer | bpm | `lastSevenDaysAvgRestingHeartRate` |
| `min_hr` | integer | bpm | `minHeartRate` |
| `max_hr` | integer | bpm | `maxHeartRate` |

`resting_hr_7d` is Garmin's own seven-day average and is the figure its app
shows as your resting rate. It moves far less than the daily value, so it is the
better one to read a trend from.

## sleep

From `/wellness-service/wellness/dailySleepData/{displayName}`, the
`dailySleepDTO` object.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `sleep_hours` | number, 2 dp | hours | `sleepTimeSeconds` ÷ 3600 |
| `sleep_score` | integer | 0–100 | `sleepScores.overall.value` |
| `sleep_deep_hours` | number, 2 dp | hours | `deepSleepSeconds` |
| `sleep_light_hours` | number, 2 dp | hours | `lightSleepSeconds` |
| `sleep_rem_hours` | number, 2 dp | hours | `remSleepSeconds` |
| `sleep_awake_hours` | number, 2 dp | hours | `awakeSleepSeconds` |
| `sleep_quality` | string | — | `sleepScores.overall.qualifierKey` |
| `sleep_start` | datetime | local | `sleepStartTimestampGMT` |
| `sleep_end` | datetime | local | `sleepEndTimestampGMT` |
| `sleep_resting_hr` | integer | bpm | `restingHeartRate` |
| `sleep_avg_stress` | number | 0–100 | `avgSleepStress` |
| `sleep_awake_count` | integer | count | `awakeCount` |
| `sleep_restless_moments` | integer | count | `restlessMomentsCount` |
| `sleep_respiration` | number | breaths/min | `averageRespirationValue` |
| `sleep_spo2` | integer | % | `averageSpO2Value` |
| `sleep_spo2_low` | integer | % | `lowestSpO2Value` |
| `sleep_body_battery_change` | integer | points | `bodyBatteryChange` |
| `nap_hours` | number, 2 dp | hours | `napTimeSeconds` ÷ 3600 |
| `sleep_quality_duration` / `_stress` / `_awakenings` / `_rem` / `_light` / `_deep` / `_restlessness` | string | — | `sleepScores.{totalDuration, stress, awakeCount, remPercentage, lightPercentage, deepPercentage, restlessness}.qualifierKey` |
| `sleep_feedback` | string | — | `sleepScoreFeedback` |
| `sleep_insight` | string | — | `sleepScoreInsight` |
| `sleep_need_hours` | number, 2 dp | hours | `sleepNeed.actual` ÷ 60 (Sleep Coach) |
| `sleep_need_baseline_hours` | number, 2 dp | hours | `sleepNeed.baseline` ÷ 60 |
| `sleep_need_next_hours` | number, 2 dp | hours | `nextSleepNeed.actual` ÷ 60 |
| `sleep_need_feedback` | string | — | `sleepNeed.feedback` |
| `sleep_need_training_feedback` | string | — | `sleepNeed.trainingFeedback` |
| `sleep_need_history_adjustment` / `_hrv_adjustment` / `_nap_adjustment` | string | — | `sleepNeed.{sleepHistoryAdjustment, hrvAdjustment, napAdjustment}` |

The sub-score verdicts and the Sleep Coach fields come from the same sleep
payload as everything above, at no extra request, and the recorded responses
in `api/schema/` confirm them. A key that never appears in your notes is one
Garmin does not send for your watch: the overnight SpO2 pair, for one, needs
pulse ox switched on during sleep.

`sleep_body_battery_change` is the one metric allowed to go **negative**: a night
that drained rather than recharged is information, not a sentinel. It is also the
number that separates a long night from a restorative one — eight hours that give
back 20 points and eight that give back 60 are not the same night.

`sleep_start` and `sleep_end` are written as `YYYY-MM-DDTHH:mm`, which Obsidian
recognises as a datetime property. They are converted from the **GMT** fields
rather than Garmin's `*Local` variants, which have been reported as
double-offset on some accounts.

The four stage hours do not necessarily sum to `sleep_hours` — awake time is
excluded from Garmin's sleep total.

## stress

From the daily summary call.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `stress_avg` | integer | 0–100 | `averageStressLevel` |
| `stress_max` | integer | 0–100 | `maxStressLevel` |
| `stress_qualifier` | string | — | `stressQualifier` |
| `stress_rest_minutes` | integer | minutes | `restStressDuration` ÷ 60 |
| `stress_low_minutes` | integer | minutes | `lowStressDuration` ÷ 60 |
| `stress_medium_minutes` | integer | minutes | `mediumStressDuration` ÷ 60 |
| `stress_high_minutes` | integer | minutes | `highStressDuration` ÷ 60 |
| `body_battery_high` | integer | 0–100 | `bodyBatteryHighestValue` |
| `body_battery_low` | integer | 0–100 | `bodyBatteryLowestValue` |
| `body_battery_latest` | integer | 0–100 | `bodyBatteryMostRecentValue` |
| `body_battery_charged` | integer | points | `bodyBatteryChargedValue` |
| `body_battery_drained` | integer | points | `bodyBatteryDrainedValue` |

`averageStressLevel` is the field most likely to arrive as `-1`; see the absent
rules above.

The four `stress_*_minutes` buckets are how long Garmin measured you in each
band. Rest is the one that matters most: a day with a high average and plenty of
rest reads very differently from one with a middling average and none.

`body_battery_charged` and `body_battery_drained` are the two directions behind
the day's net movement. A day that ends where it started having charged 60 and
drained 60 is a different day from one that did neither.

## hrv

From `/hrv-service/hrv/{date}`, the `hrvSummary` object.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `hrv_avg` | number | ms | `lastNightAvg` |
| `hrv_high` | number | ms | `lastNight5MinHigh` |
| `hrv_weekly_avg` | number | ms | `weeklyAvg` |
| `hrv_status` | string | — | `status` |
| `hrv_baseline_low` | number | ms | `baseline.balancedLow`, falling back to `baseline.lowUpper` |
| `hrv_baseline_high` | number | ms | `baseline.balancedUpper` |

The baseline pair is what makes `hrv_avg` readable at all: 38 ms means nothing on
its own, and 38 ms inside a 32–48 range means "normal for you". Absolute HRV
values vary enormously between people.

`hrv_status` is Garmin's own label (`BALANCED`, `UNBALANCED`, `LOW`, and so on)
and is written only when it is a non-empty string.

## readiness

From `/metrics-service/metrics/trainingreadiness/{date}`, first entry.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `training_readiness` | integer | 0–100 | `[0].score` |
| `training_readiness_level` | string | — | `[0].level` |
| `readiness_sleep_score` | integer | 0–100 | `[0].sleepScore` |
| `readiness_hrv_factor` | integer | % | `[0].hrvFactorPercent` |
| `recovery_time_hours` | number, 1 dp | hours | `[0].recoveryTime` ÷ 60 |
| `acute_load` | integer | load | `[0].acuteLoad` |
| `readiness_feedback` / `readiness_feedback_long` | string | — | `[0].feedbackShort` / `feedbackLong` |
| `readiness_context` | string | — | `[0].inputContext` |
| `readiness_<factor>_factor` | integer | % | `[0].<factor>FactorPercent` |
| `readiness_<factor>_feedback` | string | — | `[0].<factor>FactorFeedback` |
| `readiness_hrv_weekly_avg` | number | ms | `[0].hrvWeeklyAverage` |

`<factor>` is one of `sleep` (`sleepScore…`), `recovery` (`recoveryTime…`),
`hrv`, `load` (`acwr…`), `sleep_history` and `stress_history` — the six factors
the app lists under the score.

Garmin counts recovery in minutes; it is written here in hours, which is how
anyone reads it. When readiness is low, the factor properties say why.

## fitness

Two sources: a range call for VO2 Max and fitness age, a per-day call for
endurance score.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `vo2max` | number | ml/kg/min | `maxMetrics.generic.vo2MaxPreciseValue`, falling back to `vo2MaxValue` |
| `vo2max_cycling` | number | ml/kg/min | `maxMetrics.cycling.vo2MaxPreciseValue`, falling back to `vo2MaxValue` |
| `fitness_age` | number, 2 dp | years | `fitnessage-service` `fitnessAge`, falling back to `maxMetrics.generic.fitnessAge` |
| `fitness_age_achievable` / `fitness_age_previous` | number, 2 dp | years | `achievableFitnessAge` / `previousFitnessAge` |
| `chronological_age` | integer | years | `chronologicalAge` |
| `fitness_age_updated` | date | — | `lastUpdated`: when Garmin last recalculated it, which can be a day or more before the note |
| `fitness_age_<component>` | number, 2 dp | varies | `components.<component>.value`, named after Garmin's key in snake case |
| `endurance_score` | number | score | `endurance.overallScore` |
| `endurance_classification` | integer | enum | `endurance.classification` |
| `endurance_feedback` | integer | phrase id | `endurance.feedbackPhrase` — a number, not an enum name |
| `endurance_gauge_low` / `_high` | integer | score | `gaugeLowerLimit` / `gaugeUpperLimit` |
| `endurance_<class>_from` | integer | score | `classificationLowerLimit<Class>` for intermediate, trained, well_trained, expert, superior, elite |
| `hill_score` | integer | score | GraphQL `hillScoreScalar` → `hillScoreDTOList[].overallScore` |
| `hill_score_strength` / `_endurance` | integer | score | `strengthScore` / `enduranceScore` |
| `hill_score_classification` / `_feedback` | integer | id | `hillScoreClassificationId` / `hillScoreFeedbackPhraseId` |
| `heat_acclimation_pct` | integer | % | `heatAltitudeAcclimation.heatAcclimationPercentage` |
| `heat_acclimation_trend` | string | — | `heatAltitudeAcclimation.heatTrend` |
| `altitude_acclimation_m` / `_ft` | integer | m / ft | `heatAltitudeAcclimation.altitudeAcclimation` |
| `altitude_acclimation_trend` | string | — | `heatAltitudeAcclimation.altitudeTrend` |

Garmin sends both a rounded and a precise VO2 Max. The precise one is preferred
because a rounded series makes a trend line into a staircase.

VO2 Max and acclimation come from the max-metrics range call, whose rows carry
their day on `generic.calendarDate` (and `cycling.` / `heatAltitudeAcclimation.`)
rather than on the row. When that call has nothing for a day and the `training`
group is on, training status's `mostRecentVO2Max` fills in — but only if its own
`calendarDate` is that day, so a backfill never smears one reading across a year.

## respiration

From the daily summary call — no extra request.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `respiration_avg` | number | breaths/min | `avgWakingRespirationValue` |
| `respiration_min` | number | breaths/min | `lowestRespirationValue` |
| `respiration_max` | number | breaths/min | `highestRespirationValue` |
| `respiration_latest` | number | breaths/min | `latestRespirationValue` — the big number on the app's Respiration card |

Breathing rate is very stable for a given person, so a few breaths above your own
normal is worth noticing. It tends to rise with illness, alcohol and altitude.

## spo2

Also from the daily summary call — no extra request.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `spo2_avg` | integer | % | `averageSpo2` |
| `spo2_low` | integer | % | `lowestSpo2` |
| `spo2_latest` | integer | % | `latestSpo2` |

Wrist pulse oximetry is approximate and is **not a medical measurement**. Read
the trend across weeks, never a single reading.

## body

From `/weight-service/weight/dayview/{date}`. Garmin's own daily average is
preferred over the first weigh-in, so a day you stepped on the scale twice reads
as the day rather than as whichever reading came first.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `weight_kg` / `weight_lb` | number, 1 dp | kg / lb | `weight` (grams) |
| `bmi` | number, 2 dp | — | `bmi` |
| `body_fat_pct` | number, 2 dp | % | `bodyFat` |
| `body_water_pct` | number, 2 dp | % | `bodyWater` |
| `muscle_mass_kg` / `muscle_mass_lb` | number, 1 dp | kg / lb | `muscleMass` (grams) |
| `bone_mass_kg` / `bone_mass_lb` | number, 1 dp | kg / lb | `boneMass` (grams) |

Garmin reports every body mass in **grams** whatever the account's unit system,
so the conversion happens here. Only one key of each pair is ever written.

Everything past `weight` needs a scale that measures it; most accounts get weight
and BMI and nothing else. Days with no weigh-in write nothing at all, which for
most people is most days — expect gaps in these series rather than a daily line.

## training

From `/metrics-service/metrics/trainingstatus/aggregated/{date}`.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `training_status` | string | — | `<status>.trainingStatusFeedbackPhrase` |
| `training_status_since` | date | — | `<status>.sinceDate` |
| `fitness_trend` | integer | enum | `<status>.fitnessTrend` |
| `training_load_weekly` | integer | load | `<status>.weeklyTrainingLoad` |
| `training_load_tunnel_min` / `_max` | integer | load | `<status>.loadTunnelMin` / `loadTunnelMax` |
| `training_load_acute` | integer | load | `<acute>.dailyTrainingLoadAcute` |
| `training_load_chronic` | integer | load | `<acute>.dailyTrainingLoadChronic` |
| `training_load_optimal_min` / `_max` | integer | load | `<acute>.minTrainingLoadChronic` / `maxTrainingLoadChronic` |
| `training_load_ratio` | number, 2 dp | ratio | `dailyAcuteChronicWorkloadRatio`, or `acwrPercent` ÷ 100 |
| `training_load_status` | string | — | `<acute>.acwrStatus` |
| `training_load_feedback` | string | — | `<acute>.acwrStatusFeedback` |
| `load_aerobic_low` / `load_aerobic_high` / `load_anaerobic` | integer | load | `<balance>.monthlyLoad{AerobicLow, AerobicHigh, Anaerobic}` |
| `load_<bucket>_target_min` / `_max` | integer | load | `<balance>.monthlyLoad<Bucket>TargetMin` / `TargetMax` |
| `load_focus` | string | — | `<balance>.trainingBalanceFeedbackPhrase` |
| `running_tolerance` | integer | load | `runningtolerance/stats` `acuteTolerance` |
| `running_tolerance_load` | integer | load | `acuteImpactLoad` |
| `running_tolerance_distance_km` / `_mi` | number, 2 dp | km / mi | `acuteDistance` (metres) |
| `running_tolerance_feedback` | string | — | `runningToleranceFeedBackPhrase` |

Hill score and running tolerance are range calls, in 28-day windows — one
request per window, not per day.

Where `<status>` is `mostRecentTrainingStatus.latestTrainingStatusData.<deviceId>`,
`<acute>` is `acuteTrainingLoadDTO` inside that entry (or at the top level, if an
account sends it there), and `<balance>` is
`mostRecentTrainingLoadBalance.metricsTrainingLoadBalanceDTOMap.<deviceId>`.

Both maps are keyed by **device id**, and an account with a watch and a bike
computer has several — none of them knowable in advance. The mapper takes the
entry marked `primaryTrainingDevice: true`, or whichever is there.

Acute load is roughly the last week of training and chronic is roughly the last
month. The ratio between them is the single most useful training number Garmin
produces: below about 0.8 you are detraining, above about 1.3 injury risk climbs.

## races

From `/metrics-service/metrics/racepredictions/daily/{displayName}`.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `race_5k` | integer | **seconds** | `time5K` |
| `race_10k` | integer | **seconds** | `time10K` |
| `race_half` | integer | **seconds** | `timeHalfMarathon` |
| `race_marathon` | integer | **seconds** | `timeMarathon` |

**Seconds, deliberately.** A number charts and sorts; `"24:31"` does neither.
Formatting for display is the reader's layer, not the data's. To render one in
Dataview:

```dataviewjs
const s = dv.current().race_5k;
dv.paragraph(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
```

## health

Health Status, from the GraphQL gateway (`healthStatusSummary`), one request a
day. Each metric Garmin judges against your baseline gets four keys:

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `health_status_outliers` | integer | count | `outliersCount` |
| `health_<m>` | number | varies | `metrics[type=<M>].value` |
| `health_<m>_status` | string | — | `status` — `IN_RANGE`, `BELOW`, `ABOVE`, `ONBOARDING` |
| `health_<m>_baseline_low` / `_high` | number | varies | `baselineLowerLimit` / `baselineUpperLimit` |
| `health_snapshots` | list | — | GraphQL `healthSnapshotScalar`, one row per Health Snapshot |

`<m>` is `hrv`, `hr`, `spo2`, `respiration`, and `skin_temp_c` or `skin_temp_f`
(whichever matches the note's units; skin temperature is a signed deviation).
Snapshot rows carry `start` (local) and the averages `hr`, `respiration`,
`stress`, `spo2`, `hrv` (RMSSD) and `hrv_sdrr`.

## profile — `account.json`

Nothing in the notes; about nine requests per sync, written to
`<dataFolder>/account.json`:

| Key | Source |
| --- | --- |
| `displayName`, `fullName`, `avatar` | `socialProfile` (already fetched for the display name). Not `userName`, which is the sign-in email |
| `sex` — `male` / `female` | user settings `userData.gender`. Garmin grades VO2 Max and FTP against tables that differ by sex |
| `device` — `name`, `imageUrl`, `lastUpload` | `deviceservice/mylastused` |
| `lactateThreshold` — `date`, `heartRate`, `speed` (m/s), `pace` | `biometric/latestLactateThreshold`, user settings as a fallback. Garmin's `speed` is tenths of m/s |
| `ftp.running` / `ftp.cycling` / `ftp.xcSkiing` — `date`, `watts`, `wattsPerKg` | `biometric/powerToWeight/latest/{date}`, one call with no `sport` filter, which returns a row per sport |
| `runningEconomy` — `score`, `classification` | `runningeconomy/latest/{date}` |
| `cyclingAbility` | GraphQL `cyclingAbility.latest` |
| `trainingPlans` | `trainingplan/plans`, completed plans left out |
| `events` — `name`, `date`, `type`, `distanceMetres`, `goalSeconds` | GraphQL `myDayCardEventsScalar` |
| `personalRecords` — `type` (`run_5k`, …), `typeId`, `value`, `date`, `activityId` | `personalrecord/prs/{displayName}`. `typeId` is Garmin's prtypes id (running 1–7, cycling 8–11, steps 12–16, swimming 17–26, strength 28–32 and 45–51). `date` is the activity's **local** day, as the app shows it |

## intraday

Heart rate, stress, Body Battery, steps, floors, intensity minutes and sleep
stages across the day. Six requests a day — `dailyStress` (stress *and* Body
Battery), `dailyHeartRate`, `dailySummaryChart` (steps), `floorsChartData`,
`daily/im` and `bodyBattery/events` — spent only on the **newest seven days** of
any sync. The sleep hypnogram costs nothing: it is in the sleep payload, so every
day with sleep gets it.

One property reaches the note:

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `hr_latest` | integer | bpm | last non-null reading in `heartRateValues` |

Everything else goes to a **series file** per day, beside the notes, because a day
of heart rate is hundreds of points and frontmatter is the wrong place for it.
Every day a sync writes gets one while `intraday` is on; only the newest seven
spend the six requests, and the rest carry what the day's other payloads hold,
such as the night's sleep.

```
<dataFolder>/series/2026-09-20.json
<dataFolder>/account.json
```

```jsonc
{
  "date": "2026-09-20",
  "version": 1,
  // [epochMs, value]; null is a gap Garmin reported (off-wrist, mid-activity).
  "stress":      [[1789884000000, 22], [1789884180000, null]],
  "bodyBattery": [[1789884000000, 64]],
  "heartRate":   [[1789884000000, 52]],
  "steps":       [{ "start": 1789884000000, "end": 1789884900000, "steps": 412, "level": "active" }],
  // Only the 15-minute stretches with any floors in them.
  "floors":      [{ "start": 1789898400000, "end": 1789899300000, "up": 3, "down": 1 }],
  // [bucketEndMs, minutes], vigorous counted twice.
  "intensity":   [[1789925399999, 30]],
  // Midnight on the watch's clock: the day's charts run from here.
  "dayStart":    1789848000000,
  // level: Garmin's stage code, believed 0 deep, 1 light, 2 REM, 3 awake.
  "sleepLevels": [{ "start": 1789855080000, "end": 1789856880000, "level": 1 }],
  "bodyBatteryEvents": [{ "type": "SLEEP", "start": 1789855080000, "minutes": 464, "impact": 52, "feedback": "…" }],
  // The night that ended this day, for the Sleep pages: scores, stages, factors,
  // Sleep Coach need, and the overnight heart rate, HRV, stress and respiration.
  "sleep":       { "start": 1789855080000, "end": 1789884900000, "score": 84, "quality": "GOOD", "factors": { "…": "…" } },
  // Blocks a Health Stats page loaded on view, by the key it registered.
  "extra":       { "heartDay": { "…": "…" }, "spo2Day": { "…": "…" } },
  // Keys loaded on view, data or not, so a day Garmin had nothing for is not asked again.
  "checked":     ["heartDay", "spo2Day"]
}
```

Every timestamp is epoch milliseconds, UTC. A key is left out when Garmin had
nothing for it. The file is rewritten only when its content changes.

A Health Stats page opening a day the sync did not cover asks for that day's
blocks then, and keeps them under `extra`: `stressDay`, `heartDay`,
`respirationDay`, `spo2Day`, `fitnessAgeDay`, `snapshotList` and
`snapshotDay`. A sync's own write of the day starts the file afresh, so those
are fetched again the next time the page is opened. Files written before
2026-10-07 have no `sleep` block, and before 2026-10-04 no floors, intensity
or `dayStart`; they fill in as a sync covers those days again.

`account.json` belongs to the `profile` group — see above.

## workouts

From `/activitylist-service/activities/search/activities`, bucketed by the local
calendar day each activity started on. The value is a **list of objects**, not a
scalar, so it renders as a nested list in Obsidian's property editor.

| Key | Type | Unit | Source field |
| --- | --- | --- | --- |
| `name` | string | — | `activityName` |
| `type` | string | — | `activityType.typeKey` |
| `start` | datetime | local | `startTimeLocal` |
| `minutes` | integer | minutes | `duration` ÷ 60 |
| `duration_s` | integer | seconds | `duration` — the app's "42:13" total time, which `minutes` rounds away |
| `distance_km` / `distance_mi` | number, 2 dp | km / miles | `distance` |
| `calories` | integer | kcal | `calories` |
| `avg_hr` | integer | bpm | `averageHR` |
| `max_hr` | integer | bpm | `maxHR` |
| `elevation_gain_m` / `elevation_gain_ft` | integer | m / ft | `elevationGain` |
| `steps` | integer | count | `steps` |
| `training_effect` | number, 1 dp | 0–5 | `aerobicTrainingEffect` |
| `pace` | string | min per km / mile | `distance` ÷ `movingDuration` |

```yaml
workouts:
  - name: Morning Run
    type: running
    start: 2026-09-12T07:31
    minutes: 31
    duration_s: 1830
    distance_km: 5.12
    calories: 412
    avg_hr: 148
    max_hr: 171
    elevation_gain_m: 42
    training_effect: 3.4
    pace: "5:52"
```

`pace` is a **string**, deliberately: it lands in a list row that nothing charts,
and 5.2 minutes per kilometre reads as neither five minutes twelve nor five
twenty. It is computed from **moving** time rather than elapsed — a pace that
counts the coffee stop is not a pace — and omitted for activities with no
distance to pace, or paces slower than 30 minutes per unit (a long stop, or a few
metres of GPS drift).

This is a deliberately short row. Garmin sends roughly a hundred fields per
activity; thirty keys per workout would make the frontmatter unreadable for a
person and slow for the metadata cache.

The `workouts` key is omitted entirely on a day with no activities, rather than
written as an empty list.

### The activity index — `activities/`

The Activities pages (Home → ⋯ → Activities) read neither the notes nor their
`workouts` rows. A note only covers days a sync has reached, and its row rounds
for reading: a year of runs summed from rows rounded to 10 m reads 1,169 km
where the app says 1,168.9. So the same activity list also fills an index of
every activity on the account, with Garmin's raw numbers:

```
<dataFolder>/activities/index.json
<dataFolder>/activities/2025.json
<dataFolder>/activities/2026.json
```

```jsonc
// 2026.json — newest first, one activity per line, keys always in this order.
{
	"version": 1,
	"year": 2026,
	"activities": [
		{"id":20460000001,"name":"Morning Run","type":"running","typeId":1,"parentTypeId":17,"start":"2026-10-03T14:59:19","begin":1791025159000,"distance":8008.75,"duration":2493.64,"ascent":52,"calories":543}
	]
}
```

| Key | Unit | Source field |
| --- | --- | --- |
| `id` | — | `activityId` |
| `name` | — | `activityName` |
| `type`, `typeId`, `parentTypeId` | — | `activityType`. The parent decides the page: treadmill_running (18) sits under running (1), yoga under fitness equipment (29) |
| `start` | local time | `startTimeLocal`. The year in the file name is this one's |
| `begin` | epoch ms | `beginTimestamp`, which orders the list |
| `distance` | metres | `distance` |
| `duration` | seconds | `duration`, the app's total time |
| `ascent` | metres | `elevationGain` |
| `calories` | kcal | `calories` |

Numbers are rounded to two decimals, past anything a page shows; a key is left
out when the activity has nothing for it. `index.json` holds `complete` (the
index has the whole history), `units` (the account's, at the last sync) and
`total` (how long the list was when last counted).

How it fills:

- **Every sync** merges the first page of the list it already fetches for the
  notes: new activities are added, edited ones updated, and one Garmin no longer
  lists is dropped, but only more than a day inside the stretch that page covers.
- **The whole history** comes once, about one request per hundred activities:
  automatically after the first sync of a session while `complete` is false, or
  with the **Sync activity history** command. It stops on a 429 and leaves
  `complete` false, so the next session finishes it.
- A year file is rewritten only when its text changes, so a routine sync touches
  at most the current year, and only when an activity was added or edited.

Multisport legs are not in the list, so they are not in the index either: a
triathlon counts once, under Multisport.

## History indexes

The pages inside Home read neither the notes nor their properties. A week,
four weeks or a year of the app's charts needs every day of that span, which the
notes only have once a sync has reached each one. So the sync keeps an index
per page beside the notes, with Garmin's own daily figures: a file per year and
an `index.json`, in a folder under the data folder.

```
<dataFolder>/<folder>/index.json
<dataFolder>/<folder>/2025.json
<dataFolder>/<folder>/2026.json
```

These are JSON, not notes, so Bases and Dataview do not see them. They are
listed here because they are part of what the plugin writes.

| Folder | Group | Pages | A row holds |
| --- | --- | --- | --- |
| `activities/` | `workouts` | Activities | One activity: see [the activity index](#the-activity-index--activities) |
| `daily-stats/` | `activity` | Steps, Floors, Intensity Minutes | One day: see [the daily stats index](#the-daily-stats-index--daily-stats) |
| `sleep/` | `sleep` | Sleep | One night, filed under the day it ended |
| `stress/` | `stress` | Stress | `level`, and the seconds at `rest`, `low`, `medium` and `high` stress; `qualifier` |
| `body-battery/` | `stress` | Body Battery | `high`, `low`, `charged`, `drained`, `latest`, `atWake`, and the day's `feedback` key |
| `heart-rate/` | `heart` | Heart Rate | `resting`, `high`, `low` (two-minute averages), `avg7` (Garmin's seven-day resting average) |
| `respiration/` | `respiration` | Respiration | `awake` and `sleep` averages, breaths a minute |
| `health-status/` | `health` | Health Status | Per metric (`hr`, `hrv`, `resp`, `skin`, `spo2`): the value, the baseline `Lo`/`Hi`, the ring `Pct` and the `St`atus; `out`, the night's outlier count |
| `fitness-age/` | `fitness` | Fitness Age | `age`, `achievable`, `rhr`, `vigDays`, `bmi`, on the days Garmin recalculated it |
| `weight/` | `body` | Weight | In grams: `w` (the day's latest weigh-in), `lo`, `hi`, `avg`, `d` (Garmin's change); `n` weigh-ins, `ins` (each one), `h` (height, cm) |
| `pulse-ox/` | `spo2` | Pulse Ox, Pulse Ox Acclimation | `avg`, `low`, `latest` (%), `elev` (mean elevation, m) |
| `blood-pressure/` | `body` | Blood Pressure | `sys`, `dia`, `sysLo`, `diaLo`, `pulse`, `n` readings, `cat` (Garmin's category) |

A sleep row has the night's `score` and `quality`, the `seconds` asleep and
in each stage (`deep`, `light`, `rem`, `awake`), the Sleep Coach `need` in
minutes, `bed` and `wake` as seconds from that day's midnight (negative before
it), overnight `hr`, `rhr`, `bb` (Body Battery gained), `resp`, `spo2`,
`skinC`/`skinF`, `hrv`, `hrv7d`, `hrvStatus`, and the `align` verdict with
its `alignStart`/`alignEnd` window.

In the day-by-day indexes rows are oldest first, one a line, keys always in the
same order, and a day with nothing has no row. `index.json` holds `from` and `to`, the stretch
fetched end to end, and `complete`, whether fetching further back found
nothing.

How they fill:

- **Every sync** keeps each index current. Days the run's daily summaries
  already describe cost nothing. Anything else in the run is asked of the
  index's range request, one request per window, and so is any stretch between
  the index's newest day and the run, so a vault left closed for a fortnight
  has no hole. Some indexes ask their last few days again on every sync,
  because Garmin revises them late: 28 days for Health Status, 7 for Fitness
  Age, Weight and Blood Pressure, 2 for Respiration.
- **The whole history** comes once. After the first sync of a session, each
  index whose group is on walks back from the oldest day it holds, one window
  at a time, until a run of empty windows says the account's history has
  started. A window is 28 days for most indexes, 29 for Fitness Age and 31 for
  Respiration; Health Status, Weight, Pulse Ox and Blood Pressure take up to
  ten years a request. The **Sync … history** commands start one by hand. A run
  cut short by a 429 carries on from where it stopped next session.
- A year file is rewritten only when its text changes.

## Querying

Because everything is a real property rather than a markdown table, both Bases
and Dataview can read it.

```dataview
TABLE steps, resting_hr, sleep_hours, training_readiness
FROM "Garmin/data"
WHERE steps > 10000
SORT date DESC
```

Crossing metrics is the point — "resting HR on days I ran more than 10 km":

```dataview
TABLE resting_hr, distance_km
FROM "Garmin/data"
WHERE distance_km > 10
SORT resting_hr ASC
```

In daily-notes mode every key above needs the `garmin_` prefix.

## Display labels

`METRIC_LABELS` in `src/sync/metrics.ts` maps each canonical key to the human
label the Bases view shows as its column name (`resting_hr` → "Resting HR").
Adding a property means adding a label there too, or the column header falls
back to the raw key. `tests/metrics.test.ts` fails if a column the view opens
with, or a key `mapDay` writes for its sample day, has none.
