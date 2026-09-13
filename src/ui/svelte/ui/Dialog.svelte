<script lang="ts">
	import { Dialog } from "bits-ui";
	import type { Snippet } from "svelte";

	interface Props {
		open: boolean;
		title: string;
		/** One sentence of context. Read out with the title by screen readers. */
		description?: string;
		children: Snippet;
		/** Buttons. Gets a close callback so actions can dismiss the dialog. */
		actions?: Snippet<[() => void]>;
		onOpenChange: (open: boolean) => void;
	}

	let { open, title, description, children, actions, onOpenChange }: Props = $props();
</script>

<!--
	Obsidian's own Modal is the right tool when the dialog is the whole task
	(sign in, backfill). This is for a confirm that belongs *inside* a view —
	"remove this widget?" — where opening a second Obsidian modal over the
	dashboard is heavier than the question deserves.
-->
<Dialog.Root {open} {onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="gcd-dialog-overlay" />
		<Dialog.Content class="gcd-dialog">
			<Dialog.Title class="gcd-dialog-title">{title}</Dialog.Title>
			{#if description}
				<Dialog.Description class="gcd-dialog-desc">{description}</Dialog.Description>
			{/if}
			<div class="body">{@render children()}</div>
			{#if actions}
				<div class="actions">{@render actions(() => onOpenChange(false))}</div>
			{/if}
			<Dialog.Close aria-label="Close" class="gcd-dialog-close">×</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.gcd-dialog-overlay) {
		position: fixed;
		inset: 0;
		z-index: var(--gcd-layer, 1000);
		background: rgba(0, 0, 0, 0.45);
	}
	:global(.gcd-dialog) {
		position: fixed;
		z-index: calc(var(--gcd-layer, 1000) + 1);
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(26rem, calc(100vw - 24px));
		max-height: calc(100vh - 48px);
		overflow-y: auto;
		padding: 18px 20px;
		border-radius: var(--gcd-radius, 8px);
		border: 1px solid var(--gcd-border);
		background: var(--gcd-surface);
		color: var(--gcd-text);
		box-shadow: var(--gcd-shadow);
	}
	:global(.gcd-dialog-title) {
		margin: 0;
		font-size: var(--font-ui-large, 16px);
		font-weight: 600;
	}
	:global(.gcd-dialog-desc) {
		margin: 4px 0 0;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		line-height: 1.5;
	}
	:global(.gcd-dialog-close) {
		position: absolute;
		top: 10px;
		right: 12px;
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--gcd-muted);
		font-size: 18px;
		line-height: 1;
		cursor: pointer;
		box-shadow: none;
	}
	:global(.gcd-dialog-close:hover) {
		background: var(--gcd-raised);
		color: var(--gcd-text);
	}
	.body {
		margin-top: 12px;
		font-size: var(--font-ui-small, 13px);
		line-height: 1.5;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 16px;
	}
</style>
