import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { categoryOf } from "../src/dashboard/activities";
import { POWER_CURVE_EXPLAINER, RECORDS_HEADERS, RECORDS_TITLE, axisDuration, peakDuration } from "../src/dashboard/cycling-power-curve-copy";
import {
	CURVE_DURATIONS,
	POWER_X_AXIS,
	cyclingPowerCurveView,
	isPowerRide,
	powerAxis,
	powerCurve,
	type CurvePoint,
	type CurveVertex,
	type CyclingPowerCurveContext,
	type CyclingPowerCurveView,
	type PowerCurveRange,
} from "../src/dashboard/cycling-power-curve-pages";
import { daysBetween, type Span } from "../src/dashboard/periods";
import { PERFORMANCE_REGISTRY } from "../src/dashboard/performance-stats";
import { POWER_DURATIONS, type ActivityRow } from "../src/sync/activity-index";
import { RIDES, TODAY, fixtureLine, rideAt } from "./cycling-power-curve-fixture";

/**
 * Golden numbers from ref/performance-stats/cycling-power-curve/README.md:
 * the phone shots of Sunday 2026-10-11 21:23–21:24, the web of 22:58–22:59
 * and the payloads of 2026-10-12 16:07–16:25 — the spec's 75 checks
 * (golden-cycling-power-curve.py) that reach the view model. The live
 * payloads are quoted below as "1:687@09-13 …" (duration, watts, the ride's
 * day), so the index's curves are checked against Garmin's own route. The
 * spans roll with the date, so everything is pinned to the capture day.
 */

const CTX: CyclingPowerCurveContext = { today: TODAY, complete: true };

function view(range: PowerCurveRange, opts: { offset?: number; rows?: readonly ActivityRow[]; ctx?: Partial<CyclingPowerCurveContext> } = {}): CyclingPowerCurveView {
	return cyclingPowerCurveView({ range, offset: opts.offset ?? 0 }, opts.rows ?? RIDES, { ...CTX, ...opts.ctx });
}

/** A curve's watts, "-" where it has none: as the spec lists a line. */
const watts = (vertices: readonly CurveVertex[]) => vertices.map((v) => v.watts);
/** A curve the way the live payloads are quoted: "1:687@09-13 … 18000:-". */
const curveText = (curve: readonly (CurvePoint | null)[]) =>
	curve.map((p, i) => (p ? `${p.seconds}:${p.watts}@${p.start.slice(5, 10)}` : `${POWER_DURATIONS[i]}:-`)).join(" ");
/** A table row as the shots read it: "1 second 687 Sep 13, 2025". */
const rowText = (v: CyclingPowerCurveView) => v.table.rows.map((r) => `${r.peak} ${r.watts} ${r.date}`);
const span = (from: string, to: string): Span => ({ from, to });

/** A synthetic index row: a road ride today unless `r` says otherwise. */
const ride = (r: Partial<ActivityRow>): ActivityRow => ({
	id: 9001,
	type: "road_biking",
	typeId: 10,
	parentTypeId: 2,
	start: "2026-10-11T07:00:00",
	begin: Date.parse("2026-10-11T03:00:00Z"),
	...r,
});

/** Live `powerCurve` payloads (2026-10-12), as asked: both ends inclusive. */
const LIVE = {
	allTime: "1:687@09-13 2:650@09-27 5:626@10-13 10:582@10-13 20:543@10-13 30:498@10-13 60:317@09-27 120:286@09-27 300:251@10-20 600:240@10-20 1200:211@10-20 1800:193@10-13 3600:181@10-25 7200:167@10-25 18000:-",
	year: "1:671@10-13 2:643@10-13 5:626@10-13 10:582@10-13 20:543@10-13 30:498@10-13 60:308@10-13 120:271@10-25 300:251@10-20 600:240@10-20 1200:211@10-20 1800:193@10-13 3600:181@10-25 7200:167@10-25 18000:-",
	yearBefore: "1:687@09-13 2:650@09-27 5:612@10-04 10:540@10-04 20:409@10-04 30:344@09-27 60:317@09-27 120:286@09-27 300:235@09-06 600:219@09-06 1200:188@09-06 1800:183@09-06 3600:161@09-15 7200:146@09-27 18000:-",
	oct13: "1:671@10-13 2:643@10-13 5:626@10-13 10:582@10-13 20:543@10-13 30:498@10-13 60:308@10-13 120:264@10-13 300:228@10-13 600:205@10-13 1200:196@10-13 1800:193@10-13 3600:- 7200:- 18000:-",
	oct25: "1:523@10-25 2:406@10-25 5:395@10-25 10:385@10-25 20:376@10-25 30:350@10-25 60:291@10-25 120:271@10-25 300:217@10-25 600:195@10-25 1200:187@10-25 1800:186@10-25 3600:181@10-25 7200:167@10-25 18000:-",
	oct14To24: "1:386@10-20 2:371@10-20 5:353@10-20 10:322@10-15 20:285@10-20 30:272@10-20 60:263@10-20 120:261@10-20 300:251@10-20 600:240@10-20 1200:211@10-20 1800:171@10-15 3600:166@10-15 7200:148@10-15 18000:-",
	oct14To25: "1:523@10-25 2:406@10-25 5:395@10-25 10:385@10-25 20:376@10-25 30:350@10-25 60:291@10-25 120:271@10-25 300:251@10-20 600:240@10-20 1200:211@10-20 1800:186@10-25 3600:181@10-25 7200:167@10-25 18000:-",
	sep13ToOct11: "1:687@09-13 2:650@09-27 5:612@10-04 10:540@10-04 20:409@10-04 30:344@09-27 60:317@09-27 120:286@09-27 300:225@09-27 600:208@09-27 1200:180@09-27 1800:175@09-27 3600:161@09-15 7200:146@09-27 18000:-",
	sep15: "1:628@09-15 2:614@09-15 5:504@09-15 10:396@09-15 20:304@09-15 30:299@09-15 60:278@09-15 120:258@09-15 300:221@09-15 600:202@09-15 1200:170@09-15 1800:171@09-15 3600:161@09-15 7200:142@09-15 18000:-",
	tieSep: "1:687@09-13 2:650@09-27 5:610@09-27 10:470@09-27 20:358@09-27 30:344@09-27 60:317@09-27 120:286@09-27 300:225@09-10 600:208@09-27 1200:180@09-27 1800:175@09-27 3600:161@09-15 7200:146@09-27 18000:-",
	tieOct: "1:645@10-04 2:640@10-04 5:612@10-04 10:540@10-04 20:409@10-04 30:330@10-04 60:254@10-04 120:230@10-04 300:199@10-04 600:180@10-04 1200:170@10-04 1800:168@10-01 3600:145@10-04 7200:140@10-04 18000:-",
} as const;

/** A curve with no value at any duration: Garmin's `entries: []`. */
const EMPTY = POWER_DURATIONS.map((s) => `${s}:-`).join(" ");

describe("the fixture", () => {
	it("is the 15 rides with power as the index keeps them: integer watts by duration, none at 5 hr, none excluded", () => {
		assert.equal(RIDES.length, 15);
		assert.ok(RIDES.every((r) => r.type === "road_biking" && categoryOf(r) === "cycling" && !r.noPowerCurve && r.power !== undefined));
		assert.ok(RIDES.every((r) => Object.values(r.power!).every(Number.isInteger)));
		assert.ok(RIDES.every((r) => r.power!["18000"] === undefined));
		// The Sep 13 ride is the longest, 4.36 h: no ride reached 5 hours.
		assert.equal(Math.max(...RIDES.map((r) => r.duration!)), 15693.14);
	});

	it("equals the spec's redacted fixture, ride for ride, oldest first", () => {
		const spec = [
			"09-01 18:29 1:441 2:406 5:355 10:341 20:308 30:276 60:222 120:188 300:180 600:166 1200:148 1800:147",
			"09-06 08:30 1:388 2:379 5:356 10:338 20:325 30:307 60:282 120:251 300:235 600:219 1200:188 1800:183 3600:136",
			"09-10 09:15 1:620 2:601 5:559 10:436 20:315 30:281 60:268 120:248 300:225 600:193 1200:165 1800:147 3600:89",
			"09-13 07:47 1:687 2:592 5:493 10:427 20:320 30:312 60:276 120:245 300:197 600:172 1200:156 1800:154 3600:129 7200:125",
			"09-15 16:39 1:628 2:614 5:504 10:396 20:304 30:299 60:278 120:258 300:221 600:202 1200:170 1800:171 3600:161 7200:142",
			"09-27 16:02 1:659 2:650 5:610 10:470 20:358 30:344 60:317 120:286 300:225 600:208 1200:180 1800:175 3600:157 7200:146",
			"09-29 19:11 1:453 2:357 5:244 10:194 20:156 30:148 60:109 120:102 300:61",
			"10-01 06:57 1:584 2:568 5:487 10:481 20:387 30:318 60:240 120:217 300:184 600:173 1200:170 1800:168 3600:140",
			"10-04 09:37 1:430 2:427 5:351 10:292 20:206 30:179 60:174 120:171 300:134 600:92",
			"10-04 15:18 1:645 2:640 5:612 10:540 20:409 30:330 60:254 120:230 300:199 600:180 1200:170 1800:162 3600:145 7200:140",
			"10-13 09:26 1:671 2:643 5:626 10:582 20:425 30:351 60:270 120:246 300:228 600:205 1200:196 1800:193",
			"10-13 10:42 1:639 2:634 5:582 10:573 20:543 30:498 60:308 120:264 300:177 600:171 1200:146",
			"10-15 09:39 1:364 2:352 5:336 10:322 20:250 30:236 60:226 120:212 300:204 600:197 1200:189 1800:171 3600:166 7200:148",
			"10-20 18:13 1:386 2:371 5:353 10:309 20:285 30:272 60:263 120:261 300:251 600:240 1200:211",
			"10-25 07:22 1:523 2:406 5:395 10:385 20:376 30:350 60:291 120:271 300:217 600:195 1200:187 1800:186 3600:181 7200:167",
		];
		assert.deepEqual([...RIDES].reverse().map(fixtureLine), spec);
		assert.ok(RIDES.every((r) => r.start.startsWith("2025-")));
	});

	it("keeps each ride's local start: the September rides at −07, two of them on the day before their GMT day", () => {
		const offset = (r: ActivityRow) => (Date.parse(`${r.start}Z`) - r.begin) / 3_600_000;
		const at = (start: string) => RIDES.find((r) => r.id === rideAt(start))!;
		assert.equal(offset(at("2025-09-01T18:29")), -7);
		assert.equal(new Date(at("2025-09-01T18:29").begin).toISOString().slice(0, 10), "2025-09-02");
		assert.equal(new Date(at("2025-09-29T19:11").begin).toISOString().slice(0, 10), "2025-09-30");
		assert.equal(offset(at("2025-10-04T15:18")), -7);
		assert.equal(offset(at("2025-10-13T09:26")), 4);
	});
});

describe("the page", () => {
	it("is the registry's Cycling Power Curve: 4w · 3m · 1y on the compact control, 4w first, read from the workouts group", () => {
		const stat = PERFORMANCE_REGISTRY.page("cycling-power-curve")!;
		assert.deepEqual([stat.title, stat.ranges, stat.defaultRange, stat.rangeControl, stat.group, stat.hub, stat.tabs], ["Cycling Power Curve", ["4w", "3m", "1y"], "4w", undefined, "workouts", undefined, undefined]);
		// 3m and 1y count months back from today plus a day; 4w is the default 28 days.
		assert.deepEqual(stat.spans, { "3m": { months: 3 }, "1y": { months: 12 } });
	});

	it("reads a range it does not have as 4w", () => {
		const v = cyclingPowerCurveView({ range: "7d", offset: 0 }, RIDES, CTX);
		assert.deepEqual([v.range, v.label, v.title], ["4w", "Sep 14 - Oct 11", "4 Week Cycling Power Curve"]);
	});
});

describe("the periods", () => {
	it("label the shots' spans: 4w the 28 days to today, 3m and 1y months back from today plus a day", () => {
		const shown = (["4w", "3m", "1y"] as const).map((r) => view(r));
		assert.deepEqual(
			shown.map((v) => v.label),
			["Sep 14 - Oct 11", "Jul 12 - Oct 11", "Oct 12, 2025 - Oct 11, 2026"],
		);
		assert.deepEqual(
			shown.map((v) => [v.span.from, v.span.to, daysBetween(v.span.from, v.span.to) + 1]),
			[
				["2026-09-14", "2026-10-11", 28],
				["2026-07-12", "2026-10-11", 92],
				["2025-10-12", "2026-10-11", 365],
			],
		);
		// Not weeks: 13 weeks to today would start Jul 13, 52 weeks Oct 13, 2025.
		assert.notEqual(shown[1]!.span.from, "2026-07-13");
		assert.notEqual(shown[2]!.span.from, "2025-10-13");
	});

	it("step a whole rule back (Inferred): Aug 17 - Sep 13, Apr 12 - Jul 11, Oct 12, 2024 - Oct 11, 2025", () => {
		assert.deepEqual(
			(["4w", "3m", "1y"] as const).map((r) => view(r, { offset: -1 }).label),
			["Aug 17 - Sep 13", "Apr 12 - Jul 11", "Oct 12, 2024 - Oct 11, 2025"],
		);
	});

	it("show < on every current period and stop at 1y −1, whose start is before the first ride (Sep 1, 2025); > only on a past one", () => {
		for (const range of ["4w", "3m", "1y"] as const) {
			const v = view(range);
			assert.deepEqual([v.canGoBack, v.canGoForward], [true, false], range);
		}
		assert.deepEqual([view("1y", { offset: -1 }).canGoBack, view("1y", { offset: -1 }).canGoForward], [false, true]);
		// 4w steps back to the period holding the first ride, Sep 1, 2025, and no further.
		const fourWeeks = (offset: number) => [view("4w", { offset }).label, view("4w", { offset }).canGoBack];
		assert.deepEqual(fourWeeks(-13), ["Sep 15-Oct 12, 2025", true]);
		assert.deepEqual(fourWeeks(-14), ["Aug 18-Sep 14, 2025", false]);
		// While the history sync runs, < stays.
		assert.equal(view("1y", { offset: -1, ctx: { complete: false } }).canGoBack, true);
	});
});

describe("the Record", () => {
	const RECORD = [687, 650, 626, 582, 543, 498, 317, 286, 251, 240, 211, 193, 181, 167];

	it("is the all-time best per duration: 687 650 626 582 543 498 317 286 251 240 211 193 181 167, nothing at 5 hr", () => {
		assert.deepEqual(watts(view("4w").record), RECORD);
		assert.deepEqual(
			view("4w").record.map((v) => v.seconds),
			POWER_DURATIONS.slice(0, 14),
		);
	});

	it("equals Garmin's all-time curve (`pc-all-time`), rides and days included, and a 10- or 2-year span's", () => {
		assert.equal(curveText(powerCurve(RIDES)), LIVE.allTime);
		assert.equal(curveText(powerCurve(RIDES, span("2016-10-12", "2026-10-11"))), LIVE.allTime);
		assert.equal(curveText(powerCurve(RIDES, span("2024-10-12", "2026-10-11"))), LIVE.allTime);
	});

	it("is not a lookback: the 1 s record of Sep 13, 2025, 393 days old, still holds", () => {
		assert.equal(daysBetween("2025-09-13", TODAY), 393);
		assert.deepEqual(view("4w").table.rows[0], { seconds: 1, peak: "1 second", watts: "687", date: "Sep 13, 2025", id: rideAt("2025-09-13T07:47") });
	});

	it("is the same on every range and period: only the period's curve follows the date row", () => {
		const record = view("4w").record;
		for (const [range, offset] of [["3m", 0], ["1y", 0], ["1y", -1], ["4w", -1], ["3m", -1]] as const) {
			assert.deepEqual(view(range, { offset }).record, record, `${range} ${offset}`);
			assert.deepEqual(view(range, { offset }).table, view("4w").table, `${range} ${offset}`);
		}
	});

	it("takes each duration's ride: 1 s Sep 13; 2 s, 1 and 2 min Sep 27; 5 s, 10 s, 30 min Oct 13 09:26; 20 s, 30 s Oct 13 10:42; 5, 10, 20 min Oct 20; 1 and 2 h Oct 25", () => {
		const ids = powerCurve(RIDES).map((p) => p?.id);
		const at = rideAt;
		assert.deepEqual(ids, [
			at("2025-09-13T07:47"),
			at("2025-09-27T16:02"),
			at("2025-10-13T09:26"),
			at("2025-10-13T09:26"),
			at("2025-10-13T10:42"),
			at("2025-10-13T10:42"),
			at("2025-09-27T16:02"),
			at("2025-09-27T16:02"),
			at("2025-10-20T18:13"),
			at("2025-10-20T18:13"),
			at("2025-10-20T18:13"),
			at("2025-10-13T09:26"),
			at("2025-10-25T07:22"),
			at("2025-10-25T07:22"),
			undefined,
		]);
	});
});

describe("the period's curve", () => {
	it("4w and 3m: no ride in the span, so the empty line over the Record alone, with the full legend", () => {
		for (const [range, title, empty, legend] of [
			["4w", "4 Week Cycling Power Curve", "There is no 4 week power data for this period", "4 Weeks"],
			["3m", "3 Month Cycling Power Curve", "There is no 3 month power data for this period", "3 Months"],
		] as const) {
			const v = view(range);
			assert.deepEqual([v.title, v.empty, v.legend], [title, empty, { period: legend, record: "Record" }]);
			assert.deepEqual(v.period, []);
			assert.equal(v.record.length, 14);
			// Garmin's route for the phone's spans: `entries: []`.
			assert.equal(curveText(powerCurve(RIDES, v.span)), EMPTY);
		}
	});

	it("1y: the blue line 671 643 626 582 543 498 308 271 251 240 211 193 181 167 over five rides, no empty line, legend 1 year", () => {
		const v = view("1y");
		assert.deepEqual([v.title, v.empty, v.legend], ["1 Year Cycling Power Curve", undefined, { period: "1 year", record: "Record" }]);
		assert.deepEqual(watts(v.period), [671, 643, 626, 582, 543, 498, 308, 271, 251, 240, 211, 193, 181, 167]);
		assert.deepEqual(
			RIDES.filter((r) => r.start >= "2025-10-12").map((r) => r.start.slice(0, 16)).reverse(),
			["2025-10-13T09:26", "2025-10-13T10:42", "2025-10-15T09:39", "2025-10-20T18:13", "2025-10-25T07:22"],
		);
	});

	it("1y equals Garmin's curve for the span (`pc-1y`), its rides included", () => {
		const curve = powerCurve(RIDES, view("1y").span);
		assert.equal(curveText(curve), LIVE.year);
		// The two Oct 13 rides: 09:26 holds 1 s to 10 s and 30 min, 10:42 holds 20 s to 1 min.
		assert.deepEqual(
			curve.slice(0, 7).map((p) => p!.start.slice(11, 16)),
			["09:26", "09:26", "09:26", "09:26", "10:42", "10:42", "10:42"],
		);
		assert.equal(curve[11]!.start, "2025-10-13T09:26:10");
	});

	it("1y: the Record shows above it only at 1 s (687 / 671), 2 s (650 / 643), 1 min (317 / 308) and 2 min (286 / 271)", () => {
		const v = view("1y");
		const above = v.record.filter((r, i) => r.watts > v.period[i]!.watts).map((r) => `${r.seconds}:${r.watts}/${v.period.find((p) => p.seconds === r.seconds)!.watts}`);
		assert.deepEqual(above, ["1:687/671", "2:650/643", "60:317/308", "120:286/271"]);
		// The Record is never below the period: its rides are a subset.
		assert.ok(v.period.every((p, i) => v.record[i]!.seconds === p.seconds && v.record[i]!.watts >= p.watts));
	});

	it("never smooths: each duration's best stands alone, so one ride holds 20 min 170 W under 30 min 171 W", () => {
		assert.equal(curveText(powerCurve(RIDES, span("2025-09-15", "2025-09-15"))), LIVE.sep15);
	});
});

describe("the axes", () => {
	it("x: the 15 durations 1 sec … 5 hr in equal steps, each with its dot and its label on end, value or not", () => {
		assert.deepEqual(
			CURVE_DURATIONS.map((d) => d.axis),
			["1 sec", "2 sec", "5 sec", "10 sec", "20 sec", "30 sec", "1 min", "2 min", "5 min", "10 min", "20 min", "30 min", "1 hr", "2 hr", "5 hr"],
		);
		assert.deepEqual(
			CURVE_DURATIONS.map((d) => d.x),
			POWER_DURATIONS.map((_, i) => i / 14),
		);
		const v = view("4w");
		assert.equal(v.axis, POWER_X_AXIS);
		assert.equal(v.axisTitle, "Interval Length");
		assert.deepEqual(
			v.axis.dots.map((d) => [d.x, d.large]),
			CURVE_DURATIONS.map((d) => [d.x, true]),
		);
		assert.ok(v.axis.labels.every((l, i) => l.rotated === true && l.text === CURVE_DURATIONS[i]!.axis && l.x === CURVE_DURATIONS[i]!.x));
	});

	it("x: on the phone that is x = 50 + i·331/14, 1 sec at 50.00 and 2 hr at 357.36", () => {
		const phoneX = (x: number) => Math.round((50 + x * 331) * 100) / 100;
		assert.deepEqual([phoneX(CURVE_DURATIONS[0]!.x), phoneX(CURVE_DURATIONS[1]!.x), phoneX(CURVE_DURATIONS[13]!.x), phoneX(CURVE_DURATIONS[14]!.x)], [50, 73.64, 357.36, 381]);
	});

	it("both curves end at 2 hr, the last duration with a value: no vertex at 5 hr", () => {
		const v = view("1y");
		for (const curve of [v.record, v.period]) {
			assert.equal(curve.at(-1)!.seconds, 7200);
			assert.equal(curve.at(-1)!.x, 13 / 14);
		}
	});

	it("y: 0 … 700 in steps of 100, 100·⌈687 / 100⌉, each vertex at watts / 700", () => {
		const v = view("4w");
		assert.deepEqual([v.top, v.ticks], [700, [700, 600, 500, 400, 300, 200, 100, 0]]);
		assert.equal(v.record[0]!.at, 687 / 700);
		// The phone: y = 473.78 − 0.24278·W, so 700 sits at 303.83 and 0 at 473.78.
		const phoneY = (at: number) => Math.round((473.78 - at * (473.78 - 303.83)) * 100) / 100;
		assert.deepEqual([phoneY(1), phoneY(0), phoneY(v.record[0]!.at)], [303.83, 473.78, 306.99]);
	});

	it("y beyond the one record seen (Inferred): steps of 100 to a top of 1,000, then 200; 0–100 with no Record", () => {
		const axis = (max: number | undefined) => {
			const a = powerAxis(max);
			return `${a.ticks.at(-1)}-${a.top}/${a.step}`;
		};
		assert.deepEqual(
			[687, 700, 701, 99, 1000, 1001, 1250, 1400, 1401].map(axis),
			["0-700/100", "0-700/100", "0-800/100", "0-100/100", "0-1000/100", "0-1200/200", "0-1400/200", "0-1400/200", "0-1600/200"],
		);
		assert.deepEqual(powerAxis(undefined), { top: 100, step: 100, ticks: [100, 0] });
		assert.deepEqual(powerAxis(0), { top: 100, step: 100, ticks: [100, 0] });
		assert.equal(powerAxis(1250).ticks.length, 8);
	});
});

describe("the records table", () => {
	it("is titled Cycling Power Records over Peak · Watts · Date", () => {
		const v = view("4w");
		assert.deepEqual([v.table.title, v.table.headers], ["Cycling Power Records", ["Peak", "Watts", "Date"]]);
		assert.deepEqual([RECORDS_TITLE, RECORDS_HEADERS], [v.table.title, v.table.headers]);
	});

	it("lists all 15 durations from the Record, as the shots read them; 5 hours is -- --", () => {
		assert.deepEqual(rowText(view("4w")), [
			"1 second 687 Sep 13, 2025",
			"2 seconds 650 Sep 27, 2025",
			"5 seconds 626 Oct 13, 2025",
			"10 seconds 582 Oct 13, 2025",
			"20 seconds 543 Oct 13, 2025",
			"30 seconds 498 Oct 13, 2025",
			"1 minute 317 Sep 27, 2025",
			"2 minutes 286 Sep 27, 2025",
			"5 minutes 251 Oct 20, 2025",
			"10 minutes 240 Oct 20, 2025",
			"20 minutes 211 Oct 20, 2025",
			"30 minutes 193 Oct 13, 2025",
			"1 hour 181 Oct 25, 2025",
			"2 hours 167 Oct 25, 2025",
			"5 hours -- --",
		]);
		assert.deepEqual(view("4w").table.rows[14], { seconds: 18000, peak: "5 hours", watts: "--", date: "--" });
	});

	it("is the same on 3m and 1y, and keeps each Oct 13 row's own ride", () => {
		assert.deepEqual(rowText(view("3m")), rowText(view("4w")));
		assert.deepEqual(rowText(view("1y")), rowText(view("4w")));
		const rows = view("4w").table.rows;
		assert.deepEqual(
			[rows[2]!.id, rows[3]!.id, rows[11]!.id],
			Array(3).fill(rideAt("2025-10-13T09:26")),
		);
		assert.deepEqual([rows[4]!.id, rows[5]!.id], Array(2).fill(rideAt("2025-10-13T10:42")));
	});

	it("opens nothing: a row is words and the ride's id, no route (rides have no page yet)", () => {
		for (const row of view("4w").table.rows) assert.deepEqual(Object.keys(row).filter((k) => !["seconds", "peak", "watts", "date", "id"].includes(k)), []);
	});

	it("words each duration as the Peak column does", () => {
		assert.deepEqual(
			POWER_DURATIONS.map(peakDuration),
			["1 second", "2 seconds", "5 seconds", "10 seconds", "20 seconds", "30 seconds", "1 minute", "2 minutes", "5 minutes", "10 minutes", "20 minutes", "30 minutes", "1 hour", "2 hours", "5 hours"],
		);
		assert.deepEqual([axisDuration(90), peakDuration(90)], ["90 sec", "90 seconds"]);
	});
});

describe("the explainer", () => {
	it("is the phone's two paragraphs, verbatim", () => {
		const v = view("1y");
		assert.equal(v.explainer, POWER_CURVE_EXPLAINER);
		assert.deepEqual(v.explainer, [
			"Your power curve provides a snapshot of the maximum cycling power that you have produced (vertical axis) at a given time interval (horizontal axis). We search your ride history to find these best efforts. The background curve shows your best-ever power output at the different time intervals, while the foreground curve can display your best effort over the previous 4 weeks, 3 months or year.",
			"The Power Curve is useful for setting power-based targets in interval training. By matching the interval time with your maximum power output for that time range, you can set realistic training goals.",
		]);
	});
});

describe("previous periods (Inferred)", () => {
	it("4w −1 and 3m −1 hold no ride: their empty lines over the Record", () => {
		assert.deepEqual(
			(["4w", "3m"] as const).map((r) => [view(r, { offset: -1 }).empty, view(r, { offset: -1 }).period.length]),
			[
				["There is no 4 week power data for this period", 0],
				["There is no 3 month power data for this period", 0],
			],
		);
		// Garmin's route for them, and for 1y −2: `entries: []`.
		for (const [from, to] of [["2026-08-17", "2026-09-14"], ["2026-04-12", "2026-07-12"], ["2023-10-12", "2024-10-12"]] as const) {
			assert.equal(curveText(powerCurve(RIDES, span(from, to))), EMPTY);
		}
	});

	it("1y −1 holds the ten September and early October rides: 687 650 612 540 409 344 317 286 235 219 188 183 161 146", () => {
		const v = view("1y", { offset: -1 });
		assert.equal(v.empty, undefined);
		assert.deepEqual(watts(v.period), [687, 650, 612, 540, 409, 344, 317, 286, 235, 219, 188, 183, 161, 146]);
		const curve = powerCurve(RIDES, v.span);
		assert.equal(curveText(curve), LIVE.yearBefore);
		// Sep 13, Sep 27, Oct 4 15:18 ×3, Sep 27 ×3, Sep 6 ×4, Sep 15, Sep 27.
		assert.deepEqual(
			curve.slice(0, 14).map((p) => p!.start.slice(5, 16)),
			["09-13T07:47", "09-27T16:02", "10-04T15:18", "10-04T15:18", "10-04T15:18", "09-27T16:02", "09-27T16:02", "09-27T16:02", "09-06T08:30", "09-06T08:30", "09-06T08:30", "09-06T08:30", "09-15T16:39", "09-27T16:02"],
		);
	});

	it("1y −1: the Record behind it is equal at 1 s, 2 s, 1 min and 2 min and higher everywhere else", () => {
		const v = view("1y", { offset: -1 });
		const pairs = v.record.map((r, i) => `${r.watts}/${v.period[i]!.watts}`);
		assert.deepEqual(pairs, ["687/687", "650/650", "626/612", "582/540", "543/409", "498/344", "317/317", "286/286", "251/235", "240/219", "211/188", "193/183", "181/161", "167/146"]);
	});
});

describe("Garmin's route, reproduced from the index", () => {
	it("counts both ends of a span, whole days: one day's span holds that day's rides", () => {
		assert.equal(curveText(powerCurve(RIDES, span("2025-10-13", "2025-10-13"))), LIVE.oct13);
		assert.equal(curveText(powerCurve(RIDES, span("2025-10-13", "2025-10-14"))), LIVE.oct13);
		assert.equal(curveText(powerCurve(RIDES, span("2025-10-25", "2025-10-25"))), LIVE.oct25);
		assert.equal(curveText(powerCurve(RIDES, span("2025-10-25", "2025-10-26"))), LIVE.oct25);
		assert.equal(curveText(powerCurve(RIDES, span("2025-10-26", "2025-10-26"))), EMPTY);
	});

	it("…so 2025-10-14..10-25 holds the Oct 25 ride and 10-14..10-24 does not", () => {
		assert.equal(curveText(powerCurve(RIDES, span("2025-10-14", "2025-10-25"))), LIVE.oct14To25);
		assert.equal(curveText(powerCurve(RIDES, span("2025-10-14", "2025-10-24"))), LIVE.oct14To24);
		assert.equal(curveText(powerCurve(RIDES, span("2025-10-21", "2025-10-24"))), EMPTY);
	});

	it("has no cap and no smoothing: 29 days, a year and the year before as Garmin returns them", () => {
		assert.equal(curveText(powerCurve(RIDES, span("2025-09-13", "2025-10-11"))), LIVE.sep13ToOct11);
		assert.equal(curveText(powerCurve(RIDES, span("2025-10-12", "2026-10-11"))), LIVE.year);
		assert.equal(curveText(powerCurve(RIDES, span("2024-10-12", "2025-10-12"))), LIVE.yearBefore);
	});

	it("breaks a tie for the earliest ride: 5 min 225 W goes to Sep 10 over Sep 27, as Garmin's does", () => {
		assert.equal(curveText(powerCurve(RIDES, span("2025-09-10", "2025-09-27"))), LIVE.tieSep);
	});

	it("…and 20 min 170 W to Oct 1 over Oct 4 15:18, where Garmin's hidden decimals pick Oct 4: only the ride differs", () => {
		const ours = curveText(powerCurve(RIDES, span("2025-10-01", "2025-10-04")));
		assert.equal(ours, LIVE.tieOct.replace("1200:170@10-04", "1200:170@10-01"));
		assert.equal(powerCurve(RIDES, span("2025-10-01", "2025-10-04"))[10]!.id, rideAt("2025-10-01T06:57"));
	});
});

describe("rule edges", () => {
	it("leaves out a ride the rider left out of the power curve", () => {
		const excluded = ride({ id: 9002, power: { "1": 999, "2": 900 }, noPowerCurve: true });
		assert.equal(isPowerRide(excluded), false);
		const v = view("4w", { rows: [...RIDES, excluded] });
		assert.deepEqual([v.record[0]!.watts, v.top, v.empty], [687, 700, "There is no 4 week power data for this period"]);
		// The Sep 13 ride left out: the 1 s record falls to Oct 13 09:26's 671.
		const withoutSep13 = RIDES.map((r) => (r.id === rideAt("2025-09-13T07:47") ? { ...r, noPowerCurve: true as const } : r));
		assert.deepEqual(view("4w", { rows: withoutSep13 }).table.rows[0], { seconds: 1, peak: "1 second", watts: "671", date: "Oct 13, 2025", id: rideAt("2025-10-13T09:26") });
	});

	it("leaves out an activity with power that is not a ride: a run, a multisport", () => {
		const run = ride({ id: 9003, type: "running", typeId: 1, parentTypeId: 17, power: { "1": 999, "60": 400 } });
		const multisport = ride({ id: 9004, type: "multi_sport", typeId: 89, parentTypeId: 17, power: { "1": 998 } });
		assert.deepEqual([isPowerRide(run), isPowerRide(multisport)], [false, false]);
		const v = view("4w", { rows: [...RIDES, run, multisport] });
		assert.deepEqual(watts(v.record), watts(view("4w").record));
		assert.equal(v.empty, "There is no 4 week power data for this period");
		assert.equal(v.canGoBack, true);
	});

	it("counts any cycling type (Inferred): an indoor ride today fills 4w, 3m and 1y and raises the Record", () => {
		const indoor = ride({ id: 9005, type: "indoor_cycling", typeId: 25, parentTypeId: 2, power: { "1": 720, "2": 700, "5": 650 } });
		// A row without type ids goes by its key.
		const mtb = ride({ id: 9006, type: "mountain_biking", typeId: undefined, parentTypeId: undefined, start: "2026-10-10T07:00:00", begin: Date.parse("2026-10-10T03:00:00Z"), power: { "1": 300 } });
		assert.deepEqual([isPowerRide(indoor), isPowerRide(mtb)], [true, true]);
		for (const range of ["4w", "3m", "1y"] as const) {
			const v = view(range, { rows: [...RIDES, indoor, mtb] });
			assert.equal(v.empty, undefined, range);
			// 1y also holds the five rides of October 2025.
			assert.deepEqual(watts(v.period), range === "1y" ? [720, 700, 650, 582, 543, 498, 308, 271, 251, 240, 211, 193, 181, 167] : [720, 700, 650], range);
			assert.deepEqual(v.table.rows[0], { seconds: 1, peak: "1 second", watts: "720", date: "Oct 11, 2026", id: 9005 });
		}
		// 720 W → 0–800.
		assert.equal(view("4w", { rows: [...RIDES, indoor] }).top, 800);
		// 4w alone: the indoor ride's three durations only.
		assert.deepEqual(watts(view("4w", { rows: [...RIDES, indoor] }).period), [720, 700, 650]);
	});

	it("puts a ride on its local start day: at −07 an evening ride counts on that day, not the next GMT day", () => {
		// Sep 1, 2025 18:29 −07 is Sep 2 01:29 GMT: it is Sep 1's.
		assert.equal(curveText(powerCurve(RIDES, span("2025-09-02", "2025-09-05"))), EMPTY);
		assert.equal(powerCurve(RIDES, span("2025-08-26", "2025-09-01"))[0]!.watts, 441);
		// Sep 29 19:11 −07 is Sep 30 02:11 GMT.
		assert.equal(curveText(powerCurve(RIDES, span("2025-09-30", "2025-09-30"))), EMPTY);
		assert.equal(powerCurve(RIDES, span("2025-09-29", "2025-09-29"))[8]!.watts, 61);
		// Today at 20:00 −07, tomorrow in GMT, is today's: 4w shows it.
		const tonight = ride({ id: 9007, start: "2026-10-11T20:00:00", begin: Date.parse("2026-10-12T03:00:00Z"), power: { "1": 500 } });
		assert.deepEqual([view("4w", { rows: [...RIDES, tonight] }).empty, watts(view("4w", { rows: [...RIDES, tonight] }).period)], [undefined, [500]]);
		// Sep 13, 2026 at 22:00 −07 is Sep 14 in GMT, but 4w starts Sep 14: it belongs to 4w −1.
		const late = ride({ id: 9008, start: "2026-09-13T22:00:00", begin: Date.parse("2026-09-14T05:00:00Z"), power: { "1": 500 } });
		assert.equal(view("4w", { rows: [...RIDES, late] }).empty, "There is no 4 week power data for this period");
		assert.deepEqual(watts(view("4w", { offset: -1, rows: [...RIDES, late] }).period), [500]);
	});

	it("counts today in every current period", () => {
		const today = ride({ id: 9009, power: { "1": 400, "2": 390 } });
		for (const range of ["4w", "3m", "1y"] as const) assert.deepEqual(watts(view(range, { rows: [today] }).period), [400, 390], range);
	});

	it("keeps a tie for the ride that started first, by its start instant, then by id", () => {
		// A −07 evening ride whose local day is the 10th started after a +04 morning ride on the 11th: 02:00 GMT against 03:00.
		const evening = ride({ id: 9010, start: "2026-10-10T20:00:00", begin: Date.parse("2026-10-11T03:00:00Z"), power: { "1": 500 } });
		const morning = ride({ id: 9011, start: "2026-10-11T06:00:00", begin: Date.parse("2026-10-11T02:00:00Z"), power: { "1": 500 } });
		assert.equal(powerCurve([evening, morning])[0]!.id, 9011);
		assert.equal(powerCurve([morning, evening])[0]!.id, 9011);
		const twin = ride({ id: 9000, start: morning.start, begin: morning.begin, power: { "1": 500 } });
		assert.equal(powerCurve([morning, twin])[0]!.id, 9000);
		// A higher value always wins, whatever its day.
		assert.equal(powerCurve([evening, morning, ride({ id: 9012, power: { "1": 501 } })])[0]!.id, 9012);
	});

	it("gives a duration a value only when a ride has its key, whatever its length", () => {
		// The Sep 10 ride lasted 59 minutes and has a 1 h value (89 W).
		const sep10 = RIDES.find((r) => r.id === rideAt("2025-09-10T09:15"))!;
		assert.ok(sep10.duration! < 3600);
		assert.equal(powerCurve([sep10])[12]!.watts, 89);
		assert.equal(powerCurve([sep10])[13], null);
	});

	it("with no ride with power ever: the empty line, no curves, the axis 0–100, fifteen -- rows and the explainer", () => {
		for (const range of ["4w", "3m", "1y"] as const) {
			const v = view(range, { rows: [] });
			assert.deepEqual([v.record, v.period, v.top, v.ticks], [[], [], 100, [100, 0]], range);
			assert.equal(v.table.rows.length, 15);
			assert.ok(v.table.rows.every((r) => r.watts === "--" && r.date === "--" && r.id === undefined));
			assert.equal(v.explainer.length, 2);
			assert.deepEqual([v.canGoBack, view(range, { rows: [], ctx: { complete: false } }).canGoBack], [false, true]);
		}
		assert.equal(view("1y", { rows: [] }).empty, "There is no 1 year power data for this period");
		assert.equal(view("1y", { rows: [] }).axis.labels.length, 15);
	});
});
