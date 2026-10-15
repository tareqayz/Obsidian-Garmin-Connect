import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { glyphOf } from "../src/dashboard/activities";
import { allView, cardValue, clearedRoute, fold, searchRoute, SORT_OPTIONS, sortRoute } from "../src/dashboard/all-activities";
import { allRoute, readRoute, routeKey, type AllRoute } from "../src/dashboard/routes";
import type { ActivityRow } from "../src/sync/activity-index";
import { CENSUS_ROWS, ROWS, TODAY } from "./all-activities-fixture";

// All Activities' list: ref/activities/all-activities/README.md, TODAY the capture day.

const view = (route: Omit<AllRoute, "page"> = {}, rows: readonly ActivityRow[] = ROWS, units: "metric" | "imperial" = "metric") => allView(rows, allRoute(route), units, TODAY);
const ids = (route: Omit<AllRoute, "page">, rows: readonly ActivityRow[] = ROWS) => view(route, rows).items.map((c) => c.id);
const count = (route: Omit<AllRoute, "page">, rows: readonly ActivityRow[] = ROWS) => view(route, rows).count;

/** A route the page writes reads back as itself, and is the same history entry. */
function roundTrips(route: AllRoute): void {
	const back = readRoute(JSON.parse(JSON.stringify(route)));
	assert.deepEqual(back, route);
	assert.equal(routeKey(back!), routeKey(route));
}

describe("All Activities' cards", () => {
	const cards = view().items;
	const card = (id: number) => cards.find((c) => c.id === id)!;

	it("reads the spec's first card: Road Cycling's disc, 27.51 km, Oct 13 @ 11:57 AM", () => {
		assert.deepEqual(card(101), { id: 101, name: "Harbour Road Cycling", when: "Oct 13 @ 11:57 AM", value: "27.51 km", glyph: "bike", disc: "green" });
	});

	it("rounds the distance and truncates the time: 12,469.47 m is 12.47 km, 08:21:37 is 8:21", () => {
		assert.deepEqual([card(102).value, card(102).when], ["12.47 km", "Oct 11 @ 8:21 AM"]);
		assert.deepEqual([card(103).value, card(103).when], ["10.01 km", "Oct 10 @ 8:19 AM"]);
		assert.deepEqual([card(104).value, card(104).glyph, card(104).disc], ["5.44 km", "treadmill", "orange"]);
	});

	it("gives a swim whole metres, a yard pool yards, and the time to the nearest second without a distance", () => {
		assert.deepEqual(card(105), { id: 105, name: "Pool Swim", when: "Sep 14 @ 11:50 PM", value: "1,100 m", glyph: "swimming", disc: "blue" });
		assert.equal(card(106).value, "1,100 yd");
		assert.deepEqual([card(107).value, card(107).glyph, card(107).disc], ["34:52", "stairs-up", "orange"]);
		// 1,768.828 s rounds to 29:29 (truncating gives 29:28); 681.92 s to 11:22.
		assert.deepEqual([card(108).value, card(108).glyph], ["29:29", "barbell"]);
		assert.deepEqual([card(109).value, card(109).glyph, card(109).disc], ["11:22", "yoga", "cyan"]);
		assert.equal(card(110).value, "5:01");
		assert.equal(card(111).value, "1:08:17");
		assert.equal(card(121).value, "--");
	});

	it("adds the year for another year's activity", () => {
		assert.deepEqual([card(113).when, card(113).value], ["Oct 24, 2025 @ 9:30 AM", "519 m"]);
		assert.deepEqual([card(115).when, card(115).glyph, card(115).disc], ["Aug 20, 2025 @ 7:21 AM", "trekking", "red"]);
	});

	it("names an unnamed activity by its sport, and files a type the table lacks under its parent's group", () => {
		assert.deepEqual([card(117).name, card(117).value, card(117).glyph, card(117).disc], ["Meditation", "10:00", "yoga", "cyan"]);
		assert.deepEqual([card(119).name, card(119).glyph, card(119).disc], ["Zorb Session", "bike", "green"]);
		assert.deepEqual([card(120).glyph, card(120).disc], ["walk", "neutral"]);
	});

	it("writes miles in imperial; a pool keeps its own unit, open water reads in yards", () => {
		const imperial = view({}, ROWS, "imperial").items;
		const value = (id: number) => imperial.find((c) => c.id === id)!.value;
		assert.equal(value(101), "17.10 mi");
		assert.equal(value(105), "1,100 m");
		assert.equal(value(106), "1,100 yd");
		assert.equal(value(113), "568 yd");
		// A swim row from before index v3 has no pool: metres by its group.
		assert.equal(cardValue({ type: "lap_swimming", typeId: 27, parentTypeId: 26, distance: 1100 }, "metric"), "1,100 m");
	});
});

describe("All Activities' count", () => {
	it("is exact, where Garmin pages to 100+", () => {
		assert.equal(view().countLabel, "22 ACTIVITIES");
		assert.equal(view({ pr: true }).countLabel, "1 ACTIVITY");
		assert.equal(view({ events: ["race"], fav: true }).countLabel, "0 ACTIVITIES");
		const many = Array.from({ length: 1234 }, (_, i) => ({ ...ROWS[0]!, id: i + 1 }));
		assert.equal(view({}, many).countLabel, "1,234 ACTIVITIES");
	});

	it("matches the web on the capture day: All 341, Gym 54, Hiking 8, Cycling 16", () => {
		assert.equal(count({}, CENSUS_ROWS), 341);
		assert.equal(count({ types: [29] }, CENSUS_ROWS), 54);
		assert.equal(count({ types: [3] }, CENSUS_ROWS), 8);
		assert.equal(count({ types: [1] }, CENSUS_ROWS), 233);
		assert.equal(count({ types: [27] }, CENSUS_ROWS), 26);
	});

	it("gives 90 for the phone's Swimming + Gym + Hiking, where Garmin's 91 counts the multisport's open-water leg", () => {
		// Garmin's filtered lists include multisport legs (web: Swimming 29, Cycling 17); the
		// activity list, and so the index, leaves them out: Swimming 28, Cycling 16.
		assert.equal(count({ types: [26] }, CENSUS_ROWS), 28);
		assert.equal(count({ types: [2] }, CENSUS_ROWS), 16);
		assert.equal(count({ types: [26, 29] }, CENSUS_ROWS), 82);
		assert.equal(count({ types: [26, 29, 3] }, CENSUS_ROWS), 90);
	});

	it("finds what Garmin's search finds: names only", () => {
		assert.equal(count({ q: "Harbour" }, CENSUS_ROWS), 36);
		// 25, as search-pool.json; a search of sport names too would add the pool swim named "Long Set".
		assert.equal(count({ q: "Pool" }, CENSUS_ROWS), 25);
		// 229, as search-running.json; four runs named for their workout aren't found.
		assert.equal(count({ q: "Running" }, CENSUS_ROWS), 229);
	});
});

describe("All Activities' filters", () => {
	it("ORs types, by group or sub-type; an unknown type by its parent's group, Steps under Other", () => {
		assert.equal(count({}), 22);
		assert.deepEqual(ids({ types: [26] }), [105, 106, 113]);
		assert.equal(count({ types: [29] }), 5);
		assert.equal(count({ types: [26, 29] }), 8);
		assert.equal(count({ types: [26, 29, 3] }), 10);
		assert.deepEqual(ids({ types: [27] }), [105, 106]);
		assert.deepEqual(ids({ types: [18] }), [104]);
		assert.equal(count({ types: [1, 18] }), 5);
		assert.deepEqual(ids({ types: [2] }), [101, 119]);
		assert.deepEqual(ids({ types: [990] }), [119]);
		assert.deepEqual(ids({ types: [4] }), [117, 122, 121]);
		assert.deepEqual(ids({ types: [9] }), [120]);
		assert.deepEqual(ids({ types: [89] }), [114]);
	});

	it("takes dates as the local start's day, both ends inclusive, either end open", () => {
		// 11:50 PM on Sep 14 is Sep 14, whatever the GMT day.
		assert.deepEqual(ids({ from: "2026-09-14", to: "2026-09-14" }), [105]);
		assert.deepEqual(ids({ from: "2026-10-01", to: "2026-10-15" }), [101, 102, 103]);
		assert.deepEqual(ids({ from: "2026-10-15", to: "2026-10-15" }), []);
		assert.deepEqual(ids({ from: "2026-10-11" }), [101, 102]);
		assert.deepEqual(ids({ to: "2025-10-24" }), [113, 115, 116]);
		assert.deepEqual(ids({ from: "2026-01-28", to: "2026-01-28" }), [111, 112]);
	});

	it("takes ranges inclusive, a missing value as 0", () => {
		assert.deepEqual(ids({ dmin: 10000 }), [101, 102, 103, 114]);
		// Rows with no distance count as 0: the gym, Meditation, Breathwork.
		assert.deepEqual(ids({ dmax: 5000 }), [105, 106, 107, 108, 109, 110, 119, 118, 120, 117, 122, 121, 111, 113]);
		assert.deepEqual(ids({ dmin: 5000, dmax: 5000 }), [118]);
		assert.deepEqual(ids({ tmin: 3600 }), [102, 111, 114, 115, 116]);
		assert.deepEqual(ids({ tmax: 600 }), [110, 117, 122, 121]);
		assert.deepEqual(ids({ amin: 100 }), [101, 114, 115, 116]);
		assert.equal(count({ amax: 0 }), 15);
		assert.equal(count({ dmin: 0, tmin: 0, amin: 0 }), 22);
	});

	it("ORs event types, a row without one being Uncategorized; keeps favourites and records", () => {
		assert.deepEqual(ids({ events: ["race"] }), [114]);
		assert.deepEqual(ids({ events: ["race", "training"] }), [118, 114]);
		assert.equal(count({ events: ["uncategorized"] }), 19);
		assert.deepEqual(ids({ fav: true }), [115]);
		assert.deepEqual(ids({ pr: true }), [102]);
	});

	it("ANDs across sections", () => {
		assert.deepEqual(ids({ types: [26, 29], tmin: 1800 }), [105, 107, 111]);
		assert.deepEqual(ids({ q: "harbour", types: [2] }), [101]);
		assert.deepEqual(ids({ pr: true, types: [1] }), [102]);
		assert.deepEqual(ids({ pr: true, types: [2] }), []);
	});
});

describe("All Activities' search", () => {
	it("matches the name only, mid-word, blind to case", () => {
		assert.deepEqual(ids({ q: "pool" }), [105]);
		assert.deepEqual(ids({ q: "Running" }), [102, 103, 104, 112]);
		assert.deepEqual(ids({ q: "ARBOU" }), [101, 102, 103]);
		assert.deepEqual(ids({ q: "Harbor" }), []);
	});

	it("folds accents and compatibility forms both ways", () => {
		for (const q of ["cafe", "CAFÉ", "café run", "Café"]) assert.deepEqual(ids({ q }), [118], q);
		assert.deepEqual(ids({ q: "ＨＡＲＢＯＵＲ ＲＵＮ" }), [102, 103]);
		assert.equal(fold("Straße ﬁnish Ångström"), "strasse finish angstrom");
	});

	it("reads an unnamed activity by the sport its card shows", () => {
		assert.deepEqual(ids({ q: "medit" }), [117]);
	});
});

describe("All Activities' sorts", () => {
	const shuffled = [...ROWS].reverse();

	it("puts Newest First by the local start: 06:59 (+04) before 06:13 (+03), though later in GMT", () => {
		assert.deepEqual(ids({}, shuffled), ROWS.map((r) => r.id));
		const morning = ids({ from: "2026-01-28", to: "2026-01-28" }, shuffled);
		assert.deepEqual(morning, [111, 112]);
		assert.ok(ROWS.find((r) => r.id === 111)!.begin < ROWS.find((r) => r.id === 112)!.begin);
	});

	it("puts Oldest First in the reverse order", () => {
		assert.deepEqual(ids({ sort: "oldest" }, ROWS), ROWS.map((r) => r.id).reverse());
	});

	it("sorts A to Z by folded name, ties newest first", () => {
		assert.deepEqual(ids({ sort: "az" }, shuffled), [121, 118, 114, 120, 101, 102, 103, 115, 116, 106, 117, 112, 113, 105, 107, 122, 108, 111, 104, 109, 110, 119]);
	});

	it("sorts Z to A by folded name, ties still newest first", () => {
		assert.deepEqual(ids({ sort: "za" }, shuffled), [119, 109, 110, 104, 108, 111, 122, 107, 105, 113, 112, 117, 106, 115, 116, 102, 103, 101, 120, 114, 118, 121]);
	});

	it("compares folded names code point by code point, not as numbers or by locale", () => {
		const named = (name: string, id: number): ActivityRow => ({ ...ROWS[0]!, id, name });
		const rows = [named("Run 9", 1), named("Run 10", 2), named("Run-1", 3), named("eBike", 4), named("Zed", 5)];
		// "run 10" before "run 9" ('1' < '9'), a space before a hyphen; "eBike" folds to "ebike".
		assert.deepEqual(ids({ sort: "az" }, rows), [4, 2, 1, 3, 5]);
	});

	it("lists the Sort menu in the phone's order and writes only what isn't the default", () => {
		assert.deepEqual(SORT_OPTIONS.map((o) => o.label), ["Newest First", "Oldest First", "A to Z", "Z to A"]);
		const route = allRoute({ q: "harbour", types: [1] });
		assert.deepEqual(sortRoute(route, "az"), { page: "all", q: "harbour", sort: "az", types: [1] });
		assert.deepEqual(sortRoute(sortRoute(route, "za"), undefined), route);
		for (const option of SORT_OPTIONS) roundTrips(sortRoute(route, option.sort));
	});
});

describe("All Activities' chips", () => {
	const route = allRoute({
		types: [26, 29, 3, 10],
		from: "2026-10-01",
		to: "2026-10-15",
		dmin: 10000,
		dmax: 50000,
		tmin: 3600,
		tmax: 14400,
		amin: 100,
		events: ["race", "specialEvent"],
		fav: true,
		pr: true,
	});
	const chips = allView(ROWS, route, "metric", TODAY).chips;

	it("names each filter: types in the order chosen, then the sheet's sections in order", () => {
		assert.deepEqual(
			chips.map((c) => [c.key, c.label, c.glyph]),
			[
				["type:26", "All Swimming", "swimming"],
				["type:29", "All Gym & Fitness Equipment", "barbell"],
				["type:3", "All Hiking", "trekking"],
				["type:10", "Road Cycling", "bike"],
				["date", "Oct 1 - Oct 15", undefined],
				["distance", "10 - 50 km", undefined],
				["time", "1h - 4h", undefined],
				["ascent", "100+ m", undefined],
				["event:race", "Race", undefined],
				["event:specialEvent", "Special Event", undefined],
				["fav", "Favorite Activities", undefined],
				["pr", "Personal Records", undefined],
			],
		);
		assert.ok(allView(ROWS, route, "metric", TODAY).active);
	});

	it("removes just its own filter, and the route it leaves reads back as itself", () => {
		const remove = (key: string) => chips.find((c) => c.key === key)!.remove;
		assert.deepEqual(remove("type:29").types, [26, 3, 10]);
		assert.equal("from" in remove("date") || "to" in remove("date"), false);
		assert.equal("dmin" in remove("distance") || "dmax" in remove("distance"), false);
		assert.deepEqual(remove("event:race").events, ["specialEvent"]);
		assert.equal("fav" in remove("fav"), false);
		assert.equal(remove("pr").pr, undefined);
		for (const chip of chips) {
			const others = chips.filter((c) => c.key !== chip.key).map((c) => c.label);
			assert.deepEqual(allView(ROWS, chip.remove, "metric", TODAY).chips.map((c) => c.label), others, chip.key);
			roundTrips(chip.remove);
		}
		const last = allView(ROWS, allRoute({ types: [26] }), "metric", TODAY).chips[0]!.remove;
		assert.deepEqual(last, { page: "all" });
	});

	it("writes dates and ranges with one end open (Inferred)", () => {
		const labels = (r: Omit<AllRoute, "page">, units: "metric" | "imperial" = "metric") => view(r, ROWS, units).chips.map((c) => c.label);
		assert.deepEqual(labels({ from: "2026-09-14", to: "2026-09-14" }), ["Sep 14"]);
		assert.deepEqual(labels({ from: "2025-12-20", to: "2026-01-05" }), ["Dec 20, 2025 - Jan 5"]);
		assert.deepEqual(labels({ from: "2026-10-01" }), ["From Oct 1"]);
		assert.deepEqual(labels({ to: "2026-10-15" }), ["Until Oct 15"]);
		assert.deepEqual(labels({ dmax: 5000, tmin: 5400, amin: 100, amax: 100 }), ["0 - 5 km", "1h 30m+", "100 m"]);
		assert.deepEqual(labels({ dmin: 10500, tmax: 2700 }), ["10.5+ km", "0m - 45m"]);
		assert.deepEqual(labels({ dmin: 8046.72, amax: 304.8 }, "imperial"), ["5+ mi", "0 - 1,000 ft"]);
	});

	it("names a type the table lacks as its activities are, and an event Garmin adds from its key", () => {
		assert.deepEqual(
			view({ types: [990, 777], events: ["virtualRace"] }).chips.map((c) => [c.label, c.glyph]),
			[
				["Zorbing", "bike"],
				["Type 777", "activity"],
				["Virtual Race", undefined],
			],
		);
	});

	it("lights the filter dot for filters, not for the search or the sort (Inferred)", () => {
		assert.equal(view({ q: "harbour", sort: "az" }).active, false);
		assert.deepEqual(view({ q: "harbour", sort: "az" }).chips, []);
		assert.equal(view({ fav: true }).active, true);
	});
});

describe("All Activities' empty states", () => {
	it("says nothing is synced yet, with nothing to clear", () => {
		const empty = allView([], allRoute(), "metric", TODAY);
		assert.deepEqual([empty.count, empty.countLabel, empty.items, empty.empty], [0, "0 ACTIVITIES", [], { title: "No activities synced yet.", clear: false }]);
	});

	it("says No Activities Found with Clear All, which drops the search and the filters but keeps the sort", () => {
		assert.deepEqual(view({ q: "Harbor" }).empty, { title: "No Activities Found", clear: true });
		assert.deepEqual(view({ events: ["race"], fav: true }).empty, { title: "No Activities Found", clear: true });
		assert.equal(view().empty, undefined);
		const cleared = clearedRoute(allRoute({ q: "Harbor", sort: "za", types: [1], fav: true }));
		assert.deepEqual(cleared, { page: "all", sort: "za" });
		roundTrips(cleared);
	});

	it("writes the search trimmed, and none when it's empty", () => {
		const route = allRoute({ sort: "oldest", types: [26] });
		assert.deepEqual(searchRoute(route, "  Harbour  "), { page: "all", q: "Harbour", sort: "oldest", types: [26] });
		assert.deepEqual(searchRoute(searchRoute(route, "Harbour"), "   "), route);
		roundTrips(searchRoute(route, "Café Run"));
	});
});

describe("glyphOf, for the filter groups", () => {
	it("draws each group behind Show All with its own figure", () => {
		const glyph = (type: string, typeId: number, parentTypeId: number) => glyphOf({ type, typeId, parentTypeId });
		assert.equal(glyph("apnea_diving", 148, 144), "scuba-diving");
		assert.equal(glyph("skating_ws", 168, 165), "snowflake");
		assert.equal(glyph("wheelchair_push_run", 200, 199), "wheelchair");
		assert.equal(glyph("kayaking_v2", 231, 228), "ripple");
		assert.equal(glyph("soccer", 215, 206), "ball-football");
		assert.equal(glyph("tennis_v2", 227, 219), "ball-tennis");
		assert.equal(glyph("incident_detected", 159, 157), "asterisk");
		assert.equal(glyph("transition_v2", 189, 4), "chevrons-right");
		assert.equal(glyph("swimToBikeTransition_v2", 190, 4), "chevrons-right");
		assert.equal(glyph("elliptical", 30, 29), "barbell");
		// Multisport's linked rings, as the sheet's group and the web's card draw it.
		assert.equal(glyph("multi_sport", 89, 17), "link");
		assert.equal(glyph("speed_walking", 16, 9), "walk");
		assert.equal(glyph("golf", 88, 4), "activity");
	});
});
