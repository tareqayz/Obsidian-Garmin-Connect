<script lang="ts">
	import { compact, percent, type Stats } from "../../dashboard/series";
	import Sparkline from "./Sparkline.svelte";

	interface Props {
		label: string;
		stats: Stats;
		unit?: string;
		format?: (value: number) => string;
		/** 1 when a rise is good, -1 when a fall is good, 0 when it is neither. */
		goodDirection: 1 | -1 | 0;
	}

	let { label, stats, unit = "", format, goodDirection }: Props = $props();

	let render = $derived(format ?? compact);
	let delta = $derived(stats.delta);
	let rising = $derived((delta ?? 0) > 0);
	// A falling resting heart rate is good; a falling step count is not. The
	// arrow carries the direction and colour only reinforces it.
	let tone = $derived(
		delta === undefined || goodDirection === 0
			? "flat"
			: Math.abs(delta) < 0.005
				? "flat"
				: rising === (goodDirection === 1)
					? "good"
					: "bad",
	);
</script>

<div class="tile">
	<div class="label">{label}</div>
	<div class="value">{stats.latest ? render(stats.latest.value) + unit : "—"}</div>
	<div class="foot">
		{#if delta !== undefined && goodDirection !== 0}
			<span class="delta {tone}">
				<span class="arrow">{rising ? "↑" : "↓"}</span>
				<span>{percent(delta)}</span>
			</span>
			<span class="note">vs prior week</span>
		{:else if stats.mean !== undefined}
			<span class="note">avg {render(stats.mean)}</span>
		{/if}
	</div>
	<Sparkline points={stats.points.slice(-30)} />
</div>

<style>
	.tile {
		border: 1px solid var(--gcd-border);
		border-radius: 8px;
		padding: 12px 14px 10px;
		background: var(--gcd-surface);
		min-width: 0;
	}
	.label {
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
	}
	/* Proportional figures: tabular makes a large number look loose. */
	.value {
		font-size: 26px;
		font-weight: 600;
		line-height: 1.2;
		margin-top: 2px;
	}
	.foot {
		display: flex;
		align-items: baseline;
		gap: 6px;
		min-height: 18px;
		margin-top: 2px;
	}
	.note {
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
	}
	.delta {
		display: inline-flex;
		align-items: baseline;
		gap: 2px;
		font-size: var(--font-ui-smaller, 12px);
		font-weight: 600;
	}
	.delta.good { color: var(--gcd-good); }
	.delta.bad { color: var(--gcd-bad); }
	.delta.flat { color: var(--gcd-muted); }
	.arrow { font-size: 11px; }
</style>
