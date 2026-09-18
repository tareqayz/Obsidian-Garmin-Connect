// Pushes the version npm just wrote into package.json out to the files Obsidian reads.
// Run by `npm version <patch|minor|major>` via the "version" lifecycle script, so
// package.json, manifest.json and versions.json can never drift apart in a release.
import { readFileSync, writeFileSync } from "node:fs";

const version = process.env.npm_package_version;
if (!version) {
	console.error("\n✗ npm_package_version is unset — run this through `npm version`, not directly.\n");
	process.exit(1);
}

// Obsidian only accepts x.y.z in manifest.json. A pre-release suffix belongs on the tag of
// a beta release and nowhere else; the workflow stamps that in CI without committing it.
if (!/^\d+\.\d+\.\d+$/.test(version)) {
	console.error(`\n✗ "${version}" is not x.y.z — Obsidian rejects anything else in manifest.json.`);
	console.error("  For a beta, tag the commit directly instead: git tag -a 1.2.0-beta.1 -m 1.2.0-beta.1\n");
	process.exit(1);
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const previous = manifest.version;
manifest.version = version;
writeFileSync("manifest.json", `${JSON.stringify(manifest, null, "\t")}\n`);

// versions.json tells Obsidian the newest build a user on an older app version can still
// install. It only needs an entry when minAppVersion moves — listing every release is noise.
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
const entries = Object.entries(versions);
const currentFloor = entries.length ? entries[entries.length - 1][1] : null;

if (currentFloor === manifest.minAppVersion) {
	console.log(`✓ ${previous} → ${version} (minAppVersion still ${manifest.minAppVersion}, versions.json untouched)`);
} else {
	versions[version] = manifest.minAppVersion;
	writeFileSync("versions.json", `${JSON.stringify(versions, null, "\t")}\n`);
	console.log(`✓ ${previous} → ${version}, versions.json pinned ${version} to Obsidian ${manifest.minAppVersion}`);
}
