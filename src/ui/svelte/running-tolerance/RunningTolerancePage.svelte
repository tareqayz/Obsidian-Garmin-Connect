<script lang="ts">
	import { movedRoute, runningToleranceView, withDistance } from "../../../dashboard/running-tolerance-pages";
	import type { StatRoute } from "../../../dashboard/routes";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import {
		RUNNING_TOLERANCE_INDEX,
		RUNNING_TOLERANCE_WEEKS_INDEX,
		type RunningToleranceRow,
		type RunningToleranceWeekRow,
	} from "../../../sync/running-tolerance-index";
	import StatPageShell from "../health/StatPageShell.svelte";
	import type { PerformanceStatPageProps } from "../performance/pages";
	import ToleranceCurrent from "./ToleranceCurrent.svelte";
	import TolerancePeriod from "./TolerancePeriod.svelte";

	/**
	 * Garmin Connect's Running Tolerance page (Performance Stats). Twin: Figma
	 * page 430:6124 — phones 695:22 (Current), 695:103 (12w), 695:643 (12w ·
	 * Actual Distance), 695:897 (1y), 697:483 (1y · Actual Distance); Inferred
	 * 697:770 / 697:1000 (previous periods), 697:1250 (over the tolerance),
	 * 697:1330 (a Monday), 697:1546 / 697:1580 (no data); panes 700:1865,
	 * 701:1890, 702:2111.
	 *
	 * - Current: "Today" alone where the period goes, no steppers; the ring,
	 *   the phrase's title and copy, and three figures (`ToleranceCurrent`).
	 * - 12w / 1y: "Weekly Totals", the chart, its legend and the Actual
	 *   Distance chip (the route's `sub`), and the weeks, newest first
	 *   (`TolerancePeriod`). The chip holds through a period step and turns
	 *   off with a range switch (`movedRoute`).
	 *
	 * Current reads the daily index, 12w and 1y Garmin's weekly rows; the
	 * banner follows the one the range reads. Nothing is fetched on view.
	 */
	let { route, today, units, canSync, onBack, swap, readIndex, onSyncHistory, versions, history }: PerformanceStatPageProps = $props();

	const DAYS = RUNNING_TOLERANCE_INDEX.kind;
	const WEEKS = RUNNING_TOLERANCE_WEEKS_INDEX.kind;

	let days = $state.raw<RunningToleranceRow[]>([]);
	let daysMeta = $state.raw<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[DAYS];
		let live = true;
		readIndex<RunningToleranceRow>(DAYS).then(
			(index) => {
				if (!live) return;
				days = index.rows;
				daysMeta = index.meta;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	let weeks = $state.raw<RunningToleranceWeekRow[]>([]);
	let weeksMeta = $state.raw<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[WEEKS];
		let live = true;
		readIndex<RunningToleranceWeekRow>(WEEKS).then(
			(index) => {
				if (!live) return;
				weeks = index.rows;
				weeksMeta = index.meta;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	let view = $derived(runningToleranceView(route, { days, weeks }, { today, complete: weeksMeta?.complete ?? false, units }));
	let current = $derived(view.range === "1d" ? view : null);
	let period = $derived(view.range === "1d" ? null : view);

	/* The banner follows the index the range reads. */
	let index = $derived(current ? RUNNING_TOLERANCE_INDEX : RUNNING_TOLERANCE_WEEKS_INDEX);
	let complete = $derived((current ? daysMeta : weeksMeta)?.complete ?? false);

	/** The shell's range control and steppers: a range switch turns the chip off, which the shell would keep. */
	function move(next: StatRoute) {
		swap(movedRoute(route, next));
	}
</script>

<div class="rt-page" class:rt-today={current !== null}>
	<StatPageShell
		{route}
		{today}
		label={view.label}
		canGoBack={view.canGoBack}
		canGoForward={view.canGoForward}
		steppers={!current}
		{onBack}
		swap={move}
		history={{ title: index.title, windowDays: index.windowDays, complete, walking: history[index.kind], canSync, onSync: () => onSyncHistory(index.kind) }}
	>
		{#snippet children({ pane })}
			{#if current}
				<ToleranceCurrent view={current} />
			{:else if period}
				<TolerancePeriod view={period} {pane} onchip={(on) => swap(withDistance(route, on))} />
			{/if}
		{/snippet}
	</StatPageShell>
</div>

<style>
	/*
	 * Current's period row is "Today" alone (Period Nav · Today, 692:18): Body
	 * Semibold 15/20 with its row's top at 122.88, where the shell sets a
	 * compact page's label in Nav Title (17/22) at 125.86. The header keeps
	 * its 165; a pane keeps the shell's row, the label at its right in the
	 * same type (700:1865).
	 */
	.rt-today :global(.controls.compact .period.plain) {
		margin-top: 23.55px;
	}
	.rt-today :global(.controls.compact .period.plain strong) {
		font-size: 15px;
		line-height: 20px;
	}

	@container (min-width: 1000px) {
		.rt-today :global(.controls.compact .period.plain) {
			margin-top: 0;
		}
	}
</style>
