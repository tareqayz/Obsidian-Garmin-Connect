import type { MetricGroup } from "../sync/metrics";
import type { GlanceId } from "./glance";
import { defaultSpan, type PeriodRange, type SpanRange, type SpanRule } from "./periods";

/**
 * A stats section's registry, shared by Health Stats (`health-stats.ts`) and
 * Performance Stats (`performance-stats.ts`): every stat the app lists, in
 * its order, with what the hub, the commands, the routes and the At a Glance
 * cards need to know of it.
 *
 * A section's stats are on its shared route unless they keep a route of
 * their own (Health's Sleep, which the hub still lists) or have no page at
 * all (Performance's Cycling Ability, which it does not). A stat's page is
 * only reached once it is registered (`HEALTH_PAGES`, `PERFORMANCE_PAGES`),
 * so `registered` is that registry's keys wherever a helper takes it.
 *
 * Pure.
 */

/** An At a Glance card that opens a stat's page, and where on it. */
export interface GlanceLink {
	id: GlanceId;
	/** The tab the card opens: VO₂ Max's `cycling` for the Cycling VO₂ Max card. */
	tab?: string;
	/** The sub-page or sheet it opens. */
	sub?: string;
	/** The range it opens on, where that is not the stat's default. */
	range?: PeriodRange;
}

export interface StatDef<Id extends string = string> {
	id: Id;
	/** As the app titles the page and its row in the hub. */
	title: string;
	/** The range control's segments, in order. A stat with one has no control. */
	ranges: readonly PeriodRange[];
	defaultRange: PeriodRange;
	/** The settings group whose requests the stat's data costs. */
	group: MetricGroup;
	/** A segment's own name where it is not the range's: "Current" for 1d. */
	rangeLabels?: Partial<Record<PeriodRange, string>>;
	/** At a Glance cards that open this stat's page once it is built: a card, or a card and where it lands. */
	glance?: readonly (GlanceId | GlanceLink)[];
	/** How a range cuts and steps its period, where that is not the range's default (`spanRuleOf`). */
	spans?: Partial<Record<PeriodRange, SpanRule>>;
	/** The page's tabs, in order; the first is where it opens. */
	tabs?: readonly string[];
	/** Left out of the hub, still routable: a page another page opens (Training Status → Load). */
	hub?: false;
}

/** A stat on its section's shared route. */
export type PageStat<S extends StatDef, PageId extends string> = S & { id: PageId };

/** Where an At a Glance card lands: the stat that claims it, and the tab, sub-page or range its link names. */
export interface GlanceTarget<S extends StatDef = StatDef> {
	stat: S;
	tab?: string;
	sub?: string;
	range?: PeriodRange;
}

export interface RegistryOptions<Off extends string> {
	/** Stats with a route of their own: off the shared route, always in the hub (Health's Sleep). */
	ownRoute?: readonly Off[];
	/** Stats without a page: never routed, never in the hub (Performance's Cycling Ability). */
	noPage?: readonly Off[];
}

export interface StatRegistry<S extends StatDef, PageId extends S["id"] = S["id"]> {
	/** Every stat, in the app's order. */
	readonly stats: readonly S[];
	/** A stat by its id, or undefined for anything else. */
	get(id: unknown): S | undefined;
	/** A stat on the shared route by its id: refused for one with its own route or no page. */
	page(id: unknown): PageStat<S, PageId> | undefined;
	/** The stats whose page is registered, in the app's order, hidden ones too: what gets an "Open …" command. */
	pageStats(registered: Iterable<string>): PageStat<S, PageId>[];
	/** The hub's rows, in the app's order: the stats with their own route, then every registered one the hub shows. */
	hubStats(registered: Iterable<string>): S[];
	/**
	 * The page an At a Glance card opens: the stat on the shared route that
	 * claims the card, with what its link names. Only a registered page's
	 * when `registered` is given.
	 */
	glanceTarget(glance: GlanceId, registered?: Iterable<string>): GlanceTarget<PageStat<S, PageId>> | undefined;
}

/** The helpers a section reads its stats through, built from its list. */
export function statRegistry<S extends StatDef, Off extends S["id"] = never>(
	stats: readonly S[],
	options: RegistryOptions<Off> = {},
): StatRegistry<S, Exclude<S["id"], Off>> {
	type P = PageStat<S, Exclude<S["id"], Off>>;
	const own = new Set<string>(options.ownRoute ?? []);
	const off = new Set<string>([...own, ...(options.noPage ?? [])]);
	const isPage = (stat: S): stat is P => !off.has(stat.id);
	const get = (id: unknown) => stats.find((s) => s.id === id);
	const pageStats = (registered: Iterable<string>): P[] => {
		const has = new Set(registered);
		return stats.filter((s): s is P => isPage(s) && has.has(s.id));
	};
	return {
		stats,
		get,
		page(id) {
			const stat = get(id);
			return stat && isPage(stat) ? stat : undefined;
		},
		pageStats,
		hubStats(registered) {
			const has = new Set(registered);
			return stats.filter((s) => s.hub !== false && (own.has(s.id) || (isPage(s) && has.has(s.id))));
		},
		glanceTarget(glance, registered) {
			for (const stat of registered === undefined ? stats.filter(isPage) : pageStats(registered)) {
				const link = stat.glance?.map(linkOf).find((l) => l.id === glance);
				if (!link) continue;
				const target: GlanceTarget<P> = { stat };
				if (link.tab !== undefined) target.tab = link.tab;
				if (link.sub !== undefined) target.sub = link.sub;
				if (link.range !== undefined) target.range = link.range;
				return target;
			}
			return undefined;
		},
	};
}

/** A glance entry as a link: a bare card id opens the page as it opens by default. */
export function linkOf(entry: GlanceId | GlanceLink): GlanceLink {
	return typeof entry === "string" ? { id: entry } : entry;
}

/** The rule a stat's range cuts its period by: the stat's own, or the range's default. */
export function spanRuleOf(stat: Pick<StatDef, "spans">, range: SpanRange): SpanRule {
	return stat.spans?.[range] ?? defaultSpan(range);
}
