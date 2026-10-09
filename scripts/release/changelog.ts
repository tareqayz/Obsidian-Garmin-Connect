/**
 * The CHANGELOG.md section a release carries as its notes.
 *
 * A tag looks for its own section first (`## [1.2.0-beta.1]`), then its
 * version's (`## [1.2.0]`), then `## [Unreleased]` — so betas of a version
 * that is still being written read the notes it has so far. A section runs to
 * the next `## ` heading or the link definitions at the foot of the file.
 *
 * Pure: no file or network access.
 */
export function releaseNotes(changelog: string, tag: string): string | null {
	const version = tag.replace(/-.*$/, "");
	for (const name of new Set([tag, version, "Unreleased"])) {
		const body = section(changelog, name);
		if (body !== null && hasContent(body)) return body;
	}
	return null;
}

function section(changelog: string, name: string): string | null {
	const lines = changelog.split(/\r?\n/);
	const heading = `## [${name}]`;
	const start = lines.findIndex((line) => line === heading || line.startsWith(`${heading} `));
	if (start < 0) return null;
	const body: string[] = [];
	for (const line of lines.slice(start + 1)) {
		if (line.startsWith("## ") || /^\[[^\]]+\]:\s/.test(line)) break;
		body.push(line);
	}
	return body.join("\n").trim();
}

/** Anything but blank lines and subheadings. */
function hasContent(body: string): boolean {
	return body.split("\n").some((line) => line.trim() !== "" && !/^#{1,6}\s/.test(line));
}
