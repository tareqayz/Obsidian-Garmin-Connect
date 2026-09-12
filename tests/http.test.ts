import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { CookieJar, buildUrl, parseJson, splitSetCookie } from "../src/http";

describe("splitSetCookie", () => {
	it("splits joined cookies without breaking expiry dates", () => {
		// The exact shape Garmin's SSO returns, comma-joined by requestUrl.
		const raw =
			"GARMIN-SSO=1; Path=/; Secure, " +
			"GARMIN-SSO-GUID=ABC123; Expires=Wed, 09 Jun 2027 10:18:14 GMT; Path=/, " +
			"SESSION=xyz; Path=/; HttpOnly";
		const parts = splitSetCookie(raw);
		assert.equal(parts.length, 3);
		assert.match(parts[1]!, /^GARMIN-SSO-GUID=ABC123; Expires=Wed, 09 Jun 2027/);
	});

	it("keeps a lone cookie with a comma in its expiry intact", () => {
		const raw = "__cf_bm=abc.def-123; Expires=Sat, 12 Sep 2026 11:20:34 GMT; Path=/";
		assert.deepEqual(splitSetCookie(raw), [raw]);
	});

	it("returns nothing for an empty header", () => {
		assert.deepEqual(splitSetCookie(""), []);
	});
});

describe("CookieJar", () => {
	it("collects cookies and renders them as a request header", () => {
		const jar = new CookieJar();
		const added = jar.ingest({ "set-cookie": "A=1; Path=/, B=2; Secure" });
		assert.deepEqual(added, ["A", "B"]);
		assert.equal(jar.header(), "A=1; B=2");
		assert.equal(jar.size, 2);
	});

	it("lets a later value replace an earlier one", () => {
		const jar = new CookieJar();
		jar.ingest({ "set-cookie": "SESSION=old" });
		jar.ingest({ "set-cookie": "SESSION=new" });
		assert.equal(jar.header(), "SESSION=new");
	});

	it("is undefined when empty, so no Cookie header is sent", () => {
		assert.equal(new CookieJar().header(), undefined);
	});

	it("ignores malformed pairs", () => {
		const jar = new CookieJar();
		jar.ingest({ "set-cookie": "=novalue; Path=/, GOOD=1" });
		assert.equal(jar.header(), "GOOD=1");
	});
});

describe("buildUrl", () => {
	it("encodes the service URL Garmin requires verbatim", () => {
		const url = buildUrl("https://sso.garmin.com/mobile/api/login", {
			clientId: "GCM_IOS_DARK",
			service: "https://mobile.integration.garmin.com/gcm/ios",
		});
		assert.equal(
			url,
			"https://sso.garmin.com/mobile/api/login?clientId=GCM_IOS_DARK" +
				"&service=https%3A%2F%2Fmobile.integration.garmin.com%2Fgcm%2Fios",
		);
	});

	it("leaves the URL alone when there is no query", () => {
		assert.equal(buildUrl("https://x.test/a"), "https://x.test/a");
	});
});

describe("parseJson", () => {
	it("returns null rather than throwing on an HTML challenge page", () => {
		assert.equal(parseJson("<html>Just a moment…</html>"), null);
	});
});
