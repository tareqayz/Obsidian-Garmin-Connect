import { batteryDayView, batteryPeriodView, type BatteryDayView, type BatteryPeriodView } from "../dashboard/body-battery-pages";
import { unitsOf } from "../dashboard/day";
import { heartRateDayView, heartRatePeriodView, type HeartRateDayView, type HeartRatePeriodView } from "../dashboard/heart-rate-pages";
import { hrvStatusView, type HrvDayView, type HrvPeriodView } from "../dashboard/hrv-status-pages";
import { daysBetween, daysOf, offsetOfDay, PERIOD_DAYS, periodLabel, yearLabel, type PeriodRoute, type Span } from "../dashboard/periods";
import { pulseOxDayView, pulseOxPeriodView, type PulseOxDayView, type PulseOxPeriodView } from "../dashboard/pulse-ox-pages";
import { respirationDayView, respirationPeriodView, type RespirationDayView, type RespirationPeriodView } from "../dashboard/respiration-pages";
import type { HealthStatPageId } from "../dashboard/health-stats";
import { healthStatRoute, performanceStatRoute, type Route } from "../dashboard/routes";
import { shiftDate, type DayRow } from "../dashboard/series";
import { sleepDayView, sleepPeriodView, type SleepDayView, type SleepPeriodView } from "../dashboard/sleep-pages";
import { seriesDays, statsView, type StatId, type StatsView } from "../dashboard/stats-pages";
import { stressDayView, stressPeriodView, type StressDayView, type StressPeriodView } from "../dashboard/stress-pages";
import { massOf, massText, unitOf, weightDayView, weightPeriodView, type WeightDayView, type WeightPeriodView } from "../dashboard/weight-pages";
import type { BatteryRow } from "../sync/body-battery-index";
import type { DailyStatsRow } from "../sync/daily-stats";
import type { DayIndexData, DayRow as IndexRow } from "../sync/day-index";
import { HEART_DAY_KEY, heartDayIn, heartDayOfSeries, type HeartRateRow } from "../sync/heart-rate-index";
import { hrvNightIn, type HrvStatusRow } from "../sync/hrv-status-index";
import type { DaySeries } from "../sync/intraday";
import { hasBlock } from "../sync/intraday-registry";
import { SPO2_DAY_KEY, spo2DayIn, type PulseOxRow } from "../sync/pulse-ox-index";
import { RESPIRATION_DAY_KEY, respirationDayIn, type RespirationRow } from "../sync/respiration-index";
import type { ActivityIndex } from "../sync/series-store";
import type { SleepRow } from "../sync/sleep-index";
import { STRESS_DAY_KEY, stressDayIn, stressDayOfSeries, type StressRow } from "../sync/stress-index";
import type { WeightRow } from "../sync/weight-index";
import type { ChartEntry, ChartId, ChartRange } from "./charts";
import { onDay } from "./status";
import type { CardFigure } from "./view";

/**
 * A stat page's chart for a card in a note: the page's own view, built by
 * the page's own builder from what the vault holds, and the card's figures.
 *
 * A day's chart is the page's on that day, `today` the real one. A trend
 * ends on the block's day: the builders roll their periods back from
 * `today`, so they get the block's day as theirs. Where a page loads a day's
 * readings on view, the card reads the series file as it is and never
 * fetches; Stress, Body Battery and Heart Rate fall back to the plain points
 * the sync keeps for every day inside Day details.
 *
 * The reads come in (`ChartInputs`), so the tests feed them.
 */

/** A trend for a small card: the period's values oldest first, drawn as a line, bars or dots, and its figure. */
export interface TrendLine {
	kind: "line" | "bars" | "dots";
	values: Array<number | null>;
	/** A CSS colour. */
	color: string;
	value: string;
	label: string;
}

/** The page's chart a card draws, by the page's own view. `ChartBody.svelte` draws each. */
export type ChartModel =
	| { chart: "sleep-day"; view: SleepDayView }
	| { chart: "sleep-period"; view: SleepPeriodView }
	| { chart: "stats"; view: StatsView }
	| { chart: "stress-day"; view: StressDayView }
	| { chart: "stress-period"; view: StressPeriodView }
	| { chart: "battery-day"; view: BatteryDayView }
	| { chart: "battery-period"; view: BatteryPeriodView }
	| { chart: "heart-day"; view: HeartRateDayView; today: boolean }
	| { chart: "heart-period"; view: HeartRatePeriodView }
	| { chart: "respiration-day"; view: RespirationDayView }
	| { chart: "respiration-period"; view: RespirationPeriodView }
	| { chart: "spo2-day"; view: PulseOxDayView }
	| { chart: "spo2-period"; view: PulseOxPeriodView }
	| { chart: "hrv-day"; view: HrvDayView }
	| { chart: "hrv-period"; view: HrvPeriodView }
	| { chart: "weight-day"; view: WeightDayView }
	| { chart: "weight-period"; view: WeightPeriodView };

/** What a chart reads, all from the vault (`CardData`). */
export interface ChartInputs {
	index<R extends IndexRow = IndexRow>(kind: string): Promise<DayIndexData<R>>;
	series(date: string): Promise<DaySeries | null>;
	days(): Promise<DayRow[]>;
	activities(): Promise<ActivityIndex>;
}

/** A chart's card, short of its stat's name and icon. */
export interface ChartBuild {
	/** The page's chart, or null with why there is none. */
	model: ChartModel | null;
	none?: string;
	/** The big figure and the figures beside it. */
	value?: string;
	figures: CardFigure[];
	/** A trend's line for its small card. */
	trend?: TrendLine;
	/** A trend's period, as its page words it. */
	period?: string;
	route: Route;
}

type Trend = Exclude<ChartRange, "1d">;

const STAT_OF: Partial<Record<ChartId, StatId>> = { steps: "steps", floors: "floors", "intensity-minutes": "intensity" };

const GROUPED = new Intl.NumberFormat("en-US");

/** A chart for `day`: its day's, or the trend ending on it. `today` is the real one. */
export async function buildChart(entry: ChartEntry, range: ChartRange, day: string, today: string, read: ChartInputs): Promise<ChartBuild> {
	const route = routeOf(entry.id, range, day, today);
	const stat = STAT_OF[entry.id];
	if (stat) return { ...(await statsChart(stat, range, day, today, read)), route };
	switch (entry.id) {
		case "sleep":
			return { ...(await sleepChart(range, day, today, read)), route };
		case "stress":
			return { ...(await stressChart(range, day, today, read)), route };
		case "body-battery":
			return { ...(await batteryChart(range, day, today, read)), route };
		case "heart-rate":
			return { ...(await heartChart(range, day, today, read)), route };
		case "respiration":
			return { ...(await respirationChart(range, day, today, read)), route };
		case "pulse-ox":
			return { ...(await spo2Chart(range, day, today, read)), route };
		case "hrv-status":
			return { ...(await hrvChart(range, day, today, read)), route };
		default:
			return { ...(await weightChart(range, day, today, read)), route };
	}
}

type Built = Omit<ChartBuild, "route">;

/* ------------------------------------------------------------------ */

async function sleepChart(range: ChartRange, day: string, today: string, read: ChartInputs): Promise<Built> {
	const index = await read.index<SleepRow>("sleep");
	const data = { rows: index.rows, complete: index.meta?.complete === true, units: await unitsFor(read) };
	if (range === "1d") {
		const series = await read.series(day);
		const view = sleepDayView({ data, route: { range: "1d", offset: offsetOfDay(day, today), tab: "score" }, today, series });
		if (view.state === "empty") return { model: null, none: `No sleep recorded ${onDay(day, today)}.`, figures: [] };
		const figures = view.stats.map(statFigure);
		if (!view.timeline) return { model: null, none: "This night’s stages aren’t in your vault.", value: view.score, figures };
		return { model: { chart: "sleep-day", view }, value: view.score, figures };
	}
	const view = sleepPeriodView({ data, route: { range, offset: 0, tab: "score" }, today: day });
	const span = spanEnding(range, day);
	const scores = view.range === "1y" ? view.scoreStats : view.averages;
	const trend = trendOf(index.rows, (r) => r.score, range, day);
	return {
		model: trend.some((v) => v !== null) ? { chart: "sleep-period", view } : null,
		...noneFor(trend, span, range, today),
		figures: [scores[0], view.duration.stats[0]].filter((s) => s !== undefined).map(statFigure),
		trend: line("line", trend, "var(--color-purple)", (v) => String(Math.round(v)), "Avg score"),
		period: labelOf(range, span, today),
	};
}

async function statsChart(stat: StatId, range: ChartRange, day: string, today: string, read: ChartInputs): Promise<Built> {
	const [index, days] = await Promise.all([read.index<DailyStatsRow>("daily-stats"), read.days()]);
	const calories: Record<string, number> = {};
	for (const row of days) {
		const kcal = row.values.calories;
		if (typeof kcal === "number" && Number.isFinite(kcal)) calories[row.date] = kcal;
	}
	// A trend ends on its day: a later day's row would count in its calendar weeks and months.
	const rows = range === "1d" ? index.rows : index.rows.filter((r) => r.date <= day);
	const data = { rows, complete: index.meta?.complete === true, units: await unitsFor(read), weekStart: 1, calories };
	const route = { stat, range, offset: range === "1d" ? offsetOfDay(day, today) : 0, totals: "monthly" as const };
	const viewToday = range === "1d" ? today : day;
	const wanted = seriesDays(route, viewToday, data.weekStart);
	const series = new Map(await Promise.all(wanted.map(async (d) => [d, await read.series(d)] as const)));
	const view = statsView({ data, route, today: viewToday, series });
	// The ring's figure, big, and its goal; then the page's figures, but the ring's again.
	const value = view.ring?.value;
	const figures: CardFigure[] = view.ring?.goal ? [{ value: view.ring.goal, label: "Goal" }] : [];
	for (const s of view.stats) if (figures.length < 2 && s.value !== value) figures.push({ value: s.value, label: s.label });
	if (range === "1d") {
		const has = rows.some((r) => r.date === day);
		return has ? { model: { chart: "stats", view }, value, figures } : { model: null, none: `Nothing recorded ${onDay(day, today)}.`, figures: [] };
	}
	const pick = stat === "steps" ? (r: DailyStatsRow) => r.steps : stat === "floors" ? (r: DailyStatsRow) => r.floorsUp : (r: DailyStatsRow) => minutesOf(r);
	const trend = trendOf(rows, pick, range, day, stat === "intensity" ? "sum" : "mean");
	const span = spanEnding(range, day);
	const total = trend.reduce<number>((sum, v) => sum + (v ?? 0), 0);
	return {
		model: trend.some((v) => v !== null) ? { chart: "stats", view } : null,
		...noneFor(trend, span, range, today),
		value,
		figures,
		trend:
			stat === "intensity"
				? { kind: "bars", values: trend, color: "var(--color-orange)", value: GROUPED.format(Math.round(total)), label: "Total minutes" }
				: line("bars", trend, stat === "steps" ? "var(--color-blue)" : "var(--color-cyan)", (v) => GROUPED.format(Math.round(v)), "Avg a day"),
		period: view.label,
	};
}

async function stressChart(range: ChartRange, day: string, today: string, read: ChartInputs): Promise<Built> {
	const index = await read.index<StressRow>("stress");
	const data = { rows: index.rows, complete: index.meta?.complete ?? false };
	if (range === "1d") {
		const [series, sleep] = await Promise.all([read.series(day), read.index<SleepRow>("sleep")]);
		const readings = stressDayIn(series) ?? stressDayOfSeries(series, day === today);
		const view = stressDayView({ data, route: dayRoute(day, today), today, readings: readings ?? null, wake: sleep.rows.find((r) => r.date === day)?.wake });
		const tiles = view.tiles.filter((t) => t.part === "rest" || t.part === "high");
		const figures = tiles.map((t) => ({ value: t.value, label: t.label }));
		if (!readings) return { model: null, none: missing(series, STRESS_DAY_KEY, "stress", "Stress", day, today), value: view.value, figures };
		return { model: { chart: "stress-day", view }, value: view.value, figures };
	}
	const view = stressPeriodView({ data, route: { range, offset: 0 }, today: day });
	const trend = trendOf(index.rows, (r) => r.level, range, day);
	const span = { from: view.from, to: view.to };
	return {
		model: trend.some((v) => v !== null) ? { chart: "stress-period", view } : null,
		...noneFor(trend, span, range, today),
		figures: view.stats.slice(0, 1).map((s) => ({ value: s.value, label: s.label })),
		trend: line("line", trend, "var(--color-orange)", (v) => String(Math.round(v)), "Avg stress"),
		period: labelOf(range, span, today),
	};
}

async function batteryChart(range: ChartRange, day: string, today: string, read: ChartInputs): Promise<Built> {
	const index = await read.index<BatteryRow>("body-battery");
	const data = { rows: index.rows, complete: index.meta?.complete ?? false };
	if (range === "1d") {
		const [series, sleep] = await Promise.all([read.series(day), read.index<SleepRow>("sleep")]);
		const readings = stressDayIn(series) ?? stressDayOfSeries(series, day === today);
		const night = sleep.rows.find((r) => r.date === day);
		const view = batteryDayView({
			data,
			route: dayRoute(day, today),
			today,
			readings: readings ?? null,
			events: series?.bodyBatteryEvents ?? [],
			sleep: night ? { seconds: night.seconds, wake: night.wake } : null,
		});
		const tiles = view.tiles.map((t) => ({ value: t.value, label: t.label }));
		const value = view.gauge?.value;
		const figures = view.ring ? [{ value: view.ring.high, label: "High" }, { value: view.ring.low, label: "Low" }, ...tiles] : tiles;
		if (!readings?.battery) return { model: null, none: missing(series, STRESS_DAY_KEY, "Body Battery", "Body Battery", day, today), value, figures };
		return { model: { chart: "battery-day", view }, value, figures };
	}
	const view = batteryPeriodView({ data, route: { range, offset: 0 }, today: day });
	const trend = trendOf(index.rows, (r) => r.high, range, day);
	const span = { from: view.from, to: view.to };
	const avg = (n: number | undefined) => (n === undefined ? "--" : String(Math.round(n)));
	return {
		model: trend.some((v) => v !== null) ? { chart: "battery-period", view } : null,
		...noneFor(trend, span, range, today),
		figures: [
			{ value: avg(view.averages.high), label: "Avg High" },
			{ value: avg(view.averages.low), label: "Avg Low" },
		],
		trend: line("line", trend, "var(--color-blue)", (v) => String(Math.round(v)), "Avg high"),
		period: labelOf(range, span, today),
	};
}

async function heartChart(range: ChartRange, day: string, today: string, read: ChartInputs): Promise<Built> {
	const index = await read.index<HeartRateRow>("heart-rate");
	const data = { rows: index.rows, complete: index.meta?.complete ?? false };
	const figure = (s: { value: string; unit?: string; label: string }) => ({ value: s.unit ? `${s.value} ${s.unit}` : s.value, label: s.label });
	if (range === "1d") {
		const [series, sleep] = await Promise.all([read.series(day), read.index<SleepRow>("sleep")]);
		const samples = heartDayIn(series) ?? heartDayOfSeries(series, day === today);
		const view = heartRateDayView({ data, route: dayRoute(day, today), today, samples: samples ?? null, wake: sleep.rows.find((r) => r.date === day)?.wake });
		const figures = view.stats.map(figure);
		if (!samples) return { model: null, none: missing(series, HEART_DAY_KEY, "heart rate", "Heart Rate", day, today), figures };
		return { model: { chart: "heart-day", view, today: day === today }, figures };
	}
	// A past day counts whole: the phone leaves out only today, which is still going.
	const view = heartRatePeriodView({ data, route: { range, offset: 0 }, today: day, includeToday: day < today });
	const trend = trendOf(index.rows, (r) => r.resting, range, day);
	const span = { from: view.from, to: view.to };
	return {
		model: trend.some((v) => v !== null) ? { chart: "heart-period", view } : null,
		...noneFor(trend, span, range, today),
		figures: view.stats.map(figure),
		trend: line("line", trend, "var(--color-blue)", (v) => `${Math.round(v)} bpm`, "Avg resting"),
		period: labelOf(range, span, today),
	};
}

async function respirationChart(range: ChartRange, day: string, today: string, read: ChartInputs): Promise<Built> {
	const index = await read.index<RespirationRow>("respiration");
	const data = { rows: index.rows, complete: index.meta?.complete ?? false };
	const figure = (s: { value: string; unit?: string; label: string }) => ({ value: s.unit ? `${s.value} ${s.unit}` : s.value, label: s.label });
	if (range === "1d") {
		const series = await read.series(day);
		const reading = respirationDayIn(series);
		const view = respirationDayView({ data, route: dayRoute(day, today), today, day: reading });
		const figures = view.stats.filter((s) => s.value !== "--").map(figure);
		if (!reading) return { model: null, none: missing(series, RESPIRATION_DAY_KEY, "respiration", "Respiration", day, today), figures };
		return { model: { chart: "respiration-day", view }, figures };
	}
	const view = respirationPeriodView({ data, route: { range, offset: 0 }, today: day });
	const trend = trendOf(index.rows, (r) => r.sleep, range, day);
	const span = { from: view.from, to: view.to };
	return {
		model: trend.some((v) => v !== null) || view.points.length ? { chart: "respiration-period", view } : null,
		...noneFor(trend, span, range, today),
		figures: view.stats.map(figure),
		trend: line("line", trend, "var(--color-cyan)", (v) => `${Math.round(v)} brpm`, "Avg asleep"),
		period: labelOf(range, span, today),
	};
}

async function spo2Chart(range: ChartRange, day: string, today: string, read: ChartInputs): Promise<Built> {
	const index = await read.index<PulseOxRow>("pulse-ox");
	const data = { rows: index.rows, complete: index.meta?.complete ?? false };
	if (range === "1d") {
		const series = await read.series(day);
		const reading = spo2DayIn(series);
		const view = pulseOxDayView({ data, route: dayRoute(day, today), today, day: reading });
		const value = view.gauge !== undefined ? `${view.gauge}%` : undefined;
		const figures = view.figures.filter((f) => f.value !== "--").slice(0, 2);
		if (view.state !== "drawn") {
			const none = reading ? `No Pulse Ox readings ${onDay(day, today)}.` : missing(series, SPO2_DAY_KEY, "Pulse Ox", "Pulse Ox", day, today);
			return { model: null, none, value, figures };
		}
		return { model: { chart: "spo2-day", view }, value, figures };
	}
	const view = pulseOxPeriodView({ data, route: { range, offset: 0 }, today: day });
	const trend = trendOf(index.rows, (r) => r.avg, range, day);
	const span = { from: view.from, to: view.to };
	return {
		model: view.points.length ? { chart: "spo2-period", view } : null,
		...noneFor(trend, span, range, today),
		figures: view.figures,
		trend: line("line", trend, "var(--color-green)", (v) => `${Math.round(v)}%`, "Avg"),
		period: labelOf(range, span, today),
	};
}

async function hrvChart(range: ChartRange, day: string, today: string, read: ChartInputs): Promise<Built> {
	const index = await read.index<HrvStatusRow>("hrv-status");
	const ctx = { complete: index.meta?.complete ?? false };
	if (range === "1d") {
		const series = await read.series(day);
		const view = hrvStatusView({ range: "1d", offset: offsetOfDay(day, today) }, index.rows, { ...ctx, today, night: hrvNightIn(series) }) as HrvDayView;
		const figures = view.figures.map((f) => ({ value: f.unit ? `${f.value} ${f.unit}` : f.value, label: f.label }));
		const value = view.dial ? `${view.dial.gauge.value}${view.dial.unit ? ` ${view.dial.unit}` : ""}` : undefined;
		if (view.status) figures.unshift({ value: view.status.word, label: "Status" });
		if (!view.timeline) return { model: null, none: `No overnight HRV readings ${onDay(day, today)}.`, value, figures: figures.slice(0, 2) };
		return { model: { chart: "hrv-day", view }, value, figures: figures.slice(0, 2) };
	}
	const view = hrvStatusView({ range, offset: 0 }, index.rows, { ...ctx, today: day, night: null }) as HrvPeriodView;
	const trend = trendOf(index.rows, (r) => r.night, range, day);
	const span = { from: view.from, to: view.to };
	// Garmin's own figure for the period's last night: its 7-day average and status.
	const last = view.days.find((d) => d.date === day);
	const figures = last ? [{ value: last.weekly.unit ? `${last.weekly.value} ${last.weekly.unit}` : last.weekly.value, label: "7d Avg" }, ...(last.look ? [{ value: last.look.word, label: "Status" }] : [])] : [];
	return {
		model: view.chart ? { chart: "hrv-period", view } : null,
		...noneFor(trend, span, range, today),
		figures,
		trend: line("dots", trend, "var(--color-green)", (v) => `${Math.round(v)} ms`, "Avg overnight"),
		period: labelOf(range, span, today),
	};
}

async function weightChart(range: ChartRange, day: string, today: string, read: ChartInputs): Promise<Built> {
	const index = await read.index<WeightRow>("weight");
	const data = { rows: index.rows, complete: index.meta?.complete ?? false };
	const units = await unitsFor(read);
	if (range === "1d") {
		const view = weightDayView({ data, route: dayRoute(day, today), today, units });
		if (!view.weighIns.length) return { model: null, none: `No weigh-ins ${onDay(day, today)}.`, figures: [] };
		return { model: { chart: "weight-day", view }, value: `${view.hero} ${view.unit}`, figures: [] };
	}
	const view = weightPeriodView({ data, route: { range, offset: 0 }, today: day, units, series: "weight" });
	const trend = trendOf(index.rows, (r) => (r.w === undefined ? undefined : massOf(r.w, units)), range, day);
	const span = { from: view.from, to: view.to };
	const latest = [...trend].reverse().find((v): v is number => v !== null);
	return {
		model: view.hasData ? { chart: "weight-period", view } : null,
		...noneFor(trend, span, range, today),
		// A year's own figures lead with its average weight; a week's or four's with the change, so the average goes first.
		figures: [
			...(range === "1y" ? [] : [{ value: `${massText(view.average, units)} ${unitOf(units)}`, label: "Avg Weight" }]),
			...view.figures.map((f) => ({ value: f.unit ? `${f.value} ${f.unit}` : f.value, label: f.label })),
		].slice(0, 2),
		trend: { kind: "line", values: trend, color: "var(--color-blue)", value: latest === undefined ? "--" : `${latest.toFixed(1)} ${unitOf(units)}`, label: "Latest" },
		period: labelOf(range, span, today),
	};
}

/* ------------------------------------------------------------------ */

/** The page a chart opens: its stat on the chart's range, on the day or the period holding it. */
export function routeOf(id: ChartId, range: ChartRange, day: string, today: string): Route {
	// Whole periods back, as a saved route keeps them: never −0.
	const back = range === "1d" ? 0 : Math.floor(Math.max(0, daysBetween(day, today)) / PERIOD_DAYS[range]);
	const offset = range === "1d" ? offsetOfDay(day, today) : back > 0 ? -back : 0;
	const stat = STAT_OF[id];
	if (stat) return { page: "stats", stat, range, offset, totals: "monthly" };
	if (id === "sleep") return { page: "sleep", range, offset, tab: "score" };
	if (id === "hrv-status") return performanceStatRoute("hrv-status", { range, offset });
	return healthStatRoute(id as HealthStatPageId, { range, offset });
}

/** A 1d page on `day`, `today` being the real one. */
function dayRoute(day: string, today: string): PeriodRoute {
	return { range: "1d", offset: offsetOfDay(day, today) };
}

/** The days a trend covers, ending on its day: 7, 28, or 52 weeks of 7. */
export function spanEnding(range: Trend, day: string): Span {
	return { from: shiftDate(day, -(PERIOD_DAYS[range] - 1)), to: day };
}

/** A period as its page words it, the year judged against the real today. */
function labelOf(range: Trend, span: Span, today: string): string {
	return range === "1y" ? yearLabel(span.from, span.to) : periodLabel(span.from, span.to, today);
}

/**
 * The period's values for a small card, oldest first: a value a day on 7d
 * and 4w, a week's mean (or sum) on 1y.
 */
export function trendOf<R extends { date: string }>(rows: readonly R[], value: (row: R) => number | undefined, range: Trend, day: string, weeks: "mean" | "sum" = "mean"): Array<number | null> {
	const byDate = new Map(rows.map((r) => [r.date, r]));
	const at = (d: string) => {
		const row = byDate.get(d);
		const v = row ? value(row) : undefined;
		return v !== undefined && Number.isFinite(v) ? v : null;
	};
	if (range !== "1y") return daysOf(spanEnding(range, day)).map(at);
	const out: Array<number | null> = [];
	for (let w = 51; w >= 0; w--) {
		const to = shiftDate(day, -7 * w);
		const known = daysOf({ from: shiftDate(to, -6), to })
			.map(at)
			.filter((v): v is number => v !== null);
		out.push(!known.length ? null : weeks === "sum" ? known.reduce((a, b) => a + b, 0) : known.reduce((a, b) => a + b, 0) / known.length);
	}
	return out;
}

/** A small card's trend: its values and their mean. */
function line(kind: TrendLine["kind"], values: Array<number | null>, color: string, format: (v: number) => string, label: string): TrendLine {
	const known = values.filter((v): v is number => v !== null);
	return { kind, values, color, value: known.length ? format(known.reduce((a, b) => a + b, 0) / known.length) : "--", label };
}

/** Why a trend has no chart: nothing recorded in its period. */
function noneFor(values: ReadonlyArray<number | null>, span: Span, range: Trend, today: string): { none?: string } {
	return values.some((v) => v !== null) ? {} : { none: `Nothing recorded ${labelOf(range, span, today)}.` };
}

/**
 * Why a day's chart has no readings: Garmin had none, or its page hasn't
 * loaded them into the vault yet. A click opens the page, which does.
 */
function missing(series: DaySeries | null, key: string, noun: string, page: string, day: string, today: string): string {
	return hasBlock(series, key) ? `No ${noun} readings ${onDay(day, today)}.` : `Open ${page} to load this day’s readings.`;
}

/** A Sleep figure, its unit after its value. */
function statFigure(s: { value: string; unit?: string; label: string }): CardFigure {
	return { value: s.unit ? `${s.value} ${s.unit}` : s.value, label: s.label };
}

/** Intensity minutes as Garmin totals them: vigorous counts twice. */
function minutesOf(row: DailyStatsRow): number | undefined {
	if (row.moderate === undefined && row.vigorous === undefined) return undefined;
	return (row.moderate ?? 0) + 2 * (row.vigorous ?? 0);
}

/** The account's units, as Home reads them: the activity index's, else the day files'. */
async function unitsFor(read: ChartInputs): Promise<"metric" | "imperial"> {
	const index = await read.activities();
	return index.meta?.units ?? unitsOf(await read.days());
}
