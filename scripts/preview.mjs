// Bundles the preview pages the same way the plugin is built, so what you
// screenshot is the code that ships.
//
//   node scripts/preview.mjs            both pages
//   node scripts/preview.mjs gallery    just one
import esbuild from "esbuild";
import esbuildSvelte from "esbuild-svelte";
import { sveltePreprocess } from "svelte-preprocess";
import { resolve } from "node:path";

const PAGES = [
	{ in: "scripts/preview-dashboard.ts", out: "dashboard" },
	{ in: "scripts/preview-gallery.ts", out: "gallery" },
];

const wanted = process.argv[2];
const pages = wanted ? PAGES.filter((p) => p.out === wanted) : PAGES;
if (pages.length === 0) {
	console.error(`Unknown preview "${wanted}". Try: ${PAGES.map((p) => p.out).join(", ")}`);
	process.exit(1);
}

await esbuild.build({
	entryPoints: pages,
	bundle: true,
	format: "iife",
	platform: "browser",
	target: "es2018",
	outdir: "scripts/.preview",
	logLevel: "warning",
	mainFields: ["svelte", "browser", "module", "main"],
	conditions: ["svelte", "browser"],
	plugins: [
		esbuildSvelte({
			compilerOptions: { css: "injected" },
			preprocess: sveltePreprocess(),
			// bits-ui ships uncompiled .svelte, so its own source compiles here
			// too. Its warnings are not ours to fix and drown out real ones.
			filterWarnings: (w) => !w.filename?.includes("node_modules"),
		}),
	],
});

for (const page of pages) {
	const html = page.out === "dashboard" ? "index.html" : `${page.out}.html`;
	console.log(`  file://${resolve("scripts/.preview", html)}`);
}
