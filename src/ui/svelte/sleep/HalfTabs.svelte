<script lang="ts">
	/** Sleep Consistency · Sleep Alignment: two tabs over a chart, the chosen one underlined. */
	interface Props {
		options: [string, string];
		value: number;
		onChange: (index: number) => void;
	}

	let { options, value, onChange }: Props = $props();
</script>

<div class="half-tabs">
	{#each options as label, i (label)}
		<button class:on={value === i} aria-pressed={value === i} onclick={() => onChange(i)}>{label}</button>
	{/each}
</div>

<style>
	.half-tabs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		column-gap: 16px;
		height: 38px;
		border-bottom: 1px solid var(--background-modifier-border);
	}
	button {
		margin: 0;
		height: 38px;
		padding: 2px 0 0;
		border: none;
		border-bottom: 1px solid transparent;
		border-radius: 0;
		box-shadow: none;
		background: none;
		color: var(--text-muted);
		font: inherit;
		font-size: 16px;
		line-height: 20px;
		cursor: pointer;
	}
	button.on {
		border-bottom-color: var(--text-normal);
		color: var(--text-normal);
		font-weight: 600;
	}
</style>
