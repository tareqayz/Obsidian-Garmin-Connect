import { FITNESS_AGE_DAY } from "./fitness-age-index";
import { SNAPSHOT_DAY, SNAPSHOT_LIST } from "./health-snapshot-index";
import { HEART_DAY } from "./heart-rate-index";
import type { IntradayDef } from "./intraday-registry";
import { SPO2_DAY } from "./pulse-ox-index";
import { RESPIRATION_DAY } from "./respiration-index";
import { STRESS_DAY } from "./stress-index";

/**
 * Every registered intraday extra (`intraday-registry.ts`): a stat's own day
 * payload, loaded on view and kept in the day's series file under
 * `extra[key]`. One entry per payload, defined in the stat's own
 * `src/sync/<stat>-index.ts`:
 *
 *   import { RESPIRATION_DAY } from "./respiration-index";
 *   export const INTRADAY_EXTRAS: readonly IntradayDef[] = [STRESS_DAY];
 *
 * A page then asks for it with `loadIntraday(date, [RESPIRATION_DAY.key])`.
 * Stress, Body Battery, heart rate and Body Battery events are the series
 * file's own blocks, loadable by their own keys. Stress still registers
 * `STRESS_DAY`, because its block turns Garmin's two "not measured" codes
 * into the same null and the 1d timeline draws them apart. Heart Rate
 * registers `HEART_DAY`, because its block keeps neither the day's end nor
 * Garmin's figures for it, which a history day's 1d page needs.
 *
 * Pure, so the tests can check every entry.
 */
export const INTRADAY_EXTRAS: readonly IntradayDef[] = [STRESS_DAY, HEART_DAY, RESPIRATION_DAY, FITNESS_AGE_DAY, SNAPSHOT_LIST, SNAPSHOT_DAY, SPO2_DAY];
