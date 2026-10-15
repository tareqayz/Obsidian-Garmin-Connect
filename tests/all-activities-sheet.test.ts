import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	allView,
	applyDraft,
	draftOf,
	EVENT_TYPES,
	eventLabel,
	fieldText,
	filterTree,
	footerOf,
	groupGlyph,
	hasFilters,
	monthGrid,
	monthOptions,
	pickMonth,
	rangeOfSlider,
	rangeScales,
	setDates,
	setFlag,
	setRange,
	sliderOf,
	toggleEvent,
	toggleType,
	typedEnd,
	yearOptions,
	type AllDraft,
	type RangeScale,
	type TreeGroup,
} from "../src/dashboard/all-activities";
import { allRoute, readRoute, routeKey, type AllRoute } from "../src/dashboard/routes";
import { CENSUS_ROWS, ROWS, TODAY } from "./all-activities-fixture";

// All Activities' Filters sheet: ref/activities/all-activities/README.md ("The filter sheet",
// Rules, Builder table) and figma-garmin.md's Inferred frames.

function roundTrips(route: AllRoute): void {
	const back = readRoute(JSON.parse(JSON.stringify(route)));
	assert.deepEqual(back, route);
	assert.equal(routeKey(back!), routeKey(route));
}

const labels = (group: TreeGroup) => group.types.map((t) => t.label);

describe("the Filters sheet's activity tree", () => {
	const tree = filterTree([]);
	const group = (name: string) => tree.find((g) => g.name === name)!;

	it("lists the fifteen groups in the sheet's order, five before Show All, each with its figure", () => {
		assert.deepEqual(
			tree.map((g) => [g.name, g.glyph, g.shown]),
			[
				["Running", "run", true],
				["Cycling", "bike", true],
				["Gym & Fitness Equipment", "barbell", true],
				["Swimming", "swimming", true],
				["Walking", "walk", true],
				["Hiking", "trekking", false],
				["Multisport", "link", false],
				["Diving", "scuba-diving", false],
				["Winter Sports", "snowflake", false],
				["Parasports", "wheelchair", false],
				["Water Sports", "ripple", false],
				["Team Sports", "ball-football", false],
				["Racket Sports", "ball-tennis", false],
				["Other", "activity", false],
				["Safety", "asterisk", false],
			],
		);
		assert.equal(groupGlyph(12345), "activity");
	});

	it("opens a group on All <Group>, then its sub-types as the phone lists them", () => {
		assert.deepEqual(labels(group("Running")), [
			"All Running",
			"Indoor Running",
			"Obstacle Course Racing",
			"Street Running",
			"Track Running",
			"Trail Running",
			"Treadmill Running",
			"Ultra Run",
			"Virtual Run",
		]);
		// filters/03–04: "eBiking" and its kin after "Virtual Ride", code point by code point.
		assert.deepEqual(labels(group("Cycling")), [
			"All Cycling",
			"BMX",
			"Cyclocross",
			"Downhill Biking",
			"Enduro Mountain Biking",
			"Gravel/Unpaved Cycling",
			"Handcycling",
			"Indoor Cycling",
			"Indoor Handcycling",
			"Mountain Biking",
			"Recumbent Cycling",
			"Road Cycling",
			"Track Cycling",
			"Virtual Ride",
			"eBiking",
			"eEnduro Mountain Biking",
			"eMountain Biking",
		]);
		assert.deepEqual(labels(group("Gym & Fitness Equipment")), [
			"All Gym & Fitness Equipment",
			"Bouldering",
			"Cardio",
			"Dance Fitness",
			"Elliptical",
			"HIIT",
			"Indoor Climbing",
			"Indoor Cross Country Skiing",
			"Indoor Rowing",
			"Jump Rope",
			"Mobility",
			"Onshore Grinding",
			"Pilates",
			"Stair Stepper",
			"Strength Training",
			"Yoga",
		]);
		// filters/12 up to Skating; the last two are the web's.
		assert.deepEqual(labels(group("Winter Sports")), [
			"All Winter Sports",
			"Backcountry Skiing",
			"Backcountry Skiing/Snowboarding",
			"Backcountry Snowboarding",
			"Cross Country Classic Skiing",
			"Cross Country Skate Skiing",
			"Resort Skiing",
			"Resort Skiing or Snowboarding",
			"Resort Snowboarding",
			"Skating",
			"Snowmobiling",
			"Snowshoeing",
		]);
		assert.deepEqual(labels(group("Swimming")), ["All Swimming", "Open Water Swimming", "Pool Swimming"]);
		assert.deepEqual(labels(group("Walking")), ["All Walking", "Casual Walking", "Speed Walking"]);
		assert.deepEqual(labels(group("Hiking")), ["All Hiking", "Rucking"]);
		assert.deepEqual(labels(group("Multisport")), ["All Multisport"]);
		assert.deepEqual(labels(group("Diving")), ["All Diving", "Apnea Diving", "Apnea Hunt", "CCR", "Gauge Diving", "Multi-Gas Diving", "Pool Apnea", "Single Gas Diving"]);
		assert.deepEqual(labels(group("Other")).slice(0, 3), ["All Other", "ATV", "Archery"]);
		assert.deepEqual(group("Running").types.slice(0, 2), [
			{ id: 1, label: "All Running" },
			{ id: 156, label: "Indoor Running" },
		]);
	});

	it("lists every type but the hidden root and Steps once, sub-types by code point", () => {
		const all = tree.flatMap((g) => g.types.map((t) => t.id));
		assert.equal(all.length, 152);
		assert.equal(new Set(all).size, 152);
		assert.ok(!all.includes(17) && !all.includes(108));
		for (const g of tree) {
			const subs = g.types.slice(1).map((t) => t.label);
			assert.deepEqual([...subs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), subs, g.name);
		}
	});

	it("lists a type the history holds and the table lacks under its group, by name", () => {
		const cycling = filterTree(ROWS).find((g) => g.id === 2)!;
		assert.deepEqual(labels(cycling).slice(-5), ["Virtual Ride", "Zorbing", "eBiking", "eEnduro Mountain Biking", "eMountain Biking"]);
		assert.deepEqual(cycling.types.find((t) => t.label === "Zorbing"), { id: 990, label: "Zorbing" });
	});
});

describe("the Filters sheet's draft", () => {
	const tree = filterTree(ROWS);
	const group = (id: number) => tree.find((g) => g.id === id)!;
	const tick = (draft: AllDraft, id: number) => toggleType(draft, tree.find((g) => g.types.some((t) => t.id === id))!, id);

	it("opens on the route's filters, leaving the search and the sort to the page", () => {
		const route = allRoute({ q: "harbour", sort: "az", types: [26, 3], from: "2026-10-01", dmin: 1000, events: ["race"], fav: true });
		assert.deepEqual(draftOf(route), { types: [26, 3], from: "2026-10-01", dmin: 1000, events: ["race"], fav: true });
		assert.deepEqual(draftOf(allRoute({ q: "harbour" })), {});
	});

	it("ticks All <Group> and its sub-types each to the other's exclusion, in the order ticked (Inferred)", () => {
		let draft: AllDraft = {};
		draft = tick(draft, 26);
		assert.deepEqual(draft, { types: [26] });
		draft = tick(draft, 27);
		assert.deepEqual(draft, { types: [27] });
		draft = tick(draft, 29);
		draft = tick(draft, 28);
		assert.deepEqual(draft, { types: [27, 29, 28] });
		draft = toggleType(draft, group(26), 26);
		assert.deepEqual(draft, { types: [29, 26] });
		draft = tick(draft, 10);
		assert.deepEqual(draft, { types: [29, 26, 10] });
		// Unticking.
		draft = tick(tick(tick(draft, 29), 26), 10);
		assert.deepEqual(draft, {});
		// A type the table lacks belongs to its group too.
		assert.deepEqual(toggleType(tick({}, 2), group(2), 990), { types: [990] });
		assert.deepEqual(toggleType({ types: [990, 26] }, group(2), 2), { types: [26, 2] });
	});

	it("turns Event Type's chips on and off; Any, or the last one off, is no filter", () => {
		let draft = toggleEvent({}, "race");
		draft = toggleEvent(draft, "training");
		assert.deepEqual(draft, { events: ["race", "training"] });
		assert.deepEqual(toggleEvent(draft, "race"), { events: ["training"] });
		assert.deepEqual(toggleEvent(toggleEvent(draft, "race"), "training"), {});
		assert.deepEqual(toggleEvent(draft, null), {});
	});

	it("sets dates, ranges and the two switches, an open end writing nothing", () => {
		const [distance, time] = rangeScales("metric");
		let draft = setDates({}, "2026-10-15", "2026-10-01");
		draft = setRange(draft, distance!, 10000, undefined);
		draft = setRange(draft, time!, 3600, 14400);
		draft = setFlag(setFlag(draft, "fav", true), "pr", true);
		assert.deepEqual(draft, { from: "2026-10-15", to: "2026-10-01", dmin: 10000, tmin: 3600, tmax: 14400, fav: true, pr: true });
		assert.deepEqual(setFlag(setRange(setDates(draft, undefined, undefined), time!, undefined, undefined), "fav", false), { dmin: 10000, pr: true });
		assert.ok(hasFilters(draft));
		assert.ok(!hasFilters({}));
	});

	it("applies as a route that keeps the search and the sort, put in order, which reads back as itself", () => {
		const route = allRoute({ q: "harbour", sort: "oldest" });
		const applied = applyDraft(route, { types: [26, 26, 29], from: "2026-10-15", to: "2026-10-01", dmin: 50000, dmax: 10000, events: ["race"] });
		assert.deepEqual(applied, { page: "all", q: "harbour", sort: "oldest", types: [26, 29], from: "2026-10-01", to: "2026-10-15", dmin: 10000, dmax: 50000, events: ["race"] });
		roundTrips(applied);
		// Clear All empties the draft; the search and the sort stay.
		assert.deepEqual(applyDraft(route, {}), route);
		roundTrips(applyDraft(allRoute(), {}));
	});
});

describe("the Filters sheet's footer", () => {
	const plain = allRoute();

	it("says Show All Activities with nothing chosen, Clear All then off", () => {
		assert.deepEqual(footerOf(ROWS, plain, {}), { count: 22, label: "Show All Activities", clear: false });
	});

	it("counts the draft live: Show N Activities, Show 1 Activity, Show 0 Activities", () => {
		assert.deepEqual(footerOf(ROWS, plain, { types: [26] }), { count: 3, label: "Show 3 Activities", clear: true });
		assert.deepEqual(footerOf(ROWS, plain, { pr: true }), { count: 1, label: "Show 1 Activity", clear: true });
		assert.deepEqual(footerOf(ROWS, plain, { events: ["race"], fav: true }), { count: 0, label: "Show 0 Activities", clear: true });
	});

	it("counts with the search, which Clear All keeps", () => {
		const searching = allRoute({ q: "harbour", sort: "az" });
		assert.deepEqual(footerOf(ROWS, searching, {}), { count: 3, label: "Show 3 Activities", clear: false });
		assert.deepEqual(footerOf(ROWS, searching, { types: [2] }), { count: 1, label: "Show 1 Activity", clear: true });
	});

	it("gives the page's own count once applied", () => {
		const drafts: AllDraft[] = [{}, { types: [26, 29] }, { dmax: 5000 }, { from: "2026-01-28", to: "2026-01-28" }, { tmin: 3600, events: ["uncategorized"] }];
		for (const draft of drafts) {
			const route = allRoute({ q: "r" });
			assert.equal(footerOf(ROWS, route, draft).count, allView(ROWS, applyDraft(route, draft), "metric", TODAY).count, JSON.stringify(draft));
		}
	});

	it("reads the Figma's Inferred footers on the capture day: Show 26 (Pool Swimming), Show 90 (the phone's three groups)", () => {
		assert.equal(footerOf(CENSUS_ROWS, plain, { types: [27] }).label, "Show 26 Activities");
		assert.equal(footerOf(CENSUS_ROWS, plain, { types: [26, 29, 3] }).label, "Show 90 Activities");
	});
});

describe("the Filters sheet's ranges", () => {
	const [distance, time, ascent] = rangeScales("metric") as [RangeScale, RangeScale, RangeScale];
	const [miles, , feet] = rangeScales("imperial") as [RangeScale, RangeScale, RangeScale];

	it("has the phone's sections, ends and placeholders; imperial and the steps are Inferred", () => {
		assert.deepEqual(
			rangeScales("metric").map((s) => [s.title, s.end, s.step, s.placeholders, s.keys]),
			[
				["Distance (km)", 150, 1, ["0", "150+"], ["dmin", "dmax"]],
				["Time", 1440, 5, ["0m", "24h+"], ["tmin", "tmax"]],
				["Total Ascent (m)", 3000, undefined, ["0", "3000+"], ["amin", "amax"]],
			],
		);
		assert.deepEqual(
			rangeScales("imperial").map((s) => [s.title, s.end, s.placeholders]),
			[
				["Distance (mi)", 100, ["0", "100+"]],
				["Time", 1440, ["0m", "24h+"]],
				["Total Ascent (ft)", 10000, ["0", "10000+"]],
			],
		);
	});

	it("puts the thumbs at the ends when open, and an end at either stop means no bound", () => {
		assert.deepEqual(sliderOf(distance, undefined, undefined), [0, 150]);
		assert.deepEqual(sliderOf(distance, 10000, 50000), [10, 50]);
		assert.deepEqual(sliderOf(distance, 200000, undefined), [150, 150]);
		assert.deepEqual(sliderOf(time, 3600, 14400), [60, 240]);
		assert.deepEqual(rangeOfSlider(distance, 0, 150), {});
		assert.deepEqual(rangeOfSlider(distance, 10, 50), { min: 10000, max: 50000 });
		assert.deepEqual(rangeOfSlider(distance, 50, 10), { min: 10000, max: 50000 });
		assert.deepEqual(rangeOfSlider(miles, 5, 100), { min: 8046.72 });
		assert.deepEqual(rangeOfSlider(time, 60, 1440), { min: 3600 });
		assert.deepEqual(rangeOfSlider(time, 0, 30), { max: 1800 });
	});

	it("reads typed distances with a point or a comma; 0 and the scale's end are no bound", () => {
		assert.equal(typedEnd(distance, "min", ""), undefined);
		assert.equal(typedEnd(distance, "min", "0"), undefined);
		assert.equal(typedEnd(distance, "min", "10"), 10000);
		assert.equal(typedEnd(distance, "min", " 10.5 km "), 10500);
		assert.equal(typedEnd(distance, "min", "10,5"), 10500);
		assert.equal(typedEnd(distance, "min", "200"), 200000);
		assert.equal(typedEnd(distance, "max", "149.99"), 149990);
		for (const text of ["150", "150+", "200"]) assert.equal(typedEnd(distance, "max", text), undefined, text);
		for (const text of ["abc", "-5", "10 mi", "1e3"]) assert.equal(typedEnd(distance, "min", text), null, text);
		assert.equal(typedEnd(miles, "min", "5"), 8046.72);
		assert.equal(typedEnd(miles, "max", "100"), undefined);
	});

	it("reads typed times as hours and minutes: 1h 30m, 90m, 1:30 and 90 are one value", () => {
		for (const text of ["1h 30m", "1h30m", "90m", "90 min", "1:30", "90", "1.5h", "1h 30", "1,5 h"]) assert.equal(typedEnd(time, "min", text), 5400, text);
		assert.equal(typedEnd(time, "min", "2:00:30"), 7230);
		assert.equal(typedEnd(time, "min", "0m"), undefined);
		assert.equal(typedEnd(time, "max", "23h 55m"), 86100);
		for (const text of ["24h", "24h+", "25h", "1440"]) assert.equal(typedEnd(time, "max", text), undefined, text);
		for (const text of ["soon", "1:75", "h", "1h 30x"]) assert.equal(typedEnd(time, "min", text), null, text);
	});

	it("reads typed ascent in feet exactly at the scale's end", () => {
		assert.equal(typedEnd(ascent, "max", "2500"), 2500);
		assert.equal(typedEnd(ascent, "max", "3000"), undefined);
		assert.equal(typedEnd(feet, "max", "10000"), undefined);
		assert.equal(typedEnd(feet, "max", "1000"), 304.8);
	});

	it("writes a field's text back the way it reads", () => {
		assert.equal(fieldText(distance, undefined), "");
		assert.equal(fieldText(distance, 10500), "10.5");
		assert.equal(fieldText(distance, 10000), "10");
		assert.equal(fieldText(miles, 8046.72), "5");
		assert.equal(fieldText(feet, 304.8), "1000");
		assert.deepEqual([5400, 3600, 2700, 7230, 0].map((s) => fieldText(time, s)), ["1h 30m", "1h", "45m", "2h 30s", "0m"]);
		for (const [scale, value] of [[distance, 12340], [time, 5400], [ascent, 640], [feet, 304.8], [miles, 8046.72]] as const) {
			assert.equal(typedEnd(scale, "max", fieldText(scale, value)), value, scale.title);
		}
	});
});

describe("the Filters sheet's calendar", () => {
	const days = (grid: ReturnType<typeof monthGrid>) => grid.weeks.map((w) => w.map((d) => d?.day ?? null));

	it("draws October 2026 from Sunday: the 1st a Thursday, five weeks, today circled, the rest of the month disabled", () => {
		const grid = monthGrid("2026-10", TODAY);
		assert.equal(grid.title, "October 2026");
		assert.deepEqual(grid.weekdays, ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]);
		assert.deepEqual(days(grid), [
			[null, null, null, null, 1, 2, 3],
			[4, 5, 6, 7, 8, 9, 10],
			[11, 12, 13, 14, 15, 16, 17],
			[18, 19, 20, 21, 22, 23, 24],
			[25, 26, 27, 28, 29, 30, 31],
		]);
		const all = grid.weeks.flat().filter((d) => d !== null);
		assert.deepEqual(all.filter((d) => d.today).map((d) => d.date), ["2026-10-15"]);
		assert.deepEqual(all.filter((d) => d.disabled).map((d) => d.day), [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]);
		assert.deepEqual([grid.prev, grid.next], ["2026-09", null]);
	});

	it("marks the focused field's day, and goes back no further than the first year offered", () => {
		const picked = monthGrid("2026-10", TODAY, "2026-10-01");
		assert.deepEqual(picked.weeks.flat().filter((d) => d?.selected).map((d) => d!.date), ["2026-10-01"]);
		const september = monthGrid("2026-09", TODAY);
		assert.deepEqual([days(september)[0], september.weeks.length, september.next], [[null, null, 1, 2, 3, 4, 5], 5, "2026-10"]);
		assert.ok(september.weeks.flat().every((d) => d === null || !d.disabled));
		assert.equal(monthGrid("2026-02", TODAY).weeks.length, 4);
		assert.equal(monthGrid("2025-01", TODAY, undefined, "2025-01-05").prev, null);
		assert.equal(monthGrid("2025-02", TODAY, undefined, "2025-01-05").prev, "2025-01");
	});

	it("offers the months and years the wheel does, none after today", () => {
		const months = monthOptions(2026, TODAY);
		assert.deepEqual(months.map((m) => m.label).slice(9), ["October", "November", "December"]);
		assert.deepEqual(months.filter((m) => m.disabled).map((m) => m.value), [11, 12]);
		assert.ok(monthOptions(2025, TODAY).every((m) => !m.disabled));
		assert.deepEqual(yearOptions(ROWS, TODAY), [2025, 2026]);
		assert.deepEqual(yearOptions([], TODAY), [2026]);
		assert.equal(pickMonth(2026, 12, TODAY), "2026-10");
		assert.equal(pickMonth(2025, 12, TODAY), "2025-12");
		assert.equal(pickMonth(2026, 3, TODAY), "2026-03");
	});
});

describe("the Filters sheet's Event Type", () => {
	it("lists Garmin's nine event types after Any, by label, in the phone's words", () => {
		assert.deepEqual(
			EVENT_TYPES.map((e) => e.label),
			["Fitness", "Geocaching", "Race", "Recreation", "Special Event", "Touring", "Training", "Transportation", "Uncategorized"],
		);
		// eventTypes' keys (api-samples/event-types.json).
		assert.deepEqual(
			EVENT_TYPES.map((e) => e.key).sort(),
			["fitness", "geocaching", "race", "recreation", "specialEvent", "touring", "training", "transportation", "uncategorized"],
		);
		assert.equal(eventLabel("specialEvent"), "Special Event");
		assert.equal(eventLabel("virtualRace"), "Virtual Race");
		assert.equal(eventLabel("night_ride"), "Night Ride");
	});
});
