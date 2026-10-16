import type { CardPlot } from "../charts/kinds";

/**
 * STUB for builder C: the swims' custom plots by name, which
 * `charts/kinds.ts` spreads into `CARD_PLOTS`. Empty: per-length pace,
 * strokes and Swolf draw with the shared `blocks` mark, so the swims may
 * never need one.
 */
export const SWIM_PLOTS: Readonly<Record<string, CardPlot>> = {};
