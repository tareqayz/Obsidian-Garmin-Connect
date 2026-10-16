<script lang="ts">
	/**
	 * The expanded chart's overlay chips: the twin's Sleep Chip (202:463) in one
	 * row that scrolls sideways at every width ("overlay chips (scroll
	 * sideways)", 411:1390 and 416:86237), so the chart keeps the room it was
	 * sized for. One on at a time; the selected chip is filled, and the row
	 * scrolls to show it (the ride's twin, 956:1067), centred where it can be.
	 */
	interface Props {
		chips: Array<{ id: string; label: string }>;
		selected: string | null;
		onSelect: (id: string) => void;
	}

	let { chips, selected, onSelect }: Props = $props();

	let row = $state<HTMLElement | null>(null);

	$effect(() => {
		// Track the choice and the chips: a chosen chip far along the row would be out of sight.
		const on = selected;
		const count = chips.length;
		const chip = on && count ? row?.querySelector<HTMLElement>(".chip.on") : null;
		if (!row || !chip) return;
		row.scrollLeft = Math.max(0, chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2);
	});
</script>

<div class="chart-chips" bind:this={row}>
	{#each chips as chip (chip.id)}
		<button class="chip" class:on={chip.id === selected} aria-pressed={chip.id === selected} onclick={() => onSelect(chip.id)}>{chip.label}</button>
	{/each}
</div>

<style>
	.chart-chips {
		position: relative;
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding: 0 16px;
		scrollbar-width: none;
	}
	.chart-chips::-webkit-scrollbar {
		display: none;
	}
	.chip {
		flex: none;
		height: 36px;
		margin: 0;
		padding: 8px 17px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 18px;
		box-shadow: none;
		background: none;
		color: var(--text-normal);
		font: inherit;
		font-size: 15px;
		line-height: 20px;
		white-space: nowrap;
		cursor: pointer;
	}
	.chip.on {
		border-color: transparent;
		background: var(--background-modifier-border);
	}
	/* A pane: the row starts with the page's 32 pt margin (416:86237). */
	@container (min-width: 640px) {
		.chart-chips {
			padding: 0 32px;
		}
	}
</style>
