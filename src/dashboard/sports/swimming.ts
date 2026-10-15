import type { SportProfile } from "../activity-sports";
import { BASIC } from "./basic";

/**
 * STUBS for builder C (`ref/activity-details/pool-swim` and `open-water-swim`):
 * both swims' pages are the basic page until their profiles land here — the
 * pool's interval table with its rest rows and per-length bars, no map; open
 * water's red route, strokes and temperature; swim units by the pool's.
 */
export const POOL_SWIM: SportProfile = { ...BASIC, id: "pool-swim" };

export const OPEN_WATER_SWIM: SportProfile = { ...BASIC, id: "open-water-swim" };
