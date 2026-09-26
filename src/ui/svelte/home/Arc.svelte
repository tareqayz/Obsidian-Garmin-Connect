<script lang="ts">
	import { arcPath, clamp, polar } from "./geometry";

	/**
	 * A dial: a track, optional coloured segments, an optional marker, and a
	 * number in the middle. Covers Garmin's heart-rate gauge (270°, gap at the
	 * bottom), the Body Battery gauge, and the full rings (360°).
	 */
	interface Segment {
		from: number;
		to: number;
		color: string;
	}

	interface Props {
		size?: number;
		stroke?: number;
		/** Degrees the dial spans, centred on twelve o'clock. */
		sweep?: number;
		min?: number;
		max?: number;
		/** Filled from `min` to here, in `color`. */
		value?: number;
		color?: string;
		segments?: Segment[];
		/** A dot on the track, like the heart-rate gauge's marker. */
		marker?: number;
		label?: string;
		/** Gap in degrees between segments. */
		gap?: number;
	}

	let {
		size = 104,
		stroke = 6,
		sweep = 270,
		min = 0,
		max = 100,
		value,
		color = "var(--color-blue)",
		segments = [],
		marker,
		label,
		gap = 0,
	}: Props = $props();

	let r = $derived((size - stroke) / 2 - 2);
	let c = $derived(size / 2);
	let start = $derived(-sweep / 2);
	const angle = (v: number) => start + (clamp((v - min) / (max - min || 1), 0, 1)) * sweep;
	let markerAt = $derived(marker === undefined ? undefined : polar(c, c, r, angle(marker)));
</script>

<div class="arc" style:width="{size}px" style:height="{size}px">
	<svg width={size} height={size} viewBox="0 0 {size} {size}" aria-hidden="true">
		<path class="track" d={arcPath(c, c, r, start, start + sweep)} stroke-width={stroke} />
		{#each segments as s}
			{@const a0 = angle(s.from) + gap / 2}
			{@const a1 = angle(s.to) - gap / 2}
			{#if a1 > a0}
				<path d={arcPath(c, c, r, a0, a1)} stroke={s.color} stroke-width={stroke} fill="none" />
			{/if}
		{/each}
		{#if value !== undefined && value > min}
			<path d={arcPath(c, c, r, start, angle(value))} stroke={color} stroke-width={stroke} fill="none" />
		{/if}
		{#if markerAt}
			<circle class="marker" cx={markerAt[0]} cy={markerAt[1]} r={stroke} />
		{/if}
	</svg>
	{#if label !== undefined}<span class="label">{label}</span>{/if}
</div>

<style>
	.arc {
		position: relative;
		flex: none;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.track {
		fill: none;
		stroke: var(--background-modifier-border);
	}
	.marker {
		fill: var(--text-faint);
		stroke: var(--background-secondary);
		stroke-width: 2;
	}
	.label {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 22px;
		line-height: 26px;
		font-variant-numeric: tabular-nums;
	}
</style>
