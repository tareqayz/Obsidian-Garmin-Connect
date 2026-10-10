import type { ActivityDetail } from "../sync/activity-detail";
import type { MapOverlay } from "./routes";

/**
 * What an activity's map draws, as data: the route's points, the runs of it
 * that share an overlay colour, the lap markers and the start and end. The
 * map component (`RouteMap.svelte`) only places these.
 *
 * Pure: no Obsidian, no Leaflet.
 */

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

/** The sample column an overlay colours by, and whether a higher value is "faster" (the ramp's hot end). */
const OVERLAY_COLUMN: Record<Exclude<MapOverlay, "none" | "run-walk">, string> = {
	pace: "speed",
	gap: "gap",
	"heart-rate": "hr",
	power: "power",
	elevation: "elevation",
};

/**
 * The route cut into runs of one colour. Values are binned into `buckets`
 * equal-count bins over the activity's own values (so the ramp spans the
 * activity, slowest to fastest), which is how the phone's legend reads —
 * the exact binning is the spec's to settle. `none` is one run; `run-walk`
 * is binned by segment type instead (0 run, 1 walk, 2 idle).
 */
export function routeRuns(detail: ActivityDetail, overlay: MapOverlay, buckets: number): RouteRun[] {
	const points = routePoints(detail);
	if (points.length < 2) return [];
	if (overlay === "none") return [{ bucket: null, points: points.map((p) => p.at) }];
	const bucketOf = overlay === "run-walk" ? runWalkBucket(detail) : valueBucket(detail.samples[OVERLAY_COLUMN[overlay]] ?? [], buckets);
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

/**
 * Equal-count bins over the column's values: the bucket of a sample, or null
 * without one. A value's place is the middle of its ties, so a run of equal
 * values lands in one bin and the slowest and fastest reach the ramp's ends.
 */
function valueBucket(values: ReadonlyArray<number | null>, buckets: number): (sample: number) => number | null {
	const sorted = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
	if (!sorted.length || buckets < 1) return () => null;
	const n = sorted.length;
	return (sample) => {
		const value = values[sample];
		if (typeof value !== "number" || !Number.isFinite(value)) return null;
		const rank = (firstAtLeast(sorted, value) + firstAbove(sorted, value) - 1) / 2;
		return Math.min(buckets - 1, Math.floor(((rank + 0.5) / n) * buckets));
	};
}

/** The index of the first value not below `value`. */
function firstAtLeast(sorted: readonly number[], value: number): number {
	let lo = 0;
	let hi = sorted.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (sorted[mid]! < value) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

/** The index of the first value above `value`. */
function firstAbove(sorted: readonly number[], value: number): number {
	let lo = 0;
	let hi = sorted.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (sorted[mid]! <= value) lo = mid + 1;
		else hi = mid;
	}
	return lo;
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
 * Garmin's Slower → Faster ramp, slowest first, as the phone's legend draws it.
 * Read off the screenshot; the spec measures the final values.
 */
export const PACE_RAMP: readonly string[] = ["#1f4fb4", "#2c6fd6", "#4b95ea", "#62b746", "#a6c33a", "#f0c330", "#f29a2e", "#e9652c", "#dd3a2d"];

/** Run, walk, idle, as the Run/Walk chart's legend colours them. */
export const RUN_WALK_RAMP: readonly string[] = ["#4ea7ff", "#5fd06d", "#f5c33b"];
