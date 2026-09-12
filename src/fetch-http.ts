import { buildUrl, type HttpClient, type HttpRequest, type HttpResponse } from "./http";

/**
 * `fetch` adapter — used by the Node harness and by tests, never by the plugin.
 * Its only reason to exist is to prove the Garmin logic has no Obsidian in it.
 */
export class FetchHttpClient implements HttpClient {
	async request(req: HttpRequest): Promise<HttpResponse> {
		try {
			const res = await fetch(buildUrl(req.url, req.query), {
				method: req.method ?? "GET",
				headers: req.headers,
				body: req.body,
				redirect: "follow",
			});
			const headers: Record<string, string> = {};
			res.headers.forEach((v, k) => {
				headers[k.toLowerCase()] = v;
			});
			return { status: res.status, headers, text: await res.text() };
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
