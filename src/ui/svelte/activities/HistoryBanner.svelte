<script lang="ts">
	import { lucide } from "../home/lucide";

	/**
	 * Plugin-only: shown until an index holds the whole history — activities,
	 * or steps, floors and intensity minutes — since until then a chart can
	 * only cover what routine syncs have reached.
	 */
	interface Props {
		title: string;
		detail: string;
		/** A history sync is running: the icon spins and the button goes. */
		busy: boolean;
		canSync: boolean;
		onSync: () => void;
	}

	let { title, detail, busy, canSync, onSync }: Props = $props();
</script>

<div class="history" role="status">
	<span class="icon" class:spin={busy} use:lucide={"refresh-cw"}></span>
	<div class="text">
		<strong>{title}</strong>
		<span>{detail}</span>
	</div>
	{#if !busy}
		<button class="mod-cta" disabled={!canSync} onclick={onSync}>Sync history</button>
	{/if}
</div>

<style>
	.history {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		border-radius: 8px;
		background: var(--background-secondary);
	}
	.icon {
		display: inline-flex;
		flex: none;
		color: var(--text-muted);
	}
	.icon :global(svg) {
		width: 18px;
		height: 18px;
	}
	.spin {
		animation: gca-spin 1s linear infinite;
	}
	@keyframes gca-spin {
		to {
			transform: rotate(360deg);
		}
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
		min-width: 0;
	}
	strong {
		font-size: 15px;
		line-height: 20px;
		font-weight: 600;
	}
	span {
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
	button {
		flex: none;
		font-size: 14px;
		line-height: 18px;
		padding: 6px 12px;
		height: auto;
		border-radius: 4px;
	}
</style>
