import { cardByName, closestCard, editDistance, type CardEntry } from "./catalog";

/**
 * A `garmin` code block, read. Pure.
 *
 * ```garmin
 * show: sleep, body-battery
 * date: 2026-10-28
 * ```
 *
 * One `key: value` a line; blank lines and `#` comments are skipped. `show`
 * names one or more cards (`catalog.ts`); `date` is `YYYY-MM-DD`, `today` or
 * `yesterday`, and without one the note's own day is used (`dates.ts`);
 * `size: small` draws the big cards' small versions.
 */

export type DateSpec = { kind: "date"; date: string } | { kind: "today" } | { kind: "yesterday" };

export interface CardSpec {
	cards: CardEntry[];
	date?: DateSpec;
	size: "normal" | "small";
}

export interface SpecError {
	/** The block's line, from 1, when one line is to blame. */
	line?: number;
	message: string;
	hint?: string;
}

/** As many cards as See All holds. */
export const MAX_CARDS = 20;

const KEYS = ["show", "date", "size"] as const;
type Key = (typeof KEYS)[number];

const HINT = "Insert card… lists every card.";

export function parseCardBlock(source: string): { spec: CardSpec } | { error: SpecError } {
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
			return { error: { line: i + 1, message: `Unknown option “${name}”.${near ? ` Did you mean ${near}?` : ""}`, hint: "A block takes show, date and size." } };
		}
		if (seen.has(key)) return { error: { line: i + 1, message: `${key} appears twice.` } };
		seen.set(key, { value: text.slice(colon + 1).trim(), line: i + 1 });
	}

	const show = seen.get("show");
	if (!show) return { error: { message: "Add a show line, such as show: sleep.", hint: HINT } };
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

	const spec: CardSpec = { cards, size: "normal" };
	const date = seen.get("date");
	if (date) {
		const read = readDate(date.value);
		if (read === "invalid") return { error: { line: date.line, message: "date takes YYYY-MM-DD, today or yesterday." } };
		if (read) spec.date = read;
	}
	const size = seen.get("size");
	if (size) {
		const value = size.value.toLowerCase();
		if (value !== "small" && value !== "normal") return { error: { line: size.line, message: "size takes small or normal." } };
		spec.size = value;
	}
	return { spec };
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
	return ["```garmin", `show: ${card.id}`, ...(opts.date ? [`date: ${opts.date}`] : []), "```", ""].join("\n");
}
