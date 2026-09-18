/**
 * Turning an endpoint's responses into a verdict, and a set of verdicts into a
 * report. Pure: no network, no filesystem, no clock beyond what is passed in.
 *
 * This is where the check decides what counts as news, so it is the part most
 * worth testing directly — a rule that is too loud gets ignored, and a rule
 * that is too quiet is worse than no check at all.
 */

import type { CatalogueEntry, RecordedSchema } from "./catalogue";
import type { Window } from "./probes";
import {
	diff,
	inferAll,
	isEmptyPayload,
	statusOf,
	type Change,
	type PathStatus,
	type Shape,
} from "./schema";

export type Verdict = "ok" | "warn" | "fail" | "no-data" | "error" | "new";

export interface Result {
	entry: CatalogueEntry;
	verdict: Verdict;
	samples: number;
	changes: Change[];
	critical: Array<{ path: string; status: PathStatus }>;
	shape?: Shape;
	error?: string;
}

/**
 * A change fails the build only when it lands on a path the plugin reads.
 * Garmin adds and drops fields nobody here touches constantly; treating that as
 * a break would teach everyone to ignore the build.
 */
export function isFatal(change: Change, critical: readonly string[]): boolean {
	if (change.kind === "field-added" || change.kind === "type-widened") return false;
	// The response as a whole became a different kind of thing.
	if (change.kind === "container-changed" && change.path === "") return true;
	return critical.some((path) => path === change.path || path.startsWith(`${change.path}.`));
}

export function check(
	entry: CatalogueEntry,
	samples: unknown[],
	recorded: RecordedSchema | null,
): Result {
	const critical = entry.critical ?? [];
	const observed = inferAll(samples);
	const statuses = critical.map((path) => ({ path, status: statusOf(samples, path) }));
	const base = { entry, samples: samples.length, critical: statuses, shape: observed };

	if (!recorded) return { ...base, verdict: "new", changes: [] };

	// Nothing came back at all. On a rest day that is normal, and calling it a
	// broken contract would cry wolf every time the account went quiet.
	if (samples.every(isEmptyPayload)) return { ...base, verdict: "no-data", changes: [] };

	const changes = diff(recorded.shape, observed);
	const missing = statuses.some((status) => status.status === "missing");
	const fatal = missing || changes.some((change) => isFatal(change, critical));

	return { ...base, verdict: fatal ? "fail" : changes.length ? "warn" : "ok", changes };
}

export function failed(results: readonly Result[]): boolean {
	return results.some((r) => r.verdict === "fail" || r.verdict === "error");
}

export function changed(results: readonly Result[]): boolean {
	return results.some((r) => r.verdict === "warn");
}

const MARK: Record<Verdict, string> = {
	ok: "✓",
	warn: "!",
	fail: "✗",
	error: "✗",
	new: "+",
	"no-data": "·",
};

/**
 * Markdown, because it is read in three places: a terminal, a run summary, and
 * an issue body. Field names and types only — never a value — so the report is
 * safe to post in a public repository.
 */
export function report(results: readonly Result[], window: Window, today: string): string {
	const count = (...verdicts: Verdict[]) =>
		results.filter((r) => verdicts.includes(r.verdict)).length;

	const lines: string[] = [
		`# Garmin API contract — ${today}`,
		"",
		`${results.length} endpoints · ${count("fail", "error")} failing · ` +
			`${count("warn")} changed · ${count("new")} newly recorded · ` +
			`${count("no-data")} without data`,
		"",
		`Sampled ${window.days.join(", ")}; ranges ${window.rangeStart} → ${window.rangeEnd}.`,
		"",
	];

	for (const result of results) {
		const { entry } = result;
		lines.push(`## ${MARK[result.verdict]} ${entry.id} — \`${entry.method} ${entry.path}\``);
		const via = entry.plugin ? `\`${entry.plugin}\` · ` : "";
		const plural = result.samples === 1 ? "" : "s";
		lines.push(`${via}${result.samples} sample${plural} · ${result.verdict}`, "");

		if (result.error) {
			lines.push(`> ${result.error}`, "");
			continue;
		}
		if (result.verdict === "no-data") {
			lines.push("> Every sample came back empty — nothing to compare.", "");
			continue;
		}
		if (result.verdict === "new") {
			lines.push("> No recorded shape yet. Run `npm run api:record` to adopt this one.", "");
		}

		const unhealthy = result.critical.filter((item) => item.status !== "ok");
		if (unhealthy.length) {
			lines.push("| the plugin reads | status |", "| --- | --- |");
			for (const item of unhealthy) lines.push(`| \`${item.path}\` | ${item.status} |`);
			lines.push("");
		}

		for (const change of result.changes) {
			const emphasis = isFatal(change, entry.critical ?? []) ? "**" : "";
			lines.push(
				`- ${emphasis}${change.kind}${emphasis} \`${change.path || "(root)"}\` — ${change.detail}`,
			);
		}
		if (result.changes.length) lines.push("");
	}

	return lines.join("\n");
}
