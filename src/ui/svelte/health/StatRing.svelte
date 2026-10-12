<script lang="ts">
	import { DIAL_SIZE } from "../../../dashboard/stat-dial";

	/**
	 * A full ring of slices with a value and a line in the middle: Endurance
	 * Score's Top Contributors ring (twin 581:116). Each slice is a stroked,
	 * butt-ended arc in its own colour; the gaps between them show the page.
	 * Drawn in a Stat Dial's 196 pt box (centre 98, 98), so a page places it
	 * as it places a dial and a stat's geometry draws the arcs with
	 * `dialArc` on the ring's centreline.
	 */
	interface Text {
		/** The line box's top in the 196 box, the font size and the line height. */
		top: number;
		size: number;
		line: number;
	}

	interface Props {
		/** The slices, clockwise: an SVG arc on the centreline each, and its colour. */
		arcs: ReadonlyArray<{ d: string; color: string }>;
		/** The ring's width. */
		width: number;
		/** The number in the middle: "6,413". */
		value?: string;
		/** The line under it: "Trained". */
		label?: string;
		valueText: Text;
		labelText: Text;
	}

	let { arcs, width, value, label, valueText, labelText }: Props = $props();
</script>

<div class="stat-ring">
	<svg width={DIAL_SIZE} height={DIAL_SIZE} viewBox="0 0 {DIAL_SIZE} {DIAL_SIZE}" aria-hidden="true">
		{#each arcs as arc, i (i)}
			<path d={arc.d} stroke={arc.color} stroke-width={width} />
		{/each}
	</svg>
	{#if value}
		<div class="value" style:top="{valueText.top}px" style:font-size="{valueText.size}px" style:line-height="{valueText.line}px">{value}</div>
	{/if}
	{#if label}
		<div class="label" style:top="{labelText.top}px" style:font-size="{labelText.size}px" style:line-height="{labelText.line}px">{label}</div>
	{/if}
</div>

<style>
	.stat-ring {
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
	path {
		fill: none;
		stroke-linecap: butt;
	}
	/* Both lines are 200 pt boxes centred on the ring, as the twin sets them. */
	.value,
	.label {
		position: absolute;
		left: -2px;
		width: 200px;
		text-align: center;
		white-space: nowrap;
	}
	.value {
		font-variant-numeric: tabular-nums;
	}
	.label {
		color: var(--text-muted);
	}
</style>
