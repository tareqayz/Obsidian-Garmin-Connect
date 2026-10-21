<script lang="ts">
	import { onMount } from "svelte";
	import type GarminPlugin from "../../../main";
	import { sizeText } from "../../sync-copy";
	import type { SettingsDataRows } from "../../settings-data-rows";

	/**
	 * Settings → History: the download in progress and the new data offered for
	 * the history. The row it sits in hides itself when both are empty.
	 */
	let { plugin, rows }: { plugin: GarminPlugin; rows: SettingsDataRows } = $props();

	// The controller holds the state; this only re-reads it when it changes.
	// svelte-ignore state_referenced_locally
	let progress = $state(rows.progress);
	// svelte-ignore state_referenced_locally
	let updates = $state(rows.updates);
	// svelte-ignore state_referenced_locally
	let line = $state(rows.progress ? rows.progressLine(rows.progress) : "");
	// svelte-ignore state_referenced_locally
	let percent = $state(rows.percent);

	onMount(() =>
		rows.attach(() => {
			progress = rows.progress;
			updates = rows.updates;
			line = rows.progress ? rows.progressLine(rows.progress) : "";
			percent = rows.percent;
		}),
	);
</script>

<div class="status">
	{#if progress}
		<div class="backfill" role="status">
			{#if progress.status === "running" || progress.status === "waiting" || (progress.status === "paused" && progress.reason === "user")}
				<div class="bar"><span style:width="{percent}%"></span></div>
			{/if}
			<div class="row">
				<span class="line">{line}</span>
				{#if progress.status === "running" || progress.status === "waiting"}
					<button onclick={() => void plugin.sync.pauseBackfill()}>Pause</button>
				{:else if progress.status === "paused" && progress.reason === "sign-in"}
					<button class="mod-cta" onclick={() => plugin.openLogin()}>Sign in</button>
				{:else if progress.status === "paused" && progress.reason !== "update"}
					<!-- Nothing to resume until the plugin here is updated. -->
					<button class="mod-cta" onclick={() => void plugin.sync.resumeBackfill()}>Resume</button>
				{/if}
			</div>
		</div>
	{/if}

	{#if updates.length}
		<div class="updates" role="region" aria-label="New data for your history">
			<strong>New data for your history</strong>
			<ul>
				{#each updates as update (update.key)}
					<li>{update.title} <span class="muted">— {update.detail} · {sizeText(update.bytes)}</span></li>
				{/each}
			</ul>
			<div class="row end">
				<button class="mod-cta" onclick={() => void plugin.agreeTo(updates.map((u) => u.key), []).then(() => rows.refresh())}>Download</button>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Mounted straight into a setting row, which lays its children out in a line. */
	.status {
		flex: 1 1 auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.backfill {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px 16px;
		border-radius: var(--radius-m);
		background: var(--background-secondary);
	}
	.bar {
		height: 4px;
		border-radius: 2px;
		overflow: hidden;
		background: var(--background-modifier-border);
	}
	.bar span {
		display: block;
		height: 100%;
		border-radius: 2px;
		background: var(--interactive-accent);
		transition: width 0.3s ease;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.line {
		color: var(--text-muted);
		font-size: var(--font-ui-small);
	}
	.updates {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 16px;
		border-radius: var(--radius-m);
		background: var(--background-secondary);
	}
	.updates ul {
		margin: 0;
		padding-left: 18px;
		font-size: var(--font-ui-small);
	}
	.updates .muted {
		color: var(--text-muted);
	}
	.row.end {
		justify-content: flex-end;
	}
	button {
		flex: none;
	}
</style>
