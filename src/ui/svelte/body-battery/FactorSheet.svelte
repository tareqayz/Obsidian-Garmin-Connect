<script lang="ts">
	import { factorVerdict } from "../../../dashboard/body-battery-copy";
	import type { BatteryFactor } from "../../../dashboard/body-battery-pages";

	/**
	 * A factor's sheet: its title and close button in the Sleep History
	 * sheet's band, the verdict, and the net impact and duration. A sheet
	 * from the bottom on a phone, a centred dialog in a pane.
	 */
	let { factor, onClose }: { factor: BatteryFactor; onClose: () => void } = $props();
	let verdict = $derived(factorVerdict(factor.type, factor.feedback));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="factor-backdrop" onclick={onClose}>
	<div class="factor-sheet" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === "Escape" && onClose()}>
		<header class="sheet-header">
			<h2>{factor.label}</h2>
			<button class="close" aria-label="Close" onclick={onClose}>
				<svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 1 L7 7 M7 1 L1 7" /></svg>
			</button>
		</header>
		<div class="body">
			{#if verdict}
				<div class="verdict">{verdict.headline}</div>
				<div class="copy">{verdict.copy}</div>
			{/if}
			<div class="figures">
				<div><span class="value">{factor.impact || "--"}</span><span class="label">Body Battery Net Impact</span></div>
				<div><span class="value">{factor.duration}</span><span class="label">Duration</span></div>
			</div>
		</div>
	</div>
</div>

<style>
	.factor-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--layer-modal, 50);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		background: color-mix(in srgb, #000 40%, transparent);
	}
	.factor-sheet {
		width: 100%;
		max-height: 90%;
		overflow-y: auto;
		border-radius: 12px 12px 0 0;
		background: var(--background-primary);
		color: var(--text-normal);
	}
	@media (min-width: 1000px) {
		.factor-backdrop {
			align-items: center;
		}
		.factor-sheet {
			width: 402px;
			border-radius: 12px;
		}
	}
	.sheet-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 54px;
		padding: 0 14px 0 16px;
		background: var(--background-secondary);
	}
	h2 {
		margin: 0;
		font-size: 20px;
		line-height: 24px;
		font-weight: 700;
	}
	.close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 50%;
		box-shadow: none;
		background: var(--background-modifier-border);
		cursor: pointer;
	}
	.close path {
		fill: none;
		stroke: var(--text-normal);
		stroke-width: 2;
		stroke-linecap: round;
	}
	.body {
		padding: 18px 16px 32px;
	}
	.verdict {
		font-size: 16px;
		line-height: 22px;
	}
	.copy {
		margin-top: 4px;
		font-size: 14px;
		line-height: 20px;
		color: var(--text-muted);
	}
	.figures {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		margin-top: 24px;
	}
	.figures div {
		display: flex;
		flex-direction: column;
	}
	.value {
		font-size: 22px;
		line-height: 28px;
	}
	.label {
		font-size: 13px;
		color: var(--text-muted);
	}
</style>
