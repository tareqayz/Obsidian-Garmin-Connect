<script lang="ts">
	import { Checkbox } from "bits-ui";

	interface Props {
		checked: boolean;
		/** True when some but not all children are on — draws a dash, not a tick. */
		indeterminate?: boolean;
		label: string;
		disabled?: boolean;
		onCheckedChange: (checked: boolean) => void;
	}

	let { checked, indeterminate = false, label, disabled = false, onCheckedChange }: Props =
		$props();

	const id = `gcd-check-${Math.random().toString(36).slice(2, 9)}`;
</script>

<div class="row">
	<Checkbox.Root {id} {checked} {indeterminate} {disabled} {onCheckedChange} class="gcd-check">
		{#snippet children({ checked: on, indeterminate: mixed })}
			<span class="mark" aria-hidden="true">{mixed ? "–" : on ? "✓" : ""}</span>
		{/snippet}
	</Checkbox.Root>
	<label for={id}>{label}</label>
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	label {
		font-size: var(--font-ui-small, 13px);
		cursor: pointer;
		min-width: 0;
	}
	:global(.gcd-check) {
		flex: none;
		width: 18px;
		height: 18px;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		border: 1px solid var(--gcd-border);
		background: var(--gcd-surface);
		cursor: pointer;
		box-shadow: none;
	}
	:global(.gcd-check[data-state="checked"]),
	:global(.gcd-check[data-state="indeterminate"]) {
		background: var(--gcd-series);
		border-color: var(--gcd-series);
	}
	:global(.gcd-check[data-disabled]) {
		opacity: 0.5;
		cursor: default;
	}
	:global(.gcd-check:focus-visible) {
		outline: 2px solid var(--gcd-series);
		outline-offset: 2px;
	}
	.mark {
		color: #ffffff;
		font-size: 12px;
		line-height: 1;
	}
</style>
