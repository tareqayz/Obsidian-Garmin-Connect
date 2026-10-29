import type { GlanceId } from "../dashboard/glance";
import type { FocusId, HomeModel } from "../dashboard/home";
import type { Route } from "../dashboard/routes";
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
	  };

/** What a notice's button does. */
export type NoticeAction = NonNullable<CardNotice["action"]>["kind"];
