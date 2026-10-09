import { buildUrl, type HttpClient, type HttpRequest, type HttpResponse } from "../../src/http";

/**
 * `fetch` adapter — used by the API scripts (`api:check`, `api:token`) and by
 * tests, never by the plugin. It lets the Garmin logic run outside Obsidian, which
 * also proves that logic has no Obsidian in it.
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
			// `forEach` yields each Set-Cookie on its own, so the loop above keeps
			// only the last one — which dropped the SSO `SESSION` cookie and made
			// Garmin answer the MFA verify with SESSION_EXPIRED. Join them the way
			// Obsidian's `requestUrl` does; `splitSetCookie` takes them apart again.
			const cookies = res.headers.getSetCookie?.() ?? [];
			if (cookies.length) headers["set-cookie"] = cookies.join(", ");
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
