# Property reference

Every frontmatter property the sync can write, what it comes from, and what its
value means. Generated from `src/sync/metrics.ts` — if the two ever disagree,
the code is right.

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

`calories` includes the resting burn; `calories_active` is what you moved for
and `calories_bmr` is what your body would have used lying still. The three
activity-band minutes plus sleep account for the whole day, which is what makes
them worth reading as proportions rather than as separate numbers.

Only one distance key is ever written — whichever the unit setting selects.
`intensity_minutes` uses **Garmin's own weighting**, where a vigorous minute
counts double; it is written whenever either component exists, treating the
missing one as zero.

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

Garmin counts recovery in minutes; it is written here in hours, which is how
anyone reads it. When readiness is low, the factor properties say why.

## fitness

Two sources: a range call for VO2 Max and fitness age, a per-day call for
endurance score.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `vo2max` | number | ml/kg/min | `maxMetrics.generic.vo2MaxPreciseValue`, falling back to `vo2MaxValue` |
| `vo2max_cycling` | number | ml/kg/min | `maxMetrics.cycling.vo2MaxPreciseValue`, falling back to `vo2MaxValue` |
| `fitness_age` | number | years | `maxMetrics.generic.fitnessAge` |
| `endurance_score` | number | score | `endurance.overallScore` |

Garmin sends both a rounded and a precise VO2 Max. The precise one is preferred
because a rounded series makes a trend line into a staircase.

> **Known issue.** `vo2max` currently never populates even on accounts where
> Garmin plainly has the data. See [troubleshooting](troubleshooting.md#vo2-max-is-always-empty).

## respiration

From the daily summary call — no extra request.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `respiration_avg` | number | breaths/min | `avgWakingRespirationValue` |
| `respiration_min` | number | breaths/min | `lowestRespirationValue` |
| `respiration_max` | number | breaths/min | `highestRespirationValue` |

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
| `training_status` | string | — | `latestTrainingStatusData.*.trainingStatusFeedbackPhrase` |
| `training_load_weekly` | integer | load | `latestTrainingStatusData.*.weeklyTrainingLoad` |
| `training_load_acute` | integer | load | `acuteTrainingLoadDTO.dailyTrainingLoadAcute` |
| `training_load_chronic` | integer | load | `acuteTrainingLoadDTO.dailyTrainingLoadChronic` |
| `training_load_ratio` | number, 2 dp | ratio | `dailyAcuteChronicWorkloadRatio`, or `acwrPercent` ÷ 100 |
| `training_load_status` | string | — | `acuteTrainingLoadDTO.acwrStatus` |

`latestTrainingStatusData` is keyed by **device id**, and an account with a watch
and a bike computer has several — none of them knowable in advance. The mapper
takes whichever entry is there.

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
label used by the Bases view and the dashboard (`resting_hr` → "Resting HR").
Adding a property means adding a label there too, or the column header falls
back to the raw key.
