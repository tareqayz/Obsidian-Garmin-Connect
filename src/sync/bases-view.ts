import { ALL_GROUPS, keysFor, type MetricGroup } from "./metrics";

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

const LABELS: Record<string, string> = {
	date: "Date",
	steps: "Steps",
	steps_goal: "Step goal",
	distance_km: "Distance (km)",
	distance_mi: "Distance (mi)",
	calories: "Calories",
	calories_active: "Active calories",
	floors: "Floors",
	intensity_minutes: "Intensity min",
	intensity_moderate: "Moderate min",
	intensity_vigorous: "Vigorous min",
	resting_hr: "Resting HR",
	min_hr: "Min HR",
	max_hr: "Max HR",
	sleep_hours: "Sleep (h)",
	sleep_score: "Sleep score",
	sleep_deep_hours: "Deep (h)",
	sleep_light_hours: "Light (h)",
	sleep_rem_hours: "REM (h)",
	sleep_awake_hours: "Awake (h)",
	sleep_start: "Sleep start",
	sleep_end: "Sleep end",
	stress_avg: "Stress",
	body_battery_high: "Body battery high",
	body_battery_low: "Body battery low",
	hrv_avg: "HRV",
	hrv_high: "HRV high",
	hrv_weekly_avg: "HRV weekly",
	hrv_status: "HRV status",
	training_readiness: "Readiness",
	training_readiness_level: "Readiness level",
	workouts: "Workouts",
};

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
	const columns = keysFor(groups).filter(
		(key) => !key.startsWith("distance_") || key === wanted,
	);

	// `date` is the row key and is always written unprefixed.
	const rows = ["date", ...columns.map((key) => `${opts.prefix}${key}`)];
	const labelFor = (key: string, i: number) =>
		i === 0 ? LABELS.date : (LABELS[columns[i - 1]!] ?? columns[i - 1]!);

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
