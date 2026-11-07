/** Leaflet's ES module build: the same API, without the `window.L` its UMD build writes. */
declare module "leaflet/dist/leaflet-src.esm.js" {
	export * from "leaflet";
}

/** A font bundled as bytes (esbuild's `binary` loader): the share images' face. */
declare module "*.woff2" {
	const bytes: Uint8Array<ArrayBuffer>;
	export default bytes;
}
