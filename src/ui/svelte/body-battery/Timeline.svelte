<script lang="ts">
	import { batteryTimelinePlot, type BatteryTimelinePlot } from "../../../dashboard/body-battery-charts";
	import type { BatteryTimeline } from "../../../dashboard/body-battery-pages";
	import StatChart from "../health/StatChart.svelte";
	import TimelineMarker from "../health/TimelineMarker.svelte";
	import SleepLegend, { type LegendEntry } from "../sleep/SleepLegend.svelte";

	/**
	 * The 1d Daily Timeline: the Body Battery step line over its grey area,
	 * dotted where Garmin estimated it, the stress bars under it, the active
	 * runs in a strip under the 0 line (unmeasurable ones stay blank, the
	 * key's empty ring), and the marker row's
	 * discs: Zz where sleep or a nap began, the alarm clock at wake, the
	 * day's activities. Each chip hides its series, and the key drops what is
	 * hidden, as the phone does; "Estimated" only shows on a day with an
	 * estimated stretch. A card in a note has no chips (`chips` false): it
	 * draws every series.
	 */
	let { timeline, pane, chips = true }: { timeline: BatteryTimeline; pane: boolean; chips?: boolean } = $props();

	let shown = $state({ battery: true, rest: true, stress: true });
	const CHIPS = [
		{ id: "battery", label: "Body Battery" },
		{ id: "rest", label: "Rest" },
		{ id: "stress", label: "Stress" },
	] as const;

	let estimated = $derived(timeline.curve.some((s) => s.estimated === true));
	let legend: LegendEntry[] = $derived([
		...(shown.battery ? [{ kind: "dot", label: "Body Battery", color: "var(--battery-line)" } as LegendEntry] : []),
		...(shown.battery && estimated ? [{ kind: "dashed", label: "Estimated", color: "var(--battery-line)" } as LegendEntry] : []),
		...(shown.rest ? [{ kind: "dot", label: "Rest", color: "var(--stress-rest)" } as LegendEntry] : []),
		...(shown.stress ? [{ kind: "dot", label: "Stress", color: "var(--stress-medium)" } as LegendEntry, { kind: "dot", label: "Active", color: "var(--text-faint)" } as LegendEntry] : []),
		{ kind: "ring", label: "Unmeasurable", color: "var(--text-muted)" },
	]);
</script>

<StatChart title="Daily Timeline" {pane} plot={(width) => batteryTimelinePlot(timeline, width, pane)}>
	{#snippet under(p: BatteryTimelinePlot)}
		{#if shown.battery}{#each p.areas as d}<path class="area" {d} />{/each}{/if}
		{#each p.bars as bar}
			{#if bar.tone === "rest" ? shown.rest : shown.stress}<rect class="bar {bar.tone}" x={bar.x} y={bar.y} width={bar.w} height={bar.h} />{/if}
		{/each}
	{/snippet}
	{#snippet over(p: BatteryTimelinePlot)}
		{#if shown.battery}{#each p.lines as line}<path class="line" class:estimated={line.estimated} d={line.d} />{/each}{/if}
		{#if shown.stress}{#each p.active as a}<rect class="active" x={a.x} y={a.y} width={a.w} height={a.h} />{/each}{/if}
		{#each p.markers as m}<TimelineMarker kind={m.kind} x={m.x} y={m.y} glyph={m.glyph} />{/each}
	{/snippet}
	{#snippet footer()}
		<div class="legend"><SleepLegend items={legend} /></div>
		{#if chips}
			<div class="chips">
				{#each CHIPS as chip (chip.id)}
					<button class="chip" class:on={shown[chip.id]} aria-pressed={shown[chip.id]} onclick={() => (shown[chip.id] = !shown[chip.id])}>{chip.label}</button>
				{/each}
			</div>
		{/if}
	{/snippet}
</StatChart>

<style>
	.area {
		fill: var(--battery-area);
	}
	.line {
		fill: none;
		stroke: var(--battery-line);
		stroke-width: 2;
		stroke-linejoin: round;
	}
	.line.estimated {
		stroke-dasharray: 2 3;
	}
	.bar.rest {
		fill: var(--stress-rest);
	}
	.bar.stress {
		fill: var(--stress-medium);
	}
	.active {
		fill: var(--text-faint);
	}
	.legend {
		margin-top: 8px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 12px 16px 0;
	}
	.chip {
		height: 36px;
		margin: 0;
		padding: 8px 17px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 18px;
		box-shadow: none;
		background: transparent;
		color: var(--text-muted);
		font: inherit;
		cursor: pointer;
	}
	.chip.on {
		background: var(--background-modifier-border);
		color: var(--text-normal);
	}
</style>
