<script lang="ts">
	import { lucide } from "./lucide";

	/** Plugin-only: what a page shows when it throws while drawing, instead of a blank pane. */
	interface Props {
		error: unknown;
		onHome: () => void;
		onCopy: () => void;
	}

	let { error, onHome, onCopy }: Props = $props();
	let detail = $derived(error instanceof Error ? error.message : String(error));
</script>

<div class="page-error" role="alert">
	<span class="icon" use:lucide={"triangle-alert"}></span>
	<div class="text">
		<strong>This page couldn't be drawn</strong>
		<span>Something in your Garmin data didn't look the way this page expected. Nothing was lost. The debug info in a bug report helps fix it.</span>
		<code>{detail}</code>
		<div class="actions">
			<button class="mod-cta" onclick={onCopy}>Copy debug info</button>
			<button onclick={onHome}>Back to Home</button>
		</div>
	</div>
</div>

<style>
	.page-error {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		margin: 16px;
		padding: 16px;
		border-radius: 8px;
		background: var(--background-secondary);
	}
	.icon {
		display: inline-flex;
		flex: none;
		margin-top: 1px;
		color: var(--text-error);
	}
	.icon :global(svg) {
		width: 18px;
		height: 18px;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}
	strong {
		font-size: 15px;
		line-height: 20px;
		font-weight: 600;
	}
	span {
		font-size: 13px;
		line-height: 17px;
		color: var(--text-muted);
	}
	code {
		font-size: 12px;
		color: var(--text-muted);
		overflow-wrap: anywhere;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 6px;
	}
</style>
