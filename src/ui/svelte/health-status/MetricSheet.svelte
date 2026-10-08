<script lang="ts">
	import { bigRing, sheetPlot } from "../../../dashboard/health-status-charts";
	import type { HealthSheetView } from "../../../dashboard/health-status-pages";
	import { PHONE } from "../../../dashboard/stat-charts";
	import Ring from "./Ring.svelte";

	/**
	 * A metric's sheet: the big ring, the verdict, the typical range and the
	 * Sleep Averages chart of the 7 nights ending on the shown day (HRV adds
	 * its HRV Status figures). A sheet from the bottom on a phone, a centred
	 * dialog in a pane, like Body Battery's FactorSheet.
	 */
	let { view, onClose }: { view: HealthSheetView; onClose: () => void } = $props();
	let ring = $derived(view.metric.pct !== undefined ? bigRing(view.metric.pct, view.metric.status) : null);
	let measured = $state(0);
	let plot = $derived(sheetPlot(view, measured || PHONE));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="hs-backdrop" onclick={onClose}>
	<div class="hs-sheet" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === "Escape" && onClose()}>
		<header class="sheet-header">
			<span class="grabber"></span>
			<h2>{view.info.title}</h2>
			<button class="close" aria-label="Close" onclick={onClose}>
				<svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 1 L7 7 M7 1 L1 7" /></svg>
			</button>
		</header>
		<div class="body">
			<div class="gauge">
				{#if ring}<Ring {ring} big out={view.metric.group === "out"} />{/if}
				<div class="centre">
					<span class="big-value">{view.metric.value}</span>
					<span class="ring-label">{view.info.ringLabel}</span>
				</div>
			</div>
			<div class="heading">{view.heading}</div>
			<div class="copy">{view.copy}</div>
			{#if view.info.typicalRange && view.metric.range}
				<div class="typical">
					<span class="range">{view.metric.range}</span>
					<span class="label">Typical Range</span>
				</div>
			{/if}
			<h3>Sleep Averages</h3>
			<div class="chart" bind:clientWidth={measured} style:height="{plot.height}px">
				<svg width={plot.width} height={plot.height} aria-hidden="true">
					{#each plot.grid as g (g.label)}
						<line class="grid" x1={g.x1} x2={g.x2} y1={g.y} y2={g.y} />
						<text class="tick" x={g.x1} y={g.y - 6}>{g.label}</text>
					{/each}
					{#if plot.band}<path class="band" d={plot.band} />{/if}
					<path class="line" d={plot.line} />
					{#each plot.points as pt}<circle class="point" cx={pt.x} cy={pt.y} r="4" />{/each}
					{#each plot.dots as d}<circle class="dot" cx={d.x} cy={d.y} r={d.r} />{/each}
					{#each plot.labels as l}<text class="axis" x={l.x} y={l.y} text-anchor="middle" dominant-baseline="central">{l.text}</text>{/each}
				</svg>
			</div>
			<div class="legend">
				<span><i class="key line-key"></i>{view.info.lineName}</span>
				<span><i class="key band-key"></i>Typical Range</span>
			</div>
			{#if view.hrvStatus}
				<h3 class="hrv-title">Overnight HRV vs. HRV Status</h3>
				<div class="copy">Your overnight HRV range may be greater than your HRV status range, which is based on your 7-day HRV average.</div>
				<div class="figures">
					{#each view.hrvStatus as f (f.label)}
						<div><span class="figure">{f.value}{#if f.unit}<small> {f.unit}</small>{/if}</span><span class="label">{f.label}</span></div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.hs-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--layer-modal, 50);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		background: color-mix(in srgb, #000 40%, transparent);
	}
	.hs-sheet {
		width: 100%;
		max-height: 92%;
		overflow-y: auto;
		border-radius: 12px 12px 0 0;
		background: var(--background-primary);
		color: var(--text-normal);
		--hs-ring-halo: var(--background-primary);
	}
	@media (min-width: 1000px) {
		.hs-backdrop {
			align-items: center;
		}
		.hs-sheet {
			width: 402px;
			border-radius: 12px;
		}
		.grabber {
			display: none;
		}
	}
	.sheet-header {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 70px;
		padding: 10px 14px 0 16px;
		box-sizing: border-box;
		background: var(--background-secondary);
	}
	.grabber {
		position: absolute;
		top: 9px;
		left: calc(50% - 17.5px);
		width: 35px;
		height: 4px;
		border-radius: 2px;
		background: var(--text-faint);
	}
	h2 {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
	}
	.close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 50%;
		box-shadow: none;
		background: var(--background-modifier-border);
		cursor: pointer;
	}
	.close path {
		fill: none;
		stroke: var(--text-normal);
		stroke-width: 2;
		stroke-linecap: round;
	}
	.body {
		padding: 14px 16px 32px;
	}
	.gauge {
		position: relative;
		width: 190px;
		height: 175px;
		margin: 0 auto;
	}
	.centre {
		position: absolute;
		top: 60px;
		left: 0;
		right: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.big-value {
		font-size: 28px;
		line-height: 32px;
	}
	.ring-label,
	.copy,
	.label,
	.tick,
	.axis,
	.legend {
		color: var(--text-muted);
	}
	.ring-label {
		font-size: 14px;
	}
	.heading {
		margin-top: 28px;
		font-size: 16px;
		font-weight: 600;
	}
	.copy {
		margin-top: 6px;
		font-size: 15px;
		line-height: 21px;
	}
	.typical {
		display: flex;
		flex-direction: column;
		width: 177px;
		margin-top: 20px;
		padding-top: 8px;
		border-top: 1px solid var(--background-modifier-border);
	}
	.range,
	.figure {
		font-size: 20px;
		line-height: 26px;
	}
	.label {
		font-size: 13px;
	}
	h3 {
		margin: 32px 0 0;
		font-size: 16px;
		font-weight: 600;
	}
	.chart {
		margin: 0 -16px;
	}
	.chart svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--background-modifier-border);
	}
	.tick,
	.axis {
		fill: currentColor;
		font-size: 11px;
	}
	.band {
		fill: var(--background-modifier-hover);
	}
	.line {
		fill: none;
		stroke: var(--text-normal);
		stroke-width: 2;
	}
	.point {
		fill: var(--text-normal);
	}
	.dot {
		fill: var(--text-faint);
	}
	.legend {
		display: flex;
		justify-content: center;
		gap: 12px;
		font-size: 12px;
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.key {
		width: 17px;
		height: 17px;
		border-radius: 50%;
	}
	.line-key {
		background: var(--text-normal);
	}
	.band-key {
		background: var(--text-faint);
	}
	.hrv-title {
		font-size: 20px;
	}
	.figures {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		margin-top: 20px;
	}
	.figures div {
		display: flex;
		flex-direction: column;
		padding-top: 8px;
		border-top: 1px solid var(--background-modifier-border);
	}
	small {
		font-size: 14px;
	}
</style>
