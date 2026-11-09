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
	/** A minute's waking is a sliver of the night: keep it a visible line. */
	const MIN_AWAKE = 3;

	let from = $derived(levels[0]?.start ?? 0);
	let to = $derived(levels[levels.length - 1]?.end ?? 1);
	let span = $derived(Math.max(1, to - from));
	/** Each stretch at its real width; awake last, so a waking widened to stay visible sits on top. */
	let bars = $derived(
		levels
			.map((l) => {
				const level = Math.max(0, Math.min(3, Math.round(l.level)));
				const w = Math.max(level === 3 ? MIN_AWAKE : 1, ((l.end - l.start) / span) * W);
				return { level, x: ((l.start - from) / span) * W, w, h: HEIGHT_OF[level]! * 100 };
			})
			.sort((a, b) => Number(a.level === 3) - Number(b.level === 3)),
	);
</script>

<svg class="hypno" viewBox="0 0 {W} 100" preserveAspectRatio="none" style:height="{height}px" aria-hidden="true">
	{#each bars as b}
		<rect class={CLASS_OF[b.level]} x={b.x} y={100 - b.h} width={b.w} height={b.h} />
	{/each}
</svg>

<style>
	.hypno {
		display: block;
		width: 100%;
	}
	.deep {
		fill: var(--gcs-deep);
	}
	.light {
		fill: var(--gcs-light);
	}
	.rem {
		fill: var(--gcs-rem);
	}
	.awake {
		fill: var(--gcs-awake);
	}
</style>
