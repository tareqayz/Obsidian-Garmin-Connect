import type * as L from "leaflet";

/**
 * Leaflet, for the activity maps: plain DOM — no WebGL, no iframe, no script
 * from the network — so the same map runs in Obsidian on a desktop and on a
 * phone.
 *
 * Bundled, but evaluated only when the first map is drawn, so a plugin load
 * costs nothing for it. This is Leaflet's ES module build, which leaves
 * `window.L` alone: another plugin's Leaflet may own it.
 *
 * Its stylesheet is copied to the top of `styles.css`, since Obsidian loads
 * only that file, less what the Community directory's review flags
 * (`tests/leaflet-styles.test.ts` lists the edits). Nothing may use
 * `L.Icon.Default` or the layers control: their images aren't bundled.
 */
export type Leaflet = typeof L;

let loading: Promise<Leaflet> | null = null;

export function loadLeaflet(): Promise<Leaflet> {
	loading ??= import("leaflet/dist/leaflet-src.esm.js");
	return loading;
}
