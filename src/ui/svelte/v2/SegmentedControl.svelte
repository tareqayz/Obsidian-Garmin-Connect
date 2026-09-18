<script lang="ts">
	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		options: readonly Option[];
		value: string;
		onSelect: (value: string) => void;
		/** Names the group for a screen reader, e.g. "Date range". */
		label: string;
	}

	let { options, value, onSelect, label }: Props = $props();
</script>

<!-- v1's chips were separate buttons on the page background. A segmented
     control is one track holding a selection, which is what the range actually
     is: the options are exclusive, so they should look like one control. -->
<div class="track" role="group" aria-label={label}>
	{#each options as option (option.value)}
		<button
			class="segment"
			class:selected={option.value === value}
			aria-pressed={option.value === value}
			onclick={() => onSelect(option.value)}>{option.label}</button
		>
	{/each}
</div>

<style>
	.track {
		display: inline-flex;
		gap: 2px;
		padding: 3px;
		border-radius: 999px;
		background: var(--gcd-raised);
		max-width: 100%;
		flex-wrap: wrap;
	}
	.segment {
		padding: 6px 14px;
		border: none;
		border-radius: 999px;
		background: transparent;
		box-shadow: none;
		color: var(--v2-muted);
		font-size: 12px;
		font-weight: 500;
		line-height: 1.25;
		cursor: pointer;
		white-space: nowrap;
	}
	.segment:hover:not(.selected) {
		color: var(--gcd-text);
	}
	.segment.selected {
		background: var(--v2-surface-card);
		color: var(--gcd-text);
		box-shadow: var(--v2-shadow-1);
	}
</style>
