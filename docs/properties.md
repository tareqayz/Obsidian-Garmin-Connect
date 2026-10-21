# Data reference

Every file the sync writes and every key in it: where it comes from and what its value means. It is
maintained by hand from the code: `mapDay` in `src/sync/metrics.ts` for the day files, and the stores
in `src/sync/`. If the two ever disagree, the code is right.

**Contents:** [The data folder](#the-data-folder) · [Day files](#the-day-files--days) ·
[Day properties](#day-properties) · [Series files](#series-files--series) ·
[Activity details](#activity-details--activity-details) · [History indexes](#history-indexes) ·
[Bookkeeping files](#bookkeeping-files)

## The data folder

Everything is plain JSON under the data folder, `Garmin/data` by default (**Settings → History → Data
folder**), arranged by the data set it belongs to:

```text
Garmin/data/
├── days/                    Day details: each day's numbers
│   ├── 2026.json            a file per year, one day per line
│   └── index.json           which days were fetched whole, and at which version
├── series/                  Day details: each day's timelines
│   └── 2026-10-17.json      a file per day
├── activities/              Charts & trends: every activity on the account
├── daily-stats/             Charts & trends: steps, floors and intensity minutes
├── sleep/                   Charts & trends: a row a night
├── stress/, heart-rate/, …  Charts & trends: one folder per stat's history
├── activity-details/        Activity details: one file per activity's page
│   ├── 12345678901.json
│   └── index.json           each file's version
├── account.json             the profile group: the watch, thresholds, plans, records
├── sync-state.json          where the last Sync recent days got to
├── scan.json                where your Garmin history starts and ends
└── backfill.json            the history download's pause and the device running it
```

**Delete synced data** removes exactly these folders and files, conflict copies and set-aside
`.unreadable-…` files included, and nothing else you keep there. Outside the data folder:
- the settings are in the plugin's `data.json` ([Settings](settings.md));
- the diagnostics notes you save are in the **Log folder**;
- the session, local-storage keys and map tiles stay on the device ([Security](SECURITY.md#on-the-device-outside-the-vault)).

## The day files — `days/`

A day's properties are the keys of one object in a JSON file per year:

```jsonc
// days/2026.json — dates in order, one day per line.
{
	"version": 1,
	"year": 2026,
	"days": {
		"2026-10-10": {"steps":9120,"resting_hr":47,"sleep_score":79,"hrv_status":"BALANCED"},
		"2026-10-11": {"steps":8432,"distance_km":6.21,"resting_hr":48,"sleep_hours":7.5,"sleep_score":82}
	}
}
```

- **The date is the key.** There is no `date` property inside a day.
- **A sync merges.** A day's new values are written over what it held, so a group switched off since
  keeps the values it wrote.
- **Unchanged files are left alone.** A year file is rewritten only when its text changes.

Older builds wrote the same keys as note properties (in daily notes, with a `garmin_` prefix). See the
[FAQ](FAQ.md#i-used-an-older-version-where-did-my-day-notes-go) for getting those days into these
files.

### How absent values behave

- **Absent stays absent.** A day Garmin has no data for gains no empty properties: the key isn't
  written. A missing `steps` means "no data", never "zero steps".
- **Negative means "not measured".** Garmin reports unmeasured fields as negatives (`averageStressLevel:
  -1` is the common one). They are dropped, except where a negative is real: `sleep_body_battery_change`
  and skin temperature.
- **Non-finite values are dropped.** `NaN` and `Infinity` never reach a file.

## Day properties

By metric group, in the settings' order. A key is written only while its group is on. "Local"
datetimes are `YYYY-MM-DDTHH:mm` strings.

### activity

From the daily summary, `/usersummary-service/usersummary/daily/{displayName}`.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `steps` | integer | count | `totalSteps` |
| `steps_goal` | integer | count | `dailyStepGoal` |
| `distance_km` | number, 2 dp | km | `totalDistanceMeters` ÷ 1000; metric units only |
| `distance_mi` | number, 2 dp | miles | `totalDistanceMeters` ÷ 1609.344; imperial units only |
| `calories` | integer | kcal | `totalKilocalories`, the resting burn included |
| `calories_active` | integer | kcal | `activeKilocalories` |
| `calories_bmr` | integer | kcal | `bmrKilocalories` |
| `calories_consumed` | integer | kcal | `consumedKilocalories`; only for accounts that log food |
| `floors` | number | floors | `floorsAscended`, as sent: it can hold a fraction of a floor |
| `floors_descended` | number | floors | `floorsDescended`, as sent |
| `floors_goal` | integer | floors | `userFloorsAscendedGoal` |
| `intensity_moderate` | integer | minutes | `moderateIntensityMinutes` |
| `intensity_vigorous` | integer | minutes | `vigorousIntensityMinutes` |
| `intensity_minutes` | integer | minutes | moderate + vigorous × 2, Garmin's weighting; written when either part exists |
| `intensity_goal` | integer | minutes a week | `intensityMinutesGoal` |
| `active_minutes` | integer | minutes | `activeSeconds` ÷ 60 |
| `highly_active_minutes` | integer | minutes | `highlyActiveSeconds` ÷ 60 |
| `sedentary_minutes` | integer | minutes | `sedentarySeconds` ÷ 60 |

`distance_km` is the day's whole distance, rides and swims included. The Steps page shows only what
was walked or run, from the [daily stats index](#the-daily-stats-index--daily-stats).

### heart

From the daily summary.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `resting_hr` | integer | bpm | `restingHeartRate` |
| `resting_hr_7d` | integer | bpm | `lastSevenDaysAvgRestingHeartRate`: Garmin's seven-day average, the figure its app shows |
| `min_hr` | integer | bpm | `minHeartRate` |
| `max_hr` | integer | bpm | `maxHeartRate` |

### sleep

From `/wellness-service/wellness/dailySleepData/{displayName}`, mostly its `dailySleepDTO` object.
`sleep_resting_hr`, `sleep_restless_moments`, `sleep_body_battery_change` and
`sleep_need_next_hours` read the payload's top level first.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `sleep_hours` | number, 2 dp | hours | `sleepTimeSeconds` ÷ 3600; awake time is excluded |
| `sleep_deep_hours` | number, 2 dp | hours | `deepSleepSeconds` |
| `sleep_light_hours` | number, 2 dp | hours | `lightSleepSeconds` |
| `sleep_rem_hours` | number, 2 dp | hours | `remSleepSeconds` |
| `sleep_awake_hours` | number, 2 dp | hours | `awakeSleepSeconds` |
| `sleep_start` | datetime | local | `sleepStartTimestampGMT`, in the syncing device's time zone |
| `sleep_end` | datetime | local | `sleepEndTimestampGMT`, in the syncing device's time zone |
| `sleep_score` | integer | 0–100 | `sleepScores.overall.value` |
| `sleep_quality` | string | — | `sleepScores.overall.qualifierKey` |
| `sleep_quality_duration` | string | — | `sleepScores.totalDuration.qualifierKey` |
| `sleep_quality_stress` | string | — | `sleepScores.stress.qualifierKey` |
| `sleep_quality_awakenings` | string | — | `sleepScores.awakeCount.qualifierKey` |
| `sleep_quality_rem` | string | — | `sleepScores.remPercentage.qualifierKey` |
| `sleep_quality_light` | string | — | `sleepScores.lightPercentage.qualifierKey` |
| `sleep_quality_deep` | string | — | `sleepScores.deepPercentage.qualifierKey` |
| `sleep_quality_restlessness` | string | — | `sleepScores.restlessness.qualifierKey` |
| `sleep_feedback` | string | — | `sleepScoreFeedback` |
| `sleep_insight` | string | — | `sleepScoreInsight` |
| `sleep_resting_hr` | integer | bpm | `restingHeartRate` |
| `sleep_avg_stress` | number | 0–100 | `avgSleepStress` |
| `sleep_awake_count` | integer | count | `awakeCount` |
| `sleep_restless_moments` | integer | count | `restlessMomentsCount` |
| `sleep_respiration` | number | breaths/min | `averageRespirationValue` |
| `sleep_spo2` | integer | % | `averageSpO2Value`; needs Pulse Ox on during sleep |
| `sleep_spo2_low` | integer | % | `lowestSpO2Value` |
| `sleep_body_battery_change` | integer | points | `bodyBatteryChange`; negative when the night drained |
| `nap_hours` | number, 2 dp | hours | `napTimeSeconds` ÷ 3600 |
| `sleep_need_hours` | number, 2 dp | hours | `sleepNeed.actual` ÷ 60 (Sleep Coach) |
| `sleep_need_baseline_hours` | number, 2 dp | hours | `sleepNeed.baseline` ÷ 60 |
| `sleep_need_next_hours` | number, 2 dp | hours | `nextSleepNeed.actual` ÷ 60 |
| `sleep_need_feedback` | string | — | `sleepNeed.feedback` |
| `sleep_need_training_feedback` | string | — | `sleepNeed.trainingFeedback` |
| `sleep_need_history_adjustment` | string | — | `sleepNeed.sleepHistoryAdjustment` |
| `sleep_need_hrv_adjustment` | string | — | `sleepNeed.hrvAdjustment` |
| `sleep_need_nap_adjustment` | string | — | `sleepNeed.napAdjustment` |

`sleep_start` and `sleep_end` come from the GMT fields because Garmin's `*Local` variants have been
reported as double-offset on some accounts. A key that never appears is one Garmin doesn't send for
your watch.

### stress

From the daily summary.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `stress_avg` | integer | 0–100 | `averageStressLevel`; the field most likely to arrive as `-1` |
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

### hrv

From `/hrv-service/hrv/{date}`, the `hrvSummary` object.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `hrv_avg` | number | ms | `lastNightAvg` |
| `hrv_high` | number | ms | `lastNight5MinHigh` |
| `hrv_weekly_avg` | number | ms | `weeklyAvg` |
| `hrv_status` | string | — | `status` (`BALANCED`, `UNBALANCED`, `LOW` …), only when non-empty |
| `hrv_baseline_low` | number | ms | `baseline.balancedLow`, falling back to `baseline.lowUpper` |
| `hrv_baseline_high` | number | ms | `baseline.balancedUpper` |

### readiness

From `/metrics-service/metrics/trainingreadiness/{date}`, its first entry: the day's newest reading
(the history index keeps the morning one).

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `training_readiness` | integer | 0–100 | `score` |
| `training_readiness_level` | string | — | `level` |
| `readiness_sleep_score` | integer | 0–100 | `sleepScore` |
| `recovery_time_hours` | number, 1 dp | hours | `recoveryTime` ÷ 60 |
| `acute_load` | integer | load | `acuteLoad` |
| `readiness_feedback` | string | — | `feedbackShort` |
| `readiness_feedback_long` | string | — | `feedbackLong` |
| `readiness_context` | string | — | `inputContext` |
| `readiness_hrv_weekly_avg` | number | ms | `hrvWeeklyAverage` |

The six factors the app lists under the score each get a percentage (integer, %) and a feedback
string:

| Factor | Percentage | Feedback | Garmin's fields |
| --- | --- | --- | --- |
| sleep | `readiness_sleep_factor` | `readiness_sleep_feedback` | `sleepScoreFactorPercent`, `sleepScoreFactorFeedback` |
| recovery | `readiness_recovery_factor` | `readiness_recovery_feedback` | `recoveryTimeFactorPercent`, `recoveryTimeFactorFeedback` |
| HRV | `readiness_hrv_factor` | `readiness_hrv_feedback` | `hrvFactorPercent`, `hrvFactorFeedback` |
| load | `readiness_load_factor` | `readiness_load_feedback` | `acwrFactorPercent`, `acwrFactorFeedback` |
| sleep history | `readiness_sleep_history_factor` | `readiness_sleep_history_feedback` | `sleepHistoryFactorPercent`, `sleepHistoryFactorFeedback` |
| stress history | `readiness_stress_history_factor` | `readiness_stress_history_feedback` | `stressHistoryFactorPercent`, `stressHistoryFactorFeedback` |

### fitness

Four sources:
- the max-metrics range call (VO₂ Max and acclimation, with a fallback fitness age);
- the hill-score range call (GraphQL `hillScoreScalar`);
- the day's endurance score;
- the day's fitness-age service, the main source of fitness age.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `vo2max` | number | ml/kg/min | `maxMetrics.generic.vo2MaxPreciseValue`, falling back to `vo2MaxValue` |
| `vo2max_cycling` | number | ml/kg/min | `maxMetrics.cycling.vo2MaxPreciseValue`, falling back to `vo2MaxValue` |
| `fitness_age` | number, 2 dp | years | the fitness-age service's `fitnessAge`, falling back to `maxMetrics.generic.fitnessAge` |
| `fitness_age_achievable` | number, 2 dp | years | `achievableFitnessAge` |
| `fitness_age_previous` | number, 2 dp | years | `previousFitnessAge` |
| `chronological_age` | integer | years | `chronologicalAge` |
| `fitness_age_updated` | date | — | `lastUpdated`: when Garmin last recalculated it, which can be days earlier |
| `fitness_age_bmi`, `fitness_age_rhr`, `fitness_age_vigorous_days_avg`, `fitness_age_vigorous_minutes_avg` | number, 2 dp | varies | `components.<name>.value`, one key per component Garmin sends, named in snake case |
| `endurance_score` | number | score | `overallScore` |
| `endurance_classification` | integer | id | `classification` |
| `endurance_feedback` | integer | phrase id | `feedbackPhrase`: a number, not an enum name |
| `endurance_gauge_low`, `endurance_gauge_high` | integer | score | `gaugeLowerLimit`, `gaugeUpperLimit` |
| `endurance_intermediate_from`, `endurance_trained_from`, `endurance_well_trained_from`, `endurance_expert_from`, `endurance_superior_from`, `endurance_elite_from` | integer | score | `classificationLowerLimit<Class>` |
| `hill_score` | integer | score | `hillScoreDTOList[].overallScore` |
| `hill_score_strength` | integer | score | `strengthScore` |
| `hill_score_endurance` | integer | score | `enduranceScore` |
| `hill_score_classification` | integer | id | `hillScoreClassificationId` |
| `hill_score_feedback` | integer | id | `hillScoreFeedbackPhraseId` |
| `heat_acclimation_pct` | integer | % | `heatAltitudeAcclimation.heatAcclimationPercentage` |
| `heat_acclimation_trend` | string | — | `heatAltitudeAcclimation.heatTrend` |
| `altitude_acclimation_m` | integer | m | `heatAltitudeAcclimation.altitudeAcclimation`; metric units only |
| `altitude_acclimation_ft` | integer | ft | the same; imperial units only |
| `altitude_acclimation_trend` | string | — | `heatAltitudeAcclimation.altitudeTrend` |

The precise VO₂ Max is preferred over the rounded one, so a trend line isn't a staircase. When the
range call has nothing for a day and the `training` group is on, training status's
`mostRecentVO2Max` fills in, but only if its own date is that day.

### races

From `/metrics-service/metrics/racepredictions/daily/{displayName}`.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `race_5k` | integer | seconds | `time5K` |
| `race_10k` | integer | seconds | `time10K` |
| `race_half` | integer | seconds | `timeHalfMarathon` |
| `race_marathon` | integer | seconds | `timeMarathon` |

Seconds, deliberately: a number charts and sorts, and formatting is the reader's job.

### respiration

From the daily summary; no extra request.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `respiration_avg` | number | breaths/min | `avgWakingRespirationValue` |
| `respiration_min` | number | breaths/min | `lowestRespirationValue` |
| `respiration_max` | number | breaths/min | `highestRespirationValue` |
| `respiration_latest` | number | breaths/min | `latestRespirationValue`: the big number on the app's card |

### spo2

From the daily summary; no extra request. Wrist pulse oximetry is approximate, and isn't a medical
measurement.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `spo2_avg` | integer | % | `averageSpo2` |
| `spo2_low` | integer | % | `lowestSpo2` |
| `spo2_latest` | integer | % | `latestSpo2` |

### body

From `/weight-service/weight/dayview/{date}`. Garmin's daily average is preferred over the first
weigh-in. Garmin reports every mass in grams, and only one key of each pair is written, by the unit
setting. A day with no weigh-in writes nothing.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `weight_kg`, `weight_lb` | number, 1 dp | kg, lb | `weight` (grams) |
| `bmi` | number, 2 dp | — | `bmi` |
| `body_fat_pct` | number, 2 dp | % | `bodyFat` |
| `body_water_pct` | number, 2 dp | % | `bodyWater` |
| `muscle_mass_kg`, `muscle_mass_lb` | number, 1 dp | kg, lb | `muscleMass` (grams) |
| `bone_mass_kg`, `bone_mass_lb` | number, 1 dp | kg, lb | `boneMass` (grams) |

### training

From `/metrics-service/metrics/trainingstatus/aggregated/{date}`, plus the running-tolerance range
call.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `training_status` | string | — | `<status>.trainingStatusFeedbackPhrase` |
| `training_status_since` | date | — | `<status>.sinceDate` |
| `fitness_trend` | integer | enum | `<status>.fitnessTrend` |
| `training_load_weekly` | integer | load | `<status>.weeklyTrainingLoad` |
| `training_load_tunnel_min` | integer | load | `<status>.loadTunnelMin` |
| `training_load_tunnel_max` | integer | load | `<status>.loadTunnelMax` |
| `training_load_acute` | integer | load | `<acute>.dailyTrainingLoadAcute` |
| `training_load_chronic` | integer | load | `<acute>.dailyTrainingLoadChronic` |
| `training_load_optimal_min` | integer | load | `<acute>.minTrainingLoadChronic` |
| `training_load_optimal_max` | integer | load | `<acute>.maxTrainingLoadChronic` |
| `training_load_ratio` | number, 2 dp | ratio | `dailyAcuteChronicWorkloadRatio`, or `acwrPercent` ÷ 100 |
| `training_load_status` | string | — | `<acute>.acwrStatus` |
| `training_load_feedback` | string | — | `<acute>.acwrStatusFeedback` |
| `load_aerobic_low`, `load_aerobic_high`, `load_anaerobic` | integer | load | `<balance>.monthlyLoadAerobicLow`, `monthlyLoadAerobicHigh`, `monthlyLoadAnaerobic` |
| `load_aerobic_low_target_min`, `load_aerobic_low_target_max` | integer | load | `<balance>.monthlyLoadAerobicLowTargetMin`, `…TargetMax` |
| `load_aerobic_high_target_min`, `load_aerobic_high_target_max` | integer | load | `<balance>.monthlyLoadAerobicHighTargetMin`, `…TargetMax` |
| `load_anaerobic_target_min`, `load_anaerobic_target_max` | integer | load | `<balance>.monthlyLoadAnaerobicTargetMin`, `…TargetMax` |
| `load_focus` | string | — | `<balance>.trainingBalanceFeedbackPhrase` |
| `running_tolerance` | number | m | `runningtolerance/stats` `acuteTolerance` |
| `running_tolerance_load` | number | m | `acuteImpactLoad` |
| `running_tolerance_distance_km`, `running_tolerance_distance_mi` | number, 2 dp | km, mi | `acuteDistance` (metres), by the unit setting |
| `running_tolerance_feedback` | string | — | `runningToleranceFeedBackPhrase` |

- **`<status>`** is `mostRecentTrainingStatus.latestTrainingStatusData.<deviceId>`.
- **`<acute>`** is the top-level `acuteTrainingLoadDTO`, or the one inside that entry when the top
  level has none.
- **`<balance>`** is `mostRecentTrainingLoadBalance.metricsTrainingLoadBalanceDTOMap.<deviceId>`.

Both maps are keyed by device. An account with a watch and a bike computer has several entries, and
the mapper takes the one marked `primaryTrainingDevice: true`, or whichever is there.

### workouts

From the activity list, `/activitylist-service/activities/search/activities`, bucketed by the local
day each activity started. The value is a **list of objects**, and the key is left out on a day
without activities.

| Key | Type | Unit | Source field |
| --- | --- | --- | --- |
| `name` | string | — | `activityName` |
| `type` | string | — | `activityType.typeKey` |
| `start` | datetime | the watch's local time | `startTimeLocal` |
| `minutes` | integer | minutes | `duration` ÷ 60 |
| `duration_s` | integer | seconds | `duration`: the app's total time, which `minutes` rounds away |
| `distance_km`, `distance_mi` | number, 2 dp | km, miles | `distance` |
| `calories` | integer | kcal | `calories` |
| `avg_hr` | integer | bpm | `averageHR` |
| `max_hr` | integer | bpm | `maxHR` |
| `elevation_gain_m`, `elevation_gain_ft` | integer | m, ft | `elevationGain` |
| `steps` | integer | count | `steps` |
| `training_effect` | number, 1 dp | 0–5 | `aerobicTrainingEffect` |
| `pace` | string | m:ss per km or mile | `movingDuration` (else `duration`) ÷ `distance` |

```json
"workouts": [
	{"name":"Morning Run","type":"running","start":"2026-09-12T07:31","minutes":31,"duration_s":1830,"distance_km":5.12,"calories":412,"avg_hr":148,"max_hr":171,"elevation_gain_m":42,"training_effect":3.4,"pace":"5:52"}
]
```

`pace` is a string, computed from **moving** time rather than elapsed. It is left out for activities
with no distance, and for paces slower than 30 minutes per unit. Garmin sends about a hundred fields
per activity; the [activity index](#the-activity-index--activities) and
[activity details](#activity-details--activity-details) keep the rest.

### intraday

Six requests a day, spent on the days inside **Day details**. They also run on every day of **Sync a
date range…**, and before the setup on the newest seven days of a sync. One property reaches the day
file:

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `hr_latest` | integer | bpm | the last non-null reading in `heartRateValues` |

Everything else goes to the day's [series file](#series-files--series).

### health

Health Status, from the GraphQL gateway's `healthStatusSummary`, one request a day. Each metric Garmin
judges against your baseline gets a value, a status (`IN_RANGE`, `BELOW`, `ABOVE` or `ONBOARDING`)
and a baseline pair. The baseline pair is left out while it reads 0–0, which means no baseline yet.

| Metric | Value | Status | Baseline |
| --- | --- | --- | --- |
| HRV | `health_hrv` | `health_hrv_status` | `health_hrv_baseline_low`, `health_hrv_baseline_high` |
| Heart rate | `health_hr` | `health_hr_status` | `health_hr_baseline_low`, `health_hr_baseline_high` |
| Pulse Ox | `health_spo2` | `health_spo2_status` | `health_spo2_baseline_low`, `health_spo2_baseline_high` |
| Respiration | `health_respiration` | `health_respiration_status` | `health_respiration_baseline_low`, `health_respiration_baseline_high` |
| Skin temperature (°C) | `health_skin_temp_c` | `health_skin_temp_c_status` | `health_skin_temp_c_baseline_low`, `health_skin_temp_c_baseline_high` |
| Skin temperature (°F) | `health_skin_temp_f` | `health_skin_temp_f_status` | `health_skin_temp_f_baseline_low`, `health_skin_temp_f_baseline_high` |

- Values and baselines are numbers to 2 dp. Skin temperature is a signed deviation, and only the
  account's unit is written.
- A metric type Garmin adds later is written as `health_<type in snake case>`.
- `health_status_outliers` (integer) counts the outliers.
- `health_snapshots` is a list, one row per Health Snapshot (GraphQL `healthSnapshotScalar`). Each
  row has `start` (the watch's local time) and the averages `hr`, `respiration`, `stress`, `spo2`,
  `hrv` (RMSSD) and `hrv_sdrr`, to 1 dp.

### profile — `account.json`

Nothing goes into the day files. About nine requests a sync write `<dataFolder>/account.json`:

| Key | Source |
| --- | --- |
| `displayName`, `fullName`, `avatar` (`large`, `medium`, `small`) | `socialProfile`. Never `userName`, which is the sign-in email |
| `sex`: `male` or `female` | user settings `userData.gender`. Garmin grades VO₂ Max and FTP against tables that differ by sex |
| `device`: `name`, `imageUrl`, `lastUpload` | `deviceservice/mylastused` |
| `lactateThreshold`: `date`, `heartRate`, `speed`, `pace` | `biometric/latestLactateThreshold`, with user settings as a fallback. `speed` is m/s to 5 dp: Garmin sends a tenth of the real value, so it is multiplied by 10. `pace` is in the units of the last sync |
| `ftp.running`, `ftp.cycling`, `ftp.xcSkiing`: `date`, `watts`, `wattsPerKg` (2 dp), `ftpDate`, `weight` (kg, 1 dp), `weightDate`, `stale` | `biometric/powerToWeight/latest/{date}`, one call that returns a row per sport. `date` is the newer of the FTP's day and the weigh-in's; `stale` is Garmin's `isStale`, an FTP more than a year old |
| `runningEconomy`: `date`, `score`, `classification` | `runningeconomy/latest/{date}`: the newest reading on or before today |
| `cyclingAbility` | GraphQL `cyclingAbility.latest` |
| `trainingPlans[]`: `name`, `type`, `status`, `start`, `end`, `weeks` | `trainingplan/plans`, completed plans left out |
| `events[]`: `name`, `date`, `type`, `primary`, `distanceMetres`, `goalSeconds` | GraphQL `myDayCardEventsScalar` |
| `personalRecords[]`: `type` (`run_5k` …), `typeId`, `value`, `date`, `activityId`, `activityName`, `activityType` | `personalrecord/prs/{displayName}`. `typeId` is Garmin's record-type id; `date` is the activity's local day, as the app shows it |

## Series files — `series/`

A day of heart rate is hundreds of points, so the timelines go to a file per day instead of the day
file. Every day a sync writes gets one while `intraday` is on. Only the days inside Day details spend
the six requests; the others carry what the day's other payloads hold, such as the night's sleep.

```jsonc
// series/2026-09-20.json
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
  // Midnight on the watch's clock: the day's charts start here.
  "dayStart":    1789848000000,
  // level: Garmin's stage code, believed to be 0 deep, 1 light, 2 REM, 3 awake.
  "sleepLevels": [{ "start": 1789855080000, "end": 1789856880000, "level": 1 }],
  "bodyBatteryEvents": [{ "type": "SLEEP", "start": 1789855080000, "minutes": 464, "impact": 52, "feedback": "…" }],
  // The night that ended this day: scores, stages, factors, Sleep Coach need, overnight vitals.
  "sleep":       { "start": 1789855080000, "end": 1789884900000, "score": 84, "quality": "GOOD", "factors": { "…": "…" } },
  // Blocks a page loaded on view, or the sync kept itself, by key.
  "extra":       { "heartDay": { "…": "…" }, "hrvDay": { "…": "…" } },
  // Keys loaded on view, with data or without, so a day Garmin had nothing for isn't asked again.
  "checked":     ["heartDay", "spo2Day"]
}
```

Every timestamp is epoch milliseconds, UTC, and a key is left out when Garmin had nothing for it.

- **`extra`** holds what a page loaded when it opened a day the sync didn't cover:
  - Health Stats: `stressDay`, `heartDay`, `respirationDay`, `spo2Day`, `fitnessAgeDay`,
    `snapshotList`, `snapshotDay`;
  - Performance Stats: `enduranceDay`.
- **Written by the sync itself:** `hrvDay` (the night's HRV readings) and `readinessDay` (every
  Training Readiness reading of the day). It writes them from calls it already makes, and never
  erases them: Garmin drops old HRV readings.
- **A sync's write merges** (`keepBlocks`). It refreshes the blocks it fetched and keeps any block
  Garmin no longer sends. A write that fetched the day's timelines drops the on-view extras and
  `checked`, so the next view fetches them fresh; a write that fetched only the night keeps them.

## Activity details — `activity-details/`

An activity's page needs far more than its index row. The first time it opens (or ahead of time,
with an **Activity details** range), the plugin asks Garmin for the rest and keeps the answer in one
file per activity:
- 11 requests for a run or ride with power;
- 9 for one without power, or an open-water swim;
- 8 without GPS or power, such as a pool swim or yoga.

| Key | Holds | Source (`/activity-service/activity/{id}` unless named) |
| --- | --- | --- |
| `version` | the file's layout, 6. A run's file of version 5 is kept and read as 6, with its summary and badges left to fetch; any other file of another version reads as missing and is fetched again | — |
| `id`, `name`, `type`, `typeId`, `parentTypeId`, `start`, `startGmt`, `timeZone`, `privacy`, `notes`, `deviceVersionPk`, `windData` | the activity | the summary |
| `hasPolyline`, `hasPowerZones` | whether it has a GPS track and time in power zones; without them the page draws no map and the weather and power zones aren't asked | the summary's `metadataDTO` |
| `pool` | a pool swim's `length` and `unit` (`m` or `yd`) | `poolLength`, `unitOfPoolLength` |
| `summary` | the summary's figures as Garmin sent them, unrounded, so a page rounds once | the summary |
| `samples` | the recorded samples as columns of equal length, in Garmin's units (listed below). A column the watch didn't record is left out; `null` is a gap | `/details` |
| `laps` | each lap's figures, unrounded; a pool swim's `lengths` one by one, and `rest` on a rest | `/splits` |
| `positions` | a ride's rider positions: when each stretch of standing or sitting began | `/splits`' events |
| `segments` | run, walk and idle stretches, and workout intervals | `/typedsplits` |
| `hrZones`, `powerZones` | seconds in each zone, with its bounds | `/hrTimeInZones`, `/powerTimeInZones` |
| `weather` | temperature and feels-like (°F), humidity, wind, gusts and direction, and Garmin's description | `/weather` |
| `gear` | the gear on the activity | `/gear-service/gear/filterGear` |
| `device` | the watch, and the firmware it was recorded on | `/device-service/deviceservice/app-info/{versionPk}` |
| `sensors` | the sensors it recorded with: a name from Garmin's product catalogue, its firmware and battery. Never a serial number | the summary's `metadataDTO.sensors` |
| `badges` | the badges it earned: the name and Garmin's key | `/badge-service/badge/{displayName}/earned/activity/{id}` |
| `weightKg` | the newest weigh-in on or before the activity's day, for Power (W/kg) | `/weight-service/weight/latest` |
| `checked` | the blocks Garmin answered, with data or without | — |

The `samples` columns:
- **Common:** `time`, `distance`, `hr`, `speed`, `gap`, `cadence`, `stride`, `vo`, `vr`, `gct`,
  `elevation`, `power`, `stamina`, `potential`, `performance`, `impact`, `breaths`, `gctBalance`,
  `speedLoss`, `speedLossPct`, `lat`, `lon`, `temperature` (°C), and `clock` (seconds since the
  start, pauses included).
- **A ride:** `bikeCadence`, `balanceRight` (the right pedal's share, %), the power phase angles
  (`ppStartL`, `ppEndL`, `pppStartL`, `pppEndL`, `ppStartR`, `ppEndR`, `pppStartR`, `pppEndR`), and
  the platform centre offsets `pcoL` and `pcoR` (mm).
- **A swim:** `strokeRate`.

A block missing from `checked` (its request failed) is asked again on the next view. When the
activity index shows the activity renamed or trimmed, the whole file is fetched afresh. The file is
rewritten only when its content changes. `lat` and `lon` are where you ran, rode or swam.

## History indexes

The pages inside Home don't read the day files for their charts: a year of charts needs every day of
the year, which the day files have only once a sync has reached each one. So the sync keeps an index
per page beside them, with Garmin's own daily figures: a file per year and an `index.json`, in a
folder under the data folder.

```text
<dataFolder>/<folder>/index.json   {version, from, to, complete} for the day-by-day indexes
<dataFolder>/<folder>/2025.json    one row per line, keys always in the same order
<dataFolder>/<folder>/2026.json
```

- **Rows** are oldest first, and a day with nothing has no row. The activity index differs: see
  [below](#the-activity-index--activities).
- **`index.json`** holds `from` and `to` (the stretch fetched end to end) and `complete` (whether
  fetching further back found nothing).
- **Every sync** keeps each index current. Its own days come free from what it fetched anyway. Any
  other days in the run, and the stretch since the index's newest day, are asked of the index's range
  request.
- **The whole history** comes once, from the history download or a **Sync … history** command,
  walking back a year of windows at a time.

### The activity index — `activities/`

Every activity on the account, with Garmin's raw numbers: the Activities pages need more than the day
files' rounded `workouts` rows.

```jsonc
// activities/2026.json — newest first, one activity per line.
{
	"version": 3,
	"year": 2026,
	"activities": [
		{"id":20460000001,"name":"Morning Run","type":"running","typeId":1,"parentTypeId":17,"start":"2026-10-03T14:59:19","begin":1791025159000,"distance":8008.75,"duration":2493.64,"ascent":52,"calories":543,"event":"race","favorite":true,"pr":true}
	]
}
```

| Key | Unit | Source field |
| --- | --- | --- |
| `id` | — | `activityId` |
| `name` | — | `activityName` |
| `type`, `typeId`, `parentTypeId` | — | `activityType`. The parent decides the page: treadmill_running (18) sits under running (1) |
| `start` | local time | `startTimeLocal`; the year in the file name is this one's |
| `begin` | epoch ms | `beginTimestamp`, which orders the list |
| `distance` | metres | `distance` |
| `duration` | seconds | `duration`, the app's total time |
| `ascent` | metres | `elevationGain` |
| `calories` | kcal | `calories` |
| `aerobic`, `anaerobic` | 0–5, a tenth | `aerobicTrainingEffect`, `anaerobicTrainingEffect` |
| `benefit` | — | `trainingEffectLabel`, the primary benefit |
| `aerobicMsg`, `anaerobicMsg` | — | `aerobicTrainingEffectMessage`, `anaerobicTrainingEffectMessage` |
| `load` | — | `activityTrainingLoad`, the exercise load |
| `power` | W | a ride's best average power by duration: `maxAvgPower_1` … `maxAvgPower_7200`, and `maxAvgPower_18000` if Garmin sends it |
| `noPowerCurve` | — | `true` when the rider left the ride out of the power curve |
| `event` | — | `eventType.typeKey` (`race`, `training` …), left out when `uncategorized` |
| `favorite`, `pr` | — | `true` for a favourite, and while the activity holds a personal record |
| `pool` | — | a pool swim's length unit, `m` or `yd` |

Numbers are rounded to two decimals, and a key is left out when the activity has nothing for it.
Rows are newest first. Its `index.json` holds `version`, `complete` (a whole listing has been
merged), `units` (the account's, at the last sync) and `total` (the list's length when last
counted); it has no `from` or `to`. Multisport legs aren't in Garmin's list, so a triathlon counts once.

### The daily stats index — `daily-stats/`

Every day on the account with Garmin's own daily figures, for the Steps, Floors and Intensity Minutes
pages: `distance` here counts only what was walked or run.

```jsonc
// daily-stats/2026.json — oldest first, keys always in this order.
{"date":"2026-10-03","steps":11710,"stepGoal":6770,"distance":11465,"calories":2606,"floorsUp":32,"floorsDown":18,"floorsGoal":10,"moderate":13,"vigorous":45,"intensityGoal":150}
```

| Key | Unit | Source field |
| --- | --- | --- |
| `steps`, `stepGoal` | count | `totalSteps`, `dailyStepGoal` / `stepGoal` |
| `distance` | metres, on foot | `wellnessDistanceMeters` / `totalDistance` |
| `calories` | kcal | `totalKilocalories`; only the daily summary has it, so the pages fall back to the day file's `calories` |
| `floorsUp`, `floorsDown`, `floorsGoal` | whole floors | `floorsAscended`, `floorsDescended` (rounded down) / `wellnessFloorsAscended` … |
| `moderate`, `vigorous` | minutes | `moderateIntensityMinutes`, `vigorousIntensityMinutes` / `moderateValue`, `vigorousValue` |
| `intensityGoal` | minutes a week | `intensityMinutesGoal` / `weeklyGoal` |

A day the watch recorded nothing has no row, which is what a year's "Avg Daily" divides by. Its
history costs about 40 requests a year: three routes, 28 days a request.

### The sleep index — `sleep/`

A row a night, filed under the day it ended. The fields are:
- the score: `score`, `quality`, and the Sleep Coach `need` in minutes;
- time asleep and in each stage, in seconds: `seconds`, `deep`, `light`, `rem`, `awake`;
- `bed` and `wake`, as seconds from that day's midnight (negative before it);
- overnight vitals: `hr`, `rhr`, `bb` (Body Battery gained), `resp`, `spo2`, `skinC` and `skinF`,
  `hrv`, `hrv7d`, `hrvStatus`;
- the `align` verdict, with its `alignStart` and `alignEnd` window.

Its history costs about 14 requests a year.

### Day indexes

One folder per Health and Performance Stats history, each defined in `src/sync/<stat>-index.ts`.
The columns are:
- **Window:** how many days one request covers.
- **Re-read:** how many recent days every sync fetches again, because Garmin revises them (`refreshDays`).

| Folder | Group | Pages | A row holds | Window | Re-read |
| --- | --- | --- | --- | --- | --- |
| `stress/` | `stress` | Stress, Training Readiness | `level`, the seconds at `rest`, `low`, `medium`, `high`; `qualifier` | 28 | 0 |
| `heart-rate/` | `heart` | Heart Rate | `resting`, `high`, `low` (two-minute averages), `avg7` (seven-day resting average) | 28 | 0 |
| `body-battery/` | `stress` | Body Battery | `high`, `low`, `charged`, `drained`, `latest`, `atWake`, and the day's `feedback` key | 28, two requests | 0 |
| `respiration/` | `respiration` | Respiration | `awake` and `sleep` averages, breaths a minute | 31 | 2 |
| `health-status/` | `health` | Health Status | for each of `hr`, `hrv`, `resp`, `skin` and `spo2`: the value, baseline, ring and status (`hr`, `hrLo`, `hrHi`, `hrPct`, `hrSt`, and the same for the others); `out`, the outlier count | 3660 | 28 |
| `fitness-age/` | `fitness` | Fitness Age | `age`, `achievable`, `rhr`, `vigDays`, `bmi`, on the days Garmin recalculated it | 29 | 7 |
| `weight/` | `body` | Weight | in grams: `w` (the day's latest weigh-in), `lo`, `hi`, `avg`, `d` (Garmin's change); `n` (weigh-ins), `ins` (each one), `h` (height, cm) | 3660, two requests | 7 |
| `pulse-ox/` | `spo2` | Pulse Ox, Pulse Ox Acclimation | `avg`, `low`, `latest` (%), `elev` (mean elevation, m) | 3660 | 0 |
| `blood-pressure/` | `body` | Blood Pressure | `sys`, `dia`, `sysLo`, `diaLo`, `pulse`, `n` (readings), `cat` (Garmin's category) | 3660 | 7 |
| `vo2-max/` | `fitness` | VO₂ Max, Hill Score's VO₂ factor, Training Status | `vo2` (to a tenth) and `vo2Value` (Garmin's whole number), `cycling` and `cyclingValue` | 365 | 0 |
| `hill-score/` | `fitness` | Hill Score | `score`, `strength`, `endurance`, `classId`, `phraseId` | 365 | 2 |
| `hrv-status/` | `hrv` | HRV Status, Training Readiness, Training Status | in ms: `weekly`, `night`, `high`, `lowUpper`, `balLow`, `balHigh`; `marker`, `status`, `feedback` | 367 | 28 |
| `race-predictions/` | `races` | Race Predictor | seconds: `time5k`, `time10k`, `half`, `marathon` | 365 | 2 |
| `training-status/` | `training` | Training Status, Load's Training Load tab, Training Readiness | `code`, `phrase`; `acute`, `chronic`, `ratio`, `acwr`, `acwrPct`, `acwrFeedback`; `trend`, `trendSport`; `paused` | 365 | 2 |
| `endurance-score/` | `fitness` | Endurance Score | `score`, `classId`, `phraseId`, and `contrib`: the day's contributors as text | 365 | 2 |
| `heat-acclimation/` | `fitness` | Heat Acclimation, Training Status's row | `pct`, `prev`, `trend`; `altitude`, `altitudePrev`, `altitudeTrend`, `altitudeNow` (m) | 365 | 2 |
| `training-readiness/` | `readiness` | Training Readiness | the morning reading: `time`, `ctx`, `score`, `level`, `short`, `long`, then `sleep`, `sleepPct`, `sleepFb`, `recovery`, `recoveryPct`, `recoveryFb`, `acute`, `acwrPct`, `acwrFb`, `hrv`, `hrvPct`, `hrvFb`, `sleepHistPct`, `sleepHistFb`, `stressHistPct`, `stressHistFb` | 367 | 2 |
| `running-tolerance/` | `training` | Running Tolerance's Current | in metres: `load`, `distance`, `tolerance`; `phrase` | 365 | 2 |
| `running-tolerance-weeks/` | `training` | Running Tolerance's 12w and 1y | a Sunday week: `from`, `to`, and in metres `load`, `distance`, `tolerance` | 350 | 14 |
| `ftp/` | `fitness` | FTP, Running Lactate Threshold's power | `cycling`, `xc`, `running` (W) and `cyclingWkg`, `xcWkg`, `runningWkg` (W/kg, 4 dp) | 367, two requests | 0 |
| `lactate-threshold/` | `fitness` | Running Lactate Threshold | `hr` (bpm), `speed` (m/s, 5 dp) | 367, two requests | 0 |
| `running-economy/` | `fitness` | Running Economy | `score` (lower is better), `classification` | 366 | 2 |
| `critical-swim-speed/` | `workouts` | Critical Swim Speed | `speed` (m/s, 4 dp); the pace per 100 m is 100 ÷ `speed` seconds | 367 | 0 |
| `hrv-stress/` | `hrv` | HRV Stress | `score` (0–100, the day's last test), `n` (tests that day) | 3660 | 0 |

Critical Swim Speed's and HRV Stress's field names are inferred from the routes' names, their
sibling routes and Garmin's help, until a real result is recorded.

## Bookkeeping files

A few small files keep the sync's own state. They are plain JSON written through Obsidian, so they
sync like any other file.

| Path | Holds | Written by |
| --- | --- | --- |
| `sync-state.json` | the watch's last upload at the last **Sync recent days**: its mark | **Sync recent days** |
| `scan.json` | where your Garmin history starts and ends, as the scan found it | the setup |
| `backfill.json` | whether the history download is paused, and which device runs it | the history download |
| `days/index.json` | which days' details were fetched whole, and at which version of Day details | every sync and the history download |
| `activity-details/index.json` | each activity file's version | each activity's page as it is saved |
