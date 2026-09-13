<script lang="ts">
	import { Popover } from "bits-ui";
	import type { Snippet } from "svelte";

	interface Props {
		/** Names the trigger for screen readers, e.g. "Custom date window". */
		label: string;
		open?: boolean;
		align?: "start" | "center" | "end";
		trigger: Snippet;
		children: Snippet<[() => void]>;
		onOpenChange?: (open: boolean) => void;
	}

	let { label, open = $bindable(false), align = "start", trigger, children, onOpenChange }: Props =
		$props();
</script>

<Popover.Root bind:open {onOpenChange}>
	<Popover.Trigger aria-label={label} class="gcd-pop-trigger">{@render trigger()}</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content sideOffset={6} {align} class="gcd-pop">
			<!-- Children get a close callback so an "Apply" button can dismiss
			     the panel without the caller reaching for the bound `open`. -->
			{@render children(() => (open = false))}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>

<style>
	:global(.gcd-pop-trigger) {
		padding: 4px 12px;
		border-radius: 999px;
		border: 1px solid var(--gcd-border);
		background: transparent;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		cursor: pointer;
		box-shadow: none;
	}
	:global(.gcd-pop-trigger:hover),
	:global(.gcd-pop-trigger[data-state="open"]) {
		background: var(--gcd-raised);
		color: var(--gcd-text);
	}
	:global(.gcd-pop-trigger:focus-visible) {
		outline: 2px solid var(--gcd-series);
		outline-offset: 2px;
	}
	:global(.gcd-pop) {
		z-index: var(--gcd-layer, 1000);
		max-width: min(22rem, calc(100vw - 24px));
		padding: 12px 14px;
		border-radius: var(--gcd-radius, 8px);
		border: 1px solid var(--gcd-border);
		background: var(--gcd-surface);
		color: var(--gcd-text);
		box-shadow: var(--gcd-shadow);
	}
</style>
