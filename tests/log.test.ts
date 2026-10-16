import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ProbeLog, redactEmail, scrub } from "../src/log";

describe("scrub", () => {
	it("masks emails, bearer tokens and IP addresses wherever they appear", () => {
		const jwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJlLXZhbHVl";
		const out = scrub(`signed in as someone@example.com from 203.0.113.42 and fe80:0:0:0:1:2:3:4 with ${jwt}`);
		assert.equal(out.includes("someone@example.com"), false);
		assert.ok(out.includes(redactEmail("someone@example.com")));
		assert.equal(out.includes("203.0.113.42"), false);
		assert.equal(out.includes("fe80:0:0:0:1:2:3:4"), false);
		assert.equal(out.includes(jwt), false);
		assert.ok(out.includes("eyJhbGciOi…"));
	});

	it("leaves versions, dates, times and hashes alone", () => {
		const text = "Obsidian 1.14.4 · 2026-10-16 11:30:05 · JA4 t13d1516h2_8daaf6152771_02713d6af862";
		assert.equal(scrub(text), text);
	});
});

describe("ProbeLog", () => {
	it("scrubs every line and swaps hidden values, plain or URL-encoded, for placeholders", () => {
		const log = new ProbeLog();
		log.hide("Ana Example", "[display name]");
		log.hide("12", "[too short to hide]");
		log.detail("GET", "/usersummary-service/usersummary/daily/Ana%20Example?calendarDate=2026-10-16");
		log.warn("refused for Ana Example at someone@example.com");
		const text = log.render();
		assert.equal(text.includes("Ana"), false);
		assert.equal(text.includes("someone@example.com"), false);
		assert.ok(text.includes("/daily/[display name]"));
		assert.ok(text.includes("2026-10-16"));
	});
});
