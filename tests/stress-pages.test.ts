import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { stressCopy } from "../src/dashboard/stress-copy";
import {
	dayCardRoute,
	dayLabel,
	periodLabel,
	periodSeriesDays,
	stepRoute,
	switchRange,
	weekCardRoute,
	weekTitle,
	yearLabel,
} from "../src/dashboard/periods";
import {
	duration,
	stressDayView,
	stressPeriodView,
	stressView,
	stressWeeks,
	timelineOf,
	type StressData,
	type StressDayView,
	type StressPeriodView,
	type StressRoute,
} from "../src/dashboard/stress-pages";
import type { StressDay, StressRow } from "../src/sync/stress-index";

/** The capture day: everything below is in true dates (ref/health-stats/stress/README.md). */
const TODAY = "2026-10-08";
/**
 * The phone was shot before 04:00, when it shows the UTC date's data under the
 * local date's label: its pages are the plugin's pages of the day before.
 */
const PHONE_DATA_DAY = "2026-10-07";

/**
 * Every daily level from the account's first day to the capture, as
 * `stats/stress/daily` sent them live at 01:43 (Oct 8 partial: 28), "-" for a
 * day without one: the five −1 days and Jan 5 – 9, which Garmin left out.
 */
const FIRST_DAY = "2025-08-02";
const LEVELS = `48 10 7 26 29 28 36 25 28 35 40 35 15 37 31 38 27 20 49 15 36 49 26 25 43 36 33 31 27 26 23 22 27 34 22 29 26 30 37 33 32 30 41 19 32 37 22 32 24 26
29 19 32 26 25 34 37 30 37 22 39 27 27 73 25 17 26 31 33 28 29 30 29 22 37 21 23 29 18 32 33 25 27 53 43 30 29 22 31 31 27 30 29 31 21 28 20 30 19 30
29 24 18 17 16 30 24 23 28 33 24 28 31 39 25 37 30 32 26 40 39 34 30 37 32 37 36 31 29 31 30 31 38 27 29 29 30 35 33 31 27 28 35 32 35 35 32 38 27 24
31 36 31 36 27 - - - - - - 23 42 30 31 22 29 24 33 31 42 24 23 19 38 24 29 38 78 77 70 48 23 24 17 10 26 14 - 49 37 21 22 70 25 29 42 31 55 20 32 32
32 56 17 19 18 42 30 30 27 14 26 23 18 24 32 26 28 26 31 32 19 27 68 50 17 65 37 42 50 22 26 23 21 42 21 32 32 20 23 23 - 37 29 30 31 27 29 25 23 30
27 32 21 9 41 16 16 39 24 25 9 55 37 19 27 23 19 20 24 25 19 23 27 20 21 6 39 21 22 32 28 24 30 23 36 18 39 49 26 13 32 31 29 51 34 30 31 24 27 28 39
77 54 40 30 17 25 32 32 28 21 35 17 29 27 34 20 30 33 30 48 38 42 11 - 46 57 32 40 46 35 30 29 17 27 28 20 27 24 59 31 29 39 33 33 11 44 25 18 29 26
28 46 40 24 31 39 45 38 33 28 19 33 39 33 34 26 22 19 41 45 54 40 33 30 30 30 36 31 - 31 26 31 25 42 42 24 26 23 34 27 44 35 39 28 46 34 29 22 30 23
17 23 21 43 27 30 28 30 26 22 30 40 35 26 26 29 26 20 28 29 21 28 29 22 28 27 22 26 27 28`;

/** Rest / low / medium / high seconds, from the spec's fixture lines; Sep 8 had no high stress. */
const DURATIONS: Record<string, [number, number, number, number | null]> = {
	"09-08": [48960, 25980, 2100, null],
	"09-25": [51660, 15120, 5520, 2280],
	"09-26": [63120, 9120, 3420, 900],
	"09-27": [35880, 18060, 7500, 2700],
	"09-28": [44820, 14100, 8160, 3900],
	"09-29": [52500, 17820, 3900, 120],
	"09-30": [43560, 13500, 9840, 1680],
	"10-01": [37980, 19500, 10980, 2940],
	"10-02": [53280, 14520, 4920, 1440],
	"10-03": [41700, 14880, 13380, 1740],
	"10-04": [36360, 6840, 4140, 7140],
	"10-05": [62520, 12540, 4320, 1140],
	"10-06": [52440, 16740, 9960, 1680],
	"10-07": [39420, 15300, 5880, 3540],
	"10-08": [2160, 1440, 240, 60],
};

/** The qualifiers of the days whose copy was seen. */
const QUALIFIERS: Record<string, string> = { "10-05": "CALM", "10-06": "BALANCED", "10-07": "BALANCED", "10-08": "UNKNOWN" };

const shift = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The stress index as a sync leaves it on the capture day, with any day replaced. */
function indexRows(replace: Record<string, Partial<StressRow>> = {}): StressRow[] {
	const rows: StressRow[] = [];
	LEVELS.split(/\s+/).forEach((text, i) => {
		const date = shift(FIRST_DAY, i);
		const row: StressRow = { date };
		if (text !== "-") row.level = Number(text);
		const parts = date.startsWith("2026-") ? DURATIONS[date.slice(5)] : undefined;
		if (parts) {
			const [rest, low, medium, high] = parts;
			Object.assign(row, { rest, low, medium }, high !== null ? { high } : {});
		}
		const qualifier = date.startsWith("2026-") ? QUALIFIERS[date.slice(5)] : undefined;
		if (qualifier) row.qualifier = qualifier;
		const next = { ...row, ...replace[date] };
		if (Object.keys(next).length > 1) rows.push(next);
	});
	return rows;
}

const ROWS = indexRows();
/** Oct 8 as the web saw it at 01:07–01:09: level 29, 29 · 22 · 4 · 1 minutes. */
const WEB_ROWS = indexRows({ [TODAY]: { level: 29, rest: 1740, low: 1320, medium: 240, high: 60 } });
const data = (rows = ROWS, complete = true): StressData => ({ rows, complete });

const day = (offset: number, today = TODAY, rows = ROWS): StressDayView => stressDayView({ data: data(rows), route: { range: "1d", offset }, today });
const period = (range: StressRoute["range"], offset: number, today = TODAY, rows = ROWS): StressPeriodView =>
	stressPeriodView({ data: data(rows), route: { range, offset }, today });

const degrees = (view: { ring: Array<{ fraction: number }> }) => view.ring.map((p) => Math.round(p.fraction * 3600) / 10);
const tiles = (view: StressDayView) => view.tiles.map((t) => t.value);
const values = (view: StressPeriodView) => view.stats.map((s) => [s.label, s.value]);
const cards = (view: StressPeriodView) => view.days.map((c) => `${c.date.slice(5)} ${c.value}`);

describe("formatting", () => {
	it("writes durations in whole minutes, as the phone does", () => {
		assert.deepEqual([39420, 15300, 5880, 3540, 2160, 60, 7200, 0].map(duration), ["10h 57m", "4h 15m", "1h 38m", "59m", "36m", "1m", "2h", "0m"]);
	});

	it("labels a day, a week, four weeks and a year as the app does", () => {
		assert.deepEqual(
			["2026-10-08", "2026-10-07", "2026-10-06", "2025-10-22"].map((d) => dayLabel(d, TODAY)),
			["Today", "Wednesday, October 7", "Tuesday, October 6", "Wednesday, October 22, 2025"],
		);
		assert.equal(periodLabel("2026-10-02", "2026-10-08", TODAY), "Oct 2 - 8");
		assert.equal(periodLabel("2026-09-25", "2026-10-01", TODAY), "Sep 25 - Oct 1");
		assert.equal(periodLabel("2026-09-11", "2026-10-08", TODAY), "Sep 11 - Oct 8");
		assert.equal(periodLabel("2026-08-14", "2026-09-10", TODAY), "Aug 14 - Sep 10");
		assert.equal(periodLabel("2025-10-16", "2025-10-22", TODAY), "Oct 16-22, 2025");
		assert.equal(periodLabel("2025-12-29", "2026-01-04", TODAY), "Dec 29, 2025 - Jan 4, 2026");
		assert.equal(yearLabel("2025-10-10", "2026-10-08"), "Oct 10, 2025 - Oct 8, 2026");
		assert.equal(yearLabel("2024-10-11", "2025-10-09"), "Oct 11, 2024 - Oct 9, 2025");
	});

	it("titles a week card in each of the phone's four ways", () => {
		const title = (from: string) => weekTitle(from, shift(from, 6), TODAY);
		assert.deepEqual(
			["2026-10-01", "2026-09-24", "2026-08-27", "2026-07-30", "2026-03-26"].map(title),
			["October 1 - 7", "September 24 - 30", "Aug 27 - Sep 2", "Jul 30 - Aug 5", "Mar 26 - Apr 1"],
		);
		assert.deepEqual(
			["2025-12-25", "2025-10-09", "2025-11-27", "2025-10-30", "2025-09-25", "2025-07-31"].map(title),
			["December 25 - 31, 2025", "October 9 - 15, 2025", "Nov 27 - 3, 2025", "Oct 30 - 5, 2025", "Sep 25 - 1, 2025", "Jul 31 - 6, 2025"],
		);
	});
});

describe("the copy line", () => {
	it("follows the qualifier and the tense the phone and the web showed", () => {
		assert.equal(stressCopy("BALANCED", 27, true), "You have enough restful moments today to balance out your stress reactions.");
		assert.equal(stressCopy("BALANCED", 26, false), "You had enough restful moments on this day to balance out your stress reactions.");
		assert.equal(stressCopy("CALM", 22, false), "You had many restful moments on this day. This will help keep you energized.");
		assert.equal(stressCopy("UNKNOWN", 28, true), "More measured time is needed to determine stress balance.");
	});

	it("falls back on the web's own sentence where the wording is not known, and UNKNOWN's without a level", () => {
		assert.equal(stressCopy("STRESSFUL", 35, false), "Your stress level was 35 out of 100.");
		assert.equal(stressCopy(undefined, 29, true), "Your stress level is 29 out of 100.");
		assert.equal(stressCopy(undefined, undefined, false), "More measured time is needed to determine stress balance.");
	});
});

describe("1d", () => {
	it("Oct 7: 27, the four tiles, the ring's shares and BALANCED's past tense", () => {
		const view = day(-1);
		assert.equal(view.label, "Wednesday, October 7");
		assert.equal(view.value, "27");
		assert.deepEqual(tiles(view), ["10h 57m", "4h 15m", "1h 38m", "59m"]);
		assert.deepEqual(view.tiles.map((t) => t.label), ["Rest", "Low", "Medium", "High"]);
		assert.deepEqual(degrees(view), [221.3, 85.9, 33, 19.9]);
		assert.equal(view.copy, "You had enough restful moments on this day to balance out your stress reactions.");
		assert.deepEqual([view.canGoBack, view.canGoForward], [true, true]);
	});

	it("the phone's Today, Oct 7's data: the present tense, and no >", () => {
		const view = day(0, PHONE_DATA_DAY);
		assert.equal(view.label, "Today");
		assert.equal(view.copy, "You have enough restful moments today to balance out your stress reactions.");
		assert.equal(view.canGoForward, false);
	});

	it("Oct 6 and Oct 5, from its day card: CALM's copy", () => {
		const oct6 = day(-2);
		assert.deepEqual([oct6.value, ...tiles(oct6)], ["26", "14h 34m", "4h 39m", "2h 46m", "28m"]);
		assert.deepEqual(degrees(oct6), [233.6, 74.6, 44.4, 7.5]);
		const oct5 = stressDayView({ data: data(), route: dayCardRoute("2026-10-05", TODAY), today: TODAY });
		assert.equal(oct5.label, "Monday, October 5");
		assert.deepEqual([oct5.value, ...tiles(oct5)], ["22", "17h 22m", "3h 29m", "1h 12m", "19m"]);
		assert.equal(oct5.copy, "You had many restful moments on this day. This will help keep you energized.");
	});

	it("today's partial day: its level with UNKNOWN's copy, live and as the web saw it", () => {
		const live = day(0);
		assert.equal(live.label, "Today");
		assert.deepEqual([live.value, ...tiles(live)], ["28", "36m", "24m", "4m", "1m"]);
		assert.equal(live.copy, "More measured time is needed to determine stress balance.");
		const web = day(0, TODAY, WEB_ROWS);
		assert.deepEqual([web.value, ...tiles(web)], ["29", "29m", "22m", "4m", "1m"]);
	});

	it("a day without data: --, a grey ring, -- tiles", () => {
		for (const offset of [-51, -275]) {
			// Aug 18 (−1) and Jan 6 (left out) read the same.
			const view = day(offset);
			assert.ok(["2026-08-18", "2026-01-06"].includes(view.date));
			assert.equal(view.value, "--");
			assert.deepEqual(view.ring, []);
			assert.deepEqual(tiles(view), ["--", "--", "--", "--"]);
			assert.equal(view.copy, "More measured time is needed to determine stress balance.");
		}
	});

	it("a category with no time: -- on its tile and no share of the ring", () => {
		const view = day(-30);
		assert.equal(view.date, "2026-09-08");
		assert.deepEqual(tiles(view), ["13h 36m", "7h 13m", "35m", "--"]);
		assert.equal(view.ring[3]!.fraction, 0);
	});

	it("a history day the summaries never saw: the web's sentence about its level", () => {
		const view = day(-18);
		assert.equal(view.date, "2026-09-20");
		assert.equal(view.copy, "Your stress level was 40 out of 100.");
		assert.deepEqual(view.ring, []);
	});
});

describe("7d", () => {
	it("Oct 2 - 8 as the web showed it: 25, lowest 22, highest 29 (today, partial)", () => {
		const view = period("7d", 0, TODAY, WEB_ROWS);
		assert.equal(view.label, "Oct 2 - 8");
		assert.equal(view.title, "Daily Averages");
		assert.deepEqual(values(view), [
			["Avg Stress Level", "25"],
			["Lowest", "22"],
			["Highest", "29"],
		]);
		assert.deepEqual(cards(view), ["10-08 29", "10-07 27", "10-06 26", "10-05 22", "10-04 27", "10-03 28", "10-02 22"]);
		assert.deepEqual([view.days[0]!.weekday, view.days[0]!.detail], ["Thursday", "October 8"]);
		assert.deepEqual(view.axis.labels.map((l) => l.text), ["10-02", "10-08"]);
		assert.deepEqual(view.axis.dots.map((d) => d.large), [true, false, false, false, false, false, true]);
		assert.deepEqual(view.points.map((p) => p.value), [22, 28, 27, 22, 26, 27, 29]);
		assert.deepEqual([view.canGoBack, view.canGoForward], [true, false]);
	});

	it("live at 01:43, Oct 8 at 28: ⌊180 / 7⌋", () => {
		assert.deepEqual(values(period("7d", 0)), [
			["Avg Stress Level", "25"],
			["Lowest", "22"],
			["Highest", "28"],
		]);
	});

	it("the phone's Oct 2 - 8, Oct 1 – 7's data: 25 and its seven cards", () => {
		const view = period("7d", 0, PHONE_DATA_DAY);
		assert.equal(view.stats[0]!.value, "25");
		assert.deepEqual(cards(view), ["10-07 27", "10-06 26", "10-05 22", "10-04 27", "10-03 28", "10-02 22", "10-01 29"]);
	});

	it("Sep 25 - Oct 1, a week back: 25, lowest 20, highest 29", () => {
		const view = period("7d", -1);
		assert.equal(view.label, "Sep 25 - Oct 1");
		assert.deepEqual(values(view).map(([, v]) => v), ["25", "20", "29"]);
		assert.equal(view.canGoForward, true);
		// The phone's Sep 25 - Oct 1: Sep 24 – 30's data.
		const phone = period("7d", -1, PHONE_DATA_DAY);
		assert.equal(phone.stats[0]!.value, "25");
		assert.deepEqual(cards(phone), ["09-30 28", "09-29 21", "09-28 29", "09-27 28", "09-26 20", "09-25 26", "09-24 29"]);
	});

	it("Oct 16-22, 2025, opened from its week card: 25 and the year on every card", () => {
		const year = period("1y", 0, PHONE_DATA_DAY);
		const card = year.weeks.find((w) => w.title === "October 16 - 22, 2025")!;
		assert.equal(card.offset, -50);
		const route = weekCardRoute({ range: "1y", offset: 0 }, card.to, PHONE_DATA_DAY);
		assert.deepEqual(route, { range: "7d", offset: -50 });
		const view = stressPeriodView({ data: data(), route, today: PHONE_DATA_DAY });
		assert.equal(view.label, "Oct 16-22, 2025");
		assert.equal(view.stats[0]!.value, "25");
		assert.deepEqual(cards(view), ["10-22 25", "10-21 33", "10-20 32", "10-19 18", "10-18 29", "10-17 23", "10-16 21"]);
		assert.deepEqual([view.days[0]!.weekday, view.days[0]!.detail], ["Wednesday", "October 22, 2025"]);
		assert.deepEqual(view.axis.labels.map((l) => l.text), ["10-16", "10-22"]);
	});
});

describe("4w", () => {
	it("Sep 11 - Oct 8: ⌊774 / 28⌋ = 27, lowest 20 (Sep 26), highest 43 (Sep 12)", () => {
		const view = period("4w", 0);
		assert.equal(view.label, "Sep 11 - Oct 8");
		assert.deepEqual(values(view).map(([, v]) => v), ["27", "20", "43"]);
		assert.equal(view.days.length, 28);
		assert.deepEqual(view.axis.labels.map((l) => l.text), ["09-11", "10-08"]);
		assert.equal(view.axis.dots.length, 28);
	});

	it("the phone's Sep 11 - Oct 8, Sep 10 – Oct 7's data: ⌊769 / 28⌋ = 27, its 28 cards", () => {
		const view = period("4w", 0, PHONE_DATA_DAY);
		assert.equal(view.stats[0]!.value, "27");
		assert.deepEqual(
			view.days.map((c) => c.value).join(" "),
			"27 26 22 27 28 22 29 28 21 29 28 20 26 29 26 26 35 40 30 22 26 30 28 30 27 43 21 23",
		);
	});

	it("Aug 14 - Sep 10: ⌊828 / 27⌋ = 30, Aug 18 left out of everything", () => {
		const view = period("4w", -1);
		assert.equal(view.label, "Aug 14 - Sep 10");
		assert.deepEqual(values(view).map(([, v]) => v), ["30", "17", "46"]);
		const aug18 = view.days.find((c) => c.date === "2026-08-18")!;
		assert.deepEqual([aug18.weekday, aug18.value, aug18.ring], ["Tuesday", "--", []]);
		// No dot there, and the line breaks.
		assert.equal(view.points[4]!.value, null);
	});

	it("the phone's Aug 14 - Sep 10, Aug 13 – Sep 9's data: ⌊835 / 27⌋ = 30, with Aug 18's -- card", () => {
		const view = period("4w", -1, PHONE_DATA_DAY);
		assert.equal(view.stats[0]!.value, "30");
		assert.deepEqual(
			view.days.map((c) => c.value).join(" "),
			"17 23 30 22 29 34 46 28 39 35 44 27 34 23 26 24 42 42 25 31 26 31 -- 31 36 30 30 30",
		);
	});
});

/** `stats/stress/weekly/2026-10-08/52`: each week's first day and value. */
const WEEKLY_2026_10_08 = `2025-10-10:28 10-17:26 10-24:34 10-31:26 11-07:23 11-14:25 11-21:31 11-28:34 12-05:32 12-12:31 12-19:31 12-26:31
2026-01-02:31 01-09:29 01-16:28 01-23:50 01-30:23 02-06:37 02-13:34 02-20:30 02-27:23 03-06:27 03-13:43 03-20:29
03-27:27 04-03:27 04-10:25 04-17:29 04-24:22 05-01:22 05-08:25 05-15:30 05-22:32 05-29:42 06-05:27 06-12:27
06-19:35 06-26:38 07-03:28 07-10:31 07-17:30 07-24:34 07-31:29 08-07:37 08-14:30 08-21:30 08-28:36 09-04:25
09-11:29 09-18:29 09-25:25 10-02:25`;

/** The phone's 52 week cards (weeks ending Oct 7), as its list and the Figma frame name them. */
const PHONE_WEEKS = `October 1 - 7:25|September 24 - 30:25|September 17 - 23:29|September 10 - 16:28|September 3 - 9:28|Aug 27 - Sep 2:32|August 20 - 26:30|August 13 - 19:31|August 6 - 12:36|Jul 30 - Aug 5:30|July 23 - 29:35|July 16 - 22:30|July 9 - 15:33|July 2 - 8:24|Jun 25 - Jul 1:40|June 18 - 24:33|June 11 - 17:27|June 4 - 10:26|May 28 - Jun 3:41|May 21 - 27:34|May 14 - 20:29|May 7 - 13:28|Apr 30 - May 6:20|April 23 - 29:24|April 16 - 22:26|April 9 - 15:26|April 2 - 8:29|Mar 26 - Apr 1:25|March 19 - 25:32|March 12 - 18:40|March 5 - 11:28|Feb 26 - Mar 4:24|February 19 - 25:30|February 12 - 18:33|February 5 - 11:35|Jan 29 - Feb 4:31|January 22 - 28:43|January 15 - 21:29|January 8 - 14:29|January 1 - 7:31|December 25 - 31, 2025:31|December 18 - 24, 2025:31|December 11 - 17, 2025:31|December 4 - 10, 2025:32|Nov 27 - 3, 2025:34|November 20 - 26, 2025:30|November 13 - 19, 2025:24|November 6 - 12, 2025:24|Oct 30 - 5, 2025:28|October 23 - 29, 2025:33|October 16 - 22, 2025:25|October 9 - 15, 2025:29`;

describe("1y", () => {
	it("Oct 10, 2025 - Oct 8, 2026: 30, lowest 22, highest 50, from the weeks, not the days", () => {
		const view = period("1y", 0);
		assert.equal(view.label, "Oct 10, 2025 - Oct 8, 2026");
		assert.equal(view.title, "Weekly Averages");
		assert.deepEqual(values(view).map(([, v]) => v), ["30", "22", "50"]);
		assert.equal(view.weeks.length, 52);
		assert.deepEqual(
			view.weeks.slice(0, 10).map((w) => `${w.title}:${w.value}`),
			[
				"October 2 - 8:25 Avg",
				"Sep 25 - Oct 1:25 Avg",
				"September 18 - 24:29 Avg",
				"September 11 - 17:29 Avg",
				"September 4 - 10:25 Avg",
				"Aug 28 - Sep 3:36 Avg",
				"August 21 - 27:30 Avg",
				"August 14 - 20:30 Avg",
				"August 7 - 13:37 Avg",
				"Jul 31 - Aug 6:29 Avg",
			],
		);
		assert.deepEqual(view.weeks[0]!.offset, 0);
		assert.deepEqual(view.weeks[51]!.offset, -51);
	});

	it("reproduces every week of stats/stress/weekly from the daily rows: ⌊mean⌋ of each window", () => {
		let year = "";
		const expected = WEEKLY_2026_10_08.split(/\s+/).map((entry) => {
			const [date, value] = entry.split(":");
			if (date!.length === 10) year = date!.slice(0, 4);
			return `${date!.length === 10 ? date : `${year}-${date}`}:${value}`;
		});
		assert.deepEqual(
			stressWeeks(ROWS, TODAY).map((w) => `${w.from}:${w.value}`),
			expected,
		);
		// The previous year's ten weeks with data, the account's first one from its first day on.
		assert.deepEqual(
			stressWeeks(ROWS, "2025-10-09")
				.filter((w) => w.value !== undefined)
				.map((w) => `${w.from.slice(5)}:${w.value}`)
				.join(" "),
			"08-01:24 08-08:30 08-15:31 08-22:35 08-29:27 09-05:29 09-12:30 09-19:25 09-26:32 10-03:33",
		);
	});

	it("draws a point a week at its first day over twelve calendar months, with a dot on each month's 10th", () => {
		const view = period("1y", 0);
		assert.equal(view.dots, false);
		assert.equal(view.points.length, 52);
		assert.equal(view.points[0]!.x, 0);
		// The last week, Oct 2, stops short of the axis' end on Oct 10.
		assert.equal(view.points[51]!.x, 357 / 365);
		assert.deepEqual(
			view.axis.labels.map((l) => l.text),
			["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"],
		);
		assert.ok(view.axis.labels.every((l) => l.rotated));
		assert.deepEqual(
			view.axis.dots.map((d) => Math.round(d.x * 365)),
			[0, 31, 61, 92, 123, 151, 182, 212, 243, 273, 304, 335, 365],
		);
	});

	it("the phone's year, weeks ending Oct 7: 30 and all 52 cards as it titled them", () => {
		const view = period("1y", 0, PHONE_DATA_DAY);
		assert.equal(view.stats[0]!.value, "30");
		assert.deepEqual(
			view.weeks.map((w) => `${w.title}:${w.value.replace(" Avg", "")}`),
			PHONE_WEEKS.split("|"),
		);
	});

	it("Oct 11, 2024 - Oct 9, 2025: 29 over its ten weeks with data, lowest 24, highest 35", () => {
		const view = period("1y", -1);
		assert.equal(view.label, "Oct 11, 2024 - Oct 9, 2025");
		assert.deepEqual(values(view).map(([, v]) => v), ["29", "24", "35"]);
		assert.deepEqual(
			view.weeks.map((w) => `${w.title}:${w.value}`),
			[
				"October 3 - 9, 2025:33 Avg",
				"Sep 26 - 2, 2025:32 Avg",
				"September 19 - 25, 2025:25 Avg",
				"September 12 - 18, 2025:30 Avg",
				"September 5 - 11, 2025:29 Avg",
				"Aug 29 - 4, 2025:27 Avg",
				"August 22 - 28, 2025:35 Avg",
				"August 15 - 21, 2025:31 Avg",
				"August 8 - 14, 2025:30 Avg",
				"August 1 - 7, 2025:24 Avg",
			],
		);
		// The line runs only over the weeks with data.
		assert.equal(view.points.filter((p) => p.value !== null).length, 10);
		assert.equal(view.canGoBack, false);
		assert.equal(stressPeriodView({ data: data(ROWS, false), route: { range: "1y", offset: -1 }, today: TODAY }).canGoBack, true);
	});

	it("the phone's previous year, weeks ending Oct 8, 2025: 29 with its ten cards", () => {
		const view = period("1y", -1, PHONE_DATA_DAY);
		assert.equal(view.stats[0]!.value, "29");
		assert.deepEqual(
			view.weeks.map((w) => `${w.title}:${w.value.replace(" Avg", "")}`).join("|"),
			"October 2 - 8, 2025:32|Sep 25 - 1, 2025:32|September 18 - 24, 2025:26|September 11 - 17, 2025:30|September 4 - 10, 2025:30|Aug 28 - 3, 2025:27|August 21 - 27, 2025:32|August 14 - 20, 2025:31|August 7 - 13, 2025:32|Jul 31 - 6, 2025:24",
		);
	});

	it("shows -- with no week of data at all", () => {
		const view = stressPeriodView({ data: data([]), route: { range: "1y", offset: 0 }, today: TODAY });
		assert.deepEqual(values(view).map(([, v]) => v), ["--", "--", "--"]);
		assert.deepEqual(view.weeks, []);
	});
});

describe("moving between pages", () => {
	it("a day card switches the page in place to 1d on its day", () => {
		const week = period("7d", 0);
		const oct5 = week.days.find((c) => c.date === "2026-10-05")!;
		assert.equal(oct5.offset, -3);
		assert.deepEqual(dayCardRoute(oct5.date, TODAY), { range: "1d", offset: -3 });
	});

	it("< and > step a whole period, never past the current one", () => {
		assert.deepEqual(stepRoute({ range: "7d", offset: 0 }, -1), { range: "7d", offset: -1 });
		assert.deepEqual(stepRoute({ range: "1y", offset: -1 }, 1), { range: "1y", offset: 0 });
		assert.deepEqual(stepRoute({ range: "4w", offset: 0 }, 1), { range: "4w", offset: 0 });
		assert.equal(period("4w", -2).label, "Jul 17 - Aug 13");
		assert.equal(period("1y", -1).to, "2025-10-09");
	});

	it("1d reopens on the day it last showed; 7d, 4w and 1y on the current period", () => {
		const oct5: StressRoute = { range: "1d", offset: -3 };
		const week = switchRange(oct5, "7d", TODAY);
		assert.deepEqual(week, { range: "7d", offset: 0, date: "2026-10-05" });
		const month = switchRange(stepRoute(week, -2), "4w", TODAY);
		assert.deepEqual(month, { range: "4w", offset: 0, date: "2026-10-05" });
		assert.deepEqual(switchRange(month, "1d", TODAY), { range: "1d", offset: -3 });
		// A day later, the same day is a day further back.
		assert.deepEqual(switchRange(month, "1d", "2026-10-09"), { range: "1d", offset: -4 });
		assert.deepEqual(switchRange({ range: "1y", offset: -1 }, "1d", TODAY), { range: "1d", offset: 0 });
		assert.deepEqual(switchRange(oct5, "1d", TODAY), oct5);
	});

	it("a week card keeps the day 1d remembers", () => {
		assert.deepEqual(weekCardRoute({ range: "1y", offset: 0, date: "2026-10-05" }, "2026-10-01", "2026-10-08"), { range: "7d", offset: -1, date: "2026-10-05" });
	});

	it("loads readings for a 1d page's day only", () => {
		assert.deepEqual(periodSeriesDays({ range: "1d", offset: -1 }, TODAY), ["2026-10-07"]);
		assert.deepEqual(periodSeriesDays({ range: "7d", offset: 0 }, TODAY), []);
		assert.equal(stressView({ data: data(), route: { range: "1d", offset: 0 }, today: TODAY }).range, "1d");
		assert.equal(stressView({ data: data(), route: { range: "4w", offset: 0 }, today: TODAY }).range, "4w");
	});
});

describe("1d timeline", () => {
	const H = 3_600_000;
	const STEP = 180_000;

	it("before the readings are in: a 24-hour axis labelled every four hours, and nothing drawn", () => {
		const t = day(0).timeline;
		assert.equal(t.state, "pending");
		assert.equal(t.hours, 24);
		assert.equal(t.ticks.length, 25);
		assert.deepEqual(
			t.ticks.filter((k) => k.large).map((k) => k.label),
			["12 AM", "4 AM", "8 AM", "12 PM", "4 PM", "8 PM", "12 AM"],
		);
		assert.deepEqual([t.bars, t.active, t.unmeasurable], [[], [], []]);
		assert.equal(t.zones, undefined);
	});

	it("a bar a reading, rest to 25 and stress above; −2 runs active, −1 unmeasurable", () => {
		const start = Date.parse("2026-10-06T21:00:00Z");
		const readings: StressDay = { start, end: start + 24 * H, startOffset: 3 * H, endOffset: 3 * H, step: STEP, levels: [25, 26, -2, -2, null, -1, 0] };
		const t = stressDayView({ data: data(), route: { range: "1d", offset: -1 }, today: TODAY, readings }).timeline;
		assert.equal(t.state, "drawn");
		assert.deepEqual(
			t.bars.map((b) => [b.level, b.tone, b.x0 * 480]),
			[
				[25, "rest", 0],
				[26, "stress", 1],
				[0, "rest", 6],
			],
		);
		assert.deepEqual(t.active.map((r) => [r.x0 * 480, r.x1 * 480]), [[2, 4]]);
		assert.deepEqual(t.unmeasurable.map((r) => [r.x0 * 480, r.x1 * 480]), [[5, 6]]);
	});

	it("a day Garmin had no readings for: the axes, no bars (inferred until the phone shows one)", () => {
		const t = stressDayView({ data: data(), route: { range: "1d", offset: -200 }, today: TODAY, readings: null }).timeline;
		assert.equal(t.state, "empty");
		assert.deepEqual([t.hours, t.ticks.length, t.bars, t.active, t.unmeasurable], [24, 25, [], [], []]);
	});

	it("today runs on a 24-hour axis, its readings up to the newest", () => {
		const start = Date.parse("2026-10-07T20:00:00Z");
		const readings: StressDay = { start, end: start + 68 * 60_000, startOffset: 4 * H, endOffset: 4 * H, step: STEP, levels: [40, 30, 30, 23, -1] };
		const t = timelineOf(readings);
		assert.equal(t.hours, 24);
		assert.equal(t.bars.length, 4);
		assert.equal(t.unmeasurable[0]!.x0, (4 * STEP) / (24 * H));
	});

	it("a day the clocks went back runs 25 hours: 26 dots, labelled at its ends with their offsets", () => {
		const start = Date.parse("2026-10-04T20:00:00Z");
		const t = timelineOf({ start, end: start + 25 * H, startOffset: 4 * H, endOffset: 3 * H, step: STEP, levels: [10] });
		assert.equal(t.hours, 25);
		assert.equal(t.ticks.length, 26);
		assert.deepEqual(
			t.ticks.filter((k) => k.label).map((k) => [k.x, k.label]),
			[
				[0, "12 AM"],
				[1, "12 AM"],
			],
		);
		assert.deepEqual(t.zones, { start: "GMT +04:00", end: "GMT +03:00" });
	});

	it("puts the clock marker where the night ended, and none outside the day", () => {
		// Oct 7's sleep ended at 06:54.
		assert.equal(timelineOf(null, 24_840).wake, 24_840 / 86_400);
		assert.equal(timelineOf(null, -600).wake, undefined);
		const start = Date.parse("2026-10-06T21:00:00Z");
		assert.equal(timelineOf({ start, end: start + 23 * H, startOffset: 3 * H, endOffset: 4 * H, step: STEP, levels: [10] }, 24_840).wake, 24_840 / (23 * 3600));
	});
});
