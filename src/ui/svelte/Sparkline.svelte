<script lang="ts">
	import type { Point } from "../../dashboard/series";

	interface Props {
		points: readonly Point[];
	}

	let { points }: Props = $props();

	const W = 104;
	const H = 28;

	let values = $derived(points.map((p) => p.value));
	let min = $derived(Math.min(...values));
	let span = $derived(Math.max(...values) - min || 1);
	let x = $derived((i: number) => (i / Math.max(1, points.length - 1)) * (W - 6) + 3);
	let y = $derived((v: number) => H - 4 - ((v - min) / span) * (H - 8));
	let d = $derived(points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" "));
</script>

{#if points.length >= 2}
	<!-- The trend in the de-emphasis hue, the latest point in the accent. -->
	<svg width={W} height={H} viewBox="0 0 {W} {H}" aria-hidden="true">
		<path class="spark" {d} />
		<circle class="dot" cx={x(points.length - 1)} cy={y(values[values.length - 1] ?? 0)} r="2.5" />
	</svg>
{/if}

<style>
	svg {
		display: block;
		margin-top: 6px;
		overflow: visible;
	}
	.spark {
		fill: none;
		stroke: var(--gcd-muted);
		stroke-width: 1.5;
		stroke-linejoin: round;
		stroke-linecap: round;
		opacity: 0.7;
	}
	.dot {
		fill: var(--gcd-series);
		stroke: var(--gcd-surface);
		stroke-width: 2;
	}
</style>
