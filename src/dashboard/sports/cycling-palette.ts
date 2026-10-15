/**
 * A ride's own chart colours and fills, by name: STUB, empty until builder B
 * samples them off the road-cycling shots (the power ramp, cycling dynamics,
 * the seven power zones' bars).
 *
 * Data only, with no imports: `activity-chart-pages.ts` spreads these into
 * `CHART_COLOURS` and `CHART_FILLS`, and their names into `ChartColour` and
 * `ChartFill`, so a sport adds colours without editing the shared module.
 * Fills run top of the plot to its bottom, as the run's do.
 */
export const CYCLING_COLOURS = {} as const satisfies Readonly<Record<string, string>>;
export type CyclingColour = keyof typeof CYCLING_COLOURS;

export const CYCLING_FILLS = {} as const satisfies Readonly<Record<string, readonly [top: string, bottom: string]>>;
export type CyclingFill = keyof typeof CYCLING_FILLS;
