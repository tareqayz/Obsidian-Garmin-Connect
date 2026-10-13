/**
 * The ramp, run inside Obsidian on the plugin's own session — no token in the
 * shell, and Obsidian's `requestUrl` as the transport, which is what a sync uses.
 *
 *   npm run api:ramp:eval    # bundles to scripts/.api-ramp-eval.js
 *   scripts/dev/ev.sh "window.__rampOpts={stages:'1x3,2x6',stageSeconds:60,cooldownSeconds:120}; \
 *     eval(require('fs').readFileSync('<abs>/scripts/.api-ramp-eval.js','utf8'))"
 *   scripts/dev/ev.sh "JSON.stringify(window.__ramp.lines)"     # poll
 *   scripts/dev/ev.sh "window.__ramp.cancel=true"               # stop early
 *
 * Progress and results live on `window.__ramp`. Pause the plugin's own syncing
 * while it runs: both draw on the same budget.
 */

import type { GarminApi } from "../../src/garmin/endpoints";
import { ceiling, DEFAULT_STAGES, line, parseStages, ramp, type StageResult } from "./ramp-core";

interface RampState {
	status: "running" | "done" | "failed";
	lines: string[];
	results: StageResult[];
	cancel: boolean;
	error?: string;
}

const w = window as unknown as {
	app: { plugins: { plugins: Record<string, { garmin?: GarminApi }> } };
	__ramp?: RampState;
	__rampOpts?: { stages?: string; stageSeconds?: number; cooldownSeconds?: number };
};

if (w.__ramp?.status === "running") {
	// Idempotent: ev.sh may run this twice when the first output is lost.
} else {
	const api = w.app.plugins.plugins["garmin-connect"]?.garmin;
	const opts = w.__rampOpts ?? {};
	const state: RampState = { status: "running", lines: [], results: [], cancel: false };
	w.__ramp = state;
	const stages = parseStages(opts.stages ?? DEFAULT_STAGES);
	const stageSeconds = opts.stageSeconds ?? 60;
	const cooldownSeconds = opts.cooldownSeconds ?? 120;
	state.lines.push(`${new Date().toISOString()} ramp: ${stages.length} stages of ${stageSeconds}s, ${cooldownSeconds}s cool-down`);

	if (!api?.isAuthenticated) {
		state.status = "failed";
		state.error = "garmin-connect is not loaded or not signed in";
	} else {
		ramp(api, {
			stages,
			stageSeconds,
			cooldownSeconds,
			cancelled: () => state.cancel,
			onStage: (result, i) => {
				state.results.push(result);
				state.lines.push(`${i + 1}. ${line(result)}`);
			},
		}).then(
			(results) => {
				const top = ceiling(results);
				state.lines.push(
					top
						? `ceiling: ${top.achievedRate.toFixed(2)} req/s clean (stage ${top.rate}x${top.concurrency})`
						: "no stage ran clean",
				);
				state.status = "done";
			},
			(err: unknown) => {
				state.error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
				state.status = "failed";
			},
		);
	}
}
