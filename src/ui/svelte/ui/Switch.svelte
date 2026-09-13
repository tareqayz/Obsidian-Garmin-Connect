<script lang="ts">
	import { Switch } from "bits-ui";

	interface Props {
		checked: boolean;
		label: string;
		/** Second line under the label, for the "why would I want this" sentence. */
		hint?: string;
		disabled?: boolean;
		onCheckedChange: (checked: boolean) => void;
	}

	let { checked, label, hint, disabled = false, onCheckedChange }: Props = $props();

	const id = `gcd-switch-${Math.random().toString(36).slice(2, 9)}`;
</script>

<div class="row">
	<label class="text" for={id}>
		<span class="label">{label}</span>
		{#if hint}<span class="hint">{hint}</span>{/if}
	</label>
	<Switch.Root {id} {checked} {disabled} {onCheckedChange} class="gcd-switch">
		<Switch.Thumb class="gcd-switch-thumb" />
	</Switch.Root>
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 0;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		cursor: pointer;
	}
	.label {
		font-size: var(--font-ui-small, 13px);
	}
	.hint {
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		line-height: 1.4;
	}
	:global(.gcd-switch) {
		margin-left: auto;
		flex: none;
		width: 38px;
		height: 22px;
		padding: 0;
		border-radius: 999px;
		border: 1px solid var(--gcd-border);
		background: var(--gcd-raised);
		cursor: pointer;
		box-shadow: none;
		transition: background 120ms ease, border-color 120ms ease;
	}
	:global(.gcd-switch[data-state="checked"]) {
		background: var(--gcd-series);
		border-color: var(--gcd-series);
	}
	:global(.gcd-switch[data-disabled]) {
		opacity: 0.5;
		cursor: default;
	}
	:global(.gcd-switch:focus-visible) {
		outline: 2px solid var(--gcd-series);
		outline-offset: 2px;
	}
	:global(.gcd-switch-thumb) {
		display: block;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--gcd-surface);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
		transform: translateX(3px);
		transition: transform 120ms ease;
	}
	:global(.gcd-switch[data-state="checked"] .gcd-switch-thumb) {
		transform: translateX(19px);
	}
</style>
