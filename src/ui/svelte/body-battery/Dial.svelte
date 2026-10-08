<script lang="ts">
	import { DIAL, gaugeArcs, ringPath } from "../../../dashboard/body-battery-charts";
	import type { BatteryGauge, BatteryRing } from "../../../dashboard/body-battery-pages";

	/** Today's open gauge with the newest level over "100", or a past day's ring with its High and Low. */
	let { gauge, ring }: { gauge?: BatteryGauge; ring?: BatteryRing } = $props();
	let arcs = $derived(gauge ? gaugeArcs(gauge.segments) : []);
</script>

<div class="dial" style:width="{DIAL.size}px" style:height="{DIAL.size}px">
	<svg width={DIAL.size} height={DIAL.size} aria-hidden="true">
		{#if gauge}
			{#each arcs as arc}
				<path class="track" d={arc.track} stroke-width={DIAL.thickness} />
				{#if arc.fill}<path class="fill" d={arc.fill} stroke-width={DIAL.thickness} />{/if}
			{/each}
		{:else if ring}
			<path class={ring.filled ? "fill" : "track"} d={ringPath()} stroke-width={DIAL.thickness} />
		{/if}
	</svg>
	<div class="centre">
		{#if gauge}
			<span class="big">{gauge.value}</span>
			<span class="small">{gauge.max}</span>
		{:else if ring}
			<span class="big">{ring.high}</span>
			<span class="small">High</span>
			<span class="big">{ring.low}</span>
			<span class="small">Low</span>
		{/if}
	</div>
</div>

<style>
	.dial {
		position: relative;
		margin: 17px auto 0;
	}
	svg {
		display: block;
	}
	path {
		fill: none;
		stroke-linecap: round;
	}
	.track {
		stroke: var(--battery-track);
	}
	.fill {
		stroke: var(--battery-high);
	}
	.centre {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
	.big {
		font-size: 30px;
		line-height: 34px;
		font-variant-numeric: tabular-nums;
		color: var(--text-normal);
	}
	.small {
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
</style>
