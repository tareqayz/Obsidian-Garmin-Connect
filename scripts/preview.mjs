// Bundles the dashboard preview the same way the plugin is built, so what you
// screenshot is the code that ships.
import esbuild from "esbuild";
import esbuildSvelte from "esbuild-svelte";
import { sveltePreprocess } from "svelte-preprocess";

await esbuild.build({
	entryPoints: ["scripts/preview-dashboard.ts"],
	bundle: true,
	format: "iife",
	platform: "browser",
	target: "es2018",
	outfile: "scripts/.preview/dashboard.js",
	logLevel: "warning",
	mainFields: ["svelte", "browser", "module", "main"],
	conditions: ["svelte", "browser"],
	plugins: [
		esbuildSvelte({
			compilerOptions: { css: "injected" },
			preprocess: sveltePreprocess(),
		}),
	],
});
