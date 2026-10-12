<script lang="ts">
	import { RACE_CHIPS, type RaceChip, type RaceId } from "../../../dashboard/race-predictor-pages";
	import { toggleChip } from "../../../dashboard/stat-controls";

	/**
	 * The distances' chips (twin Race chips row 534:342): 32 pt pills, not
	 * the shared 36 pt Chip (`StatChips`), as the phone draws them — 17 pt
	 * labels, 17 pt of padding, 8 apart from x 15. On is filled, off an
	 * outline (536:648); several stay on, and the last one on stays on.
	 */
	let { chips, onchange }: { chips: readonly RaceChip[]; onchange: (on: RaceId[]) => void } = $props();

	let on = $derived(chips.filter((c) => c.on).map((c) => c.id));
</script>

<div class="race-chips">
	{#each chips as chip (chip.id)}
		<button class="chip" class:on={chip.on} aria-pressed={chip.on} onclick={() => onchange(toggleChip(on, chip.id, RACE_CHIPS) as RaceId[])}>
			{chip.label}
		</button>
	{/each}
</div>

<style>
	.race-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 0 15px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		box-sizing: border-box;
		height: 32px;
		margin: 0;
		padding: 5px 17px;
		border: none;
		border-radius: 16px;
		box-shadow: inset 0 0 0 1px var(--background-modifier-border);
		background: none;
		font: inherit;
		font-size: 17px;
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
		.race-chips {
			padding: 0;
		}
	}
</style>
