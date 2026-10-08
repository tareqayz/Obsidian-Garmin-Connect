<script lang="ts">
	import { needPlot } from "../../../dashboard/sleep-charts";
	import type { CoachView } from "../../../dashboard/sleep-pages";

	/**
	 * The night's sleep need as a hatched bar from nothing to the need. When
	 * the coach moved the need off its baseline, a dashed box spans the gap
	 * and the baseline gets its own tick.
	 */
	let { coach, baselineLabel }: { coach: CoachView; baselineLabel?: string } = $props();

	let plot = $derived(needPlot(coach, baselineLabel));
	const id = `gcs-hatch-${Math.random().toString(36).slice(2, 8)}`;
	/** The bar's start, so the bar sits where the app draws it: a little left of centre. */
	const X = 100.7;
</script>

<div class="need">
	<svg width="402" height="76" viewBox="0 0 402 76" aria-hidden="true">
		<defs>
			<pattern {id} width="4.6" height="4.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
				<line x1="2.3" y1="0" x2="2.3" y2="4.6" class="stripe" />
			</pattern>
		</defs>
		<text class="need-label" x={X + plot.need + 0.75} y="8" text-anchor="middle" dominant-baseline="central">{plot.needLabel}</text>
		<rect x={X + 1.3} y="43" width={Math.max(0, plot.need - 1.3)} height="16" fill="url(#{id})" />
		<rect class="tick" x={X} y="35" width="1.4" height="24" />
		<rect class="tick" x={X + plot.need} y="19" width="1.5" height="40" />
		{#if plot.baseline !== undefined}
			{@const x1 = Math.min(plot.need, plot.baseline) + 2.3}
			{@const x2 = Math.max(plot.need, plot.baseline) - 0.8}
			{#if x2 > x1}<rect class="adjust" x={X + x1} y="43.5" width={x2 - x1} height="15" />{/if}
			<rect class="tick base" x={X + plot.baseline} y="37" width="1.4" height="22" />
			{#if plot.baselineLabel}
				<text class="base-label" x={X + plot.baseline + 0.7} y="77.4" text-anchor="middle" dominant-baseline="central">{plot.baselineLabel}</text>
			{/if}
		{/if}
	</svg>
</div>

<style>
	.need {
		display: flex;
		justify-content: center;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.stripe {
		stroke: var(--gcs-light);
		stroke-width: 1.4;
	}
	.need-label {
		fill: var(--text-normal);
		font-size: 13px;
		font-weight: 700;
	}
	.tick {
		fill: var(--text-normal);
	}
	.tick.base {
		fill: var(--text-muted);
	}
	.adjust {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 3 2;
	}
	.base-label {
		fill: var(--text-muted);
		font-size: 12px;
	}
</style>
