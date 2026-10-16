<script lang="ts">
	import { CHART_COLOURS } from "../../../../dashboard/activity-chart-pages";
	import { platformOffsetPlot } from "../../../../dashboard/cycling-activity-charts";
	import type { PlatformOffsetData } from "../../../../dashboard/cycling-metrics";
	import { PHONE } from "../../../../dashboard/stat-charts";
	import type { CardPlotProps } from "../charts/kinds";
	import { PEDAL_TONES } from "./pedal-art";

	/**
	 * Platform Offset (the twin's 951:177298): both pedals drawn from above, "+"
	 * outboard, each with its dashed centre line and the ride's average offset
	 * as a red line, the value under it ("--" for 0, as Garmin) and the pedal's
	 * name; a divider between them and the Center · Average key under both.
	 */
	let { card, layout }: CardPlotProps = $props();

	let measured = $state(0);
	let data = $derived(card.data as PlatformOffsetData);
	let p = $derived(platformOffsetPlot(data, measured || PHONE, layout));
</script>

<div class="gc-platform-offset" bind:clientWidth={measured} style:height="{p.height}px">
	<svg width={p.width} height={p.height} aria-hidden="true">
		<rect class="divider" x={p.divider.x - 0.5} y={p.divider.y1} width="1" height={p.divider.y2 - p.divider.y1} />
		{#each p.pedals as pedal, i (i)}
			<g transform={pedal.art.mirrored ? `translate(${pedal.art.x} ${pedal.art.y}) scale(-1 1)` : `translate(${pedal.art.x} ${pedal.art.y})`}>
				{#each PEDAL_TONES as tone, k (k)}
					<path d={tone.d} fill-rule="evenodd" transform={tone.dy ? `translate(0 ${tone.dy})` : undefined} style:fill={tone.paint} />
				{/each}
			</g>
			<line class="centre" x1={pedal.centre.x} x2={pedal.centre.x} y1={pedal.centre.y1} y2={pedal.centre.y2} />
			{#if pedal.average}
				<rect x={pedal.average.x - 1} y={pedal.average.y1} width="2" height={pedal.average.y2 - pedal.average.y1} style:fill={CHART_COLOURS.red} />
			{/if}
			<text class="value" x={pedal.value.x} y={pedal.value.y} text-anchor="middle" dominant-baseline="central" style:fill={CHART_COLOURS.red}>{pedal.value.text}</text>
			<text class="name" x={pedal.label.x} y={pedal.label.y} text-anchor="middle" dominant-baseline="central">{pedal.label.text}</text>
		{/each}
	</svg>
	<div class="keys" style:top="{p.keysY - 8}px">
		{#each data.keys as key (key.label)}
			<span class="key"><span class="swatch" style:background-color={CHART_COLOURS[key.colour]}></span>{key.label}</span>
		{/each}
	</div>
</div>

<style>
	.gc-platform-offset {
		position: relative;
		min-width: 0;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.divider {
		fill: var(--background-modifier-border);
	}
	.centre {
		stroke: var(--text-faint);
		stroke-width: 1.33;
		stroke-dasharray: 7.33 4;
	}
	.value,
	.name {
		font-size: 14px;
	}
	.name {
		fill: var(--text-normal);
	}
	/* The key: 12 pt squares, the words 10 pt after them, the pair centred under both pedals. */
	.keys {
		position: absolute;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		gap: 36.67px;
		font-size: 12px;
		line-height: 16px;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.key {
		display: inline-flex;
		align-items: center;
		gap: 10px;
	}
	.swatch {
		flex: none;
		width: 12px;
		height: 12px;
	}
</style>
