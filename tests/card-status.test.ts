import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { homeModel } from "../src/dashboard/home";
import type { DayRow } from "../src/dashboard/series";
import { cardGuide, dailyTemplate } from "../src/embeds/notes-text";
import { parseCardBlock, type CardSpec } from "../src/embeds/spec";
import {
	activitiesEmptyFor,
	badgeFor,
	captionFor,
	dayWords,
	emptyCardNotice,
	emptyTextFor,
	errorNotice,
	groupsOf,
	noticeFor,
	reservedHeight,
} from "../src/embeds/status";

const TODAY = "2026-10-29";
const spec = (source: string): CardSpec => {
	const read = parseCardBlock(source);
	if ("error" in read) assert.fail(read.error.message);
	if (read.spec.kind !== "cards") assert.fail(`expected cards, got ${read.spec.kind}`);
	return read.spec;
};
const HOME = { inFocus: ["sleep", "bodyBattery", "steps"] as const, glance: ["heartRate", "intensity", "calories", "stress", "hrv", "floors", "weight", "vo2max", "endurance"] as const };

describe("card blocks: the day in words", () => {
	it("names a day as a card says it", () => {
		assert.equal(dayWords(TODAY, TODAY), "Today");
		assert.equal(dayWords("2026-10-28", TODAY), "Yesterday");
		assert.equal(dayWords("2026-10-21", TODAY), "Wed, Oct 21");
		assert.equal(dayWords("2025-11-02", TODAY), "Sun, Nov 2, 2025");
	});

	it("says what an empty card and an empty day of activities say", () => {
		assert.equal(emptyTextFor(TODAY, TODAY), "Nothing recorded today.");
		assert.equal(emptyTextFor("2026-10-28", TODAY), "Nothing recorded yesterday.");
		assert.equal(emptyTextFor("2026-10-21", TODAY), "Nothing recorded on Wed, Oct 21.");
		assert.equal(activitiesEmptyFor(TODAY, TODAY), "No activities or Health Snapshots yet today.");
		assert.equal(activitiesEmptyFor("2026-10-21", TODAY), "No activities or Health Snapshots on Wed, Oct 21.");
	});
});

describe("card blocks: why there are no cards", () => {
	const synced = { setUp: true, first: "2024-03-03", last: "2026-10-28", hasRow: true };

	it("asks for the setup first", () => {
		assert.deepEqual(noticeFor("2026-10-28", TODAY, { setUp: false, hasRow: false }), {
			icon: "watch",
			text: "Set up Garmin Connect to see your data here.",
			action: { kind: "set-up", label: "Set up", primary: true },
		});
	});

	it("tells nothing synced, a day to come, a day not synced and a day before the history apart", () => {
		assert.equal(noticeFor("2026-10-28", TODAY, { setUp: true, hasRow: false })?.text, "Nothing synced yet.");
		assert.equal(noticeFor("2026-10-30", TODAY, synced)?.text, "Fri, Oct 30 hasn’t happened yet.");
		assert.deepEqual(noticeFor(TODAY, TODAY, synced), { icon: "refresh-cw", text: "Today isn’t synced yet.", action: { kind: "open-garmin", label: "Open Garmin" }, namesDay: true });
		assert.deepEqual(noticeFor("2024-01-01", TODAY, synced)?.action, { kind: "settings", label: "Settings" });
		assert.equal(noticeFor("2024-01-01", TODAY, synced)?.text, "Your synced history starts Mar 3, 2024.");
		assert.equal(noticeFor("2026-10-21", TODAY, { ...synced, hasRow: false })?.text, "Nothing recorded on Wed, Oct 21.");
		assert.equal(noticeFor("2026-10-21", TODAY, synced), null);
	});

	it("words a mistake with its line and the way out", () => {
		assert.deepEqual(errorNotice({ line: 1, message: "Unknown card “slep”. Did you mean sleep?", hint: "Insert card… lists every card." }), {
			icon: "circle-x",
			text: "Unknown card “slep”. Did you mean sleep?",
			tone: "error",
			hint: "Line 1. Insert card… lists every card.",
		});
	});
});

describe("card blocks: the line over a block", () => {
	it("names the day only when it isn't the note's own", () => {
		assert.equal(captionFor({ date: "2026-10-28", live: false, source: "daily-note", noteDay: "2026-10-28" }, "2026-10-28", TODAY), undefined);
		assert.equal(captionFor({ date: "2026-10-21", live: false, source: "block", noteDay: "2026-10-28" }, "2026-10-21", TODAY), "Wed, Oct 21");
		assert.equal(captionFor({ date: "2026-10-21", live: false, source: "block" }, "2026-10-21", TODAY), "Wed, Oct 21");
		assert.equal(captionFor({ date: "2026-10-28", live: false, source: "block", noteDay: "2026-10-28" }, "2026-10-28", TODAY), undefined);
	});

	it("says Today on a live block, and which day it shows until today syncs", () => {
		assert.equal(captionFor({ date: TODAY, live: true, source: "today" }, TODAY, TODAY), "Today");
		assert.equal(captionFor({ date: TODAY, live: true, source: "today" }, "2026-10-28", TODAY), "Yesterday · today isn’t synced yet");
	});
});

describe("card blocks: how the cards sit", () => {
	it("keeps each card at its Home size, neighbours in one row", () => {
		assert.deepEqual(groupsOf(spec("show: sleep, body-battery"), HOME), [{ kind: "focus", ids: ["sleep", "bodyBattery"] }]);
		assert.deepEqual(groupsOf(spec("show: heart-rate, stress, hrv-status, intensity-minutes"), HOME), [{ kind: "glance", ids: ["heartRate", "stress", "hrv", "intensity"] }]);
		assert.deepEqual(groupsOf(spec("show: sleep, heart-rate, stress, steps"), HOME), [
			{ kind: "focus", ids: ["sleep"] },
			{ kind: "glance", ids: ["heartRate", "stress"] },
			{ kind: "focus", ids: ["steps"] },
		]);
	});

	it("draws the big cards small with size: small, but for the week of activities, which has no small card", () => {
		assert.deepEqual(groupsOf(spec("show: steps, heart-rate, stress\nsize: small"), HOME), [{ kind: "glance", ids: ["steps", "heartRate", "stress"] }]);
		assert.deepEqual(groupsOf(spec("show: activity-week, sleep\nsize: small"), HOME), [
			{ kind: "focus", ids: ["activities"] },
			{ kind: "glance", ids: ["sleep"] },
		]);
	});

	it("lays the whole day out as Home: In Focus, the day's activities, then the first eight At a Glance", () => {
		assert.deepEqual(groupsOf(spec("show: day"), HOME), [
			{ kind: "focus", ids: ["sleep", "bodyBattery", "steps"] },
			{ kind: "activities" },
			{ kind: "glance", ids: ["heartRate", "intensity", "calories", "stress", "hrv", "floors", "weight", "vo2max"] },
		]);
		assert.deepEqual(groupsOf(spec("show: activities"), HOME), [{ kind: "activities" }]);
	});

	it("reserves Home's card heights while it loads", () => {
		assert.equal(reservedHeight(groupsOf(spec("show: sleep"), HOME)), 318);
		assert.equal(reservedHeight(groupsOf(spec("show: sleep, heart-rate"), HOME)), 318 + 8 + 281);
	});
});

describe("card blocks: a card with nothing for its day", () => {
	const row = (date: string, values: Record<string, number> = {}): DayRow => ({ date, values, text: {} });
	const model = homeModel({ date: "2026-10-21", rows: [row("2026-10-21", { steps: 900, step_goal: 10_000 })], series: null, account: null });

	it("says so in a line when it is the block's only card", () => {
		assert.deepEqual(emptyCardNotice(spec("show: sleep"), groupsOf(spec("show: sleep"), HOME), model, "2026-10-21", TODAY), {
			icon: "moon-star",
			text: "No Sleep Score on Wed, Oct 21.",
			tone: "muted",
			namesDay: true,
		});
		assert.equal(emptyCardNotice(spec("show: steps"), groupsOf(spec("show: steps"), HOME), model, "2026-10-21", TODAY), null);
		// Among others, an empty card keeps its place and says so itself.
		const pair = spec("show: sleep, steps");
		assert.equal(emptyCardNotice(pair, groupsOf(pair, HOME), model, "2026-10-21", TODAY), null);
	});

	it("marks a card holding only the latest value on an earlier day", () => {
		assert.equal(badgeFor("cyclingFtp", "2026-10-21", TODAY), "Now");
		assert.equal(badgeFor("cyclingFtp", TODAY, TODAY), undefined);
		assert.equal(badgeFor("stress", "2026-10-21", TODAY), undefined);
	});
});

describe("the notes the plugin writes", () => {
	const blocks = (text: string) => [...text.matchAll(/^```garmin\n([\s\S]*?)^```$/gm)].map((m) => m[1]!);

	it("writes a template of cards that read, with no dates in it", () => {
		const found = blocks(dailyTemplate());
		assert.equal(found.length, 3);
		for (const source of found) {
			assert.ok(!("error" in parseCardBlock(source)), source);
			assert.ok(!/date:/.test(source));
		}
	});

	it("writes a guide with a live example of every card", () => {
		const guide = cardGuide("1.3.0");
		assert.ok(guide.startsWith("Written by Garmin Connect 1.3.0."));
		const found = blocks(guide);
		for (const source of found) assert.ok(!("error" in parseCardBlock(source)), source);
		for (const id of ["day", "sleep", "heart-rate", "weight", "xc-ski-ftp"]) assert.ok(found.includes(`show: ${id}\n`), id);
		for (const id of ["sleep", "body-battery", "pulse-ox", "weight"]) assert.ok(found.includes(`chart: ${id}\n`), id);
		assert.ok(found.includes("activity: latest\n"));
		// The example of the block itself is shown, not drawn: its fence is longer.
		assert.match(guide, /````markdown\n```garmin\nshow: sleep\n```\n````/);
	});
});
