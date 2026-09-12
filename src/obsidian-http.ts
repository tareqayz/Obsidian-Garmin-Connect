import { requestUrl } from "obsidian";
import { buildUrl, type HttpClient, type HttpRequest, type HttpResponse } from "./http";

/**
 * `requestUrl` adapter — the only file in the auth path that touches Obsidian.
 *
 * Two behaviours worth knowing:
 *  - it throws on status >= 400 unless `throw: false`, and we always want to
 *    read the body of a 403/429 rather than lose it to an exception;
 *  - it follows redirects and manages no cookies, so callers handle both.
 */
export class ObsidianHttpClient implements HttpClient {
	async request(req: HttpRequest): Promise<HttpResponse> {
		const url = buildUrl(req.url, req.query);
		try {
			const res = await requestUrl({
				url,
				method: req.method ?? "GET",
				headers: req.headers,
				body: req.body,
				throw: false,
			});

			const headers: Record<string, string> = {};
			for (const [k, v] of Object.entries(res.headers ?? {})) {
				headers[k.toLowerCase()] = String(v);
			}

			let text = "";
			try {
				text = res.text ?? "";
			} catch {
				// Binary or empty body — the status and headers still tell us
				// what we need for a diagnostic.
				text = "";
			}

			return { status: res.status, headers, text };
		} catch (err) {
			return {
				status: 0,
				headers: {},
				text: "",
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}
}
