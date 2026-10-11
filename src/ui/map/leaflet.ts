import type * as L from "leaflet";
import css from "leaflet/dist/leaflet.css";

/**
 * Leaflet, for the activity maps: plain DOM — no WebGL, no iframe, no script
 * from the network — so the same map runs in Obsidian on a desktop and on a
 * phone.
 *
 * Bundled, but evaluated only when the first map is drawn, so a plugin load
 * costs nothing for it. This is Leaflet's ES module build, which leaves
 * `window.L` alone: another plugin's Leaflet may own it.
 *
 * Its stylesheet goes into the page with the first map, since Obsidian loads
 * only `styles.css`, and comes out when the plugin unloads. Nothing may use
 * `L.Icon.Default` or the layers control: their images aren't bundled.
 */
export type Leaflet = typeof L;

let loading: Promise<Leaflet> | null = null;
let style: HTMLStyleElement | null = null;

export function loadLeaflet(): Promise<Leaflet> {
	loading ??= import("leaflet/dist/leaflet-src.esm.js").then((mod) => {
		if (!style) {
			style = document.createElement("style");
			style.id = "garmin-connect-leaflet";
			style.textContent = css;
			document.head.appendChild(style);
		}
		return mod as unknown as Leaflet;
	});
	return loading;
}

/** On unload: Leaflet's stylesheet leaves with the plugin. */
export function removeLeafletStyles(): void {
	style?.remove();
	style = null;
	loading = null;
}
