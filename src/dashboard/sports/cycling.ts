import type { SportProfile } from "../activity-sports";
import { BASIC } from "./basic";

/**
 * STUB for builder B (road cycling, `ref/activity-details/road-cycling`): a
 * ride's page is the basic page until its profile lands here — the power map
 * and its legend, the 17 Stats sections, Lap · Time · Distance · Avg Speed,
 * the 20 Charts cards with their custom plots, seven power zones.
 */
export const CYCLING: SportProfile = { ...BASIC, id: "cycling" };
