<script lang="ts">
	import type { StepsView } from "../../../dashboard/home";
	import { scaleX } from "./geometry";
	import HomeCard from "./HomeCard.svelte";
	import Headline from "./Headline.svelte";

	let { steps }: { steps: StepsView | null } = $props();

	const W = 1000;
	const H = 100;

	/** Headroom above whichever is higher, the goal or the day's total. */
	let top = $derived(steps ? Math.max(steps.goal ?? 0, steps.steps, 1) * 1.08 : 1);
	let path = $derived(
		steps
			? steps.cumulative
					.map(([t, v], i) => `${i ? "L" : "M"}${scaleX(t, steps.from, steps.to, W).toFixed(1)} ${(H - ((v ?? 0) / top) * H).toFixed(1)}`)
					.join("")
			: "",
	);
	let goalY = $derived(steps?.goal ? H - (steps.goal / top) * H : undefined);
	let end = $derived.by(() => {
		const last = steps?.cumulative[steps.cumulative.length - 1];
		return last && steps ? { x: scaleX(last[0], steps.from, steps.to, 100), y: 100 - ((last[1] ?? 0) / top) * 100 } : undefined;
	});
</script>

<HomeCard kind="focus" title="Steps" icon="footprints" accent="var(--color-blue)" empty={!steps}>
	{#if steps}
		<Headline
			value={steps.steps.toLocaleString()}
			stats={[
				{ value: steps.goal?.toLocaleString(), label: "Goal" },
				{ value: steps.distance, label: "Distance" },
			]}
		/>
		<div class="plot">
			<svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" aria-hidden="true">
				{#if goalY !== undefined}<line class="goal" x1="0" x2={W} y1={goalY} y2={goalY} />{/if}
				<path class="line" d={path} />
			</svg>
			{#if end}<span class="dot" style:left="{end.x}%" style:top="{end.y}%"></span>{/if}
		</div>
		<div class="axis"><span>12 AM</span><span>12 AM</span></div>
		<div class="axis streaks">
			<span>Current Streak {steps.currentStreak}d</span>
			<span>Longest Streak {steps.longestStreak}d</span>
		</div>
	{/if}
</HomeCard>

<style>
	.plot {
		position: relative;
		flex: 1;
		min-height: 140px;
		border-bottom: 1px solid var(--background-modifier-border);
	}
	svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.goal {
		stroke: var(--text-muted);
		stroke-dasharray: 4 4;
		vector-effect: non-scaling-stroke;
	}
	.line {
		fill: none;
		stroke: var(--text-normal);
		stroke-width: 1.5;
		vector-effect: non-scaling-stroke;
	}
	.dot {
		position: absolute;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-normal);
		transform: translate(-50%, -50%);
	}
	.axis {
		display: flex;
		justify-content: space-between;
		color: var(--text-muted);
		font-size: 11px;
		line-height: 14px;
		padding-top: 6px;
	}
	.streaks {
		font-size: 12px;
		padding-top: 8px;
	}
</style>
