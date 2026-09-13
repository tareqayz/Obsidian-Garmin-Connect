<script lang="ts">
	import { shortDate } from "../../dashboard/series";
	import type { SyncProgress } from "../../sync/runner";
	import Progress from "./ui/Progress.svelte";

	interface Props {
		latest: string | null;
		total: number;
		syncing: boolean;
		canSync: boolean;
		message: string | null;
		/** Non-null only while a run is between its first and last day. */
		progress?: SyncProgress | null;
	}

	let { latest, total, syncing, canSync, message, progress = null }: Props = $props();
</script>

<!-- Answers "is this up to date?" without a round trip to the settings pane. -->
<div class="status" role="status">
	{#if progress}
		<!-- A year-long backfill is thousands of requests. Showing the day it is
		     on is the difference between "working" and "hung". -->
		<Progress
			value={progress.done}
			max={progress.total}
			label="Garmin sync"
			caption="{progress.done} / {progress.total} · {shortDate(progress.date)}"
		/>
	{:else if !canSync}
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
