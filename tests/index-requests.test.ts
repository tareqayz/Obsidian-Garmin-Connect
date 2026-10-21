import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { GarminApi } from "../src/garmin/endpoints";
import { DAY_INDEXES } from "../src/sync/day-indexes";

/**
 * A client that answers every route with nothing and counts the routes asked.
 * The account lookups (`require…`) are cached by the real client, so they are
 * not requests a window spends.
 */
function countingApi(): { api: GarminApi; calls: string[] } {
	const calls: string[] = [];
	const api = new Proxy(
		{},
		{
			get: (_, name) => {
				if (name === "then") return undefined;
				return async () => {
					if (!String(name).startsWith("require")) calls.push(String(name));
					return [];
				};
			},
		},
	) as unknown as GarminApi;
	return { api, calls };
}

describe("history windows book what they ask", () => {
	for (const def of DAY_INDEXES) {
		it(`${def.kind}: ${def.requestsPerWindow} a window`, async () => {
			const { api, calls } = countingApi();
			try {
				await def.fetchWindow(api, "2026-01-01", "2026-01-28");
			} catch {
				// An empty answer some readers refuse: the routes asked are what counts.
			}
			assert.equal(calls.length, def.requestsPerWindow, calls.join(", "));
		});
	}
});
