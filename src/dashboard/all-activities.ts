import type { ActivityRow } from "../sync/activity-index";
import { formatDistance, glyphOf, type SportGlyph, type Units } from "./activities";
import { activityWhen } from "./activity-labels";
import { activityType, discOf, FILTER_GROUPS, groupName, groupOf, SHOWN_GROUPS, subTypes, typeById, typeName, type DiscColour } from "./activity-types";
import { readingDate } from "./day";
import { MONTHS, shiftMonth } from "./periods";
import { allRoute, type AllRoute, type AllSort } from "./routes";
import { duration } from "./series";

/**
 * All Activities: Garmin's new list, searched, sorted and filtered over the
 * activity index, so the page sends no request of its own. The route holds
 * the search, the sort and the Filters sheet's choices (`AllRoute`); this
 * works out the cards, their exact count and the chips, and for the sheet its
 * type tree, the draft it edits until "Show N Activities", the range scales
 * and the calendar.
 *
 * Spec: ref/activities/all-activities/README.md (Rules, Builder table). What
 * no shot showed is marked Inferred.
 *
 * Pure.
 */

const SWIMMING = 26;
const METRES_PER_MILE = 1609.344;
const METRES_PER_YARD = 0.9144;
const METRES_PER_FOOT = 0.3048;

/* ------------------------------------------------------------------ */
/*  The list                                                           */
/* ------------------------------------------------------------------ */

export interface AllCard {
	/** The activity the card opens (`activityRoute`). */
	id: number;
	/** The activity's name, else its sport's: "Pool Swimming". */
	name: string;
	/** "Oct 13 @ 11:57 AM"; another year's "Oct 24, 2025 @ 9:30 AM". */
	when: string;
	/** "27.51 km"; a swim's "1,100 m"; else the time, "34:52"; "--" with neither. */
	value: string;
	glyph: SportGlyph;
	disc: DiscColour;
}

export type ChipKind = "type" | "date" | "distance" | "time" | "ascent" | "event" | "fav" | "pr";

export interface AllChip {
	/** Unique in the row: "type:26", "date", "event:race". */
	key: string;
	kind: ChipKind;
	/** "All Swimming", "Road Cycling", "Oct 1 - Oct 15", "10 - 50 km". */
	label: string;
	/** A type chip's figure: the group's, or the sub-type's own. */
	glyph?: SportGlyph;
	/** The same page without this filter: what the chip's × swaps to. */
	remove: AllRoute;
}

export interface AllView {
	count: number;
	/** "341 ACTIVITIES", exact where Garmin pages to "100+"; "1 ACTIVITY" (Inferred). */
	countLabel: string;
	/** A filter is on: the filter button's dot. The search and the sort don't light it (Inferred). */
	active: boolean;
	/** Types in the order they were chosen, then the date, distance, time, ascent, events, favourites, records. */
	chips: AllChip[];
	items: AllCard[];
	/** Why there are no cards: nothing synced, or nothing matching (with Clear All). */
	empty?: { title: string; clear: boolean };
}

/**
 * The page for a route: the matching activities as cards in the route's
 * order, how many there are, and a chip per filter.
 */
export function allView(rows: readonly ActivityRow[], route: AllRoute, units: Units, today: string): AllView {
	const hits = rows.filter(matcherOf(route)).sort(ORDERS[route.sort ?? "newest"]);
	const chips = chipsOf(rows, route, units, today);
	const view: AllView = {
		count: hits.length,
		countLabel: countLabel(hits.length),
		active: chips.length > 0,
		chips,
		items: hits.map((row) => cardOf(row, units, today)),
	};
	if (!hits.length) view.empty = rows.length ? { title: "No Activities Found", clear: true } : { title: "No activities synced yet.", clear: false };
	return view;
}

function countLabel(n: number): string {
	return `${n.toLocaleString()} ${n === 1 ? "ACTIVITY" : "ACTIVITIES"}`;
}

function cardOf(row: ActivityRow, units: Units, today: string): AllCard {
	return { id: row.id, name: nameOf(row), when: activityWhen(row.start, today), value: cardValue(row, units), glyph: glyphOf(row), disc: discOf(row) };
}

/** What a card is called: the activity's name, else its sport's. Search and the name sorts read the same. */
function nameOf(row: ActivityRow): string {
	return row.name ?? typeName(row);
}

/**
 * A card's figure. A swim, known by its group (rows from before index v3 have
 * no `pool`), reads in whole metres, or in yards for a yard pool or, with no
 * pool, in imperial (both Inferred). Anything else with a distance reads it to
 * two decimals, rounded; without one, the time to the nearest second.
 */
export function cardValue(row: Pick<ActivityRow, "type" | "typeId" | "parentTypeId" | "distance" | "duration" | "pool">, units: Units): string {
	if (row.distance !== undefined) {
		if (groupOf(row) !== SWIMMING) return formatDistance(row.distance, units, 2, true);
		const unit = row.pool ?? (units === "imperial" ? "yd" : "m");
		return `${Math.round(unit === "yd" ? row.distance / METRES_PER_YARD : row.distance).toLocaleString()} ${unit}`;
	}
	return row.duration !== undefined ? duration(row.duration) : "--";
}

/* ------------------------------------------------------------------ */
/*  Matching and sorting                                               */
/* ------------------------------------------------------------------ */

/**
 * Text as search and the name sorts compare it: compatibility-decomposed,
 * accents dropped, lower case. "Café" and "CAFE" are both "cafe"; "ß" is "ss".
 */
export function fold(text: string): string {
	return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/ß/g, "ss");
}

const FOLDED = new WeakMap<ActivityRow, string>();

function foldedName(row: ActivityRow): string {
	let folded = FOLDED.get(row);
	if (folded === undefined) FOLDED.set(row, (folded = fold(nameOf(row))));
	return folded;
}

/**
 * Whether a row passes a route's search and filters, all of them at once.
 *
 * - The search is a substring of the card's name, folded: mid-word ("arbou"
 *   finds "Harbour") and blind to case and accents. Names only, as Garmin's:
 *   "Pool" doesn't find a pool swim named otherwise. An unnamed activity's card
 *   name is its sport's.
 * - Types are OR'd: a row's own type, or its filter group (`groupOf`).
 * - Dates are the local start's day, both ends inclusive; either end may be open.
 * - Distance, time and ascent are inclusive, and a value the row lacks is 0.
 * - Events are OR'd; a row without one is `uncategorized`.
 * - Favorites and Personal Records keep the rows flagged so.
 */
export function matcherOf(route: Omit<AllRoute, "page">): (row: ActivityRow) => boolean {
	const q = route.q ? fold(route.q) : "";
	const types = route.types?.length ? new Set(route.types) : null;
	const events = route.events?.length ? new Set(route.events) : null;
	return (row) => {
		if (q && !foldedName(row).includes(q)) return false;
		if (types && !types.has(row.typeId ?? activityType(row)?.id ?? 0) && !types.has(groupOf(row))) return false;
		const day = row.start.slice(0, 10);
		if ((route.from !== undefined && day < route.from) || (route.to !== undefined && day > route.to)) return false;
		if (!within(row.distance, route.dmin, route.dmax) || !within(row.duration, route.tmin, route.tmax) || !within(row.ascent, route.amin, route.amax)) return false;
		if (events && !events.has(row.event ?? "uncategorized")) return false;
		return (!route.fav || row.favorite === true) && (!route.pr || row.pr === true);
	};
}

function within(value: number | undefined, min: number | undefined, max: number | undefined): boolean {
	const v = value ?? 0;
	return (min === undefined || v >= min) && (max === undefined || v <= max);
}

type Order = (a: ActivityRow, b: ActivityRow) => number;

/**
 * Newest First is by the local start, then the GMT start, then id. That is
 * Garmin's own order: by GMT alone, a run at 06:13 (+03) would come after
 * strength at 06:59 (+04) the same morning.
 */
const newestFirst: Order = (a, b) => compare(b.start, a.start) || b.begin - a.begin || b.id - a.id;

/** The sorts. A to Z and Z to A compare folded names code point by code point; a tie is newest first either way. */
const ORDERS: Readonly<Record<AllSort | "newest", Order>> = {
	newest: newestFirst,
	oldest: (a, b) => newestFirst(b, a),
	az: (a, b) => byCodePoint(foldedName(a), foldedName(b)) || newestFirst(a, b),
	za: (a, b) => byCodePoint(foldedName(b), foldedName(a)) || newestFirst(a, b),
};

function compare(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function byCodePoint(a: string, b: string): number {
	for (let i = 0; i < a.length && i < b.length; i++) {
		const x = a.codePointAt(i)!;
		const y = b.codePointAt(i)!;
		if (x !== y) return x - y;
		if (x > 0xffff) i++;
	}
	return a.length - b.length;
}

/** The Sort menu, in its order, with what each choice writes. Newest First is the default and writes nothing. */
export const SORT_OPTIONS: ReadonlyArray<{ sort: AllSort | undefined; label: string }> = [
	{ sort: undefined, label: "Newest First" },
	{ sort: "oldest", label: "Oldest First" },
	{ sort: "az", label: "A to Z" },
	{ sort: "za", label: "Z to A" },
];

/** The same page in another order. */
export function sortRoute(route: AllRoute, sort: AllSort | undefined): AllRoute {
	return allRoute({ ...route, sort });
}

/** The same page searching for `text` (trimmed, at most 80 characters; empty is no search). */
export function searchRoute(route: AllRoute, text: string): AllRoute {
	return allRoute({ ...route, q: text });
}

/** The empty state's Clear All: no search and no filters, in the same order. */
export function clearedRoute(route: AllRoute): AllRoute {
	return allRoute({ sort: route.sort });
}

/* ------------------------------------------------------------------ */
/*  Chips                                                              */
/* ------------------------------------------------------------------ */

function chipsOf(rows: readonly ActivityRow[], route: AllRoute, units: Units, today: string): AllChip[] {
	const without = (patch: Omit<AllRoute, "page">) => allRoute({ ...route, ...patch });
	const chips: AllChip[] = [];
	const types = route.types ?? [];
	for (const id of types) {
		chips.push({ key: `type:${id}`, kind: "type", ...typeChip(id, rows), remove: without({ types: types.filter((t) => t !== id) }) });
	}
	if (route.from !== undefined || route.to !== undefined) {
		chips.push({ key: "date", kind: "date", label: dateLabel(route.from, route.to, today), remove: without({ from: undefined, to: undefined }) });
	}
	for (const scale of rangeScales(units)) {
		const [minKey, maxKey] = scale.keys;
		if (route[minKey] === undefined && route[maxKey] === undefined) continue;
		const open: Omit<AllRoute, "page"> = {};
		open[minKey] = undefined;
		open[maxKey] = undefined;
		chips.push({ key: scale.kind, kind: scale.kind, label: rangeLabel(scale, route[minKey], route[maxKey]), remove: without(open) });
	}
	const events = route.events ?? [];
	for (const key of events) {
		chips.push({ key: `event:${key}`, kind: "event", label: eventLabel(key), remove: without({ events: events.filter((e) => e !== key) }) });
	}
	if (route.fav) chips.push({ key: "fav", kind: "fav", label: "Favorite Activities", remove: without({ fav: undefined }) });
	if (route.pr) chips.push({ key: "pr", kind: "pr", label: "Personal Records", remove: without({ pr: undefined }) });
	return chips;
}

/** A type chip's words and figure: "All Swimming" with the group's, "Road Cycling" with the bike. */
function typeChip(id: number, rows: readonly ActivityRow[]): { label: string; glyph: SportGlyph } {
	if (FILTER_GROUPS.includes(id)) return { label: `All ${groupName(id)}`, glyph: groupGlyph(id) };
	const type = typeById(id);
	if (type) return { label: type.name, glyph: glyphOf({ type: type.key, typeId: type.id, parentTypeId: type.parent }) };
	// A type Garmin added after the table: named as its activities are.
	const row = rows.find((r) => r.typeId === id);
	return row ? { label: typeName(row), glyph: glyphOf(row) } : { label: `Type ${id}`, glyph: "activity" };
}

/** "Oct 1 - Oct 15", "Sep 14", "Dec 20, 2025 - Jan 5"; one end alone "From Oct 1" or "Until Oct 15" (Inferred). */
function dateLabel(from: string | undefined, to: string | undefined, today: string): string {
	const day = (date: string) => readingDate(date, today);
	if (from !== undefined && to !== undefined) return from === to ? day(from) : `${day(from)} - ${day(to)}`;
	return from !== undefined ? `From ${day(from)}` : `Until ${day(to!)}`;
}

/** "10 - 50 km", "10+ km" with no maximum, "0 - 5 km" with no minimum; time's "1h - 4h", "1h 30m+" (Inferred). */
function rangeLabel(scale: RangeScale, min: number | undefined, max: number | undefined): string {
	const text = (base: number) => (scale.kind === "time" ? timeText(base) : decimal(base / scale.per));
	const unit = scale.kind === "time" ? "" : ` ${scale.unit}`;
	if (min === undefined) return `${text(0)} - ${text(max!)}${unit}`;
	if (max === undefined) return `${text(min)}+${unit}`;
	return min === max ? `${text(min)}${unit}` : `${text(min)} - ${text(max)}${unit}`;
}

/** Up to two decimals, grouped the reader's way: "10.5", "1,250". */
function decimal(value: number): string {
	return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Seconds as the Time fields write them: "1h 30m", "45m", "2h", "0m"; seconds only when there are some. */
function timeText(seconds: number): string {
	const total = Math.round(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const parts = [h ? `${h}h` : "", m ? `${m}m` : "", s ? `${s}s` : ""].filter(Boolean);
	return parts.length ? parts.join(" ") : "0m";
}

/* ------------------------------------------------------------------ */
/*  The sheet: activity types                                          */
/* ------------------------------------------------------------------ */

/** Each filter group's figure in the sheet and on its chips (spec: the 15 groups' Tabler icons). */
const GROUP_GLYPHS: Readonly<Record<number, SportGlyph>> = {
	1: "run",
	2: "bike",
	29: "barbell",
	26: "swimming",
	9: "walk",
	3: "trekking",
	89: "link",
	144: "scuba-diving",
	165: "snowflake",
	199: "wheelchair",
	228: "ripple",
	206: "ball-football",
	219: "ball-tennis",
	4: "activity",
	157: "asterisk",
};

export function groupGlyph(group: number): SportGlyph {
	return Object.prototype.hasOwnProperty.call(GROUP_GLYPHS, group) ? GROUP_GLYPHS[group] : "activity";
}

export interface TreeType {
	id: number;
	/** "All Running", "Treadmill Running". */
	label: string;
}

export interface TreeGroup {
	/** The group's type id: what "All <Group>" selects. */
	id: number;
	/** "Gym & Fitness Equipment". */
	name: string;
	glyph: SportGlyph;
	/** One of the first five, listed before Show All. */
	shown: boolean;
	/** "All <Group>" first, then the sub-types by name. */
	types: TreeType[];
}

/**
 * The Activities section of the Filters sheet: the fifteen groups in the
 * sheet's order, the first five before Show All. A group lists "All <Group>",
 * then its sub-types by name, code point by code point ("eBiking" after
 * "Virtual Ride"). A type the table lacks but the history holds (one Garmin
 * added since) is listed under its group by its own name.
 */
export function filterTree(rows: readonly ActivityRow[]): TreeGroup[] {
	const added = new Map<number, ActivityRow>();
	for (const row of rows) if (row.typeId !== undefined && !typeById(row.typeId) && !added.has(row.typeId)) added.set(row.typeId, row);
	return FILTER_GROUPS.map((id, i) => {
		const subs: TreeType[] = subTypes(id).map((t) => ({ id: t.id, label: t.name }));
		for (const [typeId, row] of added) if (groupOf(row) === id) subs.push({ id: typeId, label: typeName(row) });
		subs.sort((a, b) => byCodePoint(a.label, b.label));
		const name = groupName(id);
		return { id, name, glyph: groupGlyph(id), shown: i < SHOWN_GROUPS, types: [{ id, label: `All ${name}` }, ...subs] };
	});
}

/* ------------------------------------------------------------------ */
/*  The sheet: the draft                                               */
/* ------------------------------------------------------------------ */

/** What the Filters sheet edits: the route's fields less the search and the sort, which it leaves alone. */
export type AllDraft = Omit<AllRoute, "page" | "q" | "sort">;

const DRAFT_KEYS = ["types", "from", "to", "dmin", "dmax", "tmin", "tmax", "amin", "amax", "events", "fav", "pr"] as const;

/** The sheet's draft as it opens: the route's filters. */
export function draftOf(route: AllRoute): AllDraft {
	return tidy({ ...route, page: undefined, q: undefined, sort: undefined });
}

/** "Show N Activities": the route with the draft's filters, the search and the sort kept, everything checked as a saved route is. */
export function applyDraft(route: AllRoute, draft: AllDraft): AllRoute {
	return allRoute({ ...draft, q: route.q, sort: route.sort });
}

/** Whether a route or draft has any of the sheet's filters. */
export function hasFilters(fields: AllDraft): boolean {
	return DRAFT_KEYS.some((key) => fields[key] !== undefined);
}

/**
 * Ticks or unticks a type row. "All <Group>" and the group's own sub-types
 * exclude each other: ticking one unticks the other (Inferred: no shot shows a
 * tick). Ticks keep the order they were made in, which is the chips' order.
 */
export function toggleType(draft: AllDraft, group: Pick<TreeGroup, "id" | "types">, id: number): AllDraft {
	const types = draft.types ?? [];
	if (types.includes(id)) return tidy({ ...draft, types: types.filter((t) => t !== id) });
	const members = new Set(group.types.map((t) => t.id));
	const kept = id === group.id ? types.filter((t) => !members.has(t)) : types.filter((t) => t !== group.id);
	return tidy({ ...draft, types: [...kept, id] });
}

/** Event Type's chips: Any (null) clears them; a type toggles, and turning off the last is Any again. Several may be on (Inferred). */
export function toggleEvent(draft: AllDraft, key: string | null): AllDraft {
	const events = draft.events ?? [];
	if (key === null) return tidy({ ...draft, events: undefined });
	return tidy({ ...draft, events: events.includes(key) ? events.filter((e) => e !== key) : [...events, key] });
}

/** Date Range's Start and End, local days; either may be open. A reversed pair is put in order when applied. */
export function setDates(draft: AllDraft, from: string | undefined, to: string | undefined): AllDraft {
	return tidy({ ...draft, from, to });
}

/** A range section's two ends, in metres or seconds; undefined is no bound. */
export function setRange(draft: AllDraft, scale: Pick<RangeScale, "keys">, min: number | undefined, max: number | undefined): AllDraft {
	const next: AllDraft = { ...draft };
	next[scale.keys[0]] = min;
	next[scale.keys[1]] = max;
	return tidy(next);
}

/** Favorite Activities or Personal Records switched on or off. */
export function setFlag(draft: AllDraft, flag: "fav" | "pr", on: boolean): AllDraft {
	return tidy({ ...draft, [flag]: on ? true : undefined });
}

export interface SheetFooter {
	/** What "Show N Activities" would show, the search included. */
	count: number;
	/** "Show 91 Activities", "Show 1 Activity", "Show 0 Activities"; "Show All Activities" with no filter and no search. */
	label: string;
	/** Whether Clear All has anything to clear: it empties the draft and keeps the search and the sort (Inferred). */
	clear: boolean;
}

/** The sheet's footer for a draft, counted live as the draft changes. */
export function footerOf(rows: readonly ActivityRow[], route: AllRoute, draft: AllDraft): SheetFooter {
	const next = applyDraft(route, draft);
	const count = rows.filter(matcherOf(next)).length;
	const clear = hasFilters(next);
	const label = clear || next.q !== undefined ? `Show ${count.toLocaleString()} ${count === 1 ? "Activity" : "Activities"}` : "Show All Activities";
	return { count, label, clear };
}

/** A copy without the keys that hold nothing: no undefined, no empty list. */
function tidy(fields: Record<string, unknown>): AllDraft {
	const out: Record<string, unknown> = {};
	for (const key of DRAFT_KEYS) {
		const value = fields[key];
		if (value !== undefined && !(Array.isArray(value) && value.length === 0)) out[key] = value;
	}
	return out;
}

/* ------------------------------------------------------------------ */
/*  The sheet: Event Type                                              */
/* ------------------------------------------------------------------ */

/**
 * Event Type's chips after Any, in the sheet's order (by label, not Garmin's
 * `sortOrder`), with the phone's words: "Recreation" where the web says
 * "Recreational".
 */
export const EVENT_TYPES: ReadonlyArray<{ key: string; label: string }> = [
	{ key: "fitness", label: "Fitness" },
	{ key: "geocaching", label: "Geocaching" },
	{ key: "race", label: "Race" },
	{ key: "recreation", label: "Recreation" },
	{ key: "specialEvent", label: "Special Event" },
	{ key: "touring", label: "Touring" },
	{ key: "training", label: "Training" },
	{ key: "transportation", label: "Transportation" },
	{ key: "uncategorized", label: "Uncategorized" },
];

/** An event type's words; one Garmin adds later reads from its key: "virtualRace" → "Virtual Race". */
export function eventLabel(key: string): string {
	const known = EVENT_TYPES.find((e) => e.key === key);
	if (known) return known.label;
	const words = key.replace(/([a-z\d])([A-Z])/g, "$1 $2").split(/[_\s]+/).filter(Boolean);
	return words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

/* ------------------------------------------------------------------ */
/*  The sheet: Distance, Time, Total Ascent                            */
/* ------------------------------------------------------------------ */

export type RangeKind = "distance" | "time" | "ascent";
type RangeKey = "dmin" | "dmax" | "tmin" | "tmax" | "amin" | "amax";

export interface RangeScale {
	kind: RangeKind;
	/** The section's row: "Distance (km)", "Time", "Total Ascent (m)". */
	title: string;
	/** The scale's unit: km, mi, minutes ("min"), m, ft. */
	unit: string;
	/** Metres or seconds in one unit. */
	per: number;
	/** The scale's end, in its unit: there and past it there is no upper bound ("150+"). */
	end: number;
	/** The slider's step in its unit; Total Ascent has fields only. */
	step?: number;
	/** The Minimum and Maximum fields' placeholders. */
	placeholders: readonly [string, string];
	/** The route's fields for the two ends. */
	keys: readonly [RangeKey, RangeKey];
}

/**
 * The three range sections in the sheet's order. Distance is 0–150+ km in
 * 1 km steps (0–100+ mi), Time 0m–24h+ in 5-minute steps, Total Ascent
 * 0–3000+ m (0–10000+ ft) with no slider. The ends and words are the phone's;
 * the steps and the imperial scales are Inferred. The route holds metres and
 * seconds whatever the units.
 */
export function rangeScales(units: Units): readonly RangeScale[] {
	const imperial = units === "imperial";
	const km = imperial ? "mi" : "km";
	const m = imperial ? "ft" : "m";
	return [
		{ kind: "distance", title: `Distance (${km})`, unit: km, per: imperial ? METRES_PER_MILE : 1000, end: imperial ? 100 : 150, step: 1, placeholders: ["0", imperial ? "100+" : "150+"], keys: ["dmin", "dmax"] },
		{ kind: "time", title: "Time", unit: "min", per: 60, end: 24 * 60, step: 5, placeholders: ["0m", "24h+"], keys: ["tmin", "tmax"] },
		{ kind: "ascent", title: `Total Ascent (${m})`, unit: m, per: imperial ? METRES_PER_FOOT : 1, end: imperial ? 10000 : 3000, placeholders: ["0", imperial ? "10000+" : "3000+"], keys: ["amin", "amax"] },
	];
}

/** The slider's two thumbs for a pair of ends, in the scale's unit: an open end sits at 0 or at the scale's end. */
export function sliderOf(scale: RangeScale, min: number | undefined, max: number | undefined): [number, number] {
	const at = (base: number) => Math.min(scale.end, Math.max(0, base / scale.per));
	return [min === undefined ? 0 : at(min), max === undefined ? scale.end : at(max)];
}

/** The ends two thumbs give, in metres or seconds: a thumb at 0 or at the scale's end is no bound. */
export function rangeOfSlider(scale: RangeScale, a: number, b: number): { min?: number; max?: number } {
	const [lo, hi] = a <= b ? [a, b] : [b, a];
	const out: { min?: number; max?: number } = {};
	if (lo > 0) out.min = toBase(scale, lo);
	if (hi < scale.end) out.max = toBase(scale, hi);
	return out;
}

/** To the centimetre or the second: a mile in metres is 1609.344, 5 minutes 300. */
function toBase(scale: RangeScale, value: number): number {
	const base = value * scale.per;
	return scale.kind === "time" ? Math.round(base) : Math.round(base * 100) / 100;
}

/** A Minimum or Maximum field's text for an end: none for an open end (the placeholder shows), else "10.5", "1h 30m". */
export function fieldText(scale: RangeScale, base: number | undefined): string {
	if (base === undefined) return "";
	return scale.kind === "time" ? timeText(base) : String(Math.round((base / scale.per) * 100) / 100);
}

/**
 * What a typed Minimum or Maximum means, in metres or seconds: undefined for
 * no bound (an empty field, a Minimum of 0, a Maximum at the scale's end or
 * past it, "150+"), null for text that isn't a value. Distance and ascent take
 * decimals with a point or a comma, the unit optional ("10,5 km"); Time takes
 * "1h 30m", "90m", "1:30" (hours and minutes) or a bare number of minutes.
 */
export function typedEnd(scale: RangeScale, end: "min" | "max", text: string): number | undefined | null {
	let t = text.trim().toLowerCase().replace(/,/g, ".");
	if (!t) return undefined;
	const plus = t.endsWith("+");
	if (plus) t = t.slice(0, -1).trim();
	// In the scale's unit, so the end compares exactly: 10000 ft is not quite 3048 m in floating point.
	const value = scale.kind === "time" ? minutesOf(t) : amount(t, scale);
	if (value === null) return null;
	if (end === "min") return value > 0 ? toBase(scale, value) : undefined;
	return plus || value >= scale.end ? undefined : toBase(scale, value);
}

function amount(text: string, scale: RangeScale): number | null {
	const match = /^(\d+(?:\.\d*)?|\.\d+)\s*([a-z]*)$/.exec(text);
	if (!match || (match[2] && match[2] !== scale.unit)) return null;
	return Number(match[1]);
}

function minutesOf(text: string): number | null {
	const s = seconds(text);
	return s === null ? null : s / 60;
}

function seconds(text: string): number | null {
	const clock = /^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/.exec(text);
	if (clock) return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3] ?? 0);
	const n = "(\\d+(?:\\.\\d+)?|\\.\\d+)";
	const units = new RegExp(`^(?:${n}\\s*h(?:rs?|ours?)?)?\\s*(?:${n}\\s*m(?:in(?:s|utes?)?)?)?\\s*(?:${n}\\s*s(?:ec(?:s|onds?)?)?)?$`).exec(text);
	if (units && (units[1] || units[2] || units[3])) return Math.round(Number(units[1] ?? 0) * 3600 + Number(units[2] ?? 0) * 60 + Number(units[3] ?? 0));
	const hoursMinutes = /^(\d+)\s*h\s*(\d+)$/.exec(text);
	if (hoursMinutes) return Number(hoursMinutes[1]) * 3600 + Number(hoursMinutes[2]) * 60;
	const minutes = /^(\d+(?:\.\d+)?|\.\d+)$/.exec(text);
	return minutes ? Math.round(Number(minutes[1]) * 60) : null;
}

/* ------------------------------------------------------------------ */
/*  The sheet: Date Range                                              */
/* ------------------------------------------------------------------ */

export const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export interface CalendarDay {
	/** `YYYY-MM-DD`. */
	date: string;
	day: number;
	/** After today: drawn grey, can't be picked. */
	disabled: boolean;
	/** Today: the filled blue circle. */
	today: boolean;
	/** The focused field's day (Inferred: tinted). */
	selected: boolean;
}

export interface MonthGrid {
	/** `YYYY-MM`. */
	month: string;
	/** "October 2026". */
	title: string;
	weekdays: typeof WEEKDAYS;
	/** Rows of seven, Sunday first; the blanks before the 1st and after the last day are null. */
	weeks: Array<Array<CalendarDay | null>>;
	/** The month ‹ opens, none before `first`. */
	prev: string | null;
	/** The month › opens: none from today's month on, which is the latest. */
	next: string | null;
}

/**
 * Date Range's calendar for a month: weeks from Sunday, days after today
 * disabled, today marked, and the focused field's day selected. October 2026
 * opens on a Thursday the 1st: four blanks, then five rows in all.
 */
export function monthGrid(month: string, today: string, selected?: string, first?: string): MonthGrid {
	const [y, m] = month.split("-").map(Number) as [number, number];
	const cells: Array<CalendarDay | null> = Array.from({ length: new Date(Date.UTC(y, m - 1, 1)).getUTCDay() }, () => null);
	const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
	for (let day = 1; day <= days; day++) {
		const date = `${month}-${String(day).padStart(2, "0")}`;
		cells.push({ date, day, disabled: date > today, today: date === today, selected: date === selected });
	}
	while (cells.length % 7) cells.push(null);
	const weeks: Array<Array<CalendarDay | null>> = [];
	for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
	const prev = shiftMonth(month, -1);
	const next = shiftMonth(month, 1);
	return {
		month,
		title: `${MONTHS[m - 1]} ${y}`,
		weekdays: WEEKDAYS,
		weeks,
		prev: first !== undefined && prev < first.slice(0, 7) ? null : prev,
		next: next > today.slice(0, 7) ? null : next,
	};
}

export interface MonthOption {
	/** 1–12. */
	value: number;
	/** "October". */
	label: string;
	/** After today's month in today's year. */
	disabled: boolean;
}

/** The month picker's months for a year: those still to come are disabled, as the wheel dims them. */
export function monthOptions(year: number, today: string): MonthOption[] {
	const [ty, tm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
	return MONTHS.map((label, i) => ({ value: i + 1, label, disabled: year > ty || (year === ty && i + 1 > tm) }));
}

/** The year picker's years: from the oldest activity's to this one. Later years would be disabled, so they aren't listed. */
export function yearOptions(rows: readonly ActivityRow[], today: string): number[] {
	const last = Number(today.slice(0, 4));
	let first = last;
	for (const row of rows) first = Math.min(first, Number(row.start.slice(0, 4)));
	return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

/** The month the pickers name, `YYYY-MM`, held at today's month when it would be later. */
export function pickMonth(year: number, month: number, today: string): string {
	const picked = `${year}-${String(month).padStart(2, "0")}`;
	return picked > today.slice(0, 7) ? today.slice(0, 7) : picked;
}
