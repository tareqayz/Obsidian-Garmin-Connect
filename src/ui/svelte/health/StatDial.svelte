<script lang="ts">
	import type { Gauge } from "../../../dashboard/gauges";
	import { DIAL_KINDS, DIAL_SIZE, dialGeometry, type DialKind } from "../../../dashboard/stat-dial";
	import { toneColor } from "../home/tones";

	/**
	 * A Performance Stats dial (twin 442:1349): a gauge's bands over 300°
	 * with round ends, its marker in its band's colour, and the value with
	 * a line under it; or, for Running Tolerance, a full ring filled to its
	 * share. Each kind's ring, gaps, marker and type come from its twin
	 * (`DIAL_KINDS`); the geometry is `dialGeometry`'s. 196 pt square, so a
	 * page centres it on its dial's centre.
	 */
	interface Props {
		kind: DialKind;
		/** The bands, the marker's place (`at`) and its colour (`tone`); the value and label when not given below. */
		gauge?: Pick<Gauge, "segments" | "at" | "tone" | "value" | "label"> | null;
		/** A full ring's filled share, 0–1, from 12 o'clock (Running Tolerance). */
		progress?: number;
		/** The number in the middle: "55", "28.2 km". */
		value?: string;
		/** A unit set after the number on its baseline: HRV Status's "ms". */
		unit?: string;
		/** The line under the number: a class ("Excellent"), "100", "7d Avg". */
		label?: string;
		/** False leaves the marker off. */
		marker?: boolean;
		/** A full ring's fill. */
		color?: string;
	}

	let { kind, gauge = null, progress, value, unit, label, marker = true, color = "var(--color-blue)" }: Props = $props();

	let spec = $derived(DIAL_KINDS[kind]);
	let g = $derived(dialGeometry(kind, gauge, progress));
	let shown = $derived(value ?? gauge?.value ?? "");
	let line = $derived(label ?? gauge?.label);
</script>

<div class="stat-dial">
	<svg width={DIAL_SIZE} height={DIAL_SIZE} viewBox="0 0 {DIAL_SIZE} {DIAL_SIZE}" aria-hidden="true">
		{#if g.track}<path class="track" d={g.track} stroke-width={g.width} />{/if}
		{#if g.progress}<path class="arc" d={g.progress} stroke={color} stroke-width={g.width} />{/if}
		{#if g.separators}<path class="separators" d={g.separators} stroke-width={g.width} />{/if}
		{#each g.bands as band, i (i)}
			<path class="arc" d={band.d} stroke={toneColor(band.tone)} stroke-width={g.width} />
		{/each}
		{#each g.caps as cap, i (i)}
			<circle cx={cap.x} cy={cap.y} r={cap.r} fill={toneColor(cap.tone)} />
		{/each}
		{#if marker && g.marker}
			<circle class="outline" cx={g.marker.x} cy={g.marker.y} r={g.marker.r + g.marker.outline} />
			<circle cx={g.marker.x} cy={g.marker.y} r={g.marker.r} fill={toneColor(g.marker.tone) ?? "var(--text-faint)"} />
		{/if}
	</svg>
	<div class="value" style:top="{spec.value.top}px" style:font-size="{spec.value.size}px" style:line-height="{spec.value.line}px">
		<span>{shown}</span>
		{#if unit && spec.unit}<span class="unit" style:font-size="{spec.unit.size}px" style:line-height="{spec.unit.line}px">{unit}</span>{/if}
	</div>
	{#if line}
		<div class="label" class:strong={spec.label.strong} style:top="{spec.label.top}px" style:font-size="{spec.label.size}px" style:line-height="{spec.label.line}px">{line}</div>
	{/if}
</div>

<style>
	.stat-dial {
		position: relative;
		flex: none;
		width: 196px;
		height: 196px;
		color: var(--text-normal);
	}
	svg {
		display: block;
		overflow: visible;
	}
	.arc,
	.track,
	.separators {
		fill: none;
	}
	.track {
		stroke: var(--background-modifier-border);
	}
	/* The twin's dial/separator: the page shows between VO₂ Max's bands. */
	.separators,
	.outline {
		stroke: var(--background-primary);
	}
	.outline {
		fill: var(--background-primary);
		stroke: none;
	}
	/* Both lines are 170 pt boxes centred on the dial, as the twin sets them. */
	.value,
	.label {
		position: absolute;
		left: 13px;
		width: 170px;
		text-align: center;
		white-space: nowrap;
	}
	.value {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 1px;
		font-variant-numeric: tabular-nums;
	}
	.label {
		color: var(--text-muted);
	}
	.label.strong {
		color: var(--text-normal);
	}
</style>
