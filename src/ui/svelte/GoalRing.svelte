<script lang="ts">
	import { compact } from "../../dashboard/series";

	interface Props {
		label: string;
		value: number;
		goal: number;
		unit?: string;
		size?: number;
		format?: (value: number) => string;
	}

	let { label, value, goal, unit = "", size = 96, format }: Props = $props();

	let render = $derived(format ?? compact);
	let fraction = $derived(goal > 0 ? value / goal : 0);
	// The arc stops at the ring; the number below is what says 140%.
	let drawn = $derived(Math.max(0, Math.min(1, fraction)));

	let stroke = $derived(Math.max(6, Math.round(size * 0.1)));
	let radius = $derived((size - stroke) / 2);
	let circumference = $derived(2 * Math.PI * radius);
</script>

<div class="ring" style:width="{size}px">
	<svg width={size} height={size} viewBox="0 0 {size} {size}" role="img" aria-label="{label}: {render(value)}{unit} of {render(goal)}{unit}">
		<!-- Rotated so the arc starts at twelve o'clock, which is where a reader
		     expects a dial to begin. -->
		<g transform="rotate(-90 {size / 2} {size / 2})">
			<circle class="track" cx={size / 2} cy={size / 2} r={radius} stroke-width={stroke} />
			<circle
				class="value"
				class:met={fraction >= 1}
				cx={size / 2}
				cy={size / 2}
				r={radius}
				stroke-width={stroke}
				stroke-dasharray="{circumference} {circumference}"
				stroke-dashoffset={circumference * (1 - drawn)}
			/>
		</g>
		<text class="pct" x={size / 2} y={size / 2 + 5} text-anchor="middle">
			{Math.round(fraction * 100)}%
		</text>
	</svg>
	<div class="caption">
		<div class="label">{label}</div>
		<div class="numbers">
			<strong>{render(value)}{unit}</strong> <span class="of">of {render(goal)}{unit}</span>
		</div>
	</div>
</div>

<style>
	.ring {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.track {
		fill: none;
		stroke: var(--gcd-grid);
	}
	.value {
		fill: none;
		stroke: var(--gcd-series);
		stroke-linecap: round;
		transition: stroke-dashoffset 220ms ease;
	}
	/* Hitting the goal is the one moment worth a colour change. */
	.met {
		stroke: var(--gcd-good);
	}
	.pct {
		fill: var(--gcd-text);
		font-size: 15px;
		font-weight: 600;
	}
	.caption {
		text-align: center;
		min-width: 0;
	}
	.label {
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
	}
	.numbers {
		font-size: var(--font-ui-smaller, 12px);
		font-variant-numeric: tabular-nums;
	}
	.of {
		color: var(--gcd-muted);
	}
</style>
