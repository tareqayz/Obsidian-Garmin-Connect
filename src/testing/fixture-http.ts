import { buildUrl, type HttpClient, type HttpRequest, type HttpResponse } from "../http";

export interface FixtureRule {
	/** Restrict to one method. Omit to match any. */
	method?: string;
	/** Substring, or a regex, matched against the resolved URL including query. */
	url: string | RegExp;
	/** How many times this rule may match before the next one takes over. */
	times?: number;
	status?: number;
	headers?: Record<string, string>;
	/** Serialised as the body, with a JSON content-type. */
	json?: unknown;
	/** Raw body, when you need something that is not JSON. */
	text?: string;
	/** Simulate a transport failure (status 0). */
	error?: string;
}

export interface RecordedRequest extends HttpRequest {
	resolvedUrl: string;
}

/**
 * Replays canned responses so the Garmin logic can be tested without a network
 * or an Obsidian host. Rules are matched in order and consumed by `times`, which
 * is how sequences like "first DI client ID fails, second succeeds" are modelled.
 */
export class FixtureHttpClient implements HttpClient {
	readonly requests: RecordedRequest[] = [];
	private rules: Array<FixtureRule & { used: number }>;

	constructor(rules: FixtureRule[]) {
		this.rules = rules.map((r) => ({ ...r, used: 0 }));
	}

	/** Requests recorded so far, oldest first. */
	get urls(): string[] {
		return this.requests.map((r) => r.resolvedUrl);
	}

	async request(req: HttpRequest): Promise<HttpResponse> {
		const resolvedUrl = buildUrl(req.url, req.query);
		this.requests.push({ ...req, resolvedUrl });

		const rule = this.rules.find((r) => {
			if (r.used >= (r.times ?? Number.POSITIVE_INFINITY)) return false;
			if (r.method && r.method.toUpperCase() !== (req.method ?? "GET").toUpperCase()) {
				return false;
			}
			return typeof r.url === "string" ? resolvedUrl.includes(r.url) : r.url.test(resolvedUrl);
		});

		if (!rule) {
			throw new Error(
				`No fixture matched ${req.method ?? "GET"} ${resolvedUrl}\n` +
					`Rules: ${this.rules.map((r) => `${r.method ?? "*"} ${String(r.url)} (used ${r.used})`).join(", ")}`,
			);
		}
		rule.used += 1;

		if (rule.error) {
			return { status: 0, headers: {}, text: "", error: rule.error };
		}

		const headers: Record<string, string> = {};
		for (const [k, v] of Object.entries(rule.headers ?? {})) headers[k.toLowerCase()] = v;
		if (rule.json !== undefined && !headers["content-type"]) {
			headers["content-type"] = "application/json";
		}

		return {
			status: rule.status ?? 200,
			headers,
			text: rule.text ?? (rule.json !== undefined ? JSON.stringify(rule.json) : ""),
		};
	}
}

/** A minimal JWT whose payload carries the given claims. Signature is not checked. */
export function fakeJwt(claims: Record<string, unknown>): string {
	const b64 = (o: unknown) =>
		btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	return `${b64({ alg: "none", typ: "JWT" })}.${b64(claims)}.signature`;
}
