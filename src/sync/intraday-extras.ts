import type { IntradayDef } from "./intraday-registry";

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
 * Stress, Body Battery, heart rate and Body Battery events need no entry:
 * they are the series file's own blocks, loadable by their own keys.
 *
 * Pure, so the tests can check every entry.
 */
export const INTRADAY_EXTRAS: readonly IntradayDef[] = [];
