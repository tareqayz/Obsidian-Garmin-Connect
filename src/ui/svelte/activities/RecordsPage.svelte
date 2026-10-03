<script lang="ts">
	import { RECORD_TABS, recordsView, type ActivitiesData } from "../../../dashboard/activities";
	import type { Route } from "../../../dashboard/routes";
	import { sportIcon } from "../../sport-icons";
	import PageBar from "../home/PageBar.svelte";
	import { lucide } from "../home/lucide";

	/**
	 * Personal Records, a tab per sport. Every slot Garmin keeps for that sport
	 * is listed, so a distance never run still shows its title. Rows open
	 * nothing yet: there is no activity screen to go to.
	 */
	interface Props {
		route: Extract<Route, { page: "records" }>;
		data: ActivitiesData;
		onBack: () => void;
		swap: (route: Route) => void;
	}

	let { route, data, onBack, swap }: Props = $props();

	let tab = $derived(RECORD_TABS.find((t) => t.id === route.tab) ?? RECORD_TABS[1]!);
	let items = $derived(recordsView(data.records, tab.id, data.units));

	// On a phone the strip is wider than the screen; keep the open tab in view.
	let strip = $state<HTMLElement | null>(null);
	$effect(() => {
		void tab;
		const on = strip?.querySelector<HTMLElement>(".on");
		if (on && strip) strip.scrollLeft = Math.max(0, on.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2);
	});
</script>

<PageBar title="Personal Records" {onBack} />

<div class="tabs" bind:this={strip}>
	{#each RECORD_TABS as t (t.id)}
		<button class:on={t.id === tab.id} aria-pressed={t.id === tab.id} onclick={() => swap({ page: "records", tab: t.id })}>{t.title}</button>
	{/each}
</div>

<div class="records">
	{#each items as record (record.typeId)}
		<div class="record">
			<span class="icon" use:lucide={sportIcon(tab.glyph)}></span>
			<div class="text">
				<span class="title">{record.title}</span>
				{#if record.value}<span class="value">{record.value}</span>{/if}
				{#if record.date}<span class="date">{record.date}</span>{/if}
			</div>
		</div>
	{/each}
</div>

<style>
	.tabs {
		display: flex;
		height: 44px;
		border-bottom: 1px solid var(--background-modifier-border);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.tabs::-webkit-scrollbar {
		display: none;
	}
	.tabs button {
		position: relative;
		flex: none;
		height: 44px;
		margin: 0;
		padding: 0 12px;
		border: none;
		box-shadow: none;
		background: none;
		font: inherit;
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
		cursor: pointer;
	}
	.tabs button.on {
		font-weight: 600;
		color: var(--text-normal);
	}
	.tabs button.on::after {
		content: "";
		position: absolute;
		left: 8px;
		right: 8px;
		bottom: 0;
		height: 1px;
		background: var(--text-normal);
	}
	.records {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		background: var(--background-secondary);
	}
	.record {
		display: flex;
		align-items: center;
		gap: 14.65px;
		min-height: 90px;
		box-sizing: border-box;
		padding: 0 20px 0 27.35px;
		background: var(--background-secondary);
	}
	.icon {
		display: inline-flex;
		flex: none;
		color: var(--text-muted);
	}
	.icon :global(svg) {
		width: 24px;
		height: 24px;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 4.7px;
		min-width: 0;
	}
	.title {
		font-size: 16px;
		line-height: 21px;
		color: var(--text-accent);
	}
	.value,
	.date {
		font-size: 13px;
		line-height: 16px;
	}
	.date {
		color: var(--text-muted);
	}

	@container (min-width: 640px) {
		.tabs {
			padding-left: 20px;
		}
		.records {
			box-sizing: content-box;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 8px;
			max-width: 1126px;
			margin: 0 auto;
			padding: 16px 32px 32px;
			background: none;
		}
		.record {
			border-radius: 8px;
		}
	}
	@container (min-width: 1000px) {
		.records {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
