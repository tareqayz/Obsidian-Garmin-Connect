<script lang="ts" module>
	import type { IndexHistoryProgress } from "../../../sync/day-index";

	/** What the history banner needs of a stat's day index. */
	export interface StatHistory {
		/** The index as its history command names it: "stress". */
		title: string;
		/** Days a history request covers, for the banner's estimate of a year. */
		windowDays: number;
		/** The index holds the whole history: no banner. */
		complete: boolean;
		/** A history walk in progress: `history[kind]`. */
		walking?: IndexHistoryProgress;
		canSync: boolean;
		onSync: () => void;
	}
</script>

<script lang="ts">
	import type { Snippet } from "svelte";
	import { HEALTH_RANGES } from "../../../dashboard/health-stats";
	import { stepRoute, switchRange, type PeriodRange, type PeriodRoute, type Span } from "../../../dashboard/periods";
	import { moveStatRoute, rangeControlOf, statOfRoute, type StatRoute } from "../../../dashboard/routes";
	import { statPeriodLabel, statSpan } from "../../../dashboard/stat-registry";
	import HistoryBanner from "../activities/HistoryBanner.svelte";
	import PageBar from "../home/PageBar.svelte";
	import { lucide } from "../home/lucide";

	/**
	 * A stat page around its body, Health Stats' and Performance Stats'
	 * alike: the bar with back and the stat's title, the range control with
	 * the stat's own ranges, the period with its steppers, all staying put
	 * while the rest scrolls; the history banner while the stat's index is
	 * still coming; and the body, told whether the page is laid out as the
	 * twins' 1190pt panes (from 1000pt), where a chart takes its pane frame.
	 *
	 * The stat is the route's section's (`statOfRoute`). The range control and
	 * the steppers move this page in place with the shared period rules
	 * (`periods.ts`): 1d reopens on the day it last showed, the others on the
	 * current period, "<" and ">" a period at a time, never past the current
	 * one; the page keeps its tab and sub-page (`moveStatRoute`). Health's
	 * range control is its own; Performance's is the compact or the wide one
	 * its stat names (`rangeControlOf`).
	 */
	interface Props {
		/** The page's route: its stat, range, period, remembered day, tab and sub-page. */
		route: StatRoute;
		today: string;
		/**
		 * The period's label: "Today", "Oct 2 - 8"; null for a page without a
		 * period (no stepper row). Left out, the shell words the period by the
		 * stat's span rule (`statPeriodLabel`).
		 */
		label?: string | null;
		/** The bar's title, where it is not the stat's: a sub-page's own name. */
		title?: string;
		/** "<": older data exists, or may (the index is still coming). */
		canGoBack?: boolean;
		/** ">": a later period exists. Left out, every period before the current one has one. */
		canGoForward?: boolean;
		onBack: () => void;
		/** Changes this page without adding a step: the props' `swap`. */
		swap: (route: StatRoute) => void;
		/** The stat's day index, for the banner; a stat without one leaves it out. */
		history?: StatHistory;
		/** Custom properties for the whole page, such as a stat's colours. */
		style?: string;
		/** The range control's segments, where they are not the stat's own. */
		ranges?: readonly PeriodRange[];
		/** The segments' names, where they are not the stat's own ("Current" for 1d). */
		rangeLabels?: Partial<Record<PeriodRange, string>>;
		/** False: the label alone, without "<" and ">" (VO₂ Max's Current, "Today"). */
		steppers?: boolean;
		/** "<" (−1) and ">" (+1) of the page's own, in place of a whole period: Hill Score's month page. */
		step?: (by: number) => void;
		/** Under the bar, over the range control and the period: Load's tabs. */
		top?: Snippet<[{ pane: boolean }]>;
		/**
		 * The page under the header, told whether it is laid out as a pane,
		 * the period it shows (`span`, null on 1d, by the stat's span rule) and
		 * given `move`, which switches this page in place: a day card's
		 * `dayCardRoute`, a week card's `weekCardRoute`.
		 */
		children: Snippet<[{ pane: boolean; move: (next: PeriodRoute<PeriodRange>) => void; span: Span | null }]>;
	}

	let {
		route,
		today,
		label,
		title,
		canGoBack = false,
		canGoForward,
		onBack,
		swap,
		history,
		style,
		ranges: ownRanges,
		rangeLabels: ownLabels,
		steppers = true,
		step,
		top,
		children,
	}: Props = $props();

	let stat = $derived(statOfRoute(route));
	let ranges: readonly PeriodRange[] = $derived(ownRanges ?? stat?.ranges ?? HEALTH_RANGES);
	let names = $derived(ownLabels ?? stat?.rangeLabels);
	let period: PeriodRoute<PeriodRange> = $derived(route.date ? { range: route.range, offset: route.offset, date: route.date } : { range: route.range, offset: route.offset });
	let span = $derived(stat ? statSpan(stat, period, today) : null);
	let shown = $derived(label !== undefined ? label : stat ? statPeriodLabel(stat, period, today) : null);
	let forward = $derived(canGoForward ?? route.offset < 0);
	/* Health's range control, or Performance's compact or wide one (twin 442:933). */
	let control = $derived(rangeControlOf(route, ranges.length));
	let perf = $derived(control.family !== "health");

	/* The twins' panes start at 1000pt. */
	let width = $state(0);
	let pane = $derived(width >= 1000);

	/** This page, moved: a range or a period. Never a new step. */
	function move(next: PeriodRoute<PeriodRange>) {
		swap(moveStatRoute(route, next));
	}

	/** "<" and ">": the page's own step, or a whole period. */
	function stepBy(by: number) {
		if (step) step(by);
		else move(stepRoute(period, by));
	}

	let banner = $derived.by(() => {
		if (!history || (history.complete && !history.walking)) return null;
		const walk = history.walking;
		if (walk) {
			const reached = walk.reached
				? new Date(`${walk.reached.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })
				: null;
			return { title: `Fetching ${history.title} history…`, detail: reached ? `Back to ${reached}` : "Starting…", busy: true };
		}
		const name = history.title.charAt(0).toUpperCase() + history.title.slice(1);
		const requests = Math.ceil(365 / Math.max(1, history.windowDays));
		return {
			title: `${name} history isn’t synced`,
			detail: `Charts cover only what’s synced. A year of history takes about ${requests} request${requests === 1 ? "" : "s"}.`,
			busy: false,
		};
	});
</script>

<div class="stat-page" {style} bind:clientWidth={width}>
	<div class="sticky">
		<PageBar title={title ?? stat?.title ?? ""} {onBack} />
		{@render top?.({ pane })}
		{#if shown !== null || ranges.length > 1}
		<div
			class="controls"
			class:single={ranges.length < 2}
			class:bare={shown === null}
			class:perf
			class:compact={control.family === "compact"}
			class:wide={control.family === "wide"}
		>
			{#if ranges.length > 1}
				<div class="range-control" style:width={control.width === undefined ? undefined : `${control.width}px`}>
					{#each ranges as range (range)}
						<button class:on={range === route.range} aria-pressed={range === route.range} onclick={() => move(switchRange(period, range, today))}>{names?.[range] ?? range}</button>
					{/each}
				</div>
			{/if}
			{#if shown !== null}
				{#if steppers}
				<div class="period">
					<button class="step" aria-label="Previous period" disabled={!canGoBack} onclick={() => stepBy(-1)}>
						<span use:lucide={"chevron-left"}></span>
					</button>
					<strong>{shown}</strong>
					<button class="step" class:hidden={!forward} aria-label="Next period" disabled={!forward} onclick={() => stepBy(1)}>
						<span use:lucide={"chevron-right"}></span>
					</button>
				</div>
				{:else}
				<div class="period plain"><strong>{shown}</strong></div>
				{/if}
			{/if}
		</div>
		{/if}
	</div>

	<div class="body">
		{#if banner && history}
			<div class="banner">
				<HistoryBanner title={banner.title} detail={banner.detail} busy={banner.busy} canSync={history.canSync} onSync={history.onSync} />
			</div>
		{/if}

		{@render children({ pane, move, span })}
	</div>
</div>

<style>
	.sticky {
		position: sticky;
		top: 0;
		z-index: 2;
		background: var(--background-primary);
	}
	/* The pane's scroller has top padding that the header sticks below, so
	   without a cover the page scrolls through that strip above it. */
	.sticky::before {
		content: "";
		position: absolute;
		left: 0;
		right: 0;
		bottom: 100%;
		height: 48px;
		background: var(--background-primary);
	}
	button {
		font: inherit;
		color: inherit;
		margin: 0;
		height: auto;
		border: none;
		box-shadow: none;
		background: none;
		cursor: pointer;
	}
	.controls {
		display: flex;
		flex-direction: column;
		align-items: center;
		box-sizing: border-box;
		height: 121px;
		padding-top: 22.3px;
	}
	/* No period: the range control alone (Fitness Age's Current). */
	.controls.bare {
		height: auto;
		padding-bottom: 14px;
	}
	/* A stat with one range keeps the period where the others have it: 22.3 + 34 + 25.9pt down. */
	.controls.single {
		padding-top: 82.2px;
	}
	/* 1d · 7d · 4w · 1y as the app's segmented control: Steps' RangeControl, with the stat's own ranges. */
	.range-control {
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-sizing: border-box;
		width: 338px;
		max-width: 100%;
		height: 34px;
		padding: 0 29.3px;
		border-radius: 4px;
		background: var(--background-modifier-border);
	}
	.range-control button {
		padding: 7px 0;
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
	}
	.range-control button.on {
		font-weight: 600;
		color: var(--text-normal);
	}
	.period {
		display: grid;
		grid-template-columns: 20px minmax(0, 1fr) 20px;
		align-items: center;
		box-sizing: border-box;
		width: 100%;
		margin-top: 25.9px;
		padding: 0 16px;
	}
	.single .period {
		margin-top: 0;
	}
	/* The label alone: no steppers either side. */
	.period.plain {
		grid-template-columns: minmax(0, 1fr);
	}
	/*
	 * Performance Stats' range controls (twin 442:933). Compact: 34 pt, its
	 * labels in 74 pt slots spaced across the stat's width (338 / 255 / 170),
	 * radius 3, 22 pt under the bar. Wide (VO₂ Max, Training Effect): 36 pt,
	 * packed 72 pt slots centred in 370 / 184, radius 4, 16 pt under the bar,
	 * the period 17.3 pt below it. A stat with one range has no control: its
	 * period sits 26 pt under the bar, or under the `top` slot (Load's tabs).
	 */
	.controls.compact {
		padding-top: 22px;
	}
	.controls.wide {
		height: 108.6px;
		padding-top: 16px;
	}
	.controls.perf.bare {
		height: auto;
		padding-bottom: 16px;
	}
	.controls.perf.single {
		height: auto;
		padding: 26px 0 16.8px;
	}
	.compact .range-control,
	.wide .range-control {
		padding: 0;
	}
	.compact .range-control {
		border-radius: 3px;
	}
	.wide .range-control {
		justify-content: center;
		height: 36px;
		border-radius: var(--radius-s, 4px);
	}
	.compact .range-control button {
		width: 74px;
		text-align: center;
	}
	.wide .range-control button {
		width: 72px;
		padding: 8px 0;
		text-align: center;
	}
	.wide .period {
		margin-top: 17.3px;
	}
	.period strong {
		font-size: 17px;
		line-height: 22px;
		font-weight: 700;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.step {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		padding: 0;
		border-radius: 50%;
		background: var(--background-modifier-border);
		color: var(--text-normal);
	}
	.step :global(svg) {
		width: 14px;
		height: 14px;
	}
	.step:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.step.hidden {
		visibility: hidden;
	}
	.banner {
		padding: 12.3px 16px 0;
	}

	@container (min-width: 640px) {
		/* Content-box: Obsidian makes everything border-box, which would take the padding out of the 1126. */
		.body {
			box-sizing: content-box;
			max-width: 1126px;
			margin: 0 auto;
			padding: 0 32px 32px;
		}
		.banner {
			padding: 16px 0 0;
		}
	}

	/* One row of controls: the range on the left, the period on the right. */
	@container (min-width: 1000px) {
		.controls,
		.controls.single {
			flex-direction: row;
			justify-content: space-between;
			height: 72px;
			padding: 0 32px;
			border-bottom: 1px solid var(--background-modifier-border);
		}
		.controls.single {
			justify-content: flex-end;
		}
		.controls.bare {
			height: 72px;
			padding-bottom: 0;
		}
		.period {
			display: flex;
			gap: 12px;
			width: auto;
			margin: 0;
			padding: 0;
		}
		.period .step.hidden {
			display: none;
		}
		.controls.perf,
		.controls.perf.bare,
		.controls.perf.single {
			height: 72px;
			padding: 0 32px;
		}
		.wide .period {
			margin: 0;
		}
	}
</style>
