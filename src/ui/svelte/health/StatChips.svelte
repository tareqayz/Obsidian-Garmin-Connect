<script lang="ts">
	import { toggleChip, type ChipRule } from "../../../dashboard/stat-controls";
	import ShapeMarker, { type Shape } from "./ShapeMarker.svelte";

	/**
	 * A row of on/off chips under a chart (twin 443:431): Race Predictor's
	 * distances (several on), LT's Pace / Power / Power (W/kg), Chronic Load,
	 * Actual Distance, Overnight Averages. A chip may carry its series' marker.
	 */
	interface Chip {
		id: string;
		label: string;
		/** The series' marker before the label. */
		shape?: Shape;
		color?: string;
	}

	interface Props extends ChipRule {
		chips: readonly Chip[];
		/** The chips that are on. */
		selected: readonly string[];
		onchange: (selected: string[]) => void;
	}

	let { chips, selected, multi = false, required = false, onchange }: Props = $props();
</script>

<div class="stat-chips">
	{#each chips as chip (chip.id)}
		{@const on = selected.includes(chip.id)}
		<button class="chip" class:on aria-pressed={on} onclick={() => onchange(toggleChip(selected, chip.id, { multi, required }))}>
			{#if chip.shape && chip.color}<ShapeMarker shape={chip.shape} color={chip.color} />{/if}
			{chip.label}
		</button>
	{/each}
</div>

<style>
	.stat-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 0 15px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		box-sizing: border-box;
		height: 36px;
		margin: 0;
		padding: 7px 17px;
		border: none;
		border-radius: 18px;
		box-shadow: inset 0 0 0 1px var(--background-modifier-border);
		background: none;
		font: inherit;
		font-size: 18px;
		line-height: 22px;
		color: var(--text-normal);
		white-space: nowrap;
		cursor: pointer;
	}
	.chip.on {
		box-shadow: none;
		background: var(--background-modifier-border);
	}

	@container (min-width: 640px) {
		.stat-chips {
			padding: 0;
		}
	}
</style>
