import type { IntradayDef } from "./intraday-registry";
import { STRESS_DAY } from "./stress-index";

/**
 * Every registered intraday extra (`intraday-registry.ts`): a stat's own day
 * payload, loaded on view and kept in the day's series file under
 * `extra[key]`. One entry per payload, defined in the stat's own
 * `src/sync/<stat>-index.ts`:
 *
 *   import { RESPIRATION_DAY } from "./respiration-index";
 *   export const INTRADAY_EXTRAS: readonly IntradayDef[] = [RESPIRATION_DAY];
 *
 * A page then asks for it with `loadIntraday(date, [RESPIRATION_DAY.key])`.
 * Stress, Body Battery, heart rate and Body Battery events are the series
 * file's own blocks, loadable by their own keys. Stress still registers
 * `STRESS_DAY`, because its block turns Garmin's two "not measured" codes
 * into the same null and the 1d timeline draws them apart.
 *
 * Pure, so the tests can check every entry.
 */
export const INTRADAY_EXTRAS: readonly IntradayDef[] = [STRESS_DAY];
