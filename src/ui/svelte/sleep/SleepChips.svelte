<script lang="ts">
	/**
	 * The overlay chips under a chart: one on at a time, the row scrolling
	 * sideways on a phone and wrapping in a pane.
	 */
	interface Props {
		chips: Array<{ id: string; label: string }>;
		selected: string | null;
		onSelect: (id: string) => void;
		/** 8pt between chips under the night's timeline, 12 under a period's score. */
		gap?: number;
	}

	let { chips, selected, onSelect, gap = 8 }: Props = $props();
</script>

<div class="sleep-chips" style:--chip-gap="{gap}px">
	{#each chips as chip (chip.id)}
		<button class="chip" class:on={chip.id === selected} aria-pressed={chip.id === selected} onclick={() => onSelect(chip.id)}>{chip.label}</button>
	{/each}
</div>

<style>
	.sleep-chips {
		display: flex;
		gap: var(--chip-gap);
		overflow-x: auto;
		padding: 0 16px;
		scrollbar-width: none;
	}
	.sleep-chips::-webkit-scrollbar {
		display: none;
	}
	.chip {
		flex: none;
		height: 36px;
		margin: 0;
		padding: 8px 17px;
		box-sizing: border-box;
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
	@container (min-width: 1000px) {
		.sleep-chips {
			flex-wrap: wrap;
			overflow: visible;
			padding: 0;
		}
	}
</style>
