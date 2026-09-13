<script lang="ts">
	import { ToggleGroup } from "bits-ui";

	export interface Segment {
		value: string;
		label: string;
	}

	interface Props {
		value: string;
		items: readonly Segment[];
		/** Names the control for screen readers, e.g. "Date range". */
		label: string;
		onValueChange: (value: string) => void;
	}

	let { value, items, label, onValueChange }: Props = $props();
</script>

<!--
	The chips in FilterBar, but as one roving-tabindex group: arrow keys move
	between segments and only the selected one is a tab stop. The hand-rolled
	version makes every chip a tab stop, which is four stops to cross a filter.
-->
<ToggleGroup.Root
	type="single"
	{value}
	onValueChange={(next) => next && onValueChange(next)}
	aria-label={label}
	class="gcd-seg"
>
	{#each items as item (item.value)}
		<ToggleGroup.Item value={item.value} class="gcd-seg-item">{item.label}</ToggleGroup.Item>
	{/each}
</ToggleGroup.Root>

<style>
	:global(.gcd-seg) {
		display: inline-flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	:global(.gcd-seg-item) {
		padding: 4px 12px;
		border-radius: 999px;
		border: 1px solid var(--gcd-border);
		background: transparent;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		cursor: pointer;
		box-shadow: none;
	}
	:global(.gcd-seg-item:hover:not([data-disabled])) {
		background: var(--gcd-raised);
		color: var(--gcd-text);
	}
	:global(.gcd-seg-item[data-state="on"]) {
		background: var(--gcd-raised);
		border-color: var(--gcd-series);
		color: var(--gcd-text);
		font-weight: 600;
	}
	:global(.gcd-seg-item[data-disabled]) {
		opacity: 0.5;
		cursor: default;
	}
	:global(.gcd-seg-item:focus-visible) {
		outline: 2px solid var(--gcd-series);
		outline-offset: 2px;
	}
</style>
