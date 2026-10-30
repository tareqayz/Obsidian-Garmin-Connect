import { readingDate } from "../dashboard/day";
import { CURRENT_ONLY, glanceEmpty, HOME_GLANCE, type GlanceId } from "../dashboard/glance";
import { focusEmpty, type FocusId, type HomeModel } from "../dashboard/home";
import { shiftDate } from "../dashboard/series";
import type { CardDate } from "./dates";
import type { CardSpec } from "./spec";

/**
 * What a card block shows for its day: a notice instead of its cards when
 * there is nothing to draw, and how its cards sit. Pure.
 */

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A day as a card names it: "Today", "Yesterday", "Tue, Oct 28", or "Sun, Nov 2, 2025" in another year. */
export function dayWords(date: string, today: string): string {
	if (date === today) return "Today";
	if (date === shiftDate(today, -1)) return "Yesterday";
	return `${WEEKDAY[new Date(`${date}T00:00:00Z`).getUTCDay()]}, ${readingDate(date, today)}`;
}

/** The day at the end of a sentence: "today", "yesterday", "on Tue, Oct 28". */
export function onDay(date: string, today: string): string {
	const words = dayWords(date, today);
	return words === "Today" ? "today" : words === "Yesterday" ? "yesterday" : `on ${words}`;
}

export interface CardNotice {
	icon: string;
	text: string;
	/** Muted for a day with nothing in it, red for a mistake in the block. */
	tone?: "muted" | "error";
	hint?: string;
	action?: { kind: "set-up" | "open-garmin" | "settings"; label: string; primary?: boolean };
	/** The notice names the block's day itself, so the line over the block would say it twice. */
	namesDay?: boolean;
}

/** What the synced days say about a block's day. */
export interface DayFacts {
	/** The setup has run. */
	setUp: boolean;
	/** The first and last synced days, if any. */
	first?: string;
	last?: string;
	/** The day has a synced row. */
	hasRow: boolean;
}

/** Why a block draws no cards for `date`, if it doesn't. */
export function noticeFor(date: string, today: string, facts: DayFacts): CardNotice | null {
	if (!facts.setUp) return { icon: "watch", text: "Set up Garmin Connect to see your data here.", action: { kind: "set-up", label: "Set up", primary: true } };
	if (!facts.last) return { icon: "refresh-cw", text: "Nothing synced yet.", action: { kind: "open-garmin", label: "Open Garmin" } };
	if (date > today) return { icon: "calendar", text: `${dayWords(date, today)} hasn’t happened yet.`, tone: "muted", namesDay: true };
	if (date > facts.last) return { icon: "refresh-cw", text: `${dayWords(date, today)} isn’t synced yet.`, action: { kind: "open-garmin", label: "Open Garmin" }, namesDay: true };
	if (facts.first && date < facts.first) return { icon: "calendar", text: `Your synced history starts ${readingDate(facts.first, today)}.`, action: { kind: "settings", label: "Settings" } };
	if (!facts.hasRow) return { icon: "calendar", text: `Nothing recorded ${onDay(date, today)}.`, tone: "muted", namesDay: true };
	return null;
}

/**
 * Why a block draws no trend ending on `date`, if it doesn't: before the
 * setup, before anything synced, a day to come, or before the history. A
 * trend ending on a day not synced yet still draws the days that are.
 */
export function trendNoticeFor(date: string, today: string, facts: DayFacts): CardNotice | null {
	if (!facts.setUp || !facts.last || date > today || (facts.first && date < facts.first)) return noticeFor(date, today, facts);
	return null;
}

/** A mistake in the block, as its notice says it. */
export function errorNotice(error: { line?: number; message: string; hint?: string }): CardNotice {
	return { icon: "circle-x", text: error.message, tone: "error", hint: [error.line ? `Line ${error.line}.` : "", error.hint ?? ""].filter(Boolean).join(" ") };
}

/**
 * The line over a block whose day isn't its note's: the day it shows. A live
 * block says "Today", or which day it shows while today hasn't synced.
 */
export function captionFor(d: CardDate, shown: string, today: string): string | undefined {
	if (d.noteDay !== undefined && d.date === d.noteDay) return undefined;
	if (d.live) return shown === today ? "Today" : `${dayWords(shown, today)} · today isn’t synced yet`;
	return d.source === "block" ? dayWords(d.date, today) : undefined;
}

/** What a card says with nothing for its day. */
export function emptyTextFor(date: string, today: string): string {
	return `Nothing recorded ${onDay(date, today)}.`;
}

/** What the day's activities say with none: Home's line, for any day. */
export function activitiesEmptyFor(date: string, today: string): string {
	return date === today ? "No activities or Health Snapshots yet today." : `No activities or Health Snapshots ${onDay(date, today)}.`;
}

/** A row of a block: big cards, small cards, or the day's activities, laid out as Home lays them out. */
export type CardGroup = { kind: "focus"; ids: FocusId[] } | { kind: "glance"; ids: GlanceId[] } | { kind: "activities" };

/** Home's own layout, which a `day` block follows. */
export interface HomeLayout {
	inFocus: readonly FocusId[];
	glance: readonly GlanceId[];
}

/**
 * A block's cards as rows, in its order: neighbouring big cards share a row,
 * as do small ones. Each card keeps its Home size; `size: small` draws the
 * stats that have both at their small size.
 */
export function groupsOf(spec: CardSpec, home: HomeLayout): CardGroup[] {
	const groups: CardGroup[] = [];
	for (const card of spec.cards) {
		if (card.kind === "day") {
			const whole: CardGroup[] = [{ kind: "focus", ids: [...home.inFocus] }, { kind: "activities" }, { kind: "glance", ids: home.glance.slice(0, HOME_GLANCE) }];
			return whole.filter((g) => g.kind === "activities" || g.ids.length > 0);
		}
		if (card.kind === "activities") return [{ kind: "activities" }];
		const big = card.kind === "focus" && (spec.size === "normal" || !card.glance);
		const last = groups[groups.length - 1];
		if (big) {
			if (last?.kind === "focus") last.ids.push(card.focus!);
			else groups.push({ kind: "focus", ids: [card.focus!] });
		} else if (last?.kind === "glance") last.ids.push(card.glance!);
		else groups.push({ kind: "glance", ids: [card.glance!] });
	}
	return groups;
}

/** A block of one card with nothing for its day says so in a line, rather than drawing an empty card. */
export function emptyCardNotice(spec: CardSpec, groups: readonly CardGroup[], model: HomeModel, date: string, today: string): CardNotice | null {
	if (spec.cards.length !== 1 || groups.length !== 1) return null;
	const card = spec.cards[0];
	const group = groups[0];
	const empty = group.kind === "focus" ? focusEmpty(group.ids[0], model) : group.kind === "glance" ? glanceEmpty(group.ids[0], model) : false;
	return empty ? { icon: card.icon, text: `No ${card.title} ${onDay(date, today)}.`, tone: "muted", namesDay: true } : null;
}

/** "Now" on a card that holds only the latest value, on a day before today. */
export function badgeFor(id: GlanceId, date: string, today: string): string | undefined {
	return CURRENT_ONLY.has(id) && date < today ? "Now" : undefined;
}

/** The height a block takes while it loads, so the note doesn't jump: Home's card heights. */
export function reservedHeight(groups: readonly CardGroup[]): number {
	const heights = groups.map((g) => (g.kind === "focus" ? 318 : g.kind === "glance" ? 281 : 96));
	return heights.reduce((a, b) => a + b, 0) + Math.max(0, heights.length - 1) * 8;
}
