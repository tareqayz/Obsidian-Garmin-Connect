<script lang="ts">
	import type { RingGeometry } from "../../../dashboard/health-status-charts";

	/**
	 * A Health Status ring: the blue in-range upper arc, the two lower arcs
	 * (grey on a card, orange on a sheet) and the marker in its halo.
	 */
	let { ring, big = false, out = false }: { ring: RingGeometry; big?: boolean; out?: boolean } = $props();
</script>

<svg class="hs-ring" class:big class:out width={ring.size} height={ring.size} viewBox="0 0 {ring.size} {ring.size}" aria-hidden="true">
	<path class="upper" d={ring.upper} stroke-width={ring.stroke} />
	<path class="lower" d={ring.left} stroke-width={ring.stroke} />
	<path class="lower" d={ring.right} stroke-width={ring.stroke} />
	<circle class="halo" cx={ring.marker.x} cy={ring.marker.y} r={ring.marker.halo} />
	<circle class="marker" cx={ring.marker.x} cy={ring.marker.y} r={ring.marker.r} />
</svg>

<style>
	.hs-ring {
		display: block;
		flex: none;
		overflow: visible;
	}
	path {
		fill: none;
		stroke-linecap: round;
	}
	.upper {
		stroke: var(--color-blue);
	}
	.lower {
		stroke: var(--text-faint);
	}
	.big .lower {
		stroke: var(--color-orange);
	}
	.halo {
		fill: var(--hs-ring-halo, var(--background-secondary));
	}
	.marker {
		fill: var(--color-blue);
	}
	.out .marker {
		fill: var(--color-orange);
	}
</style>
