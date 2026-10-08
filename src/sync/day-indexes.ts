import { BODY_BATTERY_INDEX } from "./body-battery-index";
import type { DayIndexDef } from "./day-index";
import { HEART_RATE_INDEX } from "./heart-rate-index";
import { RESPIRATION_INDEX } from "./respiration-index";
import { STRESS_INDEX } from "./stress-index";

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
export const DAY_INDEXES: readonly DayIndexDef[] = [STRESS_INDEX, HEART_RATE_INDEX, BODY_BATTERY_INDEX, RESPIRATION_INDEX];

/** A registered index by its kind. */
export function dayIndex(kind: string): DayIndexDef | undefined {
	return DAY_INDEXES.find((def) => def.kind === kind);
}
