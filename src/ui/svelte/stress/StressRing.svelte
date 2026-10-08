<script lang="ts">
	import { ringArcs, ringTrack } from "../../../dashboard/stress-charts";
	import type { RingPart } from "../../../dashboard/stress-pages";

	/**
	 * A day's stress as a ring, clockwise from twelve o'clock: rest, low,
	 * medium and high, each its share of the measured time, a 3.6° gap on
	 * every boundary. A day without any is the whole track in grey.
	 */
	let { parts, size, thickness }: { parts: RingPart[]; size: number; thickness: number } = $props();

	let arcs = $derived(ringArcs(parts, size, thickness));
	let track = $derived(ringTrack(size, thickness));
</script>

<svg class="stress-ring" width={size} height={size} viewBox="0 0 {size} {size}" aria-hidden="true">
	{#if arcs.length}
		{#each arcs as arc (arc.part)}<path class="part-{arc.part}" d={arc.d} stroke-width={thickness} />{/each}
	{:else}
		<circle class="part-none" cx={track.c} cy={track.c} r={track.r} stroke-width={thickness} />
	{/if}
</svg>

<style>
	.stress-ring {
		display: block;
		flex: none;
	}
	path,
	circle {
		fill: none;
	}
	.part-rest {
		stroke: var(--stress-rest);
	}
	.part-low {
		stroke: var(--stress-low);
	}
	.part-medium {
		stroke: var(--stress-medium);
	}
	.part-high {
		stroke: var(--stress-high);
	}
	.part-none {
		stroke: var(--stress-none);
	}
</style>
