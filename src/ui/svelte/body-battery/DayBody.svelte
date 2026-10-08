<script lang="ts">
	import type { BatteryDayView, BatteryFactor } from "../../../dashboard/body-battery-pages";
	import StatDayLayout from "../health/StatDayLayout.svelte";
	import StatFigures from "../health/StatFigures.svelte";
	import Dial from "./Dial.svelte";
	import FactorSheet from "./FactorSheet.svelte";
	import Timeline from "./Timeline.svelte";

	/**
	 * A day: today's gauge or a past day's ring, the feedback, the Charged and
	 * Drained tiles; then the Daily Timeline and the Factors, each opening its
	 * sheet. A pane puts the timeline and the Factors beside the rest.
	 */
	let { view, pane }: { view: BatteryDayView; pane: boolean } = $props();
	let open = $state<BatteryFactor | null>(null);
</script>

<StatDayLayout>
	{#snippet summary()}
		<Dial gauge={view.gauge} ring={view.ring} />
		{#if view.feedback}
			<div class="headline">{view.feedback.headline}</div>
			<!-- Not a <p>: Obsidian pads it. -->
			<div class="copy">{view.feedback.copy}</div>
		{/if}
		<div class="tiles"><StatFigures figures={view.tiles} /></div>
	{/snippet}
	{#snippet chart()}
		<Timeline timeline={view.timeline} {pane} />
		{#if view.factors.length}
			<section class="factors">
				<h3>Factors</h3>
				{#each view.factors as factor, i (i)}
					<button class="factor" onclick={() => (open = factor)}>
						<span class="text">
							<span class="label">{factor.label}{#if factor.info}<span class="info">i</span>{/if}</span>
							<span class="duration">{factor.duration}</span>
						</span>
						{#if factor.impact}
							<span class="impact">{factor.impact}</span>
							<span class="trend">{factor.trend === "up" ? "↑" : "↓"}</span>
						{/if}
					</button>
				{/each}
			</section>
		{/if}
	{/snippet}
</StatDayLayout>

{#if open}<FactorSheet factor={open} onClose={() => (open = null)} />{/if}

<style>
	.headline {
		margin-top: 28px;
		padding: 0 16px;
		font-size: 16px;
		line-height: 21px;
	}
	.copy {
		margin-top: 6px;
		padding: 0 16px;
		font-size: 13px;
		line-height: 18px;
		color: var(--text-normal);
	}
	.tiles {
		margin-top: 24px;
		padding: 0 16px;
	}
	.factors {
		margin-top: 24px;
		padding: 16px;
		background: var(--background-secondary-alt, var(--background-secondary));
	}
	h3 {
		margin: 0 0 12px;
		font-size: 16px;
		font-weight: 400;
	}
	.factor {
		display: flex;
		align-items: center;
		gap: 12px;
		box-sizing: border-box;
		width: 100%;
		height: auto;
		margin: 0 0 8px;
		padding: 14px 16px;
		border: none;
		border-radius: 8px;
		box-shadow: none;
		background: var(--background-secondary);
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.text {
		display: flex;
		flex: 1;
		flex-direction: column;
	}
	.label {
		font-weight: 600;
	}
	.info {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		margin-left: 6px;
		border-radius: 50%;
		background: var(--text-faint);
		color: var(--background-primary);
		font-size: 10px;
	}
	.duration {
		font-size: 13px;
		color: var(--text-muted);
	}
	.impact {
		font-size: 18px;
		font-variant-numeric: tabular-nums;
	}
	.trend {
		color: var(--text-muted);
	}
	@container (min-width: 1000px) {
		.headline,
		.copy,
		.tiles {
			padding: 0;
		}
	}
</style>
