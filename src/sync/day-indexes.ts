import { BLOOD_PRESSURE_INDEX } from "./blood-pressure-index";
import { BODY_BATTERY_INDEX } from "./body-battery-index";
import type { DayIndexDef } from "./day-index";
import { HEALTH_STATUS_INDEX } from "./health-status-index";
import { FITNESS_AGE_INDEX } from "./fitness-age-index";
import { HEART_RATE_INDEX } from "./heart-rate-index";
import { HILL_SCORE_INDEX } from "./hill-score-index";
import { HRV_STATUS_INDEX } from "./hrv-status-index";
import { PULSE_OX_INDEX } from "./pulse-ox-index";
import { RACE_PREDICTIONS_INDEX } from "./race-predictor-index";
import { RESPIRATION_INDEX } from "./respiration-index";
import { STRESS_INDEX } from "./stress-index";
import { TRAINING_STATUS_INDEX } from "./training-status-index";
import { VO2_MAX_INDEX } from "./vo2-max-index";
import { WEIGHT_INDEX } from "./weight-index";

/**
 * Every registered day index (`day-index.ts`), in the order the automatic
 * history walk takes them. One entry per stat, defined in its own
 * `src/sync/<stat>-index.ts`:
 *
 *   import { STRESS_INDEX } from "./stress-index";
 *   export const DAY_INDEXES: readonly DayIndexDef[] = [STRESS_INDEX];
 *
 * Registering is all it takes: routine syncs keep the index current, the
 * runner walks its history once per session and adds a "Sync <title> history"
 * command, Home reads it with `readIndex(kind)` and watches its folder.
 *
 * Pure, so the tests can check every entry; a definition must not import
 * Obsidian.
 */
export const DAY_INDEXES: readonly DayIndexDef[] = [STRESS_INDEX, HEART_RATE_INDEX, BODY_BATTERY_INDEX, RESPIRATION_INDEX, HEALTH_STATUS_INDEX, FITNESS_AGE_INDEX, WEIGHT_INDEX, PULSE_OX_INDEX, BLOOD_PRESSURE_INDEX, VO2_MAX_INDEX, HILL_SCORE_INDEX, HRV_STATUS_INDEX, RACE_PREDICTIONS_INDEX, TRAINING_STATUS_INDEX];

/** A registered index by its kind. */
export function dayIndex(kind: string): DayIndexDef | undefined {
	return DAY_INDEXES.find((def) => def.kind === kind);
}
