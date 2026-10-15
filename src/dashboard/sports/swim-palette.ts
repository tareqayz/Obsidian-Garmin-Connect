/**
 * The swims' own chart colours and fills, by name: STUB, empty until builder
 * C samples them off the pool and open-water shots (per-length pace, strokes,
 * Swolf, temperature).
 *
 * Data only, with no imports: `activity-chart-pages.ts` spreads these into
 * `CHART_COLOURS` and `CHART_FILLS`, and their names into `ChartColour` and
 * `ChartFill`, so a sport adds colours without editing the shared module.
 * Fills run top of the plot to its bottom, as the run's do.
 */
export const SWIM_COLOURS = {} as const satisfies Readonly<Record<string, string>>;
export type SwimColour = keyof typeof SWIM_COLOURS;

export const SWIM_FILLS = {} as const satisfies Readonly<Record<string, readonly [top: string, bottom: string]>>;
export type SwimFill = keyof typeof SWIM_FILLS;
