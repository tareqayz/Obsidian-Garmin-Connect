<script lang="ts">
	import { batteryTimelinePlot, type BatteryTimelinePlot } from "../../../dashboard/body-battery-charts";
	import type { BatteryTimeline } from "../../../dashboard/body-battery-pages";
	import StatChart from "../health/StatChart.svelte";
	import SleepLegend, { type LegendEntry } from "../sleep/SleepLegend.svelte";

	/**
	 * The 1d Daily Timeline: the Body Battery step line over its grey area,
	 * dotted where Garmin estimated it, the stress bars under it, the night's
	 * lighter band and the Zz marker where it ended. Each chip hides its
	 * series, and the key drops what is hidden, as the phone does.
	 */
	let { timeline, pane }: { timeline: BatteryTimeline; pane: boolean } = $props();

	let shown = $state({ battery: true, rest: true, stress: true });
	const CHIPS = [
		{ id: "battery", label: "Body Battery" },
		{ id: "rest", label: "Rest" },
		{ id: "stress", label: "Stress" },
	] as const;

	let legend: LegendEntry[] = $derived([
		...(shown.battery ? [{ kind: "dot", label: "Body Battery", color: "var(--battery-line)" } as LegendEntry, { kind: "dashed", label: "Estimated", color: "var(--battery-line)" } as LegendEntry] : []),
		...(shown.rest ? [{ kind: "dot", label: "Rest", color: "var(--stress-rest)" } as LegendEntry] : []),
		...(shown.stress ? [{ kind: "dot", label: "Stress", color: "var(--stress-medium)" } as LegendEntry, { kind: "dot", label: "Active", color: "var(--text-faint)" } as LegendEntry] : []),
		{ kind: "ring", label: "Unmeasurable", color: "var(--text-muted)" },
	]);
</script>

<StatChart title="Daily Timeline" {pane} plot={(width) => batteryTimelinePlot(timeline, width, pane)}>
	{#snippet under(p: BatteryTimelinePlot)}
		{#if p.sleep}<rect class="night" x={p.sleep.x} y={p.top} width={p.sleep.w} height={p.baseline - p.top} />{/if}
		{#if shown.battery}{#each p.areas as d}<path class="area" {d} />{/each}{/if}
		{#if shown.stress}{#each p.active as a}<rect class="active" x={a.x} y={a.y} width={a.w} height={a.h} />{/each}{/if}
		{#each p.bars as bar}
			{#if bar.tone === "rest" ? shown.rest : shown.stress}<rect class="bar {bar.tone}" x={bar.x} y={bar.y} width={bar.w} height={bar.h} />{/if}
		{/each}
	{/snippet}
	{#snippet over(p: BatteryTimelinePlot)}
		{#if shown.battery}{#each p.lines as line}<path class="line" class:estimated={line.estimated} d={line.d} />{/each}{/if}
		{#if p.marker}
			<g class="zz" transform="translate({p.marker.x} {p.marker.y})">
				<circle r="9.5" />
				<text text-anchor="middle" dominant-baseline="central">Zz</text>
			</g>
		{/if}
	{/snippet}
	{#snippet footer()}
		<div class="legend"><SleepLegend items={legend} /></div>
		<div class="chips">
			{#each CHIPS as chip (chip.id)}
				<button class="chip" class:on={shown[chip.id]} aria-pressed={shown[chip.id]} onclick={() => (shown[chip.id] = !shown[chip.id])}>{chip.label}</button>
			{/each}
		</div>
	{/snippet}
</StatChart>

<style>
	.night {
		fill: var(--battery-sleep);
	}
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
	.zz circle {
		fill: var(--color-blue);
	}
	.zz text {
		fill: var(--text-on-accent);
		font-size: 8px;
		font-weight: 700;
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
