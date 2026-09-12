<script lang="ts">
	import type { Scale } from "../../dashboard/scales";
	import { anchorFor, xLabelIndices } from "../../dashboard/scales";
	import { shortDate } from "../../dashboard/series";

	interface Props {
		scale: Scale;
		dates: readonly string[];
		/** Overrides the axis-wide tick formatter, e.g. to add an "h". */
		format?: (value: number) => string;
		goal?: number;
	}

	let { scale, dates, format, goal }: Props = $props();

	let formatTick = $derived(format ?? scale.formatTick);
	let visibleTicks = $derived(
		scale.ticks.filter((t) => scale.y(t) >= -1 && scale.y(t) <= scale.inner.h + 1),
	);
	let labels = $derived(xLabelIndices(dates.length));
</script>

<g class="axes" aria-hidden="true">
	{#each visibleTicks as tick (tick)}
		<line class="grid" x1="0" x2={scale.inner.w} y1={scale.y(tick)} y2={scale.y(tick)} />
		<text class="tick" x="-8" y={scale.y(tick) + 4} text-anchor="end">{formatTick(tick)}</text>
	{/each}

	{#each labels as i (i)}
		<text
			class="tick"
			x={scale.x(i)}
			y={scale.inner.h + 18}
			text-anchor={anchorFor(i, dates.length)}>{shortDate(dates[i] ?? "")}</text
		>
	{/each}

	{#if goal !== undefined}
		<!-- Dashed on purpose: this is a real threshold, not a gridline. The card
		     subtitle names it, because an in-plot label collides with the bars. -->
		<line class="goal" x1="0" x2={scale.inner.w} y1={scale.y(goal)} y2={scale.y(goal)} />
	{/if}
</g>

<style>
	.grid {
		stroke: var(--gcd-grid);
		stroke-width: 1;
	}
	.goal {
		stroke: var(--gcd-axis);
		stroke-width: 1;
		stroke-dasharray: 4 4;
	}
	.tick {
		fill: var(--gcd-muted);
		font-size: 10px;
		font-variant-numeric: tabular-nums;
	}
</style>
