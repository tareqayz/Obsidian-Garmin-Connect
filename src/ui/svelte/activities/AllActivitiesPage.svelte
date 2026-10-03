<script lang="ts">
	import { allActivities, type ActivitiesData } from "../../../dashboard/activities";
	import { sportIcon } from "../../sport-icons";
	import PageBar from "../home/PageBar.svelte";
	import { lucide } from "../home/lucide";

	/**
	 * Every activity, newest first. Drawn a page at a time as the list scrolls:
	 * years of history is hundreds of rows, and nobody reads them all at once.
	 */
	interface Props {
		data: ActivitiesData;
		onBack: () => void;
	}

	let { data, onBack }: Props = $props();

	const PAGE = 60;
	let items = $derived(allActivities(data.rows, data.units));
	let limit = $state(PAGE);
	let shown = $derived(items.slice(0, limit));

	let sentinel = $state<HTMLElement | null>(null);
	$effect(() => {
		if (!sentinel) return;
		const root = sentinel.closest<HTMLElement>(".view-content");
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) limit += PAGE;
			},
			{ root, rootMargin: "600px 0px" },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});
</script>

<PageBar title="All Activities" {onBack} />

<div class="rows">
	{#each shown as item (item.id)}
		<div class="row">
			<span class="icon" use:lucide={sportIcon(item.glyph)}></span>
			<div class="text">
				<span class="name">{item.name}</span>
				<span class="when">{item.when}</span>
				{#if item.time || item.distance}
					<span class="figures">
						{#if item.time}<span>{item.time}</span>{/if}
						{#if item.distance}<span>{item.distance}</span>{/if}
					</span>
				{/if}
			</div>
		</div>
	{:else}
		<p class="empty">No activities synced yet.</p>
	{/each}
	{#if shown.length < items.length}<div class="more" bind:this={sentinel}></div>{/if}
</div>

<style>
	.rows {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		background: var(--background-secondary);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 22px;
		min-height: 87.6px;
		box-sizing: border-box;
		padding: 0 21px 0 22.65px;
		background: var(--background-secondary);
	}
	.icon {
		display: inline-flex;
		flex: none;
		color: var(--text-normal);
	}
	.icon :global(svg) {
		width: 28px;
		height: 28px;
	}
	.text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.name,
	.when {
		font-size: 16px;
		line-height: 21px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.when {
		color: var(--text-muted);
	}
	.figures {
		display: flex;
		gap: 14px;
		font-size: 11px;
		line-height: 14px;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	.empty {
		margin: 0;
		padding: 24px;
		color: var(--text-muted);
		font-size: 15px;
		background: var(--background-primary);
	}
	.more {
		height: 1px;
	}

	@container (min-width: 640px) {
		.rows {
			box-sizing: content-box;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 8px;
			max-width: 1126px;
			margin: 0 auto;
			padding: 16px 32px 32px;
			background: none;
		}
		.row {
			border-radius: 8px;
		}
		.empty,
		.more {
			grid-column: 1 / -1;
		}
	}
	@container (min-width: 1000px) {
		.rows {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
