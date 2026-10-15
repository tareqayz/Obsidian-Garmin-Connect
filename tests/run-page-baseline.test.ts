import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { Units } from "../src/dashboard/activities";
import {
	availableMetrics,
	chartSub,
	chartsTabView,
	expandedChartView,
	type ChartCard,
	type ExpandedChartId,
} from "../src/dashboard/activity-chart-pages";
import { expandedPlot, runWalkPlot, seriesPlot, trainingEffectScales, zoneBars } from "../src/dashboard/activity-charts";
import { sportTitle } from "../src/dashboard/activity-labels";
import { lapMarkers, mapLegend, mapOverlays, overlayFor, routeBounds, routeEnds, routePoints, routeRuns } from "../src/dashboard/activity-map";
import { overviewView, weatherChip } from "../src/dashboard/activity-overview";
import { columnStarts, gearView, lapsView, sectionHeight, statsView, type LapsView } from "../src/dashboard/activity-stats-pages";
import { HEART_CHARTS, MAP_OVERLAYS, PACE_CHARTS, POWER_CHARTS } from "../src/dashboard/routes";
import { PHONE } from "../src/dashboard/stat-charts";
import type { ActivityDetail } from "../src/sync/activity-detail";
import { outdoorRun, TODAY, treadmillRun } from "./activity-run-fixture";

/**
 * The run page, held still while the page learns other sports: every view
 * model and every plot the run page draws, for the outdoor and the treadmill
 * run (`activity-run-fixture.ts`), in both units, on both axes, for every
 * picker choice and expanded chart. The sport profiles (cycling, swimming,
 * the basic page) must leave all of it exactly as it was.
 *
 * Laps are compared as the table the page shows (header and cells), so the
 * view model's shape can change as long as the table does not.
 *
 * The views a reader can check by eye (overview, stats, laps, the map, each
 * axis's default charts) are held in full; the combinations (every picker
 * choice, every plot, every expanded chart) as a SHA-256 of their JSON, which
 * keeps the fixture small. When a hashed view moves, write both sides out and
 * diff them: `DUMP_RUN_BASELINE=<dir> npm test` here and at the commit that
 * recorded the baseline.
 *
 * Record a new baseline only for a change to the run page itself:
 * `UPDATE_RUN_BASELINE=1 npm test`.
 */

const FIXTURE = "tests/fixtures/run-page-baseline.json";
/** A pane's card: three columns of 370 in the 1190 layout. */
const PANE = 370;
const UNITS: readonly Units[] = ["metric", "imperial"];
const AXES = ["time", "distance"] as const;

/** The Laps tab as its reader sees it: header cells, then each row's cells. */
function lapsTable(view: LapsView): { header: string[]; rows: string[][] } {
	return {
		header: view.columns.map((c) => (c.unit ? `${c.label} (${c.unit})` : c.label)),
		rows: view.rows.map((r) => r.cells),
	};
}

/** What each card draws, at the phone's width and a pane card's. */
function plotsOf(card: ChartCard): unknown {
	switch (card.kind) {
		case "series":
			return { phone: seriesPlot(card, PHONE, "phone"), pane: seriesPlot(card, PANE, "pane") };
		case "run-walk":
			return { phone: runWalkPlot(card, PHONE, "phone"), pane: runWalkPlot(card, PANE, "pane") };
		case "training-effect":
			return { phone: trainingEffectScales(card, PHONE), pane: trainingEffectScales(card, PANE) };
		case "zones":
			return { phone: zoneBars(card, PHONE), pane: zoneBars(card, PANE) };
		case "custom":
			return card.data;
	}
}

function expanded(detail: ActivityDetail, axis: (typeof AXES)[number], sub: string, units: Units): unknown {
	const view = expandedChartView(detail, { axis, sub }, units);
	return view ? { view, landscape: expandedPlot(view, 874, 402), pane: expandedPlot(view, 1190, 640) } : null;
}

function snapshot(): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	const runs: Array<[string, ActivityDetail]> = [
		["outdoor", outdoorRun()],
		["treadmill", treadmillRun()],
	];
	for (const [name, detail] of runs) {
		out[`${name}/title`] = sportTitle(detail.type);
		out[`${name}/gear`] = gearView(detail);
		const points = routePoints(detail);
		out[`${name}/map`] = {
			points,
			bounds: routeBounds(points),
			ends: routeEnds(points),
			laps: lapMarkers(detail),
			overlays: mapOverlays(detail),
			overlayFor: MAP_OVERLAYS.map((o) => overlayFor(detail, o)),
			runs: Object.fromEntries(MAP_OVERLAYS.map((o) => [o, routeRuns(detail, o)])),
			legends: Object.fromEntries(MAP_OVERLAYS.map((o) => [o, mapLegend(o)])),
		};
		const bases: ExpandedChartId[] = [...availableMetrics(detail), "run-walk", "training-effect"];
		for (const units of UNITS) {
			const key = `${name}/${units}`;
			out[`${key}/overview`] = overviewView(detail, units, TODAY);
			out[`${key}/weather`] = weatherChip(detail, units);
			const sections = statsView(detail, units);
			out[`${key}/stats`] = sections;
			out[`${key}/stats-layout`] = { heights: sections.map(sectionHeight), two: columnStarts(sections, 2), three: columnStarts(sections, 3) };
			out[`${key}/laps`] = lapsTable(lapsView(detail, units));
			for (const axis of AXES) {
				for (const pace of PACE_CHARTS) {
					for (const heart of HEART_CHARTS) {
						for (const power of POWER_CHARTS) {
							out[`${key}/charts/${axis}/${pace}/${heart}/${power}`] = chartsTabView(detail, { axis, picks: { pace, heart, power } }, units);
						}
					}
				}
				out[`${key}/plots/${axis}`] = chartsTabView(detail, { axis }, units).cards.map((card) => [card.id, plotsOf(card)]);
				for (const base of bases) out[`${key}/expanded/${axis}/${base}`] = expanded(detail, axis, chartSub({ base, overlay: null, swapped: false }), units);
			}
		}
		// Every overlay over one base, both ways round; one overlay on the distance axis.
		for (const overlay of availableMetrics(detail)) {
			if (overlay === "heart-rate") continue;
			for (const swapped of [false, true]) {
				out[`${name}/metric/expanded/time/heart-rate+${overlay}${swapped ? "/swap" : ""}`] = expanded(
					detail,
					"time",
					chartSub({ base: "heart-rate", overlay, swapped }),
					"metric",
				);
			}
		}
		out[`${name}/metric/expanded/distance/pace+heart-rate`] = expanded(detail, "distance", chartSub({ base: "pace", overlay: "heart-rate", swapped: false }), "metric");
	}
	return JSON.parse(JSON.stringify(out)) as Record<string, unknown>;
}

/** The default picks, held in full: the tab as it first opens. */
const DEFAULT_CHARTS = new RegExp(`/charts/(${AXES.join("|")})/${PACE_CHARTS[0]}/${HEART_CHARTS[0]}/${POWER_CHARTS[0]}$`);
const HASHED = /\/(charts|plots|expanded)\//;

interface Hashed {
	sha256: string;
}

const sha256 = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** What the fixture keeps for a view: the view, or its hash. */
function held(key: string, value: unknown): unknown {
	return HASHED.test(key) && !DEFAULT_CHARTS.test(key) ? ({ sha256: sha256(value) } satisfies Hashed) : value;
}

/** One key per line, each value on its line: a changed view reads as a changed line. */
function serialize(values: Record<string, unknown>): string {
	const lines = Object.entries(values).map(([key, value]) => `\t${JSON.stringify(key)}: ${JSON.stringify(held(key, value))}`);
	return `{\n${lines.join(",\n")}\n}\n`;
}

describe("the run page baseline", () => {
	it("draws both runs exactly as before", () => {
		const now = snapshot();
		const dump = process.env.DUMP_RUN_BASELINE;
		if (dump) {
			mkdirSync(dump, { recursive: true });
			for (const [key, value] of Object.entries(now)) writeFileSync(`${dump}/${key.replace(/[^\w.+-]+/g, "_")}.json`, `${JSON.stringify(value, null, "\t")}\n`);
		}
		if (process.env.UPDATE_RUN_BASELINE) {
			mkdirSync("tests/fixtures", { recursive: true });
			writeFileSync(FIXTURE, serialize(now));
		}
		assert.ok(existsSync(FIXTURE), `${FIXTURE} is missing: run UPDATE_RUN_BASELINE=1 npm test`);
		const baseline = JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, unknown>;
		assert.deepEqual(Object.keys(now), Object.keys(baseline), "the snapshot's views changed: the baseline covers the same views as before");
		for (const [key, was] of Object.entries(baseline)) assert.deepEqual(held(key, now[key]), was, `${key} changed (DUMP_RUN_BASELINE=<dir> writes it out)`);
	});
});
