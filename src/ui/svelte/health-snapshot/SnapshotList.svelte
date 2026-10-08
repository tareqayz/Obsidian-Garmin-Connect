<script lang="ts">
	import type { SnapshotListItem } from "../../../dashboard/health-snapshot-pages";
	import { lucide } from "../home/lucide";

	/** Every snapshot, newest first, one grouped list (twin 347:34 / 347:468). */
	let { items, onopen }: { items: SnapshotListItem[]; onopen: (item: SnapshotListItem) => void } = $props();
</script>

<div class="hs-list">
	{#each items as item (item.uuid)}
		<button class="hs-row" onclick={() => onopen(item)}>
			<span class="icon" use:lucide={"clipboard-plus"}></span>
			<span class="text"><span class="title">{item.title}</span><span class="detail">{item.detail}</span></span>
			<span class="chevron" use:lucide={"chevron-right"}></span>
		</button>
	{/each}
</div>

<style>
	.hs-list {
		display: flex;
		flex-direction: column;
		background: var(--background-secondary);
	}
	.hs-row {
		display: flex;
		align-items: center;
		gap: 14px;
		box-sizing: border-box;
		width: 100%;
		min-height: 57px;
		height: auto;
		margin: 0;
		padding: 6px 16px;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: none;
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.hs-row:hover {
		background: var(--background-modifier-hover);
	}
	.icon,
	.chevron {
		display: inline-flex;
		flex: none;
	}
	.chevron {
		color: var(--text-faint);
	}
	.text {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}
	.title {
		font-size: 17px;
		line-height: 22px;
	}
	.detail {
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}

	@container (min-width: 640px) {
		.hs-list {
			margin-top: 16px;
			border-radius: 8px;
			overflow: hidden;
		}
	}
</style>
