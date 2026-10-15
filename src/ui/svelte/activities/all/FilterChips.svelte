<script lang="ts">
	import type { AllChip, ChipKind } from "../../../../dashboard/all-activities";
	import { sportIcon } from "../../../sport-icons";
	import { lucide } from "../../home/lucide";

	/**
	 * The filters in force, one pill each (list/03): a figure, the label and a
	 * round × that drops that filter alone. On a phone the row scrolls
	 * sideways; a pane has room to wrap it. Type chips carry the sport's
	 * figure; the others an icon for what they filter (Inferred).
	 */
	let { chips, onRemove }: { chips: AllChip[]; onRemove: (chip: AllChip) => void } = $props();

	const ICONS: Readonly<Record<Exclude<ChipKind, "type">, string>> = {
		date: "calendar",
		distance: "ruler",
		time: "timer",
		ascent: "mountain",
		event: "tag",
		fav: "star",
		pr: "trophy",
	};

	const icon = (chip: AllChip) => (chip.glyph ? sportIcon(chip.glyph) : ICONS[chip.kind as Exclude<ChipKind, "type">]);
</script>

<div class="chips">
	{#each chips as chip (chip.key)}
		<span class="chip">
			<span class="glyph" use:lucide={icon(chip)}></span>
			<span class="label">{chip.label}</span>
			<button class="remove" aria-label="Remove {chip.label}" onclick={() => onRemove(chip)}>
				<span use:lucide={"x"}></span>
			</button>
		</span>
	{/each}
</div>

<style>
	.chips {
		display: flex;
		gap: 8px;
		margin: 0 -16px;
		padding: 0 16px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.chips::-webkit-scrollbar {
		display: none;
	}
	/* 40 tall, a pill: the figure 14 in, the label 36 in, the × 24 across and 12 from the end. */
	.chip {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 8px;
		box-sizing: border-box;
		height: 40px;
		padding: 0 12px 0 14px;
		border-radius: 20px;
		background: var(--background-modifier-border);
		color: var(--text-normal);
		white-space: nowrap;
	}
	.glyph {
		display: inline-flex;
	}
	.glyph :global(svg) {
		width: 14px;
		height: 14px;
	}
	.label {
		font-size: 15px;
		line-height: 20px;
	}
	.remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 24px;
		height: 24px;
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 50%;
		box-shadow: none;
		background: var(--background-modifier-border-hover);
		color: var(--text-normal);
		cursor: pointer;
	}
	.remove :global(svg) {
		width: 14px;
		height: 14px;
		stroke-width: 3px;
	}

	@container (min-width: 640px) {
		.chips {
			flex-wrap: wrap;
			margin: 0;
			padding: 0;
			overflow: visible;
		}
	}
</style>
