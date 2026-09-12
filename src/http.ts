/**
 * Transport abstraction.
 *
 * Nothing below this line may import `obsidian`, node builtins, or electron.
 * The Garmin logic talks to `HttpClient` only, so the same code runs under
 * Obsidian's `requestUrl` on a phone, under `fetch` in a test, or under a
 * recorded fixture.
 */

export interface HttpRequest {
	url: string;
	method?: "GET" | "POST";
	/** Appended as a URL-encoded query string. */
	query?: Record<string, string>;
	headers?: Record<string, string>;
	body?: string;
}

export interface HttpResponse {
	/** 0 means the request never completed (DNS, TLS, offline, blocked). */
	status: number;
	/** Header names are lower-cased. */
	headers: Record<string, string>;
	text: string;
	/** Transport-level failure message, when status is 0. */
	error?: string;
}

export interface HttpClient {
	request(req: HttpRequest): Promise<HttpResponse>;
}

export function buildUrl(url: string, query?: Record<string, string>): string {
	if (!query) return url;
	const qs = new URLSearchParams(query).toString();
	return qs ? `${url}?${qs}` : url;
}

export function parseJson<T = Record<string, unknown>>(text: string): T | null {
	try {
		return JSON.parse(text) as T;
	} catch {
		return null;
	}
}

/* ------------------------------------------------------------------ */
/*  Cookie jar                                                         */
/* ------------------------------------------------------------------ */

/**
 * Split a joined Set-Cookie header back into individual cookies.
 *
 * Obsidian's `requestUrl` returns headers as Record<string, string>, so when a
 * response carries several Set-Cookie headers they arrive glued together with
 * commas. Cookie expiry dates ("Expires=Wed, 09 Jun 2027 …") contain commas
 * too, so we only split on a comma that is followed by a `token=` — the shape
 * that starts a new cookie.
 */
export function splitSetCookie(raw: string): string[] {
	return raw
		.split(/,(?=\s*[A-Za-z0-9!#$%&'*+\-.^_`|~]+=)/)
		.map((s) => s.trim())
		.filter(Boolean);
}

/**
 * A minimal cookie store. Garmin's SSO leg needs cookie continuity between the
 * login POST and the MFA verify POST, and `requestUrl` does not keep a jar of
 * its own on either platform.
 */
export class CookieJar {
	private jar = new Map<string, string>();

	ingest(headers: Record<string, string>): string[] {
		const raw = headers["set-cookie"];
		if (!raw) return [];
		const added: string[] = [];
		for (const cookie of splitSetCookie(raw)) {
			const pair = cookie.split(";", 1)[0] ?? "";
			const eq = pair.indexOf("=");
			if (eq <= 0) continue;
			const name = pair.slice(0, eq).trim();
			const value = pair.slice(eq + 1).trim();
			this.jar.set(name, value);
			added.push(name);
		}
		return added;
	}

	header(): string | undefined {
		if (this.jar.size === 0) return undefined;
		return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
	}

	names(): string[] {
		return [...this.jar.keys()];
	}

	get size(): number {
		return this.jar.size;
	}
}
