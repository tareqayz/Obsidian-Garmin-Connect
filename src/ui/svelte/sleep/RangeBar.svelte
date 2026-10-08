<script lang="ts">
	import type { FactorView } from "../../../dashboard/sleep-pages";

	/**
	 * A stage's night against its optimal range: filled to the night's total,
	 * the range outlined at a fixed span, a tick at the total, and a check
	 * when it landed inside.
	 */
	let { range }: { range: NonNullable<FactorView["range"]> } = $props();

	const LEFT = 16;
	const SPAN = 370;
	const at = (fraction: number) => LEFT + fraction * SPAN;
</script>

<div class="range-bar">
	<svg width="402" height="44" viewBox="0 0 402 44" aria-hidden="true">
		<rect class="fill stage-{range.stage}" x={LEFT} y="11.3" width={Math.max(0, at(range.value) - LEFT)} height="8" />
		<rect class="optimal" x={at(range.low)} y="10.5" width={at(range.high) - at(range.low)} height="9.2" rx="4.6" />
		<rect class="marker" x={at(range.value) - 1} y="3.3" width="2" height="24" />
		<text class="label" x={LEFT + 0.7} y="34.9" dominant-baseline="central">0</text>
		<text class="label" x={at(range.low) + 0.7} y="34.9" dominant-baseline="central">{range.lowLabel}</text>
		<text class="label" x={at(range.high) - 0.7} y="34.9" text-anchor="end" dominant-baseline="central">{range.highLabel}</text>
		{#if range.inRange}<path class="check" d="M367 15.6 L372.5 21.2 L381.2 11.2" />{/if}
	</svg>
</div>

<style>
	svg {
		display: block;
		overflow: visible;
	}
	.stage-deep {
		fill: var(--gcs-deep);
	}
	.stage-light {
		fill: var(--gcs-light);
	}
	.stage-rem {
		fill: var(--color-pink);
	}
	.optimal {
		fill: none;
		stroke: var(--text-normal);
		stroke-width: 2;
	}
	.marker {
		fill: var(--text-normal);
	}
	.label {
		fill: var(--text-muted);
		font-size: 12px;
	}
	.check {
		fill: none;
		stroke: var(--color-green);
		stroke-width: 3;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
