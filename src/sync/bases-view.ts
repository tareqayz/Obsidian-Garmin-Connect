import { ALL_GROUPS, METRIC_LABELS, primaryKeysFor, type MetricGroup } from "./metrics";

/**
 * Generates an Obsidian Bases view over the data folder.
 *
 * This is what turns one-note-per-day into the table you actually wanted:
 * sortable, filterable, and still backed by real properties that Dataview and
 * Bases can query — which a markdown table is not.
 *
 * Schema per help.obsidian.md/bases/syntax: `filters` takes and/or/not with
 * expression strings, `properties` maps a bare key to a display name, and a
 * view's `order` lists columns as `note.<property>`.
 */


export interface BasesViewOptions {
	folder: string;
	prefix: string;
	groups: readonly MetricGroup[];
	/** Unit setting decides which distance column exists. */
	units: "metric" | "imperial";
	name?: string;
}

export function basesView(opts: BasesViewOptions): string {
	const groups = opts.groups.length ? opts.groups : ALL_GROUPS;
	const wanted = opts.units === "imperial" ? "distance_mi" : "distance_km";
	// The headline keys only. Every other synced property is still on the note
	// and still queryable; a view eighty columns wide would just be unusable.
	const columns = primaryKeysFor(groups).filter(
		(key) => !key.startsWith("distance_") || key === wanted,
	);

	const rows = ["date", ...columns].map((key) => `${opts.prefix}${key}`);
	const labelFor = (key: string, i: number) =>
		i === 0 ? METRIC_LABELS.date : (METRIC_LABELS[columns[i - 1]!] ?? columns[i - 1]!);

	const lines: string[] = [];
	lines.push("filters:");
	lines.push("  and:");
	// JSON.stringify twice: once for the folder argument, once so the whole
	// expression is a safely quoted YAML scalar whatever the folder is named.
	lines.push(`    - ${JSON.stringify(`file.inFolder(${JSON.stringify(opts.folder)})`)}`);

	lines.push("properties:");
	rows.forEach((key, i) => {
		lines.push(`  ${key}:`);
		lines.push(`    displayName: ${JSON.stringify(labelFor(key, i))}`);
	});

	lines.push("views:");
	lines.push("  - type: table");
	lines.push(`    name: ${JSON.stringify(opts.name ?? "Health")}`);
	lines.push("    order:");
	for (const key of rows) lines.push(`      - note.${key}`);

	return `${lines.join("\n")}\n`;
}
