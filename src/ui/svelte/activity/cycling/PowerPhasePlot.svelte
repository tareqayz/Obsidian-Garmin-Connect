<script lang="ts">
	import { CHART_COLOURS, type ChartColour } from "../../../../dashboard/activity-chart-pages";
	import { powerPhasePlot } from "../../../../dashboard/cycling-activity-charts";
	import type { PowerPhaseData } from "../../../../dashboard/cycling-metrics";
	import { PHONE } from "../../../../dashboard/stat-charts";
	import type { CardPlotProps } from "../charts/kinds";

	/**
	 * Power Phase and Balance (the twin's 951:177178): a dial a pedal, its power
	 * phase on the ring and the peak proud of it, clockwise from TDC; the
	 * balance under each half; then the key, two blocks a row, each value over
	 * "Avg PP" / "Avg PPP" and Start or End. The arcs and squares take the
	 * twin's variables (`styles.css`'s `--gc-pedal-*`, `--gc-peak-*`).
	 */
	let { card, layout }: CardPlotProps = $props();

	let measured = $state(0);
	let data = $derived(card.data as PowerPhaseData);
	let p = $derived(powerPhasePlot(data, measured || PHONE, layout));

	const PAINT: Partial<Record<ChartColour, string>> = {
		"pedal-left": "var(--gc-pedal-left)",
		"pedal-right": "var(--gc-pedal-right)",
		"peak-left": "var(--gc-peak-left)",
		"peak-right": "var(--gc-peak-right)",
	};
	const paint = (colour: ChartColour) => PAINT[colour] ?? CHART_COLOURS[colour];
</script>

<div class="gc-power-phase" bind:clientWidth={measured} style:height="{p.height}px">
	<svg width={p.width} height={p.height} aria-hidden="true">
		{#each p.dials as dial, i (i)}
			{@const source = data.dials[i]}
			<circle class="track" cx={dial.cx} cy={dial.cy} r={dial.track.r} stroke-width={dial.track.width} />
			{#if dial.phase}<path d={dial.phase.d} style:fill={paint(dial.phase.colour)} />{/if}
			{#if dial.peak}<path d={dial.peak.d} style:fill={paint(dial.peak.colour)} />{/if}
			{#each dial.marks as mark, k (k)}
				<circle class="mark" class:quarter={mark.quarter} cx={mark.x} cy={mark.y} r={mark.r} />
			{/each}
			<text class="dead-centre" x={dial.tdc.x} y={dial.tdc.y} text-anchor="middle" dominant-baseline="central">TDC</text>
			<text class="dead-centre" x={dial.bdc.x} y={dial.bdc.y} text-anchor="middle" dominant-baseline="central">BDC</text>
			<text class="side" x={dial.label.x} y={dial.label.y} text-anchor="middle" dominant-baseline="central">{dial.label.text}</text>
			{#if dial.balance && source?.balance}
				<text class="balance" x={dial.balance.x} y={dial.balance.valueY} text-anchor="middle" dominant-baseline="central"
					><tspan class="balance-value">{source.balance.value}</tspan><tspan class="balance-unit">{source.balance.unit}</tspan></text
				>
				<text class="balance-label" x={dial.balance.x} y={dial.balance.labelY} text-anchor="middle" dominant-baseline="central">{source.balance.label}</text>
			{/if}
		{/each}
		{#each p.keys as key, i (i)}
			{@const block = data.keys[i]}
			{#if block}
				<rect x={key.square.x} y={key.square.y} width={key.square.size} height={key.square.size} style:fill={paint(block.colour)} />
				<text class="key-title" x={key.titleX} y={key.titleY} dominant-baseline="central">{block.title}</text>
				<line class="key-divider" x1={key.divider.x} x2={key.divider.x} y1={key.divider.y1} y2={key.divider.y2} />
				{#each key.values as at, k (k)}
					{@const value = block.values[k]}
					{#if value}
						<text class="key-value" x={at.x} y={at.valueY} text-anchor="middle" dominant-baseline="central">{value.value}</text>
						<text class="key-label" x={at.x} y={at.labelY} text-anchor="middle" dominant-baseline="central">{value.label}</text>
						<text class="key-label" x={at.x} y={at.subY} text-anchor="middle" dominant-baseline="central">{value.sub}</text>
					{/if}
				{/each}
			{/if}
		{/each}
	</svg>
</div>

<style>
	.gc-power-phase {
		position: relative;
		min-width: 0;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.track {
		fill: none;
		stroke: var(--background-modifier-border);
	}
	.mark {
		fill: var(--background-modifier-border);
	}
	.mark.quarter {
		fill: var(--text-muted);
	}
	.dead-centre {
		fill: var(--text-muted);
		font-size: 12px;
	}
	.side {
		fill: var(--text-normal);
		font-size: 15px;
	}
	.balance {
		fill: var(--text-normal);
	}
	.balance-value {
		font-size: 23px;
	}
	.balance-unit {
		font-size: 16px;
	}
	.balance-label,
	.key-title {
		fill: var(--text-muted);
		font-size: 14px;
	}
	.key-value {
		fill: var(--text-normal);
		font-size: 17px;
	}
	.key-label {
		fill: var(--text-muted);
		font-size: 12px;
	}
	.key-divider {
		stroke: var(--background-modifier-border);
		stroke-width: 0.5;
	}
</style>
