<script lang="ts">
	import type { HistoryProgress } from "../../../sync/runner";
	import { lucide } from "../home/lucide";

	/**
	 * Plugin-only: shown until the activity index holds the whole history, since
	 * until then a chart can only cover what routine syncs have reached.
	 */
	interface Props {
		/** A history sync in progress, or null. */
		progress: HistoryProgress | null;
		/** How many activities the list held when last counted. */
		total?: number;
		canSync: boolean;
		onSync: () => void;
	}

	let { progress, total, canSync, onSync }: Props = $props();

	let detail = $derived.by(() => {
		if (total === undefined) return "Charts cover only what’s synced. The whole history takes about one request per hundred activities.";
		const requests = Math.max(1, Math.ceil(total / 100));
		return `Charts cover only what’s synced. All ${total.toLocaleString()} activities take about ${requests} ${requests === 1 ? "request" : "requests"}.`;
	});
</script>

<div class="history" role="status">
	<span class="icon" class:spin={progress} use:lucide={"refresh-cw"}></span>
	<div class="text">
		{#if progress}
			<strong>Fetching activity history…</strong>
			<span>
				{progress.total !== undefined
					? `${progress.fetched.toLocaleString()} of ${progress.total.toLocaleString()} activities`
					: `${progress.fetched.toLocaleString()} activities so far`}
			</span>
		{:else}
			<strong>Activity history isn’t synced</strong>
			<span>{detail}</span>
		{/if}
	</div>
	{#if !progress}
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
