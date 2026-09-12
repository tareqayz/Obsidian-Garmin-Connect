<script lang="ts">
	import { shortDate } from "../../dashboard/series";

	interface Props {
		latest: string | null;
		total: number;
		syncing: boolean;
		canSync: boolean;
		message: string | null;
	}

	let { latest, total, syncing, canSync, message }: Props = $props();
</script>

<!-- Answers "is this up to date?" without a round trip to the settings pane. -->
<div class="status" role="status">
	{#if !canSync}
		Not signed in — sync is unavailable.
	{:else if syncing}
		Syncing…
	{:else if message}
		{message}
	{:else if latest}
		Data through {shortDate(latest)} · {total} day{total === 1 ? "" : "s"} stored
	{:else}
		Nothing synced yet.
	{/if}
</div>

<style>
	.status {
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		min-height: 1.4em;
		margin-bottom: 12px;
	}
</style>
