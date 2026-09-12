// Fails the build if anything node-only or electron-only leaked into the bundle.
// A stray import here is exactly the bug that makes a plugin load fine on the
// desktop and throw on the phone, where it is hardest to debug.
import { readFileSync } from "node:fs";
import { builtinModules } from "node:module";

const bundle = readFileSync(new URL("../main.js", import.meta.url), "utf8");
const banned = [...builtinModules, "electron", "@electron/remote"];
const hits = [];

for (const name of banned) {
	const re = new RegExp(`require\\(\\s*["'](?:node:)?${name.replace(/[/\\]/g, "\\$&")}["']\\s*\\)`);
	if (re.test(bundle)) hits.push(name);
}

if (hits.length) {
	console.error(`\n✗ mobile-unsafe requires found in main.js: ${hits.join(", ")}`);
	console.error("  Remove them or the plugin will break on iOS/Android.\n");
	process.exit(1);
}
console.log("✓ main.js is free of node/electron requires — safe to load on mobile");
