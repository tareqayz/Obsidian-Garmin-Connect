import type { GlanceId, Tone } from "../dashboard/glance";
import type { FocusId, HomeModel } from "../dashboard/home";
import type { Route } from "../dashboard/routes";
import type { ActivityDetail } from "../sync/activity-detail";
import type { ChartModel, TrendLine } from "./chart-models";
import type { ChartId } from "./charts";
import type { CardGroup, CardNotice } from "./status";

/** What a card block draws, as `CardEmbed.svelte` takes it. Types only. */
export type CardView =
	| {
			state: "loading";
			caption?: string;
			/** Home's height for the cards to come, so the note doesn't jump. */
			height: number;
	  }
	| {
			state: "notice";
			caption?: string;
			notice: CardNotice;
	  }
	| {
			state: "cards";
			caption?: string;
			/** The day shown. */
			date: string;
			groups: CardGroup[];
			model: HomeModel;
			/** What a card says with nothing for the day. */
			emptyText: string;
			/** The same, for the day's activities. */
			activitiesEmpty: string;
			badges: Partial<Record<GlanceId, string>>;
			/** The page each card opens, or null for none. */
			routes: { focus: Partial<Record<FocusId, Route | null>>; glance: Partial<Record<GlanceId, Route | null>> };
	  }
	| {
			state: "charts";
			caption?: string;
			/** Small: a trend card each, four to a row on a desktop. */
			size: "normal" | "small";
			charts: ChartCardView[];
	  }
	| {
			state: "activities";
			caption?: string;
			activities: ActivityCardView[];
	  };

/** A figure under its label: "+51" over "Charged". */
export interface CardFigure {
	value: string;
	label: string;
}

/** One chart's card: its stat, its period, the figures over it, and the page's chart or why there is none. */
export interface ChartCardView {
	id: ChartId;
	title: string;
	icon: string;
	tone?: Tone;
	/** The period in the header: "Oct 22 – 28". A day's chart names its day only when it isn't the note's. */
	period?: string;
	/** The big figure, as an In Focus card's, and the figures beside it. */
	value?: string;
	figures: CardFigure[];
	body: { kind: "chart"; chart: ChartModel } | { kind: "none"; text: string };
	/** The small card's line: the period's values, oldest first. */
	trend?: TrendLine;
	/** The page the card opens, on its day or period. */
	route: Route;
}

/** One activity's card: its name and time, its figures, and its map once its details are in the vault. */
export interface ActivityCardView {
	id: number;
	title: string;
	/** "Sat, Oct 10 @ 8:19 AM". */
	when: string;
	/** The sport's figure, as `sportIcon` draws it. */
	icon: string;
	figures: CardFigure[];
	/** The activity's details as the vault holds them, for the map; null without a map to draw. */
	detail: ActivityDetail | null;
	/** Where the map would be, until the activity's page has loaded it. */
	mapNote?: string;
	/**
	 * The map as a still picture (a JPEG data URL), drawn when the note is
	 * exported to PDF: export prints at another width than it lays out, with
	 * no script to refit a live map, and a phone's copy of the page leaves its
	 * tiles behind.
	 */
	mapImage?: string;
	route: Route;
}

/** What a notice's button does. */
export type NoticeAction = NonNullable<CardNotice["action"]>["kind"];
