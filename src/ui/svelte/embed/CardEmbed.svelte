<script lang="ts">
	import type { TodayItem } from "../../../dashboard/home";
	import type { Route } from "../../../dashboard/routes";
	import type { CardView, NoticeAction } from "../../../embeds/view";
	import type { TileSource } from "../../map/tile-source";
	import DayActivities from "../home/DayActivities.svelte";
	import FocusCard from "../home/FocusCard.svelte";
	import Glance from "../home/Glance.svelte";
	import Tap from "../home/Tap.svelte";
	import { lucide } from "../home/lucide";
	import ActivityCard from "./ActivityCard.svelte";
	import CardNotice from "./CardNotice.svelte";
	import ChartCard from "./ChartCard.svelte";
	import ChartSmall from "./ChartSmall.svelte";

	/**
	 * A ```garmin block in a note: Home's cards for its day, as on Home and at
	 * Home's sizes, a stat page's charts in Home cards, or an activity with its
	 * map. Big cards share a row two at a time, small ones four, and a phone
	 * stacks them; a chart or an activity takes the whole width. The block
	 * measures its own width (a container query), as Home's page column does.
	 * A click opens the card's page in Garmin Home.
	 */
	interface Props {
		initialView: CardView;
		open: (route: Route) => void;
		openActivity: (item: TodayItem, date: string) => void;
		act: (kind: NoticeAction) => void;
		/** OpenStreetMap's tiles for an activity's map, or none when the setting is off. */
		tiles: () => TileSource | null;
	}

	let { initialView, open, openActivity, act, tiles }: Props = $props();

	// Seeded once; the block sets what follows.
	// svelte-ignore state_referenced_locally
	let view = $state<CardView>(initialView);

	export function setView(next: CardView) {
		view = next;
	}

	const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
</script>

<div class="gce">
	{#if view.caption}
		<div class="gce-caption"><span class="watch" use:lucide={"watch"}></span>{view.caption}</div>
	{/if}
	<!-- A card throwing on data it didn't expect shows a line, not a broken note. -->
	<svelte:boundary onerror={(error) => console.error("Garmin: a card couldn't be drawn", error)}>
		{#if view.state === "loading"}
			<div class="gce-skeleton" style:height="{view.height}px"></div>
		{:else if view.state === "notice"}
			<CardNotice notice={view.notice} {act} />
		{:else if view.state === "cards"}
			{@const cards = view}
			<div class="rows">
				{#each cards.groups as group, i (i)}
					{#if group.kind === "focus"}
						<div class="focus">
							{#each group.ids as id (id)}
								{@const page = cards.routes.focus[id] ?? null}
								{#if page}
									<Tap contained open={() => open(page)}><FocusCard {id} model={cards.model} emptyText={cards.emptyText} /></Tap>
								{:else}<FocusCard {id} model={cards.model} emptyText={cards.emptyText} />{/if}
							{/each}
						</div>
					{:else if group.kind === "glance"}
						<div class="glance">
							{#each group.ids as id (id)}
								{@const page = cards.routes.glance[id] ?? null}
								{#if page}
									<Tap contained open={() => open(page)}>
										<Glance {id} model={cards.model} emptyText={cards.emptyText} badge={cards.badges[id]} />
									</Tap>
								{:else}<Glance {id} model={cards.model} emptyText={cards.emptyText} badge={cards.badges[id]} />{/if}
							{/each}
						</div>
					{:else}
						<DayActivities
							items={cards.model.today}
							contained
							wide
							emptyText={cards.activitiesEmpty}
							opens={(item) => (item.kind === "activity" ? () => openActivity(item, cards.date) : null)}
						/>
					{/if}
				{/each}
			</div>
		{:else if view.state === "charts"}
			<div class={view.size === "small" ? "glance" : "rows"}>
				{#each view.charts as card (card.id)}
					<Tap contained open={() => open(card.route)}>
						{#if view.size === "small"}<ChartSmall {card} />{:else}<ChartCard {card} />{/if}
					</Tap>
				{/each}
			</div>
		{:else if view.state === "activities"}
			<div class="rows">
				{#each view.activities as card (card.id)}
					<Tap contained open={() => open(card.route)}><ActivityCard {card} tiles={tiles()} /></Tap>
				{/each}
			</div>
		{/if}
		{#snippet failed(error)}
			<CardNotice notice={{ icon: "circle-x", text: "This card couldn’t be drawn.", tone: "error", hint: message(error) }} {act} />
		{/snippet}
	</svelte:boundary>
</div>

<style>
	.gce {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	/* The day, when it isn't the note's own. */
	.gce-caption {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		line-height: 16px;
		color: var(--text-muted);
	}
	.watch {
		display: inline-flex;
		color: var(--text-faint);
	}
	.watch :global(svg) {
		width: 14px;
		height: 14px;
	}
	.gce-skeleton {
		border-radius: var(--radius-m, 8px);
		background: var(--background-secondary);
		opacity: 0.6;
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: var(--gch-gap, 8px);
	}
	.focus {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--gch-gap, 8px);
	}
	.glance {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--gch-gap, 8px);
	}
	/* A narrow sidebar: one small card a row. */
	@container (max-width: 299px) {
		.glance {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@container (min-width: 640px) {
		.focus {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.glance {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
	@container (min-width: 1000px) {
		.focus {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.glance {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
	}
</style>
