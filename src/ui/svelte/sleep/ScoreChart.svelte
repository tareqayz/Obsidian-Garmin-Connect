<script lang="ts">
	import { scorePlot } from "../../../dashboard/sleep-charts";
	import type { PeriodOverlay, SleepPeriodView } from "../../../dashboard/sleep-pages";
	import PeriodAxis from "./PeriodAxis.svelte";

	/** The period's sleep scores on 0–100, with the chosen overlay on its own axis at the right. */
	let { view, overlay }: { view: SleepPeriodView; overlay: PeriodOverlay | null } = $props();

	let width = $state(402);
	let plot = $derived(scorePlot(view, overlay, width));

	const TONE: Record<string, string> = {
		hr: "cyan",
		respiration: "cyan",
		rhr: "blue",
		bodyBattery: "blue",
		pulseOx: "blue",
		skin: "pink",
	};
	const STATUS: Record<string, string> = { BALANCED: "green", UNBALANCED: "orange", LOW: "red", POOR: "red" };
</script>

<div class="score-chart" bind:clientWidth={width}>
	<svg {width} height={plot.height} aria-hidden="true">
		{#each plot.grid as g}
			<line class="grid" x1={plot.left} x2={plot.right} y1={g.y} y2={g.y} />
			<text class="tick" x={plot.labelRight} y={g.y} text-anchor="end" dominant-baseline="central">{g.label}</text>
		{/each}
		<path class="score" d={plot.line} />
		{#each plot.dots as dot}<circle class="score-dot" cx={dot.x} cy={dot.y} r={plot.dotRadius} />{/each}
		{#if plot.overlay}
			{@const o = plot.overlay}
			{#if o.line}<path class="overlay tone-{TONE[o.id] ?? 'blue'}" d={o.line} />{/if}
			{#each o.marks as m}
				{#if o.kind === "dots"}
					<circle class="mark tone-{STATUS[m.status ?? ''] ?? 'green'}" cx={m.x} cy={m.y} r="4" />
				{:else}
					<rect class="mark tone-{TONE[o.id] ?? 'blue'}" x={m.x - 3.5} y={m.y - 3.5} width="7" height="7" />
				{/if}
			{/each}
			{#each o.labels as label}<text class="tick" x={o.labelX} y={label.y} dominant-baseline="central">{label.text}</text>{/each}
		{/if}
		<PeriodAxis axis={plot.axis} />
	</svg>
</div>

<style>
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--background-modifier-border);
	}
	.tick {
		fill: var(--text-muted);
		font-size: 12px;
	}
	.score {
		fill: none;
		stroke: var(--color-purple);
		stroke-width: 2;
		stroke-linejoin: round;
	}
	.score-dot {
		fill: var(--color-purple);
	}
	.overlay {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
	}
	.overlay.tone-cyan {
		stroke: var(--color-cyan);
	}
	.overlay.tone-blue {
		stroke: var(--color-blue);
	}
	.overlay.tone-pink {
		stroke: var(--color-pink);
	}
	.mark.tone-cyan {
		fill: var(--color-cyan);
	}
	.mark.tone-blue {
		fill: var(--color-blue);
	}
	.mark.tone-pink {
		fill: var(--color-pink);
	}
	.mark.tone-green {
		fill: var(--color-green);
	}
	.mark.tone-orange {
		fill: var(--color-orange);
	}
	.mark.tone-red {
		fill: var(--color-red);
	}
</style>
