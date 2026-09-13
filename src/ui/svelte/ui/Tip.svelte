<script lang="ts">
	import { Tooltip } from "bits-ui";
	import type { Snippet } from "svelte";

	interface Props {
		text: string;
		side?: "top" | "bottom" | "left" | "right";
		delay?: number;
		trigger: Snippet;
	}

	let { text, side = "top", delay = 200, trigger }: Props = $props();
</script>

<!--
	Distinct from the chart Tooltip in ../Tooltip.svelte: that one follows a
	cursor inside an SVG and clamps itself to the card. This one is attached to
	a focusable control, opens on hover *and* keyboard focus, and flips side
	when it would run off screen.
-->
<Tooltip.Provider delayDuration={delay}>
	<Tooltip.Root>
		<Tooltip.Trigger class="gcd-tip-trigger">{@render trigger()}</Tooltip.Trigger>
		<Tooltip.Portal>
			<Tooltip.Content {side} sideOffset={6} class="gcd-tip">
				{text}
				<Tooltip.Arrow class="gcd-tip-arrow" />
			</Tooltip.Content>
		</Tooltip.Portal>
	</Tooltip.Root>
</Tooltip.Provider>

<style>
	:global(.gcd-tip-trigger) {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: inherit;
		cursor: pointer;
		box-shadow: none;
	}
	:global(.gcd-tip) {
		z-index: var(--gcd-layer, 1000);
		max-width: 18rem;
		padding: 5px 9px;
		border-radius: 6px;
		border: 1px solid var(--gcd-border);
		background: var(--gcd-raised);
		color: var(--gcd-text);
		font-size: var(--font-ui-smaller, 12px);
		line-height: 1.45;
		box-shadow: var(--gcd-shadow);
	}
	:global(.gcd-tip-arrow) {
		color: var(--gcd-raised);
	}
</style>
