<script lang="ts">
	import { Select } from "bits-ui";

	export interface Option {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		value: string;
		options: readonly Option[];
		/** Names the control for screen readers, e.g. "Metric". */
		label: string;
		placeholder?: string;
		disabled?: boolean;
		onValueChange: (value: string) => void;
	}

	let {
		value,
		options,
		label,
		placeholder = "Choose…",
		disabled = false,
		onValueChange,
	}: Props = $props();

	let selected = $derived(options.find((o) => o.value === value));
</script>

<Select.Root type="single" {value} {onValueChange} {disabled} items={options as Option[]}>
	<Select.Trigger aria-label={label} class="gcd-select-trigger">
		<span class="text">{selected ? selected.label : placeholder}</span>
		<span class="caret" aria-hidden="true">⌄</span>
	</Select.Trigger>
	<Select.Portal>
		<Select.Content sideOffset={6} class="gcd-select-content">
			<Select.Viewport>
				{#each options as option (option.value)}
					<Select.Item
						value={option.value}
						label={option.label}
						disabled={option.disabled}
						class="gcd-select-item"
					>
						{#snippet children({ selected: isSelected })}
							<span class="tick" aria-hidden="true">{isSelected ? "✓" : ""}</span>
							{option.label}
						{/snippet}
					</Select.Item>
				{/each}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>

<style>
	:global(.gcd-select-trigger) {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-width: 9rem;
		padding: 4px 10px;
		border-radius: 6px;
		border: 1px solid var(--gcd-border);
		background: var(--gcd-surface);
		color: var(--gcd-text);
		font-size: var(--font-ui-smaller, 12px);
		text-align: left;
		cursor: pointer;
		box-shadow: none;
	}
	:global(.gcd-select-trigger:hover:not([data-disabled])) {
		background: var(--gcd-raised);
	}
	:global(.gcd-select-trigger[data-disabled]) {
		opacity: 0.5;
		cursor: default;
	}
	:global(.gcd-select-trigger:focus-visible) {
		outline: 2px solid var(--gcd-series);
		outline-offset: 2px;
	}
	.text {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.caret {
		color: var(--gcd-muted);
		font-size: 10px;
		flex: none;
	}

	:global(.gcd-select-content) {
		z-index: var(--gcd-layer, 1000);
		/* --bits-select-content-available-height comes from the floating layer;
		   without the cap a 20-metric list runs off a phone screen. */
		max-height: min(18rem, var(--bits-select-content-available-height, 18rem));
		min-width: var(--bits-select-anchor-width, 9rem);
		overflow-y: auto;
		padding: 4px;
		border-radius: var(--gcd-radius, 8px);
		border: 1px solid var(--gcd-border);
		background: var(--gcd-surface);
		box-shadow: var(--gcd-shadow);
	}
	:global(.gcd-select-item) {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 8px;
		border-radius: 4px;
		font-size: var(--font-ui-smaller, 12px);
		cursor: pointer;
		user-select: none;
	}
	:global(.gcd-select-item[data-highlighted]) {
		background: var(--gcd-raised);
	}
	:global(.gcd-select-item[data-disabled]) {
		opacity: 0.5;
		cursor: default;
	}
	.tick {
		width: 12px;
		flex: none;
		color: var(--gcd-series);
		font-size: 11px;
	}
</style>
