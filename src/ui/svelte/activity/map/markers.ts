/**
 * The route's markers as Leaflet draws them (`L.divIcon`): the start and end
 * pins and the numbered lap markers. Their look is in RouteMap's styles
 * (`.gc-map-pin`, `.gc-map-lap`); the colours are Garmin's, kept because they
 * are data on the map, not chrome.
 *
 * Pins are the phone's teardrops, the tip on the point: green with a white
 * ▶ where the activity started, red with a white ■ where it ended.
 */

export type PinKind = "start" | "end";

/** The phone's pins, sampled off `map/02-full-map.png` as the twin's Map Pin keeps them. */
const PIN_FILL: Record<PinKind, string> = { start: "#3cb043", end: "#e0312b" };

/** 22 × 28: a 9.25 radius head over a tip at (11, 26.5), lines tangent to the head. */
const DROP = "M11 26.5 L3.34 15.19 A9.25 9.25 0 1 1 18.66 15.19 Z";
const GLYPH: Record<PinKind, string> = {
	start: '<path d="M8.6 6.1 L8.6 13.9 L15.2 10 Z" fill="#fff"/>',
	end: '<rect x="7.4" y="6.4" width="7.2" height="7.2" rx="1" fill="#fff"/>',
};

export const PIN_SIZE: [number, number] = [22, 28];
/** The tip. */
export const PIN_ANCHOR: [number, number] = [11, 26.5];

export function pinHtml(kind: PinKind): string {
	return `<svg width="22" height="28" viewBox="0 0 22 28" aria-hidden="true"><path d="${DROP}" fill="${PIN_FILL[kind]}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>${GLYPH[kind]}</svg>`;
}

/** The lap marker: a 20 pt white disc, its number centred. */
export const LAP_SIZE: [number, number] = [20, 20];
export const LAP_ANCHOR: [number, number] = [10, 10];

/**
 * Leaflet stacks markers by where they sit on screen; these offsets keep the
 * earlier laps over the later ones where an out-and-back route puts them
 * together (6–10 under 1–5), and both pins over every lap, the start over
 * the end.
 */
export function lapZ(n: number): number {
	return -100 * n;
}
export const PIN_Z: Record<PinKind, number> = { end: 10_000, start: 10_001 };
