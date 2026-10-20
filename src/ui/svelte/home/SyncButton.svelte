<script lang="ts">
	import { lucide } from "./lucide";

	/**
	 * Sync recent days, as ↻: it spins while a sync runs. Obsidian shows the
	 * label as the tooltip, with the last sync's word after it where the page
	 * has no room to print it.
	 */
	interface Props {
		canSync: boolean;
		syncing: boolean;
		/** The last sync's word, for the tooltip. */
		message?: string | null;
		onSync: () => void;
	}

	let { canSync, syncing, message = null, onSync }: Props = $props();
</script>

<button class="clickable-icon" aria-label={message ? `Sync recent days · ${message}` : "Sync recent days"} disabled={!canSync || syncing} onclick={onSync}>
	<span class:spin={syncing} use:lucide={"refresh-cw"}></span>
</button>

<style>
	.spin {
		display: inline-flex;
		animation: sync-spin 1s linear infinite;
	}
	@keyframes sync-spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spin {
			animation: none;
		}
	}
</style>
