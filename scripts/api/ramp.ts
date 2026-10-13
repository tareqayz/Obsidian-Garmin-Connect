/**
 * Finds how fast the plugin can ask Garmin for data before Garmin objects.
 *
 *   GARMIN_TOKENS="$(cat .garmin-token.json)" npm run api:ramp -- --save-token .garmin-token.json
 *
 * Garmin publishes no rate limit, so this measures one: it asks for the same
 * per-day endpoints a backfill does, at a fixed rate per stage, raising the
 * rate stage by stage with a cool-down between. It stops — no further requests
 * — on the first 429, the first edge refusal (403 / HTML), a p95 latency three
 * times the first stage's, or more than 5% server errors. The last clean stage
 * is the ceiling; the plugin should run well under it, since the phone app and
 * the website share the account's budget.
 *
 * Options:
 *   --stages 1x3,2x6,4x9   rate (req/s) x max in flight, per stage
 *   --stage-seconds 60     how long each stage runs
 *   --cooldown 120         seconds of silence between stages
 *   --out <path>           JSON results (default ref/api-ramp/<date>.json)
 *   --save-token <path>    write a rotated refresh token back out
 *
 * Do not run it alongside a plugin sync: both draw on the same budget, and the
 * sync would read a 429 caused here as its own.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { isoDay } from "./probes";
import { ceiling, DEFAULT_STAGES, line, parseStages, ramp, type StageResult } from "./ramp-core";
import { authFromEnv, connect, EnvTokenStore, saveSession } from "./session";

function option(name: string): string | undefined {
	const index = process.argv.indexOf(`--${name}`);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<number> {
	const stages = parseStages(option("stages") ?? DEFAULT_STAGES);
	const stageSeconds = Number(option("stage-seconds") ?? 60);
	const cooldownSeconds = Number(option("cooldown") ?? 120);
	const out = option("out") ?? `ref/api-ramp/${isoDay(0)}.json`;
	const tokenOut = option("save-token");

	const store = new EnvTokenStore(authFromEnv());
	const api = await connect(store);
	saveSession(store, tokenOut);

	const done: StageResult[] = [];
	const write = () => {
		mkdirSync(dirname(out), { recursive: true });
		writeFileSync(out, `${JSON.stringify({ ranAt: new Date().toISOString(), stageSeconds, cooldownSeconds, results: done }, null, "\t")}\n`);
	};

	console.log(`Ramp: ${stages.length} stages of ${stageSeconds}s, ${cooldownSeconds}s cool-down between\n`);
	const results = await ramp(api, {
		stages,
		stageSeconds,
		cooldownSeconds,
		onStage: (result, i) => {
			done.push(result);
			console.log(`${i + 1}. ${line(result)}`);
			write();
			saveSession(store, tokenOut);
		},
	});

	const top = ceiling(results);
	console.log(
		top
			? `\nCeiling: ${top.achievedRate.toFixed(2)} req/s clean (stage ${top.rate}x${top.concurrency})`
			: "\nNo stage ran clean.",
	);
	console.log(`Results: ${out}`);
	return results.some((r) => r.stop?.startsWith("429") || r.stop?.startsWith("edge")) ? 1 : 0;
}

main().then(
	(code) => process.exit(code),
	(err: unknown) => {
		console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
		process.exit(2);
	},
);
