/**
 * A ride's own chart and map colours, by name, sampled off the road-cycling
 * shots (ref/activity-details/road-cycling/README.md, "Colours"). The rest
 * of the ride's marks take the run's colours: Speed the Pace fill, Cadence
 * the Stamina orange, L/R Balance purple, the left platform offset red.
 *
 * Data only, with no imports: `activity-chart-pages.ts` spreads these into
 * `CHART_COLOURS` and `CHART_FILLS`, and their names into `ChartColour` and
 * `ChartFill`, so a sport adds colours without editing the shared module.
 * The names must not be the run's (a spread would repaint the run).
 * Fills run top of the plot to its bottom, as the run's do.
 */
export const CYCLING_COLOURS = {
	/** The left pedal's power phase arc and the Left key's dot. */
	"pedal-left": "#72ea24",
	/** The right pedal's arc and its dots. */
	"pedal-right": "#11a9ed",
	/** The peak power phase arcs, thicker and darker. */
	"peak-left": "#50b012",
	"peak-right": "#0c7cad",
	/** Position's Standing (Seated is the run's deep orange). */
	standing: "#15aabf",
	/** Power as a landscape overlay: its line and right labels. */
	"power-line": "#ed79d5",
	/** Stamina as a landscape overlay (the run's card orange is a shade lighter). */
	"stamina-line": "#f98925",
	/**
	 * Power Zones 6 and 7's bars, theme values (zone bars are HTML, styled
	 * inline; Zone 1's white is the core `text`): Inferred, no ride had time
	 * there, the twin's variables, `styles.css`'s `--gc-power-zone-6/7`.
	 */
	"power-zone-6": "var(--gc-power-zone-6, #e02c2c)",
	"power-zone-7": "var(--gc-power-zone-7, #5a30d7)",
	/** The Power Curve: This Activity's area (its line is the run's blue) and the Record's, a backdrop that follows the theme. */
	"curve-area": "#4c7fb2",
	"record-area": "var(--gc-record-area, #414141)",
	/** Chrome, as the twin maps Garmin's greys: the dials' track the border, the Center and Record keys text-faint. */
	track: "var(--background-modifier-border)",
	centre: "var(--text-faint)",
	"record-key": "var(--text-faint)",
} as const satisfies Readonly<Record<string, string>>;
export type CyclingColour = keyof typeof CYCLING_COLOURS;

export const CYCLING_FILLS = {} as const satisfies Readonly<Record<string, readonly [top: string, bottom: string]>>;
export type CyclingFill = keyof typeof CYCLING_FILLS;

/**
 * The map's Power overlay, Less Power to More Power: one colour a power zone,
 * Z1 first, as the legend pill's seven 8 pt slots show them. The route takes
 * its sample's zone by the ride's own floors (75% of the full map's samples
 * exactly, 99% within a zone; `mapbins.py`).
 */
export const POWER_RAMP: readonly string[] = ["#c3c3c3", "#3b97f3", "#82c91e", "#faca48", "#f98925", "#d32020", "#5a30d7"];
