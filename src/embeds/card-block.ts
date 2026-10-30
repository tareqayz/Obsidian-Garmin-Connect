import { MarkdownRenderChild, type MarkdownPostProcessorContext } from "obsidian";
import { mount, unmount } from "svelte";
import type GarminPlugin from "../main";
import { areaStack, inArea } from "../dashboard/areas";
import { focusRoute, glanceRoute, type BuiltPages } from "../dashboard/card-routes";
import type { GlanceId } from "../dashboard/glance";
import { presetFor, type FocusId, type TodayItem } from "../dashboard/home";
import { GARMIN_HOME_VIEW } from "../dashboard/home-view";
import { unitsOf } from "../dashboard/day";
import { offsetOfDay } from "../dashboard/periods";
import type { Route } from "../dashboard/routes";
import { toIsoDate } from "../garmin/endpoints";
import { HEALTH_PAGES } from "../ui/svelte/health/pages";
import { PERFORMANCE_PAGES } from "../ui/svelte/performance/pages";
import CardEmbed from "../ui/svelte/embed/CardEmbed.svelte";
import { activityCard, pickActivities } from "./activity-cards";
import type { CardDay } from "./card-data";
import { buildChart } from "./chart-models";
import { dailyNotesOf, parseDay } from "./core-plugins";
import { resolveCardDate, type CardDate } from "./dates";
import { parseCardBlock, type ActivitySpec, type BlockSpec, type CardSpec, type ChartSpec, type SpecError } from "./spec";
import {
	activitiesEmptyFor,
	badgeFor,
	captionFor,
	emptyCardNotice,
	emptyTextFor,
	errorNotice,
	groupsOf,
	noticeFor,
	onDay,
	reservedHeight,
	trendNoticeFor,
	type CardGroup,
} from "./status";
import type { ActivityCardView, ChartCardView, CardView, NoticeAction } from "./view";

/** The language of a card block: ```garmin. */
export const CARD_LANGUAGE = "garmin";

/** The pages this build has, which a card can open. */
const BUILT: BuiltPages = { health: Object.keys(HEALTH_PAGES), performance: Object.keys(PERFORMANCE_PAGES) };

/** How long PDF export waits for a block's first real paint. */
const FIRST_PAINT_MS = 5000;

/** The heights a chart's card and an activity's take while they load, so the note doesn't jump. */
const CHART_HEIGHT = 430;
const TREND_HEIGHT = 190;
const ACTIVITY_HEIGHT = 330;

/** What CardEmbed.svelte exports: only svelte-check reads a component's own types. */
interface CardEmbedApi {
	setView(next: CardView): void;
}

/** Draws every ```garmin block in reading view, Live Preview, hover previews and exports. */
export function registerCardBlocks(plugin: GarminPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor(CARD_LANGUAGE, (source, el, ctx) => {
		const block = new CardBlock(plugin, source, el, ctx);
		ctx.addChild(block);
		return block.firstPaint;
	});
}

/**
 * One block: Home's cards for its day, stat page charts, or an activity,
 * mounted while the block is on screen. It reads through the plugin's
 * `CardData`, so every block in every note shares one read of each file, and
 * it never asks Garmin for anything.
 */
class CardBlock extends MarkdownRenderChild {
	/** Settles at the first real paint, or after `FIRST_PAINT_MS`: PDF export waits on it. */
	readonly firstPaint: Promise<void>;
	private painted: () => void = () => undefined;
	private component: CardEmbedApi | undefined;
	private parsed: { spec: BlockSpec } | { error: SpecError };
	private path: string;
	/** Drops a slow read that a newer one overtook. */
	private seq = 0;
	private live = true;

	constructor(
		private readonly plugin: GarminPlugin,
		private readonly source: string,
		el: HTMLElement,
		private readonly ctx: MarkdownPostProcessorContext,
	) {
		super(el);
		this.path = ctx.sourcePath;
		this.parsed = parseCardBlock(source);
		this.firstPaint = new Promise((done) => {
			this.painted = done;
			window.setTimeout(done, FIRST_PAINT_MS);
		});
	}

	onload(): void {
		const cards = this.plugin.cards;
		cards.acquire();
		this.register(cards.track(this));
		this.containerEl.addClass("gch-embed");
		this.component = mount(CardEmbed, {
			target: this.containerEl,
			props: {
				initialView: this.firstView(),
				open: (route: Route) => void this.plugin.openView(GARMIN_HOME_VIEW, { stack: inArea(route) }),
				openActivity: (item: TodayItem, date: string) =>
					void cards.activityRoute(item, date).then((route) => this.plugin.openView(GARMIN_HOME_VIEW, { stack: inArea(route) })),
				act: (kind: NoticeAction) => this.act(kind),
				tiles: () => this.plugin.mapTiles(),
			},
		}) as CardEmbedApi;
		this.register(cards.onChange(() => void this.refresh()));
		// The note's date can come from its properties and its name.
		this.registerEvent(
			this.plugin.app.metadataCache.on("changed", (file) => {
				if (file.path === this.path) void this.refresh();
			}),
		);
		this.registerEvent(
			this.plugin.app.vault.on("rename", (file, old) => {
				if (old !== this.path) return;
				this.path = file.path;
				void this.refresh();
			}),
		);
		void this.refresh();
	}

	onunload(): void {
		if (!this.live) return;
		this.live = false;
		this.drop();
		this.plugin.cards.release();
	}

	/** The plugin is going: the block shows its source again, as Obsidian draws a block nothing handles. */
	teardown(): void {
		this.onunload();
		this.containerEl.empty();
		this.containerEl.removeClass("gch-embed");
		this.containerEl.createEl("pre").createEl("code", { text: this.source });
	}

	private drop(): void {
		if (!this.component) return;
		void unmount(this.component);
		this.component = undefined;
	}

	/** What to paint at once: the day already read, or the cards' heights while it loads. */
	private firstView(): CardView {
		if ("error" in this.parsed) return { state: "notice", notice: errorNotice(this.parsed.error) };
		const spec = this.parsed.spec;
		const today = toIsoDate();
		const when = this.dateOf(spec, today);
		if (this.plugin.data.settings.setup === null) return this.setupView(when, today);
		if (spec.kind !== "cards") return { state: "loading", height: loadingHeight(spec) };
		const day = this.plugin.cards.peek(when.date, when.live);
		if (day) return this.viewFor(spec, when, day, today);
		const caption = captionFor(when, when.date, today);
		return { state: "loading", height: reservedHeight(groupsOf(spec, this.homeLayout())), ...(caption ? { caption } : {}) };
	}

	private async refresh(): Promise<void> {
		const seq = ++this.seq;
		let view: CardView;
		try {
			view = await this.build();
		} catch (err) {
			console.error("Garmin: a card couldn't be drawn", err);
			view = { state: "notice", notice: { icon: "circle-x", text: "This card couldn’t be drawn.", tone: "error", hint: err instanceof Error ? err.message : String(err) } };
		}
		if (seq !== this.seq || !this.component) return;
		this.component.setView(view);
		this.painted();
	}

	private async build(): Promise<CardView> {
		if ("error" in this.parsed) return { state: "notice", notice: errorNotice(this.parsed.error) };
		const spec = this.parsed.spec;
		const today = toIsoDate();
		const when = this.dateOf(spec, today);
		if (this.plugin.data.settings.setup === null) return this.setupView(when, today);
		if (spec.kind === "charts") return this.chartsView(spec, when, today);
		if (spec.kind === "activity") return this.activityView(spec, when, today);
		return this.viewFor(spec, when, await this.plugin.cards.day(when.date, when.live), today);
	}

	/** Before the setup has run there is no day: every block asks for it. */
	private setupView(when: CardDate, today: string): CardView {
		return { state: "notice", notice: noticeFor(when.date, today, { setUp: false, hasRow: false })! };
	}

	/**
	 * A chart block: each chart's card for the day, or for the period ending
	 * on it. A trend draws whatever days of its period are synced; a day's
	 * chart follows its day as Home's cards do, a live one Home's day to show.
	 */
	private async chartsView(spec: ChartSpec, when: CardDate, today: string): Promise<CardView> {
		const day = spec.range === "1d";
		const facts = await this.plugin.cards.facts(when.date, when.live && day);
		const date = facts.date;
		const notice = (day ? noticeFor : trendNoticeFor)(date, today, { setUp: true, ...facts });
		const caption = day ? captionFor(when, date, today) : undefined;
		const withCaption = caption ? { caption } : {};
		if (notice) return { state: "notice", notice, ...(notice.namesDay ? {} : withCaption) };
		const built = await Promise.all(spec.charts.map((entry) => buildChart(entry, spec.range, date, today, this.plugin.cards)));
		const charts: ChartCardView[] = spec.charts.map((entry, i) => {
			const b = built[i];
			const card: ChartCardView = {
				id: entry.id,
				title: entry.title,
				icon: entry.icon,
				figures: b.figures,
				body: b.model ? { kind: "chart", chart: b.model } : { kind: "none", text: b.none ?? "" },
				route: b.route,
			};
			if (entry.tone) card.tone = entry.tone;
			if (b.period) card.period = b.period;
			if (b.value !== undefined) card.value = b.value;
			if (b.trend) card.trend = b.trend;
			return card;
		});
		// A block of one chart with nothing at all for its day says so in a line, as a card does.
		const only = charts.length === 1 ? charts[0] : null;
		if (only && only.body.kind === "none" && only.value === undefined && !only.figures.length && spec.size === "normal") {
			return { state: "notice", notice: { icon: only.icon, text: only.body.text, tone: "muted", namesDay: day }, ...(day ? {} : withCaption) };
		}
		return { state: "charts", size: spec.size, charts, ...withCaption };
	}

	/** An activity block: the day's latest, all of the day's, or one by its id, from what the vault holds. */
	private async activityView(spec: ActivitySpec, when: CardDate, today: string): Promise<CardView> {
		const cards = this.plugin.cards;
		const byDay = spec.pick.kind !== "id";
		const facts = await cards.facts(when.date, false);
		const notice = noticeFor(facts.date, today, { setUp: true, ...facts, hasRow: true });
		const caption = byDay ? captionFor(when, facts.date, today) : undefined;
		const withCaption = caption ? { caption } : {};
		if (notice && (byDay || !facts.last)) return { state: "notice", notice, ...(notice.namesDay ? {} : withCaption) };
		const [index, days] = await Promise.all([cards.activities(), cards.days()]);
		const units = index.meta?.units ?? unitsOf(days);
		const rows = pickActivities(index.rows, spec.pick, facts.date);
		const ids = spec.pick.kind === "id" && !rows.length ? [spec.pick.id] : rows.map((r) => r.id);
		const details = await Promise.all(ids.map((id) => cards.activity(id)));
		const activities = ids.map((id, i) => activityCard(id, rows[i], details[i], units, today)).filter((c): c is ActivityCardView => c !== null);
		if (!activities.length) {
			const text = byDay ? `No activities ${onDay(facts.date, today)}.` : "This activity isn’t in your vault.";
			return { state: "notice", notice: { icon: "activity", text, tone: "muted", namesDay: byDay }, ...(byDay ? {} : withCaption) };
		}
		return { state: "activities", activities, ...withCaption };
	}

	/** The block's view for its day. */
	private viewFor(spec: CardSpec, when: CardDate, day: CardDay, today: string): CardView {
		const caption = captionFor(when, day.date, today);
		const withCaption = caption ? { caption } : {};
		const notice = noticeFor(day.date, today, { setUp: true, first: day.first, last: day.last, hasRow: day.hasRow }) ?? emptyCardNotice(spec, this.groups(spec), day.model, day.date, today);
		if (notice) return { state: "notice", notice, ...(notice.namesDay ? {} : withCaption) };
		const groups = this.groups(spec);
		return {
			state: "cards",
			date: day.date,
			groups,
			model: day.model,
			emptyText: emptyTextFor(day.date, today),
			activitiesEmpty: activitiesEmptyFor(day.date, today),
			badges: badgesOf(groups, day.date, today),
			routes: routesOf(groups, offsetOfDay(day.date, today)),
			...withCaption,
		};
	}

	/** The block's day: its own `date:`, else its note's, else today (`dates.ts`). */
	private dateOf(spec: BlockSpec, today: string): CardDate {
		const app = this.plugin.app;
		const file = app.vault.getFileByPath(this.path);
		// The cache is current; a Live Preview context's frontmatter is empty.
		const frontmatter = (file && app.metadataCache.getFileCache(file)?.frontmatter) ?? (this.ctx.frontmatter as Record<string, unknown> | null | undefined) ?? null;
		return resolveCardDate({ explicit: spec.date, path: this.path, frontmatter, daily: dailyNotesOf(app), today, parse: parseDay });
	}

	private groups(spec: CardSpec): CardGroup[] {
		return groupsOf(spec, this.homeLayout());
	}

	/** Home's In Focus cards and At a Glance list, which a `day` block follows. */
	private homeLayout(): { inFocus: readonly FocusId[]; glance: readonly GlanceId[] } {
		const home = this.plugin.data.home;
		const preset = presetFor(home.preset);
		return { inFocus: preset.inFocus, glance: home.glance ?? preset.glance };
	}

	private act(kind: NoticeAction): void {
		if (kind === "set-up") this.plugin.openSetup();
		else if (kind === "settings") this.plugin.openSettings();
		else void this.plugin.openView(GARMIN_HOME_VIEW, { stack: areaStack("home") });
	}
}

/** What a chart or an activity block takes while it loads. */
function loadingHeight(spec: ChartSpec | ActivitySpec): number {
	if (spec.kind === "activity") return ACTIVITY_HEIGHT;
	if (spec.size === "small") return Math.ceil(spec.charts.length / 2) * (TREND_HEIGHT + 8) - 8;
	return spec.charts.length * (CHART_HEIGHT + 8) - 8;
}

/** The page each card opens, on the block's day, as on Home. */
function routesOf(groups: readonly CardGroup[], dayOffset: number): Extract<CardView, { state: "cards" }>["routes"] {
	const routes: Extract<CardView, { state: "cards" }>["routes"] = { focus: {}, glance: {} };
	for (const group of groups) {
		if (group.kind === "focus") for (const id of group.ids) routes.focus[id] = focusRoute(id, dayOffset, BUILT);
		else if (group.kind === "glance") for (const id of group.ids) routes.glance[id] = glanceRoute(id, dayOffset, BUILT);
	}
	return routes;
}

function badgesOf(groups: readonly CardGroup[], date: string, today: string): Partial<Record<GlanceId, string>> {
	const badges: Partial<Record<GlanceId, string>> = {};
	for (const group of groups) {
		if (group.kind !== "glance") continue;
		for (const id of group.ids) {
			const badge = badgeFor(id, date, today);
			if (badge) badges[id] = badge;
		}
	}
	return badges;
}
