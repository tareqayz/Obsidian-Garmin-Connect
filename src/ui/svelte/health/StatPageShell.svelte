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
	import { HEALTH_RANGES, pageStat } from "../../../dashboard/health-stats";
	import { stepRoute, switchRange, type PeriodRange, type PeriodRoute } from "../../../dashboard/periods";
	import type { HealthStatRoute } from "../../../dashboard/routes";
	import HistoryBanner from "../activities/HistoryBanner.svelte";
	import PageBar from "../home/PageBar.svelte";
	import { lucide } from "../home/lucide";

	/**
	 * A Health Stats page around its body: the bar with back and the stat's
	 * title, the range control with the stat's own ranges, the period with its
	 * steppers, all staying put while the rest scrolls; the history banner
	 * while the stat's index is still coming; and the body, told whether the
	 * page is laid out as the twins' 1190pt panes (from 1000pt), where a
	 * chart takes its pane frame.
	 *
	 * The range control and the steppers move this page in place with the
	 * shared period rules (`periods.ts`): 1d reopens on the day it last
	 * showed, the others on the current period, "<" and ">" a period at a
	 * time, never past the current one.
	 */
	interface Props {
		/** The page's route: its stat, range, period and remembered day. */
		route: HealthStatRoute;
		today: string;
		/** The period's label: "Today", "Oct 2 - 8". */
		label: string;
		/** "<": older data exists, or may (the index is still coming). */
		canGoBack: boolean;
		onBack: () => void;
		/** Changes this page without adding a step: the props' `swap`. */
		swap: (route: HealthStatRoute) => void;
		/** The stat's day index, for the banner; a stat without one leaves it out. */
		history?: StatHistory;
		/** Custom properties for the whole page, such as a stat's colours. */
		style?: string;
		/**
		 * The page under the header, told whether it is laid out as a pane and
		 * given `move`, which switches this page in place: a day card's
		 * `dayCardRoute`, a week card's `weekCardRoute`.
		 */
		children: Snippet<[{ pane: boolean; move: (next: PeriodRoute) => void }]>;
	}

	let { route, today, label, canGoBack, onBack, swap, history, style, children }: Props = $props();

	let stat = $derived(pageStat(route.stat));
	let ranges: readonly PeriodRange[] = $derived(stat?.ranges ?? HEALTH_RANGES);
	let period: PeriodRoute = $derived(route.date ? { range: route.range, offset: route.offset, date: route.date } : { range: route.range, offset: route.offset });
	let canGoForward = $derived(route.offset < 0);

	/* The twins' panes start at 1000pt. */
	let width = $state(0);
	let pane = $derived(width >= 1000);

	/** This page, moved: a range or a period. Never a new step. */
	function move(next: PeriodRoute) {
		const target: HealthStatRoute = { page: "health-stat", stat: route.stat, range: next.range, offset: next.offset };
		if (next.date) target.date = next.date;
		swap(target);
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
		<PageBar title={stat?.title ?? ""} {onBack} />
		<div class="controls" class:single={ranges.length < 2}>
			{#if ranges.length > 1}
				<div class="range-control">
					{#each ranges as range (range)}
						<button class:on={range === route.range} aria-pressed={range === route.range} onclick={() => move(switchRange(period, range, today))}>{range}</button>
					{/each}
				</div>
			{/if}
			<div class="period">
				<button class="step" aria-label="Previous period" disabled={!canGoBack} onclick={() => move(stepRoute(period, -1))}>
					<span use:lucide={"chevron-left"}></span>
				</button>
				<strong>{label}</strong>
				<button class="step" class:hidden={!canGoForward} aria-label="Next period" disabled={!canGoForward} onclick={() => move(stepRoute(period, 1))}>
					<span use:lucide={"chevron-right"}></span>
				</button>
			</div>
		</div>
	</div>

	<div class="body">
		{#if banner && history}
			<div class="banner">
				<HistoryBanner title={banner.title} detail={banner.detail} busy={banner.busy} canSync={history.canSync} onSync={history.onSync} />
			</div>
		{/if}

		{@render children({ pane, move })}
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
	}
</style>
