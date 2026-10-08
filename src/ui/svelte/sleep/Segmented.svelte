<script lang="ts">
	/** Timeline · Stages: the app's two-way switch with a sliding thumb. */
	interface Props {
		options: [string, string];
		/** 0 or 1. */
		value: number;
		onChange: (index: number) => void;
	}

	let { options, value, onChange }: Props = $props();
</script>

<div class="segmented">
	<span class="thumb" class:right={value === 1}></span>
	{#each options as label, i (label)}
		<button class:on={value === i} aria-pressed={value === i} onclick={() => onChange(i)}>{label}</button>
	{/each}
</div>

<style>
	.segmented {
		position: relative;
		display: grid;
		grid-template-columns: 1fr 1fr;
		width: 370px;
		max-width: 100%;
		height: 38px;
		box-sizing: border-box;
		padding: 2px 3px;
		border-radius: 8px;
		background: var(--background-modifier-border);
	}
	.thumb {
		position: absolute;
		top: 2px;
		bottom: 2px;
		left: 3px;
		width: calc(50% - 11px);
		border-radius: 7px;
		background: var(--background-primary);
		transition: transform 150ms ease;
	}
	.thumb.right {
		transform: translateX(calc(100% + 16px));
	}
	button {
		position: relative;
		margin: 0;
		height: auto;
		padding: 0;
		border: none;
		box-shadow: none;
		background: none;
		color: var(--text-muted);
		font: inherit;
		font-size: 16px;
		line-height: 20px;
		cursor: pointer;
	}
	button.on {
		color: var(--text-normal);
	}
</style>
