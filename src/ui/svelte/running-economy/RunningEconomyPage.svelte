<script lang="ts">
	import { runningEconomyView } from "../../../dashboard/running-economy-pages";
	import type { AccountInfo } from "../../../sync/account";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { RUNNING_ECONOMY_INDEX, type RunningEconomyRow } from "../../../sync/running-economy-index";
	import StatPageShell from "../health/StatPageShell.svelte";
	import type { PerformanceStatPageProps } from "../performance/pages";
	import EconomyCurrent from "./EconomyCurrent.svelte";
	import EconomyPeriod from "./EconomyPeriod.svelte";

	/**
	 * Garmin Connect's Running Economy page (Performance Stats). Twin: Figma
	 * page 430:6114 — phones 752:3253 (Current), 752:3318 / 752:3488 /
	 * 752:3620 (4w / 12w / 1y); Inferred 752:3768 (12w −1), 752:3925 (a
	 * period without a reading), 752:3973 (no reading at all); panes 756:595
	 * (Current), 757:614 / 757:700 (12w / 1y).
	 *
	 * - Current has no period row: the reading's day goes over the dial, the
	 *   class and its copy under it (beside it in a pane).
	 * - 4w / 12w / 1y: the chart's title, the chart, its legend of the
	 *   points' classes and Avg / Best (the legend and the figures in the
	 *   370 pt column in a pane).
	 *
	 * Everything comes from the running-economy index, Current from its
	 * newest row or account.json's when that is newer, so the page works
	 * offline and fetches nothing on view.
	 */
	let { route, today, canSync, onBack, swap, readIndex, onSyncHistory, versions, history, readAccount }: PerformanceStatPageProps = $props();

	const KIND = RUNNING_ECONOMY_INDEX.kind;

	let rows = $state.raw<RunningEconomyRow[]>([]);
	let meta = $state.raw<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<RunningEconomyRow>(KIND).then(
			(index) => {
				if (!live) return;
				rows = index.rows;
				meta = index.meta;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	/* Current's fallback: the latest reading the account sync keeps. */
	let account = $state.raw<AccountInfo | null>(null);
	$effect(() => {
		void versions["#account"];
		let live = true;
		readAccount().then(
			(read) => {
				if (live) account = read;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	let complete = $derived(meta?.complete ?? false);
	let view = $derived(runningEconomyView(route, rows, { today, complete, account }));
</script>

<StatPageShell
	{route}
	{today}
	label={view.label}
	canGoBack={view.canGoBack}
	{onBack}
	{swap}
	history={{ title: RUNNING_ECONOMY_INDEX.title, windowDays: RUNNING_ECONOMY_INDEX.windowDays, complete, walking: history[KIND], canSync, onSync: () => onSyncHistory(KIND) }}
>
	{#snippet children({ pane })}
		{#if view.current}
			<EconomyCurrent current={view.current} />
		{:else}
			<EconomyPeriod {view} {pane} />
		{/if}
	{/snippet}
</StatPageShell>
