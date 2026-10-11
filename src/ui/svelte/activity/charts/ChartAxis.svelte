<svelte:options namespace="svg" />

<script lang="ts">
	/**
	 * A chart's axes inside its SVG: the y labels right-aligned at `labelRight`,
	 * the x axis' dots, labels and title. The twin's Axis style: 10 pt labels,
	 * 12 pt title, text-muted; the dots text-faint.
	 */
	interface Props {
		labelRight: number;
		yLabels: Array<{ y: number; text: string }>;
		dots: Array<{ x: number; y: number; r: number }>;
		xLabels: Array<{ x: number; y: number; text: string }>;
		xTitle: { x: number; y: number; text: string } | null;
	}

	let { labelRight, yLabels, dots, xLabels, xTitle }: Props = $props();
</script>

{#each yLabels as l, i (i)}
	<text class="tick" x={labelRight} y={l.y} text-anchor="end" dominant-baseline="central">{l.text}</text>
{/each}
{#each dots as d, i (i)}
	<circle class="axis-dot" cx={d.x} cy={d.y} r={d.r} />
{/each}
{#each xLabels as l, i (i)}
	<text class="tick" x={l.x} y={l.y} text-anchor="middle" dominant-baseline="central">{l.text}</text>
{/each}
{#if xTitle}
	<text class="axis-title" x={xTitle.x} y={xTitle.y} text-anchor="middle" dominant-baseline="central">{xTitle.text}</text>
{/if}

<style>
	.tick {
		fill: var(--text-muted);
		font-size: 10px;
	}
	.axis-title {
		fill: var(--text-muted);
		font-size: 12px;
	}
	.axis-dot {
		fill: var(--text-faint);
	}
</style>
