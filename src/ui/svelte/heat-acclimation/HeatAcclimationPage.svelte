<script lang="ts">
	import { heatAcclimationView } from "../../../dashboard/heat-acclimation-pages";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { HEAT_ACCLIMATION_INDEX, type HeatAcclimationRow } from "../../../sync/heat-acclimation-index";
	import StatPageShell from "../health/StatPageShell.svelte";
	import type { PerformanceStatPageProps } from "../performance/pages";
	import HeatDay from "./HeatDay.svelte";
	import HeatPeriod from "./HeatPeriod.svelte";

	/**
	 * Garmin Connect's Heat Acclimation page (Performance Stats), opened from
	 * Training Status's Heat Acclimation row and Home's Heat card. Twin: Figma
	 * page 430:6104 — phone (Light 630:8, Dark 630:113929) 1d 630:9, 7d
	 * 630:34, 4w 630:146; Inferred 1d 630:359 / 630:379 / 630:402 / 630:423
	 * and 4w − 1 630:439; panes (Light 631:560, Dark 631:114407) 631:561 /
	 * 631:591 / 631:679. The header is the shell's — the compact 1d · 7d · 4w
	 * control and the period stepper, no Help. 1d is the day's trend disc, %
	 * and trend line with ACCLIMATIZING's copy; 7d and 4w are Daily Progress
	 * and its key. Everything comes from the heat-acclimation index and the
	 * account's units, so the page works offline and asks nothing on view.
	 */
	let { route, today, units, canSync, onBack, swap, readIndex, onSyncHistory, versions, history }: PerformanceStatPageProps = $props();

	const KIND = HEAT_ACCLIMATION_INDEX.kind;

	let rows = $state.raw<HeatAcclimationRow[]>([]);
	let meta = $state.raw<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<HeatAcclimationRow>(KIND).then(
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

	let complete = $derived(meta?.complete ?? false);
	let view = $derived(heatAcclimationView(route, rows, { today, complete, units }));
</script>

<StatPageShell
	{route}
	{today}
	label={view.label}
	canGoBack={view.canGoBack}
	canGoForward={view.canGoForward}
	{onBack}
	{swap}
	history={{ title: HEAT_ACCLIMATION_INDEX.title, complete, walking: history[KIND], canSync, onSync: () => onSyncHistory(KIND) }}
>
	{#snippet children({ pane })}
		{#if view.range === "1d"}
			<HeatDay {view} />
		{:else}
			<HeatPeriod {view} {pane} />
		{/if}
	{/snippet}
</StatPageShell>
