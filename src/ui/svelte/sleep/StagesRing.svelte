<script lang="ts">
	import { ringArcs } from "../../../dashboard/sleep-charts";
	import type { Stages } from "../../../dashboard/sleep-pages";

	/** The night's stages as a ring, clockwise from twelve: deep, light, REM, awake. */
	let { stages }: { stages: Stages } = $props();

	let arcs = $derived(ringArcs(stages.segments));
</script>

<div class="ring">
	<svg width="166" height="166" viewBox="0 0 166 166" aria-hidden="true">
		{#each arcs as arc}<path class={arc.stage} d={arc.d} />{/each}
	</svg>
	<div class="centre">
		<span class="total">{stages.total}</span>
		<span class="label">Total Sleep</span>
	</div>
</div>

<style>
	.ring {
		position: relative;
		width: 166px;
		height: 166px;
	}
	svg {
		display: block;
	}
	path {
		fill: none;
		stroke-width: 5.7;
	}
	.deep {
		stroke: var(--gcs-deep);
	}
	.light {
		stroke: var(--gcs-light);
	}
	.rem,
	.awake {
		stroke: var(--color-pink);
	}
	.awake {
		opacity: 0.7;
	}
	.centre {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding-bottom: 2px;
	}
	.total {
		font-size: 35px;
		line-height: 42px;
		white-space: nowrap;
	}
	.label {
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
</style>
