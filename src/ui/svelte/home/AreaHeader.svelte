<script lang="ts">
	import type { Snippet } from "svelte";
	import type { Area, AreaId } from "../../../dashboard/areas";
	import AreaTabs from "./AreaTabs.svelte";
	import { lucide } from "./lucide";

	/**
	 * The top of Home and of each area's own page. On a phone: the plugin's
	 * name, the page's actions and Sync, then the area tabs, and Sync's last
	 * word under them. In a pane, where the rail navigates and holds Sync: the
	 * page's title and its actions.
	 */
	interface Props {
		title: string;
		/** Beside the title in a pane: Home's day. */
		subtitle?: string;
		phone: boolean;
		areas: Area[];
		current: AreaId;
		locked: boolean;
		canSync: boolean;
		syncing: boolean;
		syncMessage: string | null;
		onArea: (area: AreaId) => void;
		onSync: () => void;
		/** Home's Layout button. */
		actions?: Snippet;
	}

	let { title, subtitle, phone, areas, current, locked, canSync, syncing, syncMessage, onArea, onSync, actions }: Props = $props();
</script>

{#if phone}
	<header class="area-head">
		<div class="title-row">
			<span class="watch" use:lucide={"watch"}></span>
			<strong>Garmin Connect</strong>
			<span class="fill"></span>
			{@render actions?.()}
			<button class="clickable-icon" aria-label="Sync recent days" disabled={!canSync || syncing} onclick={onSync}>
				<span class:spin={syncing} use:lucide={"refresh-cw"}></span>
			</button>
		</div>
		<AreaTabs {areas} {current} {locked} {onArea} />
		{#if syncMessage}<div class="sync-line">{syncMessage}</div>{/if}
	</header>
{:else}
	<header class="area-head pane">
		<strong class="title">{title}</strong>
		{#if subtitle}<span class="sub">{subtitle}</span>{/if}
		<span class="fill"></span>
		{@render actions?.()}
	</header>
{/if}

<style>
	.title-row {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 48px;
		padding: 0 10px 0 12px;
	}
	.title-row strong {
		font-size: 15px;
		font-weight: 600;
		white-space: nowrap;
	}
	.watch {
		display: inline-flex;
		color: var(--text-muted);
	}
	.fill {
		flex: 1;
	}
	.sync-line {
		padding: 6px 16px 0;
		font-size: 11px;
		color: var(--text-faint);
	}
	.pane {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 49px;
		padding: 0 24px 0 32px;
		border-bottom: 1px solid var(--background-modifier-border);
	}
	.title {
		font-size: 17px;
		white-space: nowrap;
	}
	.sub {
		font-size: 14px;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}
	.spin {
		display: inline-flex;
		animation: head-spin 1s linear infinite;
	}
	@keyframes head-spin {
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
