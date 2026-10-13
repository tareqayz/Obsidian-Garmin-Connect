/**
 * The ramp itself, free of node and of Obsidian, so the same code runs from the
 * CLI (`ramp.ts`, a token from the environment) and inside the running plugin
 * (`ramp-eval.ts`, the plugin's own session and `requestUrl`). See `ramp.ts`.
 */

import type { GarminApi } from "../../src/garmin/endpoints";
import { retryAfter } from "../../src/garmin/tokens";
import type { HttpClient } from "../../src/http";
import { endpointOf, summarize, type RequestSample, type RequestSummary } from "../../src/garmin/request-stats";
import { isoDay, sleep } from "./probes";

export interface Stage {
	rate: number;
	concurrency: number;
}

export interface StageResult extends Stage {
	seconds: number;
	achievedRate: number;
	summary: RequestSummary;
	statuses: Record<string, number>;
	byEndpoint: Record<string, { count: number; p50: number; p95: number }>;
	stop?: string;
	retryAfter?: number;
}

export const DEFAULT_STAGES = "1x3,2x6,4x9,6x12,8x15,12x20";

/** The per-day calls a backfill makes, in the order `fetchDay` makes them. */
const DAY_CALLS: Array<(api: GarminApi, date: string) => Promise<unknown>> = [
	(api, d) => api.dailySummary(d),
	(api, d) => api.sleep(d),
	(api, d) => api.hrv(d),
	(api, d) => api.trainingReadiness(d),
	(api, d) => api.enduranceScore(d),
	(api, d) => api.trainingStatus(d),
	(api, d) => api.bodyComposition(d),
	(api, d) => api.fitnessAge(d),
	(api, d) => api.healthStatus(d),
];

/** Days a backfill would walk, from a month back, so the newest data is not the only kind asked for. */
function* workload(): Generator<(api: GarminApi) => Promise<unknown>> {
	for (let offset = 30; ; offset++) {
		const date = isoDay(offset);
		for (const call of DAY_CALLS) yield (api) => call(api, date);
	}
}

export function parseStages(raw: string): Stage[] {
	return raw.split(",").map((part) => {
		const [rate, concurrency] = part.split("x").map(Number);
		if (!(rate! > 0) || !(concurrency! > 0)) throw new Error(`bad stage "${part}" (want <rate>x<concurrency>)`);
		return { rate: rate!, concurrency: concurrency! };
	});
}

function tally<T>(items: readonly T[], key: (item: T) => string): Record<string, number> {
	const out: Record<string, number> = {};
	for (const item of items) out[key(item)] = (out[key(item)] ?? 0) + 1;
	return out;
}

function byEndpoint(samples: readonly RequestSample[]): StageResult["byEndpoint"] {
	const groups = new Map<string, RequestSample[]>();
	for (const s of samples) groups.set(s.endpoint, [...(groups.get(s.endpoint) ?? []), s]);
	return Object.fromEntries(
		[...groups].map(([endpoint, list]) => {
			const sum = summarize(list);
			return [endpoint, { count: sum.count, p50: sum.p50, p95: sum.p95 }];
		}),
	);
}

/**
 * Starts one request every `1000 / rate` ms, never more than `concurrency` at
 * once. A refusal (set on `out` by `tap`) means nothing further is started; requests already
 * in flight are let finish, because abandoning them does not un-send them.
 */
async function runStage(
	api: GarminApi,
	stage: Stage,
	seconds: number,
	next: () => (api: GarminApi) => Promise<unknown>,
	out: Refusal,
	cancelled?: () => boolean,
): Promise<void> {
	const interval = 1000 / stage.rate;
	const deadline = Date.now() + seconds * 1000;
	const inFlight = new Set<Promise<void>>();

	let due = Date.now();
	while (Date.now() < deadline && !out.stop && !cancelled?.()) {
		while (inFlight.size >= stage.concurrency) await Promise.race(inFlight);
		const wait = due - Date.now();
		if (wait > 0) await sleep(wait);
		if (out.stop) break;
		due += interval;

		const call = next();
		// Failures are read off the wire by `tap`, not off the thrown error: the
		// plugin's minified build does not keep its error class names.
		const job = call(api)
			.then(() => undefined, () => undefined)
			.finally(() => inFlight.delete(job));
		inFlight.add(job);
	}
	await Promise.all(inFlight);
}

export function line(r: StageResult): string {
	const s = r.summary;
	return (
		`${String(r.rate).padStart(4)} calls/s x${String(r.concurrency).padEnd(3)} → ` +
		`${r.achievedRate.toFixed(2)} HTTP req/s achieved, ${s.count} requests, ` +
		`p50 ${s.p50}ms p95 ${s.p95}ms max ${s.max}ms, ` +
		`statuses ${JSON.stringify(r.statuses)}` +
		(r.stop ? `\n     ✗ stopped: ${r.stop}${r.retryAfter ? ` (Retry-After ${r.retryAfter}s)` : ""}` : "")
	);
}


export interface RampOptions {
	stages: Stage[];
	stageSeconds: number;
	cooldownSeconds: number;
	/** Each finished stage, as it finishes. */
	onStage?: (result: StageResult, index: number) => void;
	/** Set to stop between stages, or before the next request. */
	cancelled?: () => boolean;
}

/**
 * Times every HTTP call the client makes, retries included, by wrapping its
 * transport. Wrapping rather than reading `GarminClient.stats` keeps the ramp
 * working against a plugin build older than the stats.
 */
type Refusal = Pick<StageResult, "stop" | "retryAfter">;

/** A 429, or the edge's non-JSON 403 / HTML challenge: Garmin saying stop. */
function refusal(res: { status: number; headers: Record<string, string>; text: string }): Refusal | null {
	if (res.status === 429) return { stop: "429 rate limited", retryAfter: retryAfter(res.headers) ?? undefined };
	const type = res.headers["content-type"] ?? "";
	if (res.status === 403 && !type.includes("json")) return { stop: "edge refused: 403 without JSON (bot challenge)" };
	if (res.status === 200 && type.includes("html")) return { stop: "edge refused: HTML where JSON was expected" };
	return null;
}

function tap(api: GarminApi, samples: RequestSample[], refused: Refusal): () => void {
	const holder = api as unknown as { http: HttpClient };
	const original = holder.http;
	holder.http = {
		async request(req) {
			const started = Date.now();
			const res = await original.request(req);
			const path = req.url.replace(/^https?:\/\/[^/]+/, "");
			samples.push({ endpoint: endpointOf(path), status: res.status, ms: Date.now() - started, attempt: 1, at: started });
			const why = refusal(res);
			if (why && !refused.stop) Object.assign(refused, why);
			return res;
		},
	};
	return () => {
		holder.http = original;
	};
}

export async function ramp(api: GarminApi, opts: RampOptions): Promise<StageResult[]> {
	// The display name lookup the summary needs, out of the first stage's timings.
	await api.dailySummary(isoDay(29)).catch(() => undefined);

	const samples: RequestSample[] = [];
	const refused: Refusal = {};
	const untap = tap(api, samples, refused);
	const results: StageResult[] = [];
	const source = workload();
	const next = () => source.next().value as (api: GarminApi) => Promise<unknown>;
	try {
		for (const [i, stage] of opts.stages.entries()) {
			if (opts.cancelled?.()) break;
			const started = Date.now();
			await runStage(api, stage, opts.stageSeconds, next, refused, opts.cancelled);
			const elapsed = (Date.now() - started) / 1000;
			const taken = samples.filter((s) => s.at >= started);
			const summary = summarize(taken);
			const result: StageResult = {
				...stage,
				seconds: Math.round(elapsed),
				achievedRate: taken.length / elapsed,
				summary,
				statuses: tally(taken, (s) => String(s.status)),
				byEndpoint: byEndpoint(taken),
				...refused,
			};

			const baseline = results[0]?.summary.p95;
			const serverErrors = taken.filter((s) => s.status === 0 || s.status >= 500).length;
			if (!result.stop && baseline && summary.p95 > baseline * 3) {
				result.stop = `p95 ${summary.p95}ms is over 3x the first stage's ${baseline}ms — Garmin is slowing down`;
			}
			if (!result.stop && taken.length && serverErrors / taken.length > 0.05) {
				result.stop = `${serverErrors} of ${taken.length} requests failed on Garmin's side`;
			}

			results.push(result);
			opts.onStage?.(result, i);
			if (result.stop) break;
			if (i < opts.stages.length - 1) {
				const until = Date.now() + opts.cooldownSeconds * 1000;
				while (Date.now() < until && !opts.cancelled?.()) await sleep(Math.min(1000, until - Date.now()));
			}
		}
	} finally {
		untap();
	}
	return results;
}

/** The last stage that ran clean, or null. */
export function ceiling(results: readonly StageResult[]): StageResult | null {
	return results.filter((r) => !r.stop).at(-1) ?? null;
}
