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

Only one distance key is ever written — whichever the unit setting selects.
`intensity_minutes` uses **Garmin's own weighting**, where a vigorous minute
counts double; it is written whenever either component exists, treating the
missing one as zero.

## heart

From the same daily summary call as `activity`.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `resting_hr` | integer | bpm | `restingHeartRate` |
| `min_hr` | integer | bpm | `minHeartRate` |
| `max_hr` | integer | bpm | `maxHeartRate` |

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
| `sleep_start` | datetime | local | `sleepStartTimestampGMT` |
| `sleep_end` | datetime | local | `sleepEndTimestampGMT` |

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
| `body_battery_high` | integer | 0–100 | `bodyBatteryHighestValue` |
| `body_battery_low` | integer | 0–100 | `bodyBatteryLowestValue` |

`averageStressLevel` is the field most likely to arrive as `-1`; see the absent
rules above.

## hrv

From `/hrv-service/hrv/{date}`, the `hrvSummary` object.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `hrv_avg` | number | ms | `lastNightAvg` |
| `hrv_high` | number | ms | `lastNight5MinHigh` |
| `hrv_weekly_avg` | number | ms | `weeklyAvg` |
| `hrv_status` | string | — | `status` |

`hrv_status` is Garmin's own label (`BALANCED`, `UNBALANCED`, `LOW`, and so on)
and is written only when it is a non-empty string.

## readiness

From `/metrics-service/metrics/trainingreadiness/{date}`, first entry.

| Property | Type | Unit | Source field |
| --- | --- | --- | --- |
| `training_readiness` | integer | 0–100 | `[0].score` |
| `training_readiness_level` | string | — | `[0].level` |

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

```yaml
workouts:
  - name: Morning Run
    type: running
    start: 2026-09-12T07:31
    minutes: 31
    distance_km: 5.12
    calories: 412
    avg_hr: 148
```

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
