<script lang="ts">
	import type { Point } from "../../../dashboard/series";

	interface Props {
		label: string;
		value: string;
		unit?: string;
		/** Signed fraction against the prior window. Omit and no pill appears. */
		delta?: number;
		/** 1 when a rise is good, -1 when a fall is good, 0 when it is neither. */
		goodDirection?: 1 | -1 | 0;
		points?: readonly Point[];
		caption?: string;
	}

	let {
		label,
		value,
		unit,
		delta,
		goodDirection = 0,
		points = [],
		caption = "vs prior week",
	}: Props = $props();

	const H = 34;

	let hostWidth = $state(0);
	let width = $derived(Math.max(60, hostWidth));

	let rising = $derived((delta ?? 0) > 0);
	// A falling resting heart rate is good; a falling step count is not. The
	// arrow carries the direction and the tint only reinforces it — which is why
	// a card can legitimately show a down arrow in the positive green.
	let flat = $derived(delta === undefined || goodDirection === 0 || Math.abs(delta) < 0.005);
	let tone = $derived(flat ? "flat" : rising === (goodDirection === 1) ? "good" : "bad");
	let arrow = $derived(flat ? "→" : rising ? "↑" : "↓");

	let values = $derived(points.map((p) => p.value));
	let low = $derived(values.length ? Math.min(...values) : 0);
	let span = $derived((values.length ? Math.max(...values) : 1) - low || 1);
	let x = $derived((i: number) => (i / Math.max(1, values.length - 1)) * width);
	let y = $derived((v: number) => H - 3 - ((v - low) / span) * (H - 6));
	let line = $derived(values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" "));
	let area = $derived(values.length >= 2 ? `${line} L${width},${H} L0,${H} Z` : "");
</script>

<div class="stat">
	<div class="label">{label}</div>

	<div class="readout">
		<span class="value">{value}</span>
		{#if unit}<span class="unit">{unit}</span>{/if}
	</div>

	{#if delta !== undefined}
		<div class="delta">
			<span class="pill {tone}">
				<span class="arrow">{arrow}</span>
				<span class="percent">{(Math.abs(delta) * 100).toFixed(1).replace(/\.0$/, "")}%</span>
			</span>
			<span class="caption">{caption}</span>
		</div>
	{/if}

	<div class="trend" bind:clientWidth={hostWidth}>
		{#if hostWidth > 0 && values.length >= 2}
			<svg {width} height={H} viewBox="0 0 {width} {H}" aria-hidden="true">
				<path class="area" d={area} />
				<path class="line" d={line} />
			</svg>
		{/if}
	</div>
</div>

<style>
	.stat {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 14px 16px;
		border-radius: 12px;
		background: var(--v2-surface-card);
		box-shadow: var(--v2-shadow-1);
		min-width: 0;
	}
	.label {
		font-size: 11px;
		font-weight: 500;
		line-height: 1.2;
		letter-spacing: 0.44px;
		text-transform: uppercase;
		color: var(--v2-muted);
	}
	.readout {
		display: flex;
		align-items: baseline;
		gap: 5px;
	}
	.value {
		font-size: 24px;
		font-weight: 600;
		line-height: 1.15;
		color: var(--gcd-text);
	}
	.unit {
		font-size: 12px;
		color: var(--v2-muted);
	}
	.delta {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	/* v1 coloured the delta text. A tinted pill carries the same judgement
	   without asking a 12px glyph to hold the colour on its own. */
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 2px 7px 2px 6px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
	}
	.pill .arrow {
		font-size: 10px;
	}
	.pill.good {
		background: var(--v2-positive-tint);
		color: var(--v2-positive);
	}
	.pill.bad {
		background: var(--v2-negative-tint);
		color: var(--v2-negative);
	}
	.pill.flat {
		background: var(--gcd-raised);
		color: var(--v2-muted);
	}
	.caption {
		font-size: 12px;
		color: var(--v2-muted);
		white-space: nowrap;
	}
	.trend {
		width: 100%;
		min-height: 34px;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.area {
		fill: var(--v2-accent);
		fill-opacity: 0.14;
		stroke: none;
	}
	.line {
		fill: none;
		stroke: var(--v2-accent);
		stroke-width: 1.5;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
</style>
