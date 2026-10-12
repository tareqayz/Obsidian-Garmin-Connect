import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { MARKER, PHONE_BOX_TOP, RACE_FRAMES, markerPath, racePlot, type RacePlot } from "../src/dashboard/race-predictor-charts";
import { RACE_DISTANCES, racePredictorView, type RaceId, type RacePeriodView } from "../src/dashboard/race-predictor-pages";
import { PANE_COLUMN, PHONE } from "../src/dashboard/stat-charts";
import { ROWS, TODAY } from "./race-predictor-fixture";

/**
 * The pace chart against the Obsidian twin (Figma 430:6110) at the phone's
 * 402 pt and a pane's 748 pt column, and against Garmin's own phone shots of
 * 2026-10-11: the spec's ten pixel fits (golden-race-predictor.py), with the
 * shots' readings embedded below as rp_pixels.py takes them. The twin is
 * Garmin's page 56 pt higher with the same plot, so a shot's pixel row y is
 * the box's y / 3 − 56 − 202.35.
 */

type Range = RacePeriodView["range"];
const IDS: readonly RaceId[] = ["5k", "10k", "half", "marathon"];

function view(range: Range, opts: { offset?: number; sub?: string } = {}): RacePeriodView {
	return racePredictorView({ range, offset: opts.offset ?? 0, sub: opts.sub }, ROWS, { today: TODAY, complete: true, units: "metric" }) as RacePeriodView;
}
function plot(range: Range, opts: { offset?: number; sub?: string } = {}, width = PHONE): RacePlot {
	const v = view(range, opts);
	return racePlot(v.range, v.chart, width);
}
const line = (p: RacePlot, id: RaceId) => p.lines.find((l) => l.id === id)!;
/** The box's y on the 402 twin's page. */
const onPage = (y: number) => Math.round((y + PHONE_BOX_TOP) * 100) / 100;
const near = (got: number, want: number, tolerance: number, what: string) => assert.ok(Math.abs(got - want) <= tolerance, `${what}: ${got} vs ${want}`);
const nums = (text: string) => text.trim().split(/\s+/).map(Number);

/* ------------------------------------------------------------------ */
/*  The twin                                                           */
/* ------------------------------------------------------------------ */

/** The twin's gridline centres on the phone page. */
const TWIN_GRID: Record<Range, number[]> = {
	"4w": [254.97, 311.09, 367.21, 423.33],
	"6m": [253.67, 310.01, 366.35, 422.69],
	"1y": [266.67, 320.23, 373.79, 427.35],
};

/** The twin's Chart Marker instances: 16 pt frames centred on the value, top-left x, then each line's top-left y. */
const TWIN_MARKERS: Record<string, { x: number[]; y: Record<RaceId, number[]> }> = {
	// 535:124
	"4w": { x: [41.67, 361], y: { "5k": [247.85, 249.16], "10k": [287.09, 289.06], half: [334.49, 337.92], marathon: [406.5, 405.77] } },
	// 535:354
	"6m": {
		x: [46.67, 109.536, 172.402, 235.268, 298.134, 361],
		y: {
			"5k": [245.67, 256.7, 268.88, 274.97, 274.97, 275.35],
			"10k": [270.97, 282.58, 301.03, 309.21, 309.02, 309.97],
			half: [298.81, 320.18, 341.46, 351.02, 351.2, 352.37],
			marathon: [353.23, 378.84, 399.89, 414.68, 411.75, 411.25],
		},
	},
	// 535:609
	"1y": {
		x: [38, 67.334, 96.667, 126.001, 155.335, 184.668, 214.002, 243.335, 272.669, 302.003, 331.336, 360.67],
		y: {
			"5k": [258.67, 259.26, 262.22, 270.21, 274.64, 282.33, 287.95, 296.53, 306, 310.73, 310.73, 311.02],
			"10k": [275.38, 276.56, 281.15, 293.28, 296.24, 303.19, 307.62, 316.64, 330.99, 337.35, 337.2, 337.94],
			half: [294.56, 298.84, 308.02, 323.37, 323.23, 324.91, 329.26, 345.87, 362.42, 369.85, 369.99, 370.9],
			marathon: [326.91, 340.2, 352.29, 371.95, 366.52, 365.64, 371.57, 391.48, 407.84, 419.34, 417.06, 416.68],
		},
	},
	// 536:410, Aug 17 - Sep 13
	"4w-1": { x: [41.67, 361], y: { "5k": [246.97, 249.12], "10k": [286.93, 286.93], half: [333.15, 333.25], marathon: [400.51, 403.62] } },
	// 536:850, Nov 30, 2024 - Oct 31, 2025: the last three slots
	"1y-1": {
		x: [302.003, 331.336, 360.67],
		y: { "5k": [279.97, 274.64, 258.67], "10k": [308.96, 306.59, 287.95], half: [347.62, 342.86, 325.75], marathon: [419.34, 403.43, 387.23] },
	},
};

function matchesTwinMarkers(p: RacePlot, twin: { x: number[]; y: Record<RaceId, number[]> }, ids: readonly RaceId[] = IDS) {
	assert.deepEqual(p.lines.map((l) => l.id), [...ids]);
	for (const id of ids) {
		const markers = line(p, id).markers;
		assert.equal(markers.length, twin.x.length, id);
		markers.forEach((m, i) => {
			near(m.x, twin.x[i]! + 8, 0.011, `${id} ${i} x`);
			near(onPage(m.y), twin.y[id][i]! + 8, 0.011, `${id} ${i} y`);
		});
	}
}

describe("4w on the phone (twin 535:124)", () => {
	const p = plot("4w");

	it("rules four gridlines from the first day to the last: 254.97 … 423.33, x 49.67 to 369", () => {
		assert.deepEqual(p.grid.map((g) => onPage(g.y)), TWIN_GRID["4w"]);
		assert.ok(p.grid.every((g) => g.x1 === 49.67 && g.x2 === 369));
		assert.deepEqual(p.grid.map((g) => g.label), ["4:14", "4:40", "5:05", "5:31"]);
		assert.equal(p.labelRight, 34.29);
	});

	it("puts a day 11.827 pt apart and draws each line's shape at its ends only, where the twin's markers are", () => {
		const fiveK = line(p, "5k").points;
		assert.equal(fiveK.length, 28);
		fiveK.forEach((pt, d) => near(pt.x, 49.67 + 11.827 * d, 0.011, `day ${d}`));
		matchesTwinMarkers(p, TWIN_MARKERS["4w"]!);
	});

	it("draws the 5k line through the twin's own points: the top gridline on Oct 3", () => {
		// The twin's line 5k (535:132), its path's points on the page.
		const twin = nums("255.85 255.41 255.85 258.04 258.48 257.16 257.6 258.04 258.04 258.92 261.11 255.41 255.85 257.16 255.85 256.29 256.72 257.16 257.6 254.97 255.41 255.85 256.29 256.72 257.16 257.6 258.04 257.16");
		line(p, "5k").points.forEach((pt, d) => near(onPage(pt.y), twin[d]!, 0.011, `day ${d}`));
		assert.equal(line(p, "5k").line.split("L").length, 28);
		// The marathon touches the bottom one on Sep 24 (day 10).
		assert.equal(onPage(line(p, "marathon").points[10]!.y), 423.33);
	});

	it("marks the axis row 444: 28 dots, Ø 8.33 at the ends and 4.33 between, the ends labelled", () => {
		assert.equal(p.dots.length, 28);
		assert.deepEqual(p.dots.map((d) => d.r), [4.165, ...Array<number>(26).fill(2.165), 4.165]);
		assert.ok(p.dots.every((d) => onPage(d.y) === 451.01));
		assert.deepEqual(p.labels, [
			{ x: 49.67, y: 261.48, text: "09-14", rotated: false },
			{ x: 369, y: 261.48, text: "10-11", rotated: false },
		]);
		assert.equal(onPage(p.labels[0]!.y), 463.83);
	});

	it("ends at the legend: 288.32 pt under the title's foot, y 490.67", () => {
		assert.equal(p.height, 288.32);
		assert.equal(onPage(p.height), 490.67);
	});
});

describe("6m on the phone (twin 535:354)", () => {
	const p = plot("6m");

	it("rules 253.67 … 422.69 from x 54.67 to 369, labelled to x 39.03", () => {
		assert.deepEqual(p.grid.map((g) => onPage(g.y)), TWIN_GRID["6m"]);
		assert.ok(p.grid.every((g) => g.x1 === 54.67 && g.x2 === 369));
		assert.deepEqual(p.grid.map((g) => g.label), ["3:59", "4:29", "4:59", "5:28"]);
		assert.equal(p.labelRight, 39.03);
	});

	it("puts a slot 62.866 pt apart, a marker on every point, where the twin's are", () => {
		matchesTwinMarkers(p, TWIN_MARKERS["6m"]!);
	});

	it("labels every slot under an Ø 8.33 dot", () => {
		assert.deepEqual(p.dots.map((d) => d.x), [54.67, 117.54, 180.4, 243.27, 306.13, 369]);
		assert.ok(p.dots.every((d) => d.r === 4.165 && onPage(d.y) === 451.01));
		assert.deepEqual(p.labels.map((l) => [l.x, l.text]), [[54.67, "05-31"], [117.54, "06-30"], [180.4, "07-31"], [243.27, "08-31"], [306.13, "09-30"], [369, "10-11"]]);
		assert.ok(p.labels.every((l) => !l.rotated));
	});
});

describe("1y on the phone (twin 535:609)", () => {
	const p = plot("1y");

	it("rules 266.67 … 427.35 from x 46 to 368.67, labelled to x 30.2", () => {
		assert.deepEqual(p.grid.map((g) => onPage(g.y)), TWIN_GRID["1y"]);
		assert.ok(p.grid.every((g) => g.x1 === 46 && g.x2 === 368.67));
		assert.deepEqual(p.grid.map((g) => g.label), ["3:40", "4:16", "4:52", "5:28"]);
		assert.equal(p.labelRight, 30.2);
	});

	it("puts a slot 29.333 pt apart, a marker on every point, where the twin's are", () => {
		matchesTwinMarkers(p, TWIN_MARKERS["1y"]!);
	});

	it("stands its labels on end, centred 475.83 down and 0.67 left of their dots, 2 pt lower dots", () => {
		assert.equal(p.dots.length, 12);
		assert.ok(p.dots.every((d) => d.r === 4.165 && onPage(d.y) === 453.01));
		assert.ok(p.labels.every((l) => l.rotated && onPage(l.y) === 475.83));
		assert.deepEqual(p.labels.map((l) => l.x), [45.33, 74.66, 104, 133.33, 162.66, 192, 221.33, 250.67, 280, 309.33, 338.67, 368]);
		assert.equal(p.labels.map((l) => l.text).join(" "), "11-30 12-31 01-31 02-28 03-31 04-30 05-31 06-30 07-31 08-31 09-30 10-11");
	});

	it("ends at its legend, 20 pt lower: 308.32 pt, y 510.67", () => {
		assert.equal(onPage(p.height), 510.67);
	});
});

describe("the twin's Inferred frames", () => {
	it("4w −1, Aug 17 – Sep 13 (536:410)", () => {
		const p = plot("4w", { offset: -1 });
		assert.deepEqual(p.grid.map((g) => g.label), ["4:13", "4:39", "5:05", "5:31"]);
		matchesTwinMarkers(p, TWIN_MARKERS["4w-1"]!);
	});

	it("1y −1, Nov 30, 2024 – Oct 31, 2025 (536:850): the last three slots, the line from x 302 + 8", () => {
		const p = plot("1y", { offset: -1 });
		assert.deepEqual(p.grid.map((g) => g.label), ["3:39", "3:57", "4:15", "4:34"]);
		assert.equal(p.dots.length, 12);
		matchesTwinMarkers(p, TWIN_MARKERS["1y-1"]!);
		assert.ok(line(p, "5k").line.startsWith("M310 "));
	});

	it("Half off (536:648): no half line, everything else where it was", () => {
		const all = plot("4w");
		const off = plot("4w", { sub: "off:half" });
		const twin = TWIN_MARKERS["4w"]!;
		matchesTwinMarkers(off, { x: twin.x, y: twin.y }, ["5k", "10k", "marathon"]);
		assert.deepEqual(off.grid, all.grid);
		assert.deepEqual(line(off, "marathon"), line(all, "marathon"));
	});

	it("a period without a prediction: the bare box, no gridlines, no axis", () => {
		const empty = racePlot("1y", null, PHONE);
		assert.deepEqual([empty.grid, empty.dots, empty.labels, empty.lines], [[], [], [], []]);
		assert.deepEqual([empty.top, empty.baseline, empty.height], [64.32, 225, 308.32]);
	});
});

describe("in a pane's 748 pt column (twin 537:1353, 537:1498, 537:1655)", () => {
	it("4w keeps the phone's insets and heights and stretches the days to 24.642 pt: gridlines 81.67–747 on the page", () => {
		const p = plot("4w", {}, PANE_COLUMN);
		assert.ok(p.grid.every((g) => g.x1 + 32 === 81.67 && g.x2 + 32 === 747));
		line(p, "5k").points.forEach((pt, d) => near(pt.x, 49.67 + 24.642 * d, 0.011, `day ${d}`));
		assert.deepEqual(p.grid.map((g) => g.y), plot("4w").grid.map((g) => g.y));
		// The pane's markers (537:1363), from the chart frame at y 217.62 = the title's foot 173 + 44.62.
		const ends = line(p, "half").markers.map((m) => [m.x - 8, Math.round((m.y - 44.62 - 8) * 100) / 100]);
		assert.deepEqual(ends, [[41.67, 87.52], [707, 90.95]]);
		assert.deepEqual(p.labels.map((l) => l.x + 32), [81.67, 747]);
		// Its X Axis (537:1467): the second day's 4.33 pt dot at x 72.147 in the chart frame.
		near(p.dots[1]!.x - 2.165, 72.147, 0.01, "day 2");
	});

	it("ends each box at its axis labels' foot, the legend being beside it: the twin's chart frames end at y 442.65 and 466.65", () => {
		// 537:1450 (217.62 + 225.03) and 537:1786 (229.32 + 237.33), from the title's foot at 173.
		const end = (range: Range) => Math.round((173 + racePlot(range, view(range).chart, PANE_COLUMN, true).height) * 100) / 100;
		assert.deepEqual([end("4w"), end("6m"), end("1y")], [442.65, 442.65, 466.65]);
		assert.deepEqual([RACE_FRAMES["4w"].foot, RACE_FRAMES["1y"].foot], [269.65, 293.65]);
		// A phone's box runs on to the legend.
		assert.equal(racePlot("4w", view("4w").chart, PHONE).height, 288.32);
	});

	it("6m puts a slot 132.066 pt apart; 1y 60.788, its labels on end", () => {
		const six = plot("6m", {}, PANE_COLUMN);
		line(six, "5k").points.forEach((pt, i) => near(pt.x, 54.67 + 132.066 * i, 0.011, `slot ${i}`));
		assert.ok(six.grid.every((g) => g.x1 === 54.67 && g.x2 === 715));
		const year = plot("1y", {}, PANE_COLUMN);
		line(year, "5k").points.forEach((pt, i) => near(pt.x, 46 + 60.788 * i, 0.011, `slot ${i}`));
		assert.ok(year.grid.every((g) => g.x1 === 46 && g.x2 === 714.67));
		assert.ok(year.labels.every((l) => l.rotated));
	});
});

describe("markers", () => {
	it("are the Chart Marker's shapes: circle Ø 10, square 10, diamond 15, triangle 12 × 11.25 by its centroid", () => {
		assert.equal(markerPath("circle", 50, 100), "M45 100A5 5 0 1 0 55 100A5 5 0 1 0 45 100Z");
		assert.equal(markerPath("square", 50, 100), "M45 95H55V105H45Z");
		assert.equal(markerPath("diamond", 50, 100), "M50 92.5L57.5 100L50 107.5L42.5 100Z");
		assert.equal(markerPath("triangle", 50, 100), "M50 92.5L56 103.75H44Z");
		assert.deepEqual(MARKER, { circle: 5, square: 10, diamond: 15, triangle: { width: 12, height: 11.25 } });
		// The twin's triangle (534:236): its centroid two thirds down from the apex, on the value.
		const [apex, base] = [92.5, 103.75];
		assert.equal(apex + ((base - apex) * 2) / 3, 100);
	});

	it("take each distance's shape", () => {
		assert.deepEqual(plot("6m").lines.map((l) => l.shape), RACE_DISTANCES.map((d) => d.shape));
	});
});

/* ------------------------------------------------------------------ */
/*  Garmin's phone shots: the spec's ten pixel fits                    */
/* ------------------------------------------------------------------ */

/**
 * rp_pixels.py's readings off phone/{4w,6m,1y}/01-top.png (3 px a point):
 * the gridlines' centre rows, each line's colour centroid row at every
 * segment's midpoint (x between two points), and on 6m and 1y each marker's
 * centre from its colour's box (the triangle's two thirds down), in pixels.
 */
const MEASURED: Record<Range, { grid: string; midpoints: Record<RaceId, string>; markers?: Record<RaceId, string> }> = {
	"4w": {
		grid: "932.9 1101.0 1270.0 1438.0",
		midpoints: {
			"5k": "934.91 934.89 939.00 942.97 942.00 940.49 941.50 942.00 943.51 948.00 942.18 934.92 938.06 938.00 936.49 937.50 938.97 940.50 937.36 933.51 934.91 936.50 937.50 939.03 940.50 941.51 941.00",
			"10k": "1053.00 1053.97 1058.50 1063.49 1061.50 1058.97 1061.00 1062.49 1064.03 1068.00 1060.72 1052.00 1055.06 1054.50 1052.97 1055.00 1056.97 1058.50 1055.11 1052.03 1054.00 1057.06 1060.00 1062.03 1064.00 1065.00 1062.00",
			half: "1195.50 1197.48 1204.00 1208.97 1205.50 1202.49 1205.00 1206.00 1207.51 1213.50 1206.68 1197.00 1200.06 1200.00 1198.97 1201.00 1202.97 1205.00 1201.65 1198.03 1200.00 1203.06 1207.00 1209.51 1211.50 1213.51 1210.00",
			marathon: "1412.00 1415.39 1423.00 1428.48 1424.50 1420.48 1423.00 1424.49 1426.52 1433.00 1423.09 1409.50 1411.52 1411.00 1409.49 1411.00 1412.49 1413.50 1410.11 1406.51 1408.00 1409.50 1410.50 1411.51 1412.50 1413.51 1410.35",
		},
	},
	"6m": {
		grid: "929.0 1097.99 1267.0 1436.03",
		midpoints: {
			"5k": "945.48 979.99 1007.51 1017.00 1017.50",
			"10k": "1021.89 1067.00 1107.06 1118.99 1120.50",
			half: "1119.84 1183.99 1230.52 1245.50 1247.50",
			marathon: "1290.24 1360.49 1414.10 1431.50 1426.50",
		},
		markers: {
			"5k": "929.00 962.00 999.00 1017.00 1017.00 1018.00",
			"10k": "1005.67 1039.67 1095.67 1119.67 1119.67 1122.67",
			half: "1089.00 1152.00 1216.00 1245.00 1246.00 1249.00",
			marathon: "1252.50 1329.50 1392.50 1436.50 1427.50 1426.50",
		},
	},
	"1y": {
		grid: "968.0 1128.03 1288.99 1450.01",
		midpoints: {
			"5k": "968.50 973.50 990.00 1008.50 1027.00 1046.99 1068.00 1095.50 1116.99 1124.08 1124.50",
			"10k": "1019.50 1027.99 1053.00 1075.50 1090.50 1107.50 1127.50 1163.00 1194.50 1203.50 1204.00",
			half: "1081.50 1102.00 1139.00 1161.50 1163.50 1172.50 1204.00 1254.00 1290.00 1301.50 1303.00",
			marathon: "1192.00 1229.99 1277.50 1298.99 1289.50 1297.00 1336.00 1390.49 1432.50 1446.50 1442.50",
		},
		markers: {
			"5k": "968.00 969.00 978.00 1002.00 1015.00 1039.00 1056.00 1081.00 1110.00 1124.00 1124.00 1125.00",
			"10k": "1018.67 1021.67 1035.67 1071.67 1080.67 1101.67 1114.67 1141.67 1185.67 1204.67 1203.67 1205.67",
			half: "1075.00 1089.00 1116.00 1162.00 1161.00 1166.00 1179.00 1229.00 1279.00 1301.00 1303.00 1304.00",
			marathon: "1172.50 1212.50 1248.50 1307.50 1291.50 1288.50 1306.50 1366.50 1415.50 1450.50 1443.50 1442.50",
		},
	},
};

/**
 * The samplings the spec rejected, by month, Nov 2025 – Oct 2026 (6m is the
 * last six): each distance's mean, best and first day, in seconds, from the
 * daily rows (golden-race-predictor.py's `month_alt`).
 */
const ALTERNATIVES = `
2025-11 1097.4333 2304.8333 5138.3667 11220.0000 | 1096 2293 5109 11133 | 1096 2293 5109 11146
2025-12 1097.8710 2305.7742 5152.0000 11371.4516 | 1095 2295 5103 11109 | 1098 2309 5144 11211
2026-01 1106.5806 2347.7097 5318.2581 11871.7419 | 1099 2314 5202 11591 | 1099 2314 5202 11591
2026-02 1121.5357 2381.4643 5424.0357 12146.7500 | 1110 2344 5328 11912 | 1110 2350 5344 11953
2026-03 1142.4839 2447.0000 5591.9355 12525.3548 | 1133 2424 5536 12326 | 1138 2435 5570 12541
2026-04 1163.3667 2471.3000 5566.4333 12337.1667 | 1152 2451 5544 12244 | 1152 2451 5561 12363
2026-05 1173.2581 2487.2581 5552.1935 12281.8065 | 1160 2463 5494 12137 | 1160 2465 5514 12184
2026-06 1212.2000 2561.2000 5775.9333 12824.6333 | 1187 2514 5615 12433 | 1187 2514 5615 12433
2026-07 1234.5484 2624.0323 5968.1613 13193.5484 | 1201 2560 5807 12825 | 1227 2592 5892 13081
2026-08 1265.0968 2709.9032 6171.0968 13670.9355 | 1256 2678 6097 13484 | 1256 2678 6097 13484
2026-09 1275.2000 2732.1000 6229.0667 13851.8667 | 1268 2713 6176 13733 | 1279 2742 6256 13934
2026-10 1274.0000 2731.3636 6233.1818 13781.2727 | 1270 2720 6206 13752 | 1275 2730 6228 13794
`;

/** A pixel row of a shot as a y in the chart's box; a marker's centre is a continuous coordinate, half a pixel past its row's. */
const fromRow = (row: number) => row / 3 - 56 - PHONE_BOX_TOP;
const fromEdge = (y: number) => fromRow(y - 0.5);

const rms = (values: readonly number[]) => Math.sqrt(values.reduce((s, v) => s + v * v, 0) / values.length);

/** The least-squares line through (x, y), as the spec's fits draw it. */
function lineFit(xs: readonly number[], ys: readonly number[]): (x: number) => number {
	const n = xs.length;
	const mx = xs.reduce((a, b) => a + b, 0) / n;
	const my = ys.reduce((a, b) => a + b, 0) / n;
	const b = xs.reduce((s, x, i) => s + (x - mx) * (ys[i]! - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
	return (x) => my + b * (x - mx);
}

/** The residuals' rms about that line. */
function fitRms(xs: readonly number[], ys: readonly number[]): number {
	const fit = lineFit(xs, ys);
	return rms(ys.map((y, i) => y - fit(xs[i]!)));
}

const KM: Record<RaceId, number> = { "5k": 5, "10k": 10, half: 21.0975, marathon: 42.195 };

/** Each segment's midpoint: the measured y (box), our line's y there, and the two ends' mean pace and speed. */
function midpoints(range: Range) {
	const v = view(range);
	const p = racePlot(range, v.chart, PHONE);
	return IDS.flatMap((id) => {
		const ours = line(p, id).points;
		const values = v.chart!.lines.find((l) => l.id === id)!.points;
		return nums(MEASURED[range].midpoints[id]).map((row, i) => ({
			measured: fromRow(row),
			ours: (ours[i]!.y + ours[i + 1]!.y) / 2,
			pace: (values[i]!.value + values[i + 1]!.value) / 2,
			speed: ((KM[id] * 1000) / values[i]!.seconds + (KM[id] * 1000) / values[i + 1]!.seconds) / 2,
		}));
	});
}

describe("Garmin's phone shots: the spec's pixel fits", () => {
	for (const [range, count] of [["4w", 108], ["6m", 20], ["1y", 44]] as const) {
		it(`${range}: our lines run through the shot's at all ${count} segment midpoints, linear in pace, not in speed`, () => {
			const m = midpoints(range);
			assert.equal(m.length, count);
			const off = m.map((s) => s.measured - s.ours);
			// 0.12, 0.10 and 0.19 pt on the capture day: a fraction of a pixel.
			assert.ok(rms(off) < 0.25, `rms ${rms(off).toFixed(3)} pt`);
			assert.ok(Math.max(...off.map(Math.abs)) < 0.6, `max ${Math.max(...off.map(Math.abs)).toFixed(3)} pt`);
			// The spec's test: the best line in pace fits to a fraction of a pixel, the best in speed by pixels.
			const pace = fitRms(m.map((s) => s.pace), m.map((s) => s.measured));
			const speed = fitRms(m.map((s) => s.speed), m.map((s) => s.measured));
			assert.ok(pace < 0.5 / 3 && speed > 10 * pace, `pace ${pace.toFixed(3)} pt, speed ${speed.toFixed(3)} pt`);
		});

		it(`${range}: the shot's top and bottom gridlines are ours, the fastest point on the one and the slowest on the other`, () => {
			const p = plot(range);
			const shot = nums(MEASURED[range].grid).map(fromRow);
			near(p.grid[0]!.y, shot[0]!, 0.02, "top");
			near(p.grid[3]!.y, shot[3]!, 0.02, "bottom");
			// Garmin snaps its 1 pt lines to the 3x pixel grid: the middle two sit within a quarter point of the thirds.
			near(p.grid[1]!.y, shot[1]!, 0.25, "second");
			near(p.grid[2]!.y, shot[2]!, 0.25, "third");
			const ys = p.lines.flatMap((l) => l.points.map((pt) => pt.y));
			assert.deepEqual([Math.min(...ys), Math.max(...ys)], [p.top, p.baseline]);
		});
	}

	for (const [range, months] of [["6m", 6], ["1y", 12]] as const) {
		it(`${range}: each month's end (today for this one) beats its mean, its best and its first day`, () => {
			const m = midpoints(range);
			const ours = fitRms(m.map((s) => s.pace), m.map((s) => s.measured));
			const table = ALTERNATIVES.trim().split("\n").slice(-months).map((row) => row.slice(8).split("|").map(nums));
			for (const [k, name] of ["mean", "best", "first"].entries()) {
				const paces = IDS.flatMap((id, d) => table.slice(1).map((month, i) => (table[i]![k]![d]! + month[k]![d]!) / 2 / KM[id]));
				const alternative = fitRms(paces, m.map((s) => s.measured));
				assert.ok(alternative > 3 * ours, `${name}: ${alternative.toFixed(3)} pt vs ${ours.toFixed(3)}`);
			}
		});

		it(`${range}: all ${months * 4} markers sit on their values, the triangle by its centroid`, () => {
			// The spec's check: each marker's centre on the shot's own best line in pace, within a third of a point.
			const m = midpoints(range);
			const fit = lineFit(m.map((s) => s.pace), m.map((s) => s.measured));
			const v = view(range);
			const p = plot(range);
			for (const id of IDS) {
				const values = v.chart!.lines.find((l) => l.id === id)!.points;
				nums(MEASURED[range].markers![id]).forEach((y, i) => {
					near(fromEdge(y), fit(values[i]!.value), 0.35, `${id} ${i} on the shot's line`);
					// Ours are on our points, which are the twin's; Garmin's 1y markers ride 0.2 pt above its lines.
					near(line(p, id).markers[i]!.y, fromEdge(y), 0.5, `${id} ${i} against ours`);
				});
			}
		});
	}
});
