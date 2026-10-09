import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { releaseNotes } from "../scripts/release/changelog";

const CHANGELOG = `# Changelog

Preamble.

## [Unreleased]

### Added

- Home.

## [1.2.0] — 2026-11-02

### Fixed

- A thing.

## [1.1.0] — 2026-10-01

### Added

[Unreleased]: https://example.com/compare/1.2.0...HEAD
[1.2.0]: https://example.com/releases/tag/1.2.0
`;

describe("releaseNotes", () => {
	it("takes a version's own section, up to the next heading", () => {
		assert.equal(releaseNotes(CHANGELOG, "1.2.0"), "### Fixed\n\n- A thing.");
	});

	it("gives a beta its version's section, or Unreleased while that has none", () => {
		assert.equal(releaseNotes(CHANGELOG, "1.2.0-beta.3"), "### Fixed\n\n- A thing.");
		assert.equal(releaseNotes(CHANGELOG, "1.3.0-beta.1"), "### Added\n\n- Home.");
	});

	it("prefers a section written for the beta itself", () => {
		const withBeta = CHANGELOG.replace("## [Unreleased]", "## [1.3.0-beta.1] — 2026-12-01\n\n- Beta notes.\n\n## [Unreleased]");
		assert.equal(releaseNotes(withBeta, "1.3.0-beta.1"), "- Beta notes.");
	});

	it("stops at the link definitions at the foot of the file", () => {
		const notes = releaseNotes(CHANGELOG.replace("### Added\n\n[Unreleased]", "### Added\n\n- Old.\n\n[Unreleased]"), "1.1.0");
		assert.equal(notes, "### Added\n\n- Old.");
	});

	it("skips a section with only headings, and has nothing when every candidate is empty", () => {
		assert.equal(releaseNotes(CHANGELOG, "1.1.0"), "### Added\n\n- Home.");
		assert.equal(releaseNotes(CHANGELOG.replace("- Home.\n", ""), "1.1.0"), null);
	});

	it("reads the real CHANGELOG.md's Unreleased section for the next beta", async () => {
		const { readFileSync } = await import("node:fs");
		const notes = releaseNotes(readFileSync("CHANGELOG.md", "utf8"), "0.2.0-beta.1");
		assert.ok(notes?.startsWith("The plugin is now Garmin Connect"), notes ?? "no notes");
		assert.ok(!notes?.includes("[Unreleased]:"));
		const beta = releaseNotes(readFileSync("CHANGELOG.md", "utf8"), "0.1.0-beta.1");
		assert.ok(beta?.includes("Sign-in that works on desktop and mobile"), beta ?? "no notes");
		assert.ok(!beta?.includes("https://github.com/"), "ran into the link definitions");
	});
});
