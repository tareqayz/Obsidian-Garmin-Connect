<script lang="ts">
	import { formatBytes } from "../../sync/estimate";

	/** The confirmation before "Delete synced data" moves the plugin's files to the trash. */
	interface Props {
		folder: string;
		files: number;
		bytes: number;
		logFolder: string;
		/** Diagnostics notes the plugin saved: the checkbox shows only when there are some. */
		notes: number;
		onDelete: (diagnostics: boolean) => Promise<void>;
		onCancel: () => void;
	}

	let { folder, files, bytes, logFolder, notes, onDelete, onCancel }: Props = $props();

	let diagnostics = $state(false);
	let busy = $state(false);
	const count = new Intl.NumberFormat();

	async function remove() {
		busy = true;
		try {
			await onDelete(diagnostics);
		} finally {
			busy = false;
		}
	}
</script>

<div class="gch-delete">
	<div class="body">
		This moves the plugin’s files in {folder} to the trash: {formatBytes(bytes)} in {count.format(files)}
		{files === 1 ? "file" : "files"}. Anything else in that folder stays, and your Garmin account is not affected. Your vault
		sync removes them from your other devices too.
	</div>
	{#if notes}
		<label class="check">
			<input type="checkbox" bind:checked={diagnostics} />
			Also delete diagnostics notes in {logFolder}
		</label>
	{/if}
	<div class="footer">
		<button disabled={busy} onclick={onCancel}>Cancel</button>
		<button class="mod-warning" disabled={busy || !files} onclick={remove}>{busy ? "Deleting…" : "Delete"}</button>
	</div>
</div>

<style>
	.gch-delete {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.body {
		font-size: var(--font-ui-small);
		line-height: 20px;
		color: var(--text-muted);
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: var(--font-ui-small);
	}
	.footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
</style>
