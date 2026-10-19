/**
 * What every request to Garmin cost: how long it took and what came back.
 *
 * A sync reports how many requests it made, which says nothing about where its
 * time went — Garmin's response time, our own pauses, or retries. This is the
 * missing half, and what the ramp probe reads to find the safe request rate.
 */

export interface RequestSample {
	/** The path with ids and dates folded, so one endpoint is one bucket. */
	endpoint: string;
	status: number;
	ms: number;
	/** 1 for the first try, 2+ for a retry. */
	attempt: number;
	at: number;
}

export interface RequestSummary {
	count: number;
	retries: number;
	rateLimited: number;
	errors: number;
	p50: number;
	p95: number;
	max: number;
	/** Sum of request durations; above wall time when requests overlapped. */
	busyMs: number;
}

/** `/wellness-service/wellness/dailySleepData/abc?date=2024-01-02` → `/wellness-service/wellness/dailySleepData/:id`. */
export function endpointOf(path: string): string {
	return path
		.split("?")[0]
		.replace(/\/\d{4}-\d{2}-\d{2}(?=\/|$)/g, "/:date")
		.replace(/\/[0-9a-f-]{8,}(?=\/|$)/gi, "/:id")
		.replace(/\/\d+(?=\/|$)/g, "/:n");
}

export function percentile(sorted: readonly number[], p: number): number {
	if (!sorted.length) return 0;
	const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
	return sorted[index];
}

export function summarize(samples: readonly RequestSample[]): RequestSummary {
	const ms = samples.map((s) => s.ms).sort((a, b) => a - b);
	return {
		count: samples.length,
		retries: samples.filter((s) => s.attempt > 1).length,
		rateLimited: samples.filter((s) => s.status === 429).length,
		errors: samples.filter((s) => s.status === 0 || s.status >= 400).length,
		p50: percentile(ms, 50),
		p95: percentile(ms, 95),
		max: ms.at(-1) ?? 0,
		busyMs: ms.reduce((sum, v) => sum + v, 0),
	};
}

export function describe(s: RequestSummary): string {
	return (
		`${s.count} requests, p50 ${s.p50}ms, p95 ${s.p95}ms, max ${s.max}ms` +
		(s.retries ? `, ${s.retries} retries` : "") +
		(s.rateLimited ? `, ${s.rateLimited} rate limited` : "")
	);
}

/** Keeps the newest `cap` samples: a long backfill should not grow without bound. */
export class RequestStats {
	private samples: RequestSample[] = [];

	constructor(private readonly cap = 20_000) {}

	record(sample: RequestSample): void {
		this.samples.push(sample);
		if (this.samples.length > this.cap) this.samples.splice(0, this.samples.length - this.cap);
	}

	/** Samples recorded at or after `since` (epoch ms). */
	since(since = 0): RequestSample[] {
		return this.samples.filter((s) => s.at >= since);
	}

	summary(since = 0): RequestSummary {
		return summarize(this.since(since));
	}

	clear(): void {
		this.samples = [];
	}
}
