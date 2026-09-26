<script lang="ts">
	import type { SleepLevel } from "../../../sync/intraday";

	/**
	 * Garmin's sleep-stage chart: deep lowest, then light, REM, and awake as
	 * the tallest. Stage codes as `mapSeries` keeps them: 0 deep, 1 light,
	 * 2 REM, 3 awake.
	 */
	interface Props {
		levels: SleepLevel[];
		height?: number;
	}

	let { levels, height = 140 }: Props = $props();

	const W = 1000;
	const HEIGHT_OF = [0.3, 0.5, 0.78, 1];
	const CLASS_OF = ["deep", "light", "rem", "awake"];

	let from = $derived(levels[0]?.start ?? 0);
	let to = $derived(levels[levels.length - 1]?.end ?? 1);
	let span = $derived(Math.max(1, to - from));
</script>

<svg class="hypno" viewBox="0 0 {W} 100" preserveAspectRatio="none" style:height="{height}px" aria-hidden="true">
	{#each levels as l}
		{@const level = Math.max(0, Math.min(3, Math.round(l.level)))}
		{@const x = ((l.start - from) / span) * W}
		{@const w = Math.max(level === 3 ? 2 : 1, ((l.end - l.start) / span) * W)}
		{@const h = HEIGHT_OF[level]! * 100}
		<rect class={CLASS_OF[level]} x={x} y={100 - h} width={level === 3 ? Math.min(w, 4) : w} height={h} />
	{/each}
</svg>

<style>
	.hypno {
		display: block;
		width: 100%;
	}
	/* Garmin: deep is the dark blue, light the pale one drawn taller over it. */
	.deep {
		fill: color-mix(in srgb, var(--color-blue) 80%, #000);
	}
	.light {
		fill: color-mix(in srgb, var(--color-blue) 60%, #fff);
	}
	.rem {
		fill: var(--color-pink);
	}
	.awake {
		fill: color-mix(in srgb, var(--color-pink) 70%, transparent);
	}
</style>
