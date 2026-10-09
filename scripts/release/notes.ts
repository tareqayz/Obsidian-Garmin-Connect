/**
 * Prints the release notes for a tag from CHANGELOG.md; exits 1 when it has
 * none. The release workflow passes them to `gh release create --notes-file`.
 *
 *   npm run --silent release:notes -- 0.2.0-beta.1
 */
import { readFileSync } from "node:fs";
import { releaseNotes } from "./changelog";

const tag = process.argv[2];
if (!tag) {
	console.error("usage: npm run --silent release:notes -- <tag>");
	process.exit(2);
}
const notes = releaseNotes(readFileSync("CHANGELOG.md", "utf8"), tag);
if (notes === null) {
	console.error(`CHANGELOG.md has no notes for ${tag}: add a "## [${tag.replace(/-.*$/, "")}]" or "## [Unreleased]" section.`);
	process.exit(1);
}
process.stdout.write(`${notes}\n`);
