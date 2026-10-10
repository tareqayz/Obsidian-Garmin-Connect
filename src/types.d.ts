/**
 * Stylesheets imported as text (esbuild's `.css` loader, `esbuild.config.mjs`):
 * the map injects Leaflet's into the page itself, since Obsidian loads only
 * `styles.css`.
 */
declare module "*.css" {
	const css: string;
	export default css;
}

/** Leaflet's ES module build: the same API, without the `window.L` its UMD build writes. */
declare module "leaflet/dist/leaflet-src.esm.js" {
	export * from "leaflet";
}
