/**
 * The swims' own chart fills, by name, sampled off the pool and open-water
 * shots (ref/activity-details/pool-swim/README.md, "Colours"; open water's
 * are the same at the same height). The rest of a swim's marks take the
 * run's colours: Pace the run's pace gradient, Heart Rate and Training Effect
 * the run's, the zone bars `zone-<n>` with a white Zone 1. As a landscape
 * overlay (not shot, Inferred) Strokes is the run's orange, Swolf its purple
 * and Temperature its grey, so the swims add no colours of their own.
 *
 * Data only, with no imports: `activity-chart-pages.ts` spreads these into
 * `CHART_COLOURS` and `CHART_FILLS`, and their names into `ChartColour` and
 * `ChartFill`, so a sport adds colours without editing the shared module.
 * The names must not be the run's or another sport's (a spread would repaint
 * them). Fills run top of the plot to its bottom, as the run's do.
 */
export const SWIM_COLOURS = {} as const satisfies Readonly<Record<string, string>>;
export type SwimColour = keyof typeof SWIM_COLOURS;

export const SWIM_FILLS = {
	/** Strokes: the pool's bars and open water's stroke rate, #fd9c38 43 pt below the top, #ea670e at the bottom; the top extrapolated. */
	"swim-strokes": ["#ffb34a", "#ea670e"],
	/** Swolf's bars: #ea71d3 52 pt below the top, #d430c2 at the bottom (the run's Power bottom); the top extrapolated. */
	"swim-swolf": ["#f899dd", "#d430c2"],
	/** The water's temperature steps: #6a6a6a a quarter down, #515151 at the bottom; the top extrapolated. */
	"swim-temperature": ["#727272", "#515151"],
} as const satisfies Readonly<Record<string, readonly [top: string, bottom: string]>>;
export type SwimFill = keyof typeof SWIM_FILLS;
