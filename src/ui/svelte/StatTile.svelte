<script lang="ts">
	import { compact, percent, type Stats } from "../../dashboard/series";
	import Sparkline from "./Sparkline.svelte";
	import Meter from "./ui/Meter.svelte";

	interface Props {
		label: string;
		stats: Stats;
		unit?: string;
		format?: (value: number) => string;
		/** 1 when a rise is good, -1 when a fall is good, 0 when it is neither. */
		goodDirection: 1 | -1 | 0;
		/** Shown behind the "i" button. Omit and no button appears. */
		info?: string;
		/** The day's goal for this metric, when Garmin reports one. */
		goal?: number;
	}

	let { label, stats, unit = "", format, goodDirection, info, goal }: Props = $props();

	let showInfo = $state(false);

	let render = $derived(format ?? compact);
	// Only meaningful against the newest day — a goal averaged over a range is
	// not a thing anyone wants to read.
	let latest = $derived(stats.latest?.value);
	let showGoal = $derived(goal !== undefined && goal > 0 && latest !== undefined);
	let goalPercent = $derived(
		showGoal ? Math.round((latest! / goal!) * 100) : 0,
	);
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
	<div class="head">
		<div class="label">{label}</div>
		{#if info}
			<button
				class="icon"
				class:on={showInfo}
				aria-expanded={showInfo}
				aria-label="About {label}"
				title="About {label}"
				onclick={() => (showInfo = !showInfo)}>i</button
			>
		{/if}
	</div>
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
	{#if showGoal}
		<Meter
			value={latest!}
			max={goal!}
			label="{label} against goal"
			caption="{goalPercent}% of {render(goal!)}"
		/>
	{/if}

	<Sparkline points={stats.points.slice(-30)} />

	{#if showInfo && info}
		<p class="info">{info}</p>
	{/if}
</div>

<style>
	.tile {
		border: 1px solid var(--gcd-border);
		border-radius: 8px;
		padding: 12px 14px 10px;
		background: var(--gcd-surface);
		min-width: 0;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.label {
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		min-width: 0;
	}
	.icon {
		margin-left: auto;
		width: 18px;
		height: 18px;
		padding: 0;
		border-radius: 50%;
		border: 1px solid var(--gcd-border);
		background: transparent;
		color: var(--gcd-muted);
		font-size: 10px;
		line-height: 1;
		cursor: pointer;
		box-shadow: none;
		flex: none;
	}
	.icon:hover,
	.icon.on {
		background: var(--gcd-raised);
		color: var(--gcd-text);
	}
	.info {
		margin: 8px 0 0;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		line-height: 1.5;
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
		flex-wrap: wrap;
	}
	/* Wrap between the delta and its caption, never inside the caption. */
	.note {
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		white-space: nowrap;
	}
	.delta {
		white-space: nowrap;
	}
	.delta {
		display: inline-flex;
		align-items: baseline;
		gap: 2px;
		font-size: var(--font-ui-smaller, 12px);
		font-weight: 600;
	}
	/* The meter sits between the delta and the trend line: today against the
	   goal, then the shape of the last month. */
	.tile :global(.gcd-spark) {
		margin-top: 6px;
	}
	.delta.good { color: var(--gcd-good); }
	.delta.bad { color: var(--gcd-bad); }
	.delta.flat { color: var(--gcd-muted); }
	.arrow { font-size: 11px; }
</style>
