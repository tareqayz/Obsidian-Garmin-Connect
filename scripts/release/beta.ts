/**
 * Tags and pushes the beta that heads CHANGELOG.md. A beta is never committed
 * to manifest.json (Obsidian would ship it to every user); the release
 * workflow stamps the tag's version in CI instead.
 *
 *   npm run release:beta              # checks, asks, tags, pushes
 *   npm run release:beta -- --dry-run # checks only
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { latestVersion, releaseNotes } from "./changelog";

const dryRun = process.argv.includes("--dry-run");
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();

function fail(message: string): never {
	console.error(`\n✗ ${message}\n`);
	process.exit(1);
}

const changelog = readFileSync("CHANGELOG.md", "utf8");
const tag = latestVersion(changelog);
if (!tag || !/^\d+\.\d+\.\d+-beta\.\d+$/.test(tag)) {
	fail(`CHANGELOG.md's newest section is "${tag ?? "none"}", not x.y.z-beta.N. Rename ## [Unreleased] in a PR first (docs/CONTRIBUTING.md, "Beta").`);
}
if (git("branch", "--show-current") !== "main") fail("Switch to main: a beta tags the merged main.");
if (git("status", "--porcelain")) fail("The working tree isn't clean.");
git("fetch", "--quiet", "--tags", "origin", "main");
if (git("rev-parse", "HEAD") !== git("rev-parse", "origin/main")) fail("main isn't in step with origin/main: pull or push first.");
if (git("tag", "--list", tag)) fail(`Tag ${tag} already exists.`);

const manifestVersion = JSON.parse(readFileSync("manifest.json", "utf8")).version;
const notes = releaseNotes(changelog, tag);
if (notes === null) fail(`CHANGELOG.md has no notes for ${tag}.`);

console.log(`${tag} on ${git("log", "-1", "--format=%h %s")} (manifest.json stays ${manifestVersion})\n`);
console.log(notes);
if (dryRun) process.exit(0);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(`\nTag and push ${tag}? The beta is published as soon as the tag lands. [y/N] `);
rl.close();
if (answer.trim().toLowerCase() !== "y") fail("Nothing tagged.");

git("tag", "-a", tag, "-m", tag);
execFileSync("git", ["push", "origin", tag], { stdio: "inherit" });
console.log(`\n✓ ${tag} pushed: the release workflow publishes it as a pre-release.`);
