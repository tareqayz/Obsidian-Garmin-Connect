<script lang="ts">
	import type { AllCard } from "../../../../dashboard/all-activities";
	import { discColour } from "../../../../dashboard/training-effect-charts";
	import { sportIcon } from "../../../sport-icons";
	import { lucide } from "../../home/lucide";

	/**
	 * An activity in the list (list/01): the sport's disc, the name over the
	 * date, the value at the right. 370 × 74 on a phone, radius 8: the disc
	 * 40 across and 16 in, the text 68 in, the value 16 from the end. It opens
	 * the activity's page and, like Garmin's, has no chevron.
	 */
	let { item, onclick }: { item: AllCard; onclick: () => void } = $props();

	let disc = $derived(discColour(item.disc));
</script>

<button class="tile" {onclick}>
	<span class="disc" style:background={disc.fill} style:color={disc.glyph}>
		<span class="glyph" use:lucide={sportIcon(item.glyph)}></span>
	</span>
	<span class="text">
		<span class="name">{item.name}</span>
		<span class="when">{item.when}</span>
	</span>
	<span class="value">{item.value}</span>
</button>

<style>
	.tile {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 12px;
		box-sizing: border-box;
		width: 100%;
		min-height: 74px;
		height: auto;
		margin: 0;
		padding: 0 16px;
		border: none;
		border-radius: 8px;
		box-shadow: none;
		background: var(--background-secondary);
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		white-space: normal;
		cursor: pointer;
	}
	.tile:hover {
		background: var(--background-modifier-hover);
	}
	.disc {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 40px;
		height: 40px;
		border-radius: 50%;
	}
	.glyph {
		display: flex;
	}
	.glyph :global(svg) {
		width: 22px;
		height: 22px;
	}
	/* The name's and the date's baselines 31 and 53 down the card, as on the phone. */
	.text {
		display: flex;
		flex-direction: column;
		gap: 4.5px;
		flex: 1;
		min-width: 0;
	}
	.name,
	.when {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.name {
		font-size: 15px;
		line-height: 20px;
		font-weight: 600;
	}
	.when {
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
	.value {
		flex: none;
		font-size: 17px;
		line-height: 22px;
		font-variant-numeric: tabular-nums;
	}
</style>
