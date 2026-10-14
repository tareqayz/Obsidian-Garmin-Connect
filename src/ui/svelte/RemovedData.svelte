<script lang="ts">
	import { formatBytes } from "../../sync/estimate";

	/**
	 * After an uninstall: the data the plugin synced is still in the vault.
	 * Shown once the plugin itself is gone, so it brings its own styles —
	 * styles.css left with the plugin.
	 */
	interface Props {
		folder: string;
		bytes: number;
		onKeep: () => void;
		onTrash: () => Promise<void>;
	}

	let { folder, bytes, onKeep, onTrash }: Props = $props();
	let busy = $state(false);

	async function trash() {
		busy = true;
		try {
			await onTrash();
		} finally {
			busy = false;
		}
	}
</script>

<div class="gc-removed">
	<div class="body">
		Its synced data is still in your vault: {folder} ({formatBytes(bytes)}). Map tiles cached on this device were cleared.
	</div>
	<div class="footer">
		<button class="mod-cta" disabled={busy} onclick={onKeep}>Keep data</button>
		<button class="danger" disabled={busy} onclick={trash}>{busy ? "Moving…" : "Move to trash"}</button>
	</div>
</div>

<style>
	.gc-removed {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.body {
		font-size: var(--font-ui-small);
		line-height: 20px;
		color: var(--text-muted);
	}
	.footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	button.danger:not(.clickable-icon) {
		color: var(--text-error);
		background-color: rgba(var(--color-red-rgb), 0.1);
		box-shadow: none;
	}
</style>
