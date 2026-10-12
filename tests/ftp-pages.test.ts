import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { MEASUREMENT_SHEET } from "../src/dashboard/ftp-copy";
import {
	BLOCK_DAYS,
	DASH,
	FTP_DIAL,
	FTP_DIAL_TONES,
	FTP_TABS,
	FTP_UNITS,
	LINK_LINE,
	NO_DATA,
	STALE_DAYS,
	WKG_SUB,
	blockLabel,
	ftpAngle,
	ftpCurrent,
	ftpDial,
	ftpDialAngles,
	ftpStale,
	ftpTab,
	ftpUnit,
	ftpView,
	ftpYAxis,
	linkLines,
	movedRoute,
	withFtpUnit,
	type FtpChart,
	type FtpContext,
	type FtpView,
} from "../src/dashboard/ftp-pages";
import { FTP_CLASSES, ftpGauge } from "../src/dashboard/gauges";
import { daysBetween, lastDayOfMonth, type PeriodRange } from "../src/dashboard/periods";
import { PERFORMANCE_REGISTRY } from "../src/dashboard/performance-stats";
import { performanceStatRoute } from "../src/dashboard/routes";
import { DIAL_KINDS, dialFraction, segmentsFromAngles } from "../src/dashboard/stat-dial";
import { mapAccount, type AccountInfo } from "../src/sync/account";
import { FTP_INDEX, rowsOfRanges, type FtpRow } from "../src/sync/ftp-index";
import { LATEST_2026_10_11, wattsPayload, wkgPayload } from "./ftp-fixture";

/**
 * Golden numbers from ref/performance-stats/ftp/README.md: the phone shots of
 * Sunday 2026-10-11 21:24–21:25, the web report of 22:59 and the routes as
 * Garmin answered them on Oct 12. The index's rows come from the payloads
 * through the index itself, and Current from `powerToWeight/latest` through
 * the account mapping. The windows roll daily, so the spans reproduce only
 * with today pinned.
 */
const TODAY = "2026-10-11";

const ROWS: FtpRow[] = rowsOfRanges(wattsPayload("2024-10-08", TODAY), wkgPayload("2024-10-08", TODAY)).map((r) => FTP_INDEX.normalize(r)!);
/** account.json after the sync of the capture day: a man, metric. */
const ACCOUNT: AccountInfo = mapAccount({ ftp: [...LATEST_2026_10_11], settings: { userData: { gender: "MALE" } } })!;
const CTX: FtpContext = { today: TODAY, complete: true, account: ACCOUNT };

type Options = { offset?: number; tab?: string; sub?: string; rows?: readonly FtpRow[]; ctx?: Partial<FtpContext> };
const view = (range: PeriodRange, opts: Options = {}): FtpView =>
	ftpView({ range, offset: opts.offset ?? 0, tab: opts.tab, sub: opts.sub }, opts.rows ?? ROWS, { ...CTX, ...opts.ctx });
const wkg = (range: PeriodRange, opts: Options = {}) => view(range, { ...opts, sub: WKG_SUB });

const dots = (v: FtpView) => v.chart!.points.map((p) => `${p.day.slice(5)} ${p.value}`);
const labels = (v: FtpView) => v.chart!.y.labels.map((l) => l.text);

/*
 * The shots' chart boxes in native px (3 px a point), read with the spec's
 * tools/chart.py and xaxis.py: the top and bottom gridlines, and the first
 * and last day's x (144 on Watts, 135 on W/kg, 1106 for both).
 */
const BOX = { "4w": { top: 1245, bottom: 1870 }, "12w": { top: 1241, bottom: 1829 }, "1y": { top: 1241, bottom: 1829 } } as const;
const X0 = { watts: 144, wkg: 135 } as const;
const XL = 1106;

/** A value's y on a shot, by the chart's own axis. */
function yPx(chart: FtpChart, value: number, range: keyof typeof BOX): number {
	const { top, bottom } = BOX[range];
	return bottom - ((value - chart.y.lo) / (chart.y.hi - chart.y.lo)) * (bottom - top);
}

/** The dots' values as the shot shows them (`pixel reads` in the spec): each within 1.5 px of where the chart puts its value. */
function matchesShot(v: FtpView, range: keyof typeof BOX, reads: readonly number[]) {
	const points = v.chart!.points;
	assert.equal(points.length, reads.length);
	points.forEach((p, i) => {
		const off = Math.abs(yPx(v.chart!, p.value, range) - yPx(v.chart!, reads[i]!, range));
		assert.ok(off <= 1.5, `${p.date}: ${p.value} is ${off.toFixed(2)} px off the shot's ${reads[i]}`);
	});
}

/** A day as Highcharts' month categories count it, for the web's "Data range: … categories". */
const monthX = (day: string) => (Number(day.slice(0, 4)) - 2000) * 12 + Number(day.slice(5, 7)) - 1 + Number(day.slice(8, 10)) / Number(lastDayOfMonth(day.slice(0, 7)).slice(8));

describe("the fixture", () => {
	it("is the history Garmin sent: 35 days from 2025-08-02, cycling on 8, skiing on 5", () => {
		assert.deepEqual([ROWS.length, ROWS[0]!.date, ROWS.at(-1)!.date], [35, "2025-08-02", "2026-10-08"]);
		assert.deepEqual([ROWS.filter((r) => r.cycling).length, ROWS.filter((r) => r.xc).length], [8, 5]);
	});

	it("is account.json as the account sync writes it", () => {
		assert.deepEqual(ACCOUNT.sex, "male");
		assert.deepEqual(ACCOUNT.ftp?.cycling, { date: "2026-10-08", watts: 274, wattsPerKg: 4.03, ftpDate: "2025-10-13", weight: 68, weightDate: "2026-10-08", stale: false });
		assert.equal(ACCOUNT.ftp?.xcSkiing?.stale, true);
	});
});

describe("Current, Cycling", () => {
	const v = view("1d");
	const c = v.current!;

	it('"Cycling (W/kg)" · "Thursday, October 8": the newer of the FTP and the Oct 8 weigh-in', () => {
		assert.equal(v.tab, "cycling");
		assert.deepEqual([c.title, c.line, c.date, c.stale], ["Cycling (W/kg)", "Thursday, October 8", "2026-10-08", false]);
	});

	it('"4.03" · "Excellent": the W/kg to 2 dp, rounded (4.0294; truncating gives 4.02), graded 3.93 ≤ 4.03 ≤ 5.04', () => {
		assert.deepEqual([c.dial!.gauge.value, c.dial!.gauge.label, c.dial!.gauge.tone], ["4.03", "Excellent", "blue"]);
		assert.equal((Math.floor(4.029411764705882 * 100) / 100).toFixed(2), "4.02");
		assert.equal(c.figure, null);
	});

	it('Based On: "Cycling FTP 274 W Oct 13, 2025" and "Weight 68.0 kg Oct 8", each with its own date', () => {
		assert.deepEqual(c.basedOn, [
			{ label: "Cycling FTP", value: "274 W", date: "Oct 13, 2025" },
			{ label: "Weight", value: "68.0 kg", date: "Oct 8" },
		]);
		assert.equal(c.link, undefined);
	});

	it("has no period row, no stepper, no chart and no unit control; the route's offset is not a day", () => {
		assert.deepEqual([v.label, v.canGoBack, v.chart, v.unit, v.segments, v.title, v.empty], [null, false, null, undefined, undefined, undefined, undefined]);
		assert.deepEqual(view("1d", { offset: -5 }).current, c);
	});
});

describe("the dial", () => {
	const dial = view("1d").current!.dial!;

	it("is linear 0–6 W/kg over 300°, its bands edged at the classes' printed upper ends: 2.22 / 2.78 / 3.92 / 5.04", () => {
		assert.deepEqual(ftpDialAngles(), [-150, -39, -11, 46, 102, 150]);
		assert.deepEqual(dial.gauge.segments, segmentsFromAngles([-150, -39, -11, 46, 102, 150], ["red", "orange", "green", "blue", "purple"]));
		// The web gauge: "Data ranges from 0 to 6".
		assert.deepEqual([FTP_DIAL.male.top, ftpAngle(0), ftpAngle(6), ftpAngle(9)], [6, -150, 150, 150]);
	});

	it("matches the shot's gaps (−39.00°, −10.98°, 102.02°) within 0.1°; gauges.ts's lower ends would miss each by 0.4° or more", () => {
		const measured = [-39.0, -10.98, 102.02];
		const bounds = ftpDialAngles();
		[bounds[1]!, bounds[2]!, bounds[4]!].forEach((b, i) => assert.ok(Math.abs(b - measured[i]!) < 0.1, `edge ${b} vs ${measured[i]}`));
		[2.23, 2.79, 5.05].forEach((lower, i) => assert.ok(Math.abs(ftpAngle(lower) - measured[i]!) > 0.4));
	});

	it("puts the marker at −150 + 50·v: 51.5° for 4.03, within 0.05° of 51.47° (4.0294) and 0.25° of the measured 51.34°, in the blue band", () => {
		assert.equal(dial.angle, 51.5);
		assert.ok(Math.abs(dial.angle - ftpAngle(4.029411764705882)) < 0.05);
		assert.ok(Math.abs(ftpAngle(4.029411764705882) - 51.47) < 0.005);
		assert.ok(Math.abs(dial.angle - 51.34) < 0.25);
		assert.ok(Math.abs(dial.gauge.at! - dialFraction(51.5)) < 1e-12);
		const blue = dial.gauge.segments[3]!;
		assert.ok(dial.gauge.at! > blue.from && dial.gauge.at! < blue.to && blue.tone === "blue");
	});

	it("grades as the web's table: < 2.23 Untrained, 2.23 – 2.78 Fair, 2.79 – 3.92 Good, 3.93 – 5.04 Excellent, > 5.04 Superior", () => {
		const graded = (v: number) => {
			const g = ftpDial(v, "male").gauge;
			return `${g.label} ${g.tone}`;
		};
		assert.deepEqual(
			[2.22, 2.23, 2.78, 2.79, 3.92, 3.93, 5.04, 5.05].map(graded),
			["Untrained red", "Fair orange", "Fair orange", "Good green", "Good green", "Excellent blue", "Excellent blue", "Superior purple"],
		);
		// The class is At a Glance's, whatever the dial: one table.
		for (const v of [1.5, 2.5, 3.5, 4.5, 5.5]) assert.equal(ftpDial(v, "male").gauge.label, ftpGauge(v, "male").label);
		assert.deepEqual(FTP_CLASSES, ["Untrained", "Fair", "Good", "Excellent", "Superior"]);
		// Each band holds its class's values: the marker sits in the band of its own tone.
		for (const v of [2.22, 2.23, 2.78, 2.79, 3.92, 3.93, 5.04, 5.05]) {
			const g = ftpDial(v, "male").gauge;
			const band = g.segments.find((s) => g.at! >= s.from - 1e-9 && g.at! <= s.to + 1e-9 && s.tone === g.tone);
			assert.ok(band, `${v} sits outside its ${g.tone} band`);
		}
	});

	it("leaves the class off without the account's sex, on the men's bands (Inferred)", () => {
		const g = ftpDial(4.03, undefined).gauge;
		assert.deepEqual([g.value, g.label, g.tone, g.at!.toFixed(6)], ["4.03", undefined, "blue", dialFraction(51.5).toFixed(6)]);
		assert.equal(view("1d", { ctx: { account: { ...ACCOUNT, sex: undefined } } }).current!.dial!.gauge.label, undefined);
	});

	it("is the same shape on the women's table for a woman (Inferred): edges 1.89 / 2.35 / 3.32 / 4.29 on 0–5.11", () => {
		assert.deepEqual(FTP_DIAL.female.edges, [1.89, 2.35, 3.32, 4.29]);
		assert.ok(Math.abs(FTP_DIAL.female.top - 5.11) < 0.005);
		const angles = ftpDialAngles("female");
		assert.deepEqual([angles[0], angles[5]], [-150, 150]);
		assert.ok(angles.every((a, i) => i === 0 || a > angles[i - 1]!));
		assert.deepEqual([3.33, 3.32].map((v) => ftpDial(v, "female").gauge.label), ["Excellent", "Good"]);
	});

	it("draws the class word in the text colour, regular, and leaves the shot's 2.17° between bands", () => {
		// `strong` is the dial's text colour, never bold: the twin's white label.
		assert.equal(DIAL_KINDS.ftp.label.strong, true);
		assert.equal(DIAL_KINDS.ftp.gap, 2.17);
		assert.deepEqual(FTP_DIAL_TONES, ["red", "orange", "green", "blue", "purple"]);
	});
});

describe("Current, Cross Country Skiing", () => {
	const v = view("1d", { tab: "xc" });
	const c = v.current!;

	it('"No Cross Country Skiing FTP data in the past year", "--" over "Watts": Garmin\'s isStale, an FTP set 2025-08-02', () => {
		assert.equal(v.tab, "xc");
		assert.deepEqual([c.title, c.line, c.stale], ["Cross Country Skiing Power", "No Cross Country Skiing FTP data in the past year", true]);
		assert.deepEqual([c.dial, c.figure], [null, { value: "--", unit: "Watts" }]);
		assert.equal(DASH, "--");
		// 435 days before today (the spec's 436 counts both ends), past the year.
		assert.equal(daysBetween("2025-08-02", TODAY), 435);
		assert.ok(daysBetween("2025-08-02", TODAY) > STALE_DAYS);
	});

	it("links to how to update it, on the phone's two lines, and has no Based On", () => {
		assert.deepEqual(c.link, {
			text: "Learn how to update your Cross Country Skiing FTP",
			lines: ["Learn how to update your Cross Country", "Skiing FTP"],
			sheet: MEASUREMENT_SHEET,
		});
		assert.equal(MEASUREMENT_SHEET.title, "How to Get a Measurement");
		assert.deepEqual([c.basedOn, c.date], [[], undefined]);
	});
});

describe("staleness", () => {
	it("turns Cycling's 2025-10-13 FTP stale on 2026-10-13, between two account syncs too (Inferred layout)", () => {
		assert.equal(view("1d", { ctx: { today: "2026-10-12" } }).current!.stale, false);
		const c = view("1d", { ctx: { today: "2026-10-13" } }).current!;
		// account.json still says isStale false: it was written on Oct 11.
		assert.equal(ACCOUNT.ftp!.cycling!.stale, false);
		assert.deepEqual([c.title, c.line, c.stale, c.dial, c.figure], ["Cycling (W/kg)", "No Cycling FTP data in the past year", true, null, { value: "--", unit: "W/kg" }]);
		assert.deepEqual([c.basedOn, c.link?.text, c.link?.lines], [[], "Learn how to update your Cycling FTP", ["Learn how to update your Cycling FTP"]]);
	});

	it("is Garmin's flag, or 365 days since the FTP's day — else the account's day, for a file written before ftpDate was kept", () => {
		assert.equal(STALE_DAYS, 365);
		assert.equal(ftpStale({ ftpDate: "2025-10-13", stale: false }, "2026-10-12"), false);
		assert.equal(ftpStale({ ftpDate: "2025-10-13", stale: false }, "2026-10-13"), true);
		assert.equal(ftpStale({ ftpDate: "2026-10-01", stale: true }, TODAY), true);
		assert.equal(ftpStale({ date: "2025-10-11" }, TODAY), true);
		assert.equal(ftpStale({ date: "2026-10-08" }, TODAY), false);
		assert.equal(ftpStale(undefined, TODAY), false);
	});
});

describe("4w, Sep 14 – Oct 11", () => {
	it("Watts: one dot on Oct 8, 274, labelled 350 312 274 236 200", () => {
		const v = view("4w");
		assert.deepEqual([v.label, v.unit, v.title], ["Sep 14 - Oct 11", "watts", "Watts"]);
		assert.deepEqual(v.chart!.points, [{ date: "2026-10-08", day: "2026-10-08", x: 24 / 27, value: 274 }]);
		assert.deepEqual(labels(v), ["350", "312", "274", "236", "200"]);
		assert.deepEqual([v.chart!.y.lo, v.chart!.y.hi, v.chart!.y.grid], [200, 350, [350, 312.5, 275, 237.5, 200]]);
		// 274 W sits 4.2 px below the middle gridline: 1561.67 px predicted, 1561.5 measured; the dot at 999.1 px (x 333.2 pt).
		assert.ok(Math.abs(yPx(v.chart!, 274, "4w") - 1561.5) < 0.5);
		assert.ok(Math.abs(X0.watts + v.chart!.points[0]!.x * (XL - X0.watts) - 999.1) < 0.5);
		matchesShot(v, "4w", [274.04]);
	});

	it("W/kg: the same dot, 4.0294, labelled 6 5 4 3, the labels at their own values between the gridlines", () => {
		const v = wkg("4w");
		assert.deepEqual([v.unit, v.title], ["wkg", "Watts Per Kilogram"]);
		assert.deepEqual(dots(v), ["10-08 4.0294"]);
		assert.deepEqual(labels(v), ["6", "5", "4", "3"]);
		assert.deepEqual(v.chart!.y.grid, [6, 5.25, 4.5, 3.75, 3]);
		assert.deepEqual(v.chart!.y.labels.map((l) => l.value), [6, 5, 4, 3]);
		// 4.0294 on [3, 6] at 1655.54 px, measured 1655.5.
		assert.ok(Math.abs(yPx(v.chart!, 4.0294, "4w") - 1655.5) < 0.1);
		matchesShot(v, "4w", [4.0296]);
	});

	it("has a dot a day under the plot, the ends large and labelled 09-14 and 10-11", () => {
		const axis = view("4w").chart!.axis;
		assert.equal(axis.dots.length, 28);
		assert.deepEqual(axis.dots.flatMap((d, i) => (d.large ? [i] : [])), [0, 27]);
		assert.deepEqual(axis.labels, [{ x: 0, text: "09-14" }, { x: 1, text: "10-11" }]);
	});

	it("shows the unit control with the route's segment on, and can step back", () => {
		assert.deepEqual(view("4w").segments, [
			{ id: "watts", label: "Watts", on: true },
			{ id: "wkg", label: "W/kg", on: false },
		]);
		assert.deepEqual(wkg("4w").segments!.map((u) => u.on), [false, true]);
		assert.equal(view("4w").canGoBack, true);
	});
});

describe("12w, Jul 20 – Oct 11", () => {
	it("one dot at the 10-05 slot: block 11 holds the Oct 8 row, drawn at the block's first day", () => {
		const v = view("12w");
		assert.equal(v.label, "Jul 20 - Oct 11");
		assert.deepEqual(v.chart!.points, [{ date: "2026-10-08", day: "2026-10-05", x: 77 / 83, value: 274 }]);
		assert.deepEqual(labels(v), ["350", "312", "274", "236", "200"]);
		// x 345.8 pt on the shot: within 2.5 px.
		assert.ok(Math.abs(X0.watts + (77 / 83) * (XL - X0.watts) - 345.8 * 3) <= 2.5);
		matchesShot(v, "12w", [274.1]);
		const w = wkg("12w");
		assert.deepEqual([dots(w), labels(w)], [["10-05 4.0294"], ["6", "5", "4", "3"]]);
		matchesShot(w, "12w", [4.033]);
	});

	it('marks the 12 blocks\' first days, all large, labelled "M-dd" on end: 7-20 … 10-05', () => {
		const axis = view("12w").chart!.axis;
		assert.equal(axis.dots.length, 12);
		assert.ok(axis.dots.every((d) => d.large));
		assert.deepEqual(axis.labels.map((l) => l.text), ["7-20", "7-27", "8-03", "8-10", "8-17", "8-24", "8-31", "9-07", "9-14", "9-21", "9-28", "10-05"]);
		assert.ok(axis.labels.every((l) => l.rotated));
		const measured = [144, 225, 306, 387, 468, 550, 631, 712, 793, 874, 956, 1037];
		axis.dots.forEach((d, i) => assert.ok(Math.abs(X0.watts + d.x * (XL - X0.watts) - measured[i]!) <= 1.5, `dot ${i}`));
	});
});

describe("1y, Oct 13, 2025 – Oct 11, 2026", () => {
	it("Watts: 274 · 274 · 274 at blocks 0, 2 and 51 (Oct 13, Oct 27, Oct 5): each block's last row, at its first day", () => {
		const v = view("1y");
		assert.equal(v.label, "Oct 13, 2025 - Oct 11, 2026");
		assert.deepEqual(
			v.chart!.points.map((p) => [p.date, p.day, Math.round(p.x * 363), p.value]),
			[
				["2025-10-13", "2025-10-13", 0, 274],
				["2025-11-02", "2025-10-27", 14, 274],
				["2026-10-08", "2026-10-05", 357, 274],
			],
		);
		assert.deepEqual(labels(v), ["350", "312", "274", "236", "200"]);
		// The shot's dots at x 48.2, 60.5 and 363.8 pt: within 1.4 px. Nov 2 itself would be at 197 px.
		[48.2, 60.5, 363.8].forEach((pt, i) => assert.ok(Math.abs(X0.watts + v.chart!.points[i]!.x * (XL - X0.watts) - pt * 3) <= 1.4, `dot ${i}`));
		assert.ok(Math.abs(X0.watts + (20 / 363) * (XL - X0.watts) - 197) < 0.5);
		matchesShot(v, "1y", [274, 274, 274]);
	});

	it("W/kg: 4.0774 · 4.0294 · 4.0294, the first on the 2025-10-13 weigh-in's 67.199 kg; labelled 6 5 4 3", () => {
		const v = wkg("1y");
		assert.deepEqual(dots(v), ["10-13 4.0774", "10-27 4.0294", "10-05 4.0294"]);
		assert.deepEqual(labels(v), ["6", "5", "4", "3"]);
		matchesShot(v, "1y", [4.0791, 4.0332, 4.0332]);
	});

	it("Cross Country Skiing W/kg: 1.6518 · 1.6324 · 1.6324 on the same blocks, labelled 3 2 1 0", () => {
		const v = wkg("1y", { tab: "xc" });
		assert.equal(v.tab, "xc");
		assert.deepEqual(dots(v), ["10-13 1.6518", "10-27 1.6324", "10-05 1.6324"]);
		assert.deepEqual(labels(v), ["3", "2", "1", "0"]);
		assert.deepEqual([v.chart!.y.lo, v.chart!.y.hi], [0, 3]);
		matchesShot(v, "1y", [1.6556, 1.6352, 1.6352]);
	});

	it("marks the period's first day each month on, Oct … Sep, within 0.7 px of the shot's dots", () => {
		const axis = view("1y").chart!.axis;
		assert.deepEqual(axis.labels.map((l) => l.text), ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"]);
		assert.ok(axis.dots.every((d) => d.large) && axis.labels.every((l) => l.rotated));
		const measured = [144, 226, 305, 388, 470, 544, 626, 706, 788, 868, 950, 1032];
		axis.dots.forEach((d, i) => assert.ok(Math.abs(X0.watts + d.x * (XL - X0.watts) - measured[i]!) <= 0.7, `month ${i}`));
		// Feb → Mar is the short step: 74 px, the others 79–83.
		const px = axis.dots.map((d) => d.x * (XL - X0.watts));
		const steps = px.slice(1).map((x, i) => Math.round(x - px[i]!));
		assert.equal(Math.min(...steps), steps[4]);
		assert.equal(steps[4], 74);
	});

	it("is Garmin's weekly route for the same window: each point at the week's from, dated by its updatedDate", () => {
		// ftp-weekly-web-2025-10-13_2026-10-11.json, cycling and skiing.
		const web = [
			["2025-10-13", "2025-10-13", 274, 111],
			["2025-10-27", "2025-11-02", 274, 111],
			["2026-10-05", "2026-10-08", 274, 111],
		];
		const cycling = view("1y").chart!.points;
		const xc = view("1y", { tab: "xc" }).chart!.points;
		assert.deepEqual(cycling.map((p, i) => [p.day, p.date, p.value, xc[i]!.value]), web);
	});
});

describe("the web report, for the same spans", () => {
	const range = (v: FtpView) => [Math.min(...v.chart!.points.map((p) => p.value)), Math.max(...v.chart!.points.map((p) => p.value))];
	const categories = (v: FtpView) => monthX(v.chart!.points.at(-1)!.day) - monthX(v.chart!.points[0]!.day) + 1;

	it('says "Data ranges from 274 to 274" on 4w, 12w and 1y, and 12.741935483870968 categories on 1y', () => {
		for (const r of ["4w", "12w", "1y"] as const) assert.deepEqual(range(view(r)), [274, 274], r);
		assert.ok(Math.abs(categories(view("1y")) - 12.741935483870968) < 1e-9);
	});

	it('1y −1: "186 to 227", 2.596774193548388 categories; W/kg "2.7761194029850746 to 3.388059701492537"', () => {
		const v = view("1y", { offset: -1 });
		assert.deepEqual(range(v), [186, 227]);
		assert.ok(Math.abs(categories(v) - 2.596774193548388) < 1e-9);
		const [lo, hi] = range(wkg("1y", { offset: -1 }));
		assert.ok(Math.abs(lo! - 2.7761194029850746) < 5e-5 && Math.abs(hi! - 3.388059701492537) < 5e-5);
	});

	it('1y −1 on Cross Country Skiing: one point, "111 to 111", 1 category', () => {
		const v = view("1y", { offset: -1, tab: "xc" });
		assert.deepEqual([range(v), categories(v)], [[111, 111], 1]);
	});

	it('4w −1 and 12w −1: "You have no data for this time period."', () => {
		for (const r of ["4w", "12w"] as const) assert.equal(view(r, { offset: -1 }).empty, "You have no data for this time period.");
	});

	it('Current: "4.03 W/kg", "Excellent", a 0–6 gauge, "274 W"; the Help\'s sentence from the same value and class', () => {
		const c = view("1d").current!;
		assert.equal(
			`Your cycling FTP is ${c.dial!.gauge.value} watts per kilogram of body weight, which is ${c.dial!.gauge.label!.toLowerCase()}.`,
			"Your cycling FTP is 4.03 watts per kilogram of body weight, which is excellent.",
		);
		assert.deepEqual([c.basedOn[0]!.value, FTP_DIAL.male.top], ["274 W", 6]);
	});
});

describe("previous periods (Inferred)", () => {
	it("are labelled by their spans", () => {
		assert.equal(view("4w", { offset: -1 }).label, "Aug 17 - Sep 13");
		assert.equal(view("12w", { offset: -1 }).label, "Apr 27 - Jul 19");
		assert.equal(view("1y", { offset: -1 }).label, "Oct 14, 2024 - Oct 12, 2025");
	});

	it("draw nothing for a period without a row, keeping the unit control and the title above", () => {
		const v = wkg("4w", { offset: -1 });
		assert.deepEqual([v.chart, v.empty, v.title, v.segments!.map((u) => u.on)], [null, NO_DATA, "Watts Per Kilogram", [false, true]]);
		assert.equal(v.canGoBack, true);
	});

	it("1y −1: blocks Jul 28 (186), Sep 1 (224, the block's last of 221 → 224) and Sep 15 (227); axis 300 250 200 150 100", () => {
		const v = view("1y", { offset: -1 });
		assert.deepEqual(dots(v), ["07-28 186", "09-01 224", "09-15 227"]);
		assert.deepEqual(v.chart!.points.map((p) => p.date), ["2025-08-03", "2025-09-06", "2025-09-15"]);
		assert.deepEqual(labels(v), ["300", "250", "200", "150", "100"]);
		const w = wkg("1y", { offset: -1 });
		assert.deepEqual([dots(w), labels(w)], [["07-28 2.7761", "09-01 3.3433", "09-15 3.3881"], ["5", "4", "3", "2", "1"]]);
		assert.deepEqual(dots(view("1y", { offset: -1, tab: "xc" })), ["07-28 111"]);
		assert.deepEqual(dots(wkg("1y", { offset: -1, tab: "xc" })), ["07-28 1.6567"]);
	});

	it("step back until the index is whole and its oldest row is not before the period", () => {
		assert.equal(view("1y").canGoBack, true);
		assert.equal(view("1y", { offset: -1 }).canGoBack, false);
		assert.equal(view("1y", { offset: -1, ctx: { complete: false } }).canGoBack, true);
	});
});

describe("Cross Country Skiing's ranges (Inferred)", () => {
	it("4w: one dot on Oct 8, 111 W on [50, 200] (200 162 124 86 50), 1.6324 W/kg on [0, 3]", () => {
		const v = view("4w", { tab: "xc" });
		assert.deepEqual([dots(v), labels(v)], [["10-08 111"], ["200", "162", "124", "86", "50"]]);
		const w = wkg("4w", { tab: "xc" });
		assert.deepEqual([dots(w), labels(w)], [["10-08 1.6324"], ["3", "2", "1", "0"]]);
	});

	it("12w: one dot at the 10-05 slot; 1y Watts: 111 · 111 · 111 on blocks 0, 2 and 51", () => {
		assert.deepEqual(dots(view("12w", { tab: "xc" })), ["10-05 111"]);
		assert.deepEqual(dots(view("1y", { tab: "xc" })), ["10-13 111", "10-27 111", "10-05 111"]);
	});
});

describe("rules", () => {
	it("open on the first tab and keep the one the route names", () => {
		assert.deepEqual(FTP_TABS, [{ id: "cycling", label: "Cycling" }, { id: "xc", label: "Cross Country Skiing" }]);
		const stat = PERFORMANCE_REGISTRY.page("ftp")!;
		assert.deepEqual(FTP_TABS.map((t) => stat.tabLabels?.[t.id]), ["Cycling", "Cross Country Skiing"]);
		assert.deepEqual([ftpTab(undefined), ftpTab("xc"), ftpTab("swim")], ["cycling", "xc", "cycling"]);
		assert.equal(ftpView(performanceStatRoute("ftp"), ROWS, CTX).current!.title, "Cycling (W/kg)");
		assert.equal(ftpView(performanceStatRoute("ftp", { tab: "xc", range: "1y" }), ROWS, CTX).tab, "xc");
	});

	it("keep the unit in the route's sub: W/kg, else Watts; the tab and the period stay", () => {
		assert.deepEqual(FTP_UNITS.map((u) => [u.label, u.title]), [["Watts", "Watts"], ["W/kg", "Watts Per Kilogram"]]);
		assert.deepEqual([ftpUnit(undefined), ftpUnit("wkg"), ftpUnit("ratio")], ["watts", "wkg", "watts"]);
		const route = performanceStatRoute("ftp", { range: "1y", offset: -1, tab: "xc" });
		const on = withFtpUnit(route, "wkg");
		assert.deepEqual(on, { ...route, sub: "wkg" });
		assert.deepEqual(withFtpUnit(on, "watts"), route);
		assert.ok(!("sub" in withFtpUnit(on, "watts")));
		// The unit survives a tab change.
		assert.equal(ftpView({ ...on, tab: "cycling" }, ROWS, CTX).unit, "wkg");
	});

	it("open each range on Watts: a range switch drops the unit, a period step keeps it (Inferred)", () => {
		const on = performanceStatRoute("ftp", { range: "4w", tab: "xc", sub: WKG_SUB });
		assert.deepEqual(movedRoute(on, { ...on, offset: -1 }), { ...on, offset: -1 });
		const switched = movedRoute(on, { ...on, range: "12w" as const });
		assert.deepEqual([switched.range, switched.tab, "sub" in switched], ["12w", "xc", false]);
		assert.equal(ftpView(switched, ROWS, CTX).unit, "watts");
		assert.ok(!("sub" in movedRoute(on, { ...on, range: "1d" as const })));
	});

	it("break the link where the phone does: after 38 characters, by words", () => {
		assert.equal(LINK_LINE, 38);
		assert.deepEqual(linkLines("Learn how to update your Cross Country Skiing FTP"), ["Learn how to update your Cross Country", "Skiing FTP"]);
		assert.deepEqual(linkLines("Learn how to update your Cycling FTP"), ["Learn how to update your Cycling FTP"]);
		assert.deepEqual(linkLines("a  b", 1), ["a", "b"]);
	});

	it("cut 12w and 1y into 7-day blocks from the period's first day, labelled month-day without the month's zero", () => {
		assert.equal(BLOCK_DAYS, 7);
		assert.deepEqual(["2026-07-20", "2026-08-03", "2026-10-05", "2026-12-28"].map(blockLabel), ["7-20", "8-03", "10-05", "12-28"]);
	});

	it("pad the y axis a unit past the rounded data, never below 0 (Inferred past the shots)", () => {
		const axis = (values: number[], unit: "watts" | "wkg") => ftpYAxis(values, unit).labels.map((l) => l.text).join(" ");
		assert.equal(axis([274], "watts"), "350 312 274 236 200");
		assert.equal(axis([186, 227], "watts"), "300 250 200 150 100");
		assert.equal(axis([4.0774, 4.0294], "wkg"), "6 5 4 3");
		assert.equal(axis([1.6518, 1.6324], "wkg"), "3 2 1 0");
		// Values on exact multiples, and a floor that would go below 0.
		assert.equal(axis([250], "watts"), "300 275 250 225 200");
		assert.equal(axis([30], "watts"), "100 75 50 25 0");
		assert.equal(axis([0.5], "wkg"), "2 1 0");
		assert.deepEqual(ftpYAxis([30], "watts").grid, [100, 75, 50, 25, 0]);
	});
});

describe("without data", () => {
	it("Current without an account, or without an FTP for the sport: the out-of-date state", () => {
		for (const account of [null, undefined, { sex: "male" as const }]) {
			const c = view("1d", { ctx: { account } }).current!;
			assert.deepEqual([c.line, c.stale, c.figure, c.basedOn.length], ["No Cycling FTP data in the past year", true, { value: "--", unit: "W/kg" }, 0]);
		}
	});

	it("a fresh skiing FTP shows its watts over 'Watts' under its date line, without Based On (twin 728:580, Inferred)", () => {
		const account: FtpContext["account"] = { sex: "male", ftp: { xcSkiing: { date: "2026-10-08", watts: 111, wattsPerKg: 1.63, ftpDate: "2026-10-01", weight: 68, weightDate: "2026-10-08", stale: false } } };
		const c = ftpCurrent("xc", { ...CTX, account });
		assert.deepEqual([c.title, c.line, c.stale, c.dial, c.figure], ["Cross Country Skiing Power", "Thursday, October 8", false, null, { value: "111", unit: "Watts" }]);
		assert.deepEqual([c.basedOn, c.link], [[], undefined]);
	});

	it("a cycling FTP without a weigh-in shows its watts the same way (Inferred)", () => {
		const c = ftpCurrent("cycling", { ...CTX, account: { sex: "male", ftp: { cycling: { date: "2026-10-01", watts: 274, ftpDate: "2026-10-01", stale: false } } } });
		assert.deepEqual([c.title, c.line, c.dial, c.figure, c.basedOn], ["Cycling Power", "Thursday, October 1", null, { value: "274", unit: "Watts" }, []]);
	});

	it("reads 'Today' on the day, a year on another year's, and the weight in lb for imperial (Inferred)", () => {
		const today = ftpCurrent("cycling", { ...CTX, account: { sex: "male", ftp: { cycling: { ...ACCOUNT.ftp!.cycling!, date: TODAY, weightDate: TODAY } } } });
		assert.deepEqual([today.line, today.basedOn[1]!.date], ["Today", "Oct 11"]);
		const imperial = ftpCurrent("cycling", { ...CTX, units: "imperial" });
		assert.deepEqual(imperial.basedOn[1], { label: "Weight", value: "149.9 lb", date: "Oct 8" });
	});

	it("an account.json from before the FTP's own day was kept: Based On without dates", () => {
		const c = ftpCurrent("cycling", { ...CTX, account: { sex: "male", ftp: { cycling: { date: "2026-10-08", watts: 274, wattsPerKg: 4.03 } } } });
		assert.deepEqual([c.line, c.dial!.gauge.value, c.basedOn], ["Thursday, October 8", "4.03", [{ label: "Cycling FTP", value: "274 W" }]]);
	});

	it("a range before the first sync: nothing to draw, and '<' while the history may still come", () => {
		assert.deepEqual([view("4w", { rows: [] }).chart, view("4w", { rows: [] }).empty], [null, NO_DATA]);
		assert.equal(view("1y", { rows: [] }).canGoBack, false);
		assert.equal(view("1y", { rows: [], ctx: { complete: false } }).canGoBack, true);
	});

	it("a W/kg chart without a weigh-in is empty while its watts draw", () => {
		const rows = ROWS.map(({ cyclingWkg: _w, xcWkg: _x, runningWkg: _r, ...rest }) => rest);
		assert.deepEqual([dots(view("1y", { rows })).length, wkg("1y", { rows }).empty], [3, NO_DATA]);
	});
});
