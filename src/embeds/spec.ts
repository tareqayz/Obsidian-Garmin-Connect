import { cardByName, closestCard, editDistance, type CardEntry } from "./catalog";
import { CHART_RANGES, chartByName, closestChart, type ChartEntry, type ChartRange } from "./charts";

/**
 * A `garmin` code block, read. Pure.
 *
 * ```garmin
 * show: sleep, body-battery
 * date: 2026-10-28
 * ```
 *
 * One `key: value` a line; blank lines and `#` comments are skipped. A block
 * draws one of three things:
 *
 * - `show` names one or more of Home's cards (`catalog.ts`); `size: small`
 *   draws the big cards' small versions.
 * - `chart` names one or more stat page charts (`charts.ts`), for the day
 *   (`range: 1d`, the default) or the 7d, 4w or 1y ending on it; `size:
 *   small` draws a trend as a small card.
 * - `activity` is one activity: the day's `latest`, `all` of the day's, or
 *   one by its Garmin id.
 *
 * `date` is `YYYY-MM-DD`, `today` or `yesterday`, and without one the note's
 * own day is used (`dates.ts`).
 */

export type DateSpec = { kind: "date"; date: string } | { kind: "today" } | { kind: "yesterday" };

/** Home's cards. */
export interface CardSpec {
	kind: "cards";
	cards: CardEntry[];
	date?: DateSpec;
	size: "normal" | "small";
}

/** Stat page charts, for one range. */
export interface ChartSpec {
	kind: "charts";
	charts: ChartEntry[];
	range: ChartRange;
	date?: DateSpec;
	size: "normal" | "small";
}

/** Which activity: the day's latest, all of the day's, or one by its id. */
export type ActivityPick = { kind: "latest" } | { kind: "all" } | { kind: "id"; id: number };

export interface ActivitySpec {
	kind: "activity";
	pick: ActivityPick;
	date?: DateSpec;
}

export type BlockSpec = CardSpec | ChartSpec | ActivitySpec;

export interface SpecError {
	/** The block's line, from 1, when one line is to blame. */
	line?: number;
	message: string;
	hint?: string;
}

/** As many cards as See All holds, and as many charts. */
export const MAX_CARDS = 20;

const KEYS = ["show", "chart", "activity", "date", "range", "size"] as const;
type Key = (typeof KEYS)[number];
/** What a block draws: one of these a block. */
const WHAT = ["show", "chart", "activity"] as const;

const HINT = "Insert card… lists every card.";
const CHART_HINT = "Insert card… lists every chart.";

export function parseCardBlock(source: string): { spec: BlockSpec } | { error: SpecError } {
	const seen = new Map<Key, { value: string; line: number }>();
	const lines = source.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const text = lines[i].trim();
		if (!text || text.startsWith("#")) continue;
		const colon = text.indexOf(":");
		if (colon < 0) return { error: { line: i + 1, message: `Each line is a key and a value, such as show: ${text}.`, hint: HINT } };
		const name = text.slice(0, colon).trim().toLowerCase();
		const key = KEYS.find((k) => k === name);
		if (!key) {
			const near = KEYS.find((k) => editDistance(name, k) <= 2);
			return { error: { line: i + 1, message: `Unknown option “${name}”.${near ? ` Did you mean ${near}?` : ""}`, hint: "A block takes show, chart or activity, and date, range and size." } };
		}
		if (seen.has(key)) return { error: { line: i + 1, message: `${key} appears twice.` } };
		if (WHAT.includes(key as (typeof WHAT)[number]) && WHAT.some((w) => seen.has(w))) return { error: { line: i + 1, message: "Use one of show, chart and activity in a block." } };
		seen.set(key, { value: text.slice(colon + 1).trim(), line: i + 1 });
	}

	let date: DateSpec | undefined;
	const dateLine = seen.get("date");
	if (dateLine) {
		const read = readDate(dateLine.value);
		if (read === "invalid") return { error: { line: dateLine.line, message: "date takes YYYY-MM-DD, today or yesterday." } };
		if (read) date = read;
	}
	let size: "normal" | "small" = "normal";
	const sizeLine = seen.get("size");
	if (sizeLine) {
		const value = sizeLine.value.toLowerCase();
		if (value !== "small" && value !== "normal") return { error: { line: sizeLine.line, message: "size takes small or normal." } };
		size = value;
	}
	const rangeLine = seen.get("range");
	if (rangeLine && !seen.has("chart")) return { error: { line: rangeLine.line, message: "range goes with chart." } };

	const chartLine = seen.get("chart");
	if (chartLine) return chartsOf(chartLine, rangeLine, sizeLine?.line, size, date);
	const activityLine = seen.get("activity");
	if (activityLine) {
		if (sizeLine) return { error: { line: sizeLine.line, message: "size goes with show or chart." } };
		const pick = readPick(activityLine.value);
		if (!pick) return { error: { line: activityLine.line, message: "activity takes latest, all or an activity’s id.", hint: "Insert card… lists your activities." } };
		return { spec: { kind: "activity", pick, ...(date ? { date } : {}) } };
	}

	const show = seen.get("show");
	if (!show) return { error: { message: "Add a show, chart or activity line, such as show: sleep.", hint: HINT } };
	const cards: CardEntry[] = [];
	for (const name of show.value.split(",").map((n) => n.trim()).filter(Boolean)) {
		const card = cardByName(name);
		if (!card) {
			const near = closestCard(name);
			return { error: { line: show.line, message: `Unknown card “${name}”.${near ? ` Did you mean ${near.id}?` : ""}`, hint: HINT } };
		}
		if (!cards.includes(card)) cards.push(card);
	}
	if (!cards.length) return { error: { line: show.line, message: "Name a card after show:, such as show: sleep.", hint: HINT } };
	if (cards.length > MAX_CARDS) return { error: { line: show.line, message: `Show at most ${MAX_CARDS} cards in one block.` } };
	const alone = cards.find((c) => c.kind === "day" || c.kind === "activities");
	if (alone && cards.length > 1) return { error: { line: show.line, message: `${alone.id} goes in a block of its own.` } };
	return { spec: { kind: "cards", cards, size, ...(date ? { date } : {}) } };
}

/** A `chart:` block: its charts, each with the block's range. */
function chartsOf(
	line: { value: string; line: number },
	rangeLine: { value: string; line: number } | undefined,
	sizeAt: number | undefined,
	size: "normal" | "small",
	date: DateSpec | undefined,
): { spec: ChartSpec } | { error: SpecError } {
	const charts: ChartEntry[] = [];
	for (const name of line.value.split(",").map((n) => n.trim()).filter(Boolean)) {
		const found = chartByName(name);
		if (!found) {
			const card = cardByName(name);
			if (card) return { error: { line: line.line, message: `${card.title} has no chart yet.`, hint: CHART_HINT } };
			const near = closestChart(name);
			return { error: { line: line.line, message: `Unknown chart “${name}”.${near ? ` Did you mean ${near.id}?` : ""}`, hint: CHART_HINT } };
		}
		if (!charts.includes(found)) charts.push(found);
	}
	if (!charts.length) return { error: { line: line.line, message: "Name a chart after chart:, such as chart: sleep.", hint: CHART_HINT } };
	if (charts.length > MAX_CARDS) return { error: { line: line.line, message: `Show at most ${MAX_CARDS} charts in one block.` } };
	let range: ChartRange = "1d";
	if (rangeLine) {
		const value = rangeLine.value.toLowerCase() as ChartRange;
		if (!CHART_RANGES.includes(value)) return { error: { line: rangeLine.line, message: "range takes 1d, 7d, 4w or 1y." } };
		range = value;
		const without = charts.find((c) => !c.ranges.includes(range));
		if (without) return { error: { line: rangeLine.line, message: `${without.title} has no ${range} chart.` } };
	}
	if (size === "small" && range === "1d") return { error: { line: sizeAt, message: "size: small draws trends. Add range: 7d, 4w or 1y." } };
	return { spec: { kind: "charts", charts, range, size, ...(date ? { date } : {}) } };
}

/** An `activity:` value: `latest`, `all`, or a Garmin activity id. */
function readPick(value: string): ActivityPick | null {
	const text = value.trim().toLowerCase();
	if (text === "latest") return { kind: "latest" };
	if (text === "all") return { kind: "all" };
	if (/^\d{1,15}$/.test(text)) {
		const id = Number(text);
		return id > 0 ? { kind: "id", id } : null;
	}
	return null;
}

/**
 * A `date:` value. A template placeholder that wasn't filled in (`{{date}}`,
 * `<% tp.date.now() %>`) counts as no date, so the note's own day applies.
 */
function readDate(value: string): DateSpec | null | "invalid" {
	const text = value.replace(/^["']|["']$/g, "").trim();
	if (!text || /^\{\{.*\}\}$/.test(text) || /^<%.*%>$/.test(text)) return null;
	const lower = text.toLowerCase();
	if (lower === "today") return { kind: "today" };
	if (lower === "yesterday") return { kind: "yesterday" };
	return isDay(text) ? { kind: "date", date: text } : "invalid";
}

/** A real calendar day, written `YYYY-MM-DD`. */
export function isDay(text: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
	const at = new Date(`${text}T00:00:00Z`);
	return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === text;
}

/** The block the picker inserts for a card, on a line of its own. */
export function snippetFor(card: CardEntry, opts: { date?: string } = {}): string {
	return block([`show: ${card.id}`, ...(opts.date ? [`date: ${opts.date}`] : [])]);
}

/** The block the picker inserts for a chart: the day's, with its range written out to change. */
export function chartSnippet(chart: ChartEntry, opts: { date?: string } = {}): string {
	return block([`chart: ${chart.id}`, "range: 1d", ...(opts.date ? [`date: ${opts.date}`] : [])]);
}

/** The block the picker inserts for an activity: one by its id, or the day's. */
export function activitySnippet(pick: ActivityPick, opts: { date?: string } = {}): string {
	const value = pick.kind === "id" ? String(pick.id) : pick.kind;
	return block([`activity: ${value}`, ...(opts.date && pick.kind !== "id" ? [`date: ${opts.date}`] : [])]);
}

function block(lines: string[]): string {
	return ["```garmin", ...lines, "```", ""].join("\n");
}
