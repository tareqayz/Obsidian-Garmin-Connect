import type { ActivityDetail } from "../sync/activity-detail";
import { MAP_OVERLAYS, type MapOverlay } from "./routes";

/**
 * What an activity's map draws, as data: the route's points, the runs of it
 * that share an overlay colour, the lap markers and the start and end. The
 * map component (`RouteMap.svelte`) only places these.
 *
 * What the run's map offers is the default. Another sport passes its
 * `MapSpec` (its profile's `map`): its Data Overlay list, the overlay its
 * Overview shows, each overlay's words and colours, and the route's colour
 * without one.
 *
 * Pure: no Obsidian, no Leaflet.
 */

/** One Data Overlay of a sport's map. */
export interface MapOverlayDef {
	/** Map Settings' row: "Power". */
	label: string;
	/** The route's colours, low (or slow) first: ten slots for a value, one per kind for keys. */
	ramp: readonly string[];
	/** The legend: the ramp between two words ("Less Power" … "More Power"), a swatch per key, or none. */
	legend: { low: string; high: string } | { keys: readonly string[] } | null;
	/**
	 * An overlay the run doesn't have: the sample column it colours by and the
	 * summary's average and best for it, binned as the run's value overlays
	 * are; `positive` counts only values above 0 as data.
	 */
	values?: { column: string; average: string; best: string; positive?: boolean };
}

/** A sport's map. */
export interface MapSpec {
	/** Map Settings' Data Overlay rows, in the sheet's order; each offered only with data. */
	overlays: readonly string[];
	/** The overlay the Overview's map and the full map it opens show. */
	overview: string;
	defs: Readonly<Record<string, MapOverlayDef>>;
	/** The route's colour without an overlay. */
	base: string;
}

export type LatLon = [number, number];

/** The route, from the samples' `lat` and `lon`, with the sample each point came from. */
export interface RoutePoint {
	at: LatLon;
	sample: number;
}

/** Points with a position, in order. Empty without GPS (a treadmill run). */
export function routePoints(detail: ActivityDetail): RoutePoint[] {
	const lat = detail.samples.lat ?? [];
	const lon = detail.samples.lon ?? [];
	const out: RoutePoint[] = [];
	for (let i = 0; i < lat.length; i += 1) {
		const a = lat[i];
		const b = lon[i];
		if (typeof a === "number" && typeof b === "number" && (a !== 0 || b !== 0)) out.push({ at: [a, b], sample: i });
	}
	return out;
}

export function hasRoute(detail: ActivityDetail): boolean {
	return routePoints(detail).length > 1;
}

/** The smallest box around the route, `[[south, west], [north, east]]`. */
export function routeBounds(points: readonly RoutePoint[]): [LatLon, LatLon] | null {
	if (!points.length) return null;
	let south = Infinity;
	let west = Infinity;
	let north = -Infinity;
	let east = -Infinity;
	for (const { at } of points) {
		south = Math.min(south, at[0]);
		north = Math.max(north, at[0]);
		west = Math.min(west, at[1]);
		east = Math.max(east, at[1]);
	}
	return [
		[south, west],
		[north, east],
	];
}

/** A stretch of route drawn in one colour: `bucket` indexes the overlay's ramp, or is null for no data. */
export interface RouteRun {
	bucket: number | null;
	points: LatLon[];
}

/** The ramp's slots, slow (or low) first: Garmin's legend has ten. */
export const RAMP_SLOTS = 10;

/** The sample column each value overlay colours by, and the summary's average and best for it. */
const VALUE_OVERLAY: Record<"heart-rate" | "power" | "elevation", { column: string; average: string; best: string }> = {
	"heart-rate": { column: "hr", average: "averageHR", best: "maxHR" },
	power: { column: "power", average: "averagePower", best: "maxPower" },
	elevation: { column: "elevation", average: "avgElevation", best: "maxElevation" },
};

/** A sport's overlay by its id: its own entry, never one an object inherits (`constructor`, from a hand-edited route). */
function defOf(overlay: string, spec: MapSpec | undefined): MapOverlayDef | undefined {
	return spec && Object.prototype.hasOwnProperty.call(spec.defs, overlay) ? spec.defs[overlay] : undefined;
}

function isRunOverlay(overlay: string): overlay is MapOverlay {
	return (MAP_OVERLAYS as readonly string[]).includes(overlay);
}

function isValueOverlay(overlay: string): overlay is keyof typeof VALUE_OVERLAY {
	return overlay === "heart-rate" || overlay === "power" || overlay === "elevation";
}

/**
 * The route cut into runs of one colour.
 *
 * Pace (and Grade-Adjusted Pace) is binned into ten equal steps of pace, from
 * the run's best pace at the fast end to a slow end as far below the average as
 * the best is above it, so the average falls between the two greens. Paces
 * beyond either end take the end colour. The spec proved this on the phone's
 * map (84% of samples exactly, 95% within a slot); the other value overlays use
 * the same rule over their own column (Inferred), as do a sport's own
 * (its spec's `values`). `none` is one run, and `run-walk` is coloured by
 * segment (0 run, 1 walk, 2 idle).
 */
export function routeRuns(detail: ActivityDetail, overlay: string, spec?: MapSpec): RouteRun[] {
	const points = routePoints(detail);
	if (points.length < 2) return [];
	if (overlay === "none") return [{ bucket: null, points: points.map((p) => p.at) }];
	const bucketOf = overlay === "run-walk" ? runWalkBucket(detail) : overlayBucket(detail, overlay, spec);
	const runs: RouteRun[] = [];
	for (let i = 0; i < points.length; i += 1) {
		const point = points[i]!;
		const bucket = bucketOf(point.sample);
		const last = runs.at(-1);
		if (last && last.bucket === bucket) {
			last.points.push(point.at);
		} else {
			// Each run starts where the last ended, so the line has no gaps.
			const previous = points[i - 1];
			runs.push({ bucket, points: previous ? [previous.at, point.at] : [point.at] });
		}
	}
	return runs.filter((run) => run.points.length > 1);
}

/** A sample's slot under a pace or value overlay, or null without a value (or for an overlay neither the run nor the spec knows). */
export function overlayBucket(detail: ActivityDetail, overlay: string, spec?: MapSpec): (sample: number) => number | null {
	if (overlay === "pace" || overlay === "gap") {
		const speeds = detail.samples[overlay === "pace" ? "speed" : "gap"] ?? [];
		const moving = speeds.filter((v): v is number => typeof v === "number" && v > 0);
		if (!moving.length) return () => null;
		const summary = detail.summary;
		const best = positive(overlay === "pace" ? summary.maxSpeed : undefined) ?? Math.max(...moving);
		const average = positive(overlay === "pace" ? summary.averageSpeed : summary.avgGradeAdjustedSpeed) ?? mean(moving);
		const fast = 1000 / best;
		const slow = 2 * (1000 / average) - fast;
		return (sample) => {
			const speed = speeds[sample];
			if (typeof speed !== "number" || speed <= 0) return null;
			return slot((slow - 1000 / speed) / (slow - fast));
		};
	}
	const source = isValueOverlay(overlay) ? VALUE_OVERLAY[overlay] : defOf(overlay, spec)?.values;
	if (!source) return () => null;
	const { column, average: avgKey, best: bestKey } = source;
	const values = detail.samples[column] ?? [];
	const present = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
	if (!present.length) return () => null;
	const best = finite(detail.summary[bestKey]) ?? Math.max(...present);
	const average = finite(detail.summary[avgKey]) ?? mean(present);
	const low = 2 * average - best;
	return (sample) => {
		const value = values[sample];
		if (typeof value !== "number" || !Number.isFinite(value)) return null;
		return slot((value - low) / (best - low));
	};
}

/** A position along the ramp, 0 to 1, as one of its ten slots; the ends hold everything beyond them. */
function slot(at: number): number {
	if (!Number.isFinite(at)) return Math.floor(RAMP_SLOTS / 2);
	return Math.max(0, Math.min(RAMP_SLOTS - 1, Math.floor(at * RAMP_SLOTS)));
}

function positive(value: unknown): number | undefined {
	return typeof value === "number" && value > 0 ? value : undefined;
}

function finite(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mean(values: readonly number[]): number {
	return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Run 0, walk 1, idle 2, by which run/walk segment a sample's clock falls in. */
function runWalkBucket(detail: ActivityDetail): (sample: number) => number | null {
	const clock = detail.samples.clock ?? [];
	const kinds: Array<[string, number]> = [
		["RWD_RUN", 0],
		["RWD_WALK", 1],
		["RWD_STAND", 2],
	];
	const segments = detail.segments.filter((s) => kinds.some(([type]) => type === s.type));
	return (sample) => {
		const at = clock[sample];
		if (typeof at !== "number") return null;
		const segment = segments.find((s) => at >= s.start && at <= s.end);
		return segment ? (kinds.find(([type]) => type === segment.type)?.[1] ?? null) : null;
	};
}

/** A numbered lap marker: where each lap but the last ended. */
export interface LapMarker {
	n: number;
	at: LatLon;
}

export function lapMarkers(detail: ActivityDetail): LapMarker[] {
	const laps = detail.laps;
	return laps
		.slice(0, -1)
		.filter((lap): lap is typeof lap & { end: LatLon } => Array.isArray(lap.end))
		.map((lap) => ({ n: lap.n, at: lap.end }));
}

/** The first and last point of the route. */
export function routeEnds(points: readonly RoutePoint[]): { start: LatLon; end: LatLon } | null {
	if (points.length < 2) return null;
	return { start: points[0]!.at, end: points.at(-1)!.at };
}

/**
 * Garmin's Slower → Faster ramp, ten slots slowest first, sampled off the
 * phone's legend. Slots 5 and 6 are the same green, so a route shows nine.
 */
export const PACE_RAMP: readonly string[] = ["#004ba0", "#1976d2", "#3b97f3", "#54a9fe", "#82c91e", "#82c91e", "#faca48", "#f98925", "#ea670e", "#d32020"];

/** Run, walk, idle, as the Run/Walk chart colours them. */
export const RUN_WALK_RAMP: readonly string[] = ["#54a9fe", "#60d275", "#f5bf2a"];

/** The route with no overlay (Inferred: the ramp's blue). */
export const ROUTE_BASE = "#54a9fe";

/** Map Settings' Data Overlay rows, worded as the phone's sheet words them. */
export const OVERLAY_LABELS: Readonly<Record<MapOverlay, string>> = {
	none: "None",
	pace: "Pace",
	gap: "Grade-Adjusted Pace",
	"heart-rate": "Heart Rate",
	power: "Power",
	elevation: "Elevation",
	"run-walk": "Run/Walk",
};

/** The sample column each value overlay reads, and whether only values above zero count as data. */
const OVERLAY_COLUMN: Record<Exclude<MapOverlay, "none" | "run-walk">, [string, boolean]> = {
	pace: ["speed", true],
	gap: ["gap", true],
	"heart-rate": ["hr", true],
	power: ["power", true],
	elevation: ["elevation", false],
};

const RUN_WALK_TYPES: readonly string[] = ["RWD_RUN", "RWD_WALK", "RWD_STAND"];

/**
 * The Data Overlay choices an activity has data for, in the sheet's order.
 * None is always there; a run without a power meter offers no Power, as the
 * page leaves out every metric it has no value for (Inferred for the sheet:
 * the captured run has them all). A sport's spec lists its own.
 */
export function mapOverlays(detail: ActivityDetail, spec?: MapSpec): string[] {
	if (spec) return spec.overlays.filter((overlay) => offers(detail, overlay, spec));
	return MAP_OVERLAYS.filter((overlay) => {
		if (overlay === "none") return true;
		if (overlay === "run-walk") return detail.segments.some((s) => RUN_WALK_TYPES.includes(s.type));
		const [column, positive] = OVERLAY_COLUMN[overlay];
		return (detail.samples[column] ?? []).some((v) => typeof v === "number" && Number.isFinite(v) && (!positive || v > 0));
	});
}

/** Whether a sport's map can draw an overlay for the activity: the run's by its column, the sport's own by its `values`. */
function offers(detail: ActivityDetail, overlay: string, spec: MapSpec): boolean {
	if (overlay === "none") return true;
	if (overlay === "run-walk") return detail.segments.some((s) => RUN_WALK_TYPES.includes(s.type));
	const run = isRunOverlay(overlay) ? OVERLAY_COLUMN[overlay as Exclude<MapOverlay, "none" | "run-walk">] : undefined;
	const own = defOf(overlay, spec)?.values;
	const [column, positive] = run ?? (own ? [own.column, own.positive === true] : [undefined, false]);
	if (column === undefined) return false;
	return (detail.samples[column] ?? []).some((v) => typeof v === "number" && Number.isFinite(v) && (!positive || v > 0));
}

/** The overlay a map draws: the one asked for when the activity has its data, else none. */
export function overlayFor(detail: ActivityDetail, wanted: string, spec?: MapSpec): string {
	return mapOverlays(detail, spec).includes(wanted) ? wanted : "none";
}

/** The overlay the Overview's map shows, and the full map opens in: the run's pace, or the sport's. */
export function overviewOverlay(spec?: MapSpec): string {
	return spec ? spec.overview : "pace";
}

/** The colours an overlay paints the route with, by bucket: the run's ramps, or the sport's. */
export function rampOf(overlay: string, spec?: MapSpec): readonly string[] {
	if (spec) return defOf(overlay, spec)?.ramp ?? PACE_RAMP;
	return overlay === "run-walk" ? RUN_WALK_RAMP : PACE_RAMP;
}

/** The route's colour without an overlay (or where a sample has no value). */
export function baseOf(spec?: MapSpec): string {
	return spec ? spec.base : ROUTE_BASE;
}

/** Map Settings' word for an overlay. */
export function overlayLabel(overlay: string, spec?: MapSpec): string {
	return defOf(overlay, spec)?.label ?? (isRunOverlay(overlay) ? OVERLAY_LABELS[overlay] : overlay);
}

export interface LegendKey {
	label: string;
	color: string;
}

/** What the map's legend pill shows: the ramp between two words, or a swatch per colour. */
export type MapLegend = { kind: "ramp"; low: string; high: string; colors: readonly string[] } | { kind: "keys"; keys: LegendKey[] };

/**
 * The legend for an overlay. Pace and Grade-Adjusted Pace read "Slower" to
 * "Faster", as on the phone; Run/Walk names its three colours, as its chart's
 * legend does; Heart Rate, Power and Elevation run from "Lower" to "Higher"
 * (Inferred: no shot). No overlay, no legend. A sport's spec words its own.
 */
export function mapLegend(overlay: string, spec?: MapSpec): MapLegend | null {
	if (spec) {
		const def = defOf(overlay, spec);
		if (overlay === "none" || !def?.legend) return null;
		const legend = def.legend;
		return "keys" in legend
			? { kind: "keys", keys: legend.keys.map((label, i) => ({ label, color: def.ramp[i] ?? spec.base })) }
			: { kind: "ramp", low: legend.low, high: legend.high, colors: def.ramp };
	}
	switch (overlay) {
		case "none":
			return null;
		case "pace":
		case "gap":
			return { kind: "ramp", low: "Slower", high: "Faster", colors: PACE_RAMP };
		case "run-walk":
			return {
				kind: "keys",
				keys: ["Run", "Walk", "Idle"].map((label, i) => ({ label, color: RUN_WALK_RAMP[i]! })),
			};
		default:
			return { kind: "ramp", low: "Lower", high: "Higher", colors: PACE_RAMP };
	}
}

/**
 * The run's map as a spec: what the functions above do without one, as data a
 * sport can start from (`{ ...RUN_MAP, overlays: … }`). The run's page passes
 * no spec; a test holds the two to the same answers.
 */
export const RUN_MAP: MapSpec = {
	overlays: MAP_OVERLAYS,
	overview: "pace",
	defs: {
		none: { label: OVERLAY_LABELS.none, ramp: PACE_RAMP, legend: null },
		pace: { label: OVERLAY_LABELS.pace, ramp: PACE_RAMP, legend: { low: "Slower", high: "Faster" } },
		gap: { label: OVERLAY_LABELS.gap, ramp: PACE_RAMP, legend: { low: "Slower", high: "Faster" } },
		"heart-rate": { label: OVERLAY_LABELS["heart-rate"], ramp: PACE_RAMP, legend: { low: "Lower", high: "Higher" } },
		power: { label: OVERLAY_LABELS.power, ramp: PACE_RAMP, legend: { low: "Lower", high: "Higher" } },
		elevation: { label: OVERLAY_LABELS.elevation, ramp: PACE_RAMP, legend: { low: "Lower", high: "Higher" } },
		"run-walk": { label: OVERLAY_LABELS["run-walk"], ramp: RUN_WALK_RAMP, legend: { keys: ["Run", "Walk", "Idle"] } },
	},
	base: ROUTE_BASE,
};
