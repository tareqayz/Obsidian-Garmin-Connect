<script lang="ts">
	import {
		activityWhen,
		detailFields,
		heroFields,
		sportOf,
		typeLabel,
		type ElevationPoint,
		type Field,
		type Split,
		type Zone,
	} from "../../../dashboard/activity";
	import type { WorkoutEntry } from "../../../dashboard/series";
	import DetailGrid from "./DetailGrid.svelte";
	import ElevationProfile from "./ElevationProfile.svelte";
	import HrZoneBar from "./HrZoneBar.svelte";
	import MetricCard from "./MetricCard.svelte";
	import SplitsTable from "./SplitsTable.svelte";
	import SportBadge from "./SportBadge.svelte";

	interface Props {
		entry: WorkoutEntry;
		/**
		 * The three cards below the hero need per-activity detail that the sync
		 * does not collect yet — `mapWorkout` writes one short row per activity,
		 * not a stream. Each is optional and its card is simply absent without
		 * it, which is the same availability rule the v1 dashboard uses.
		 */
		splits?: readonly Split[];
		zones?: readonly Zone[];
		elevation?: readonly ElevationPoint[];
		/** Detail-grid fields from outside the vault row. */
		extraFields?: readonly Field[];
		/** Where the activity happened, if the caller knows. */
		location?: string;
		onBack?: () => void;
	}

	let { entry, splits, zones, elevation, extraFields, location, onBack }: Props = $props();

	let sport = $derived(sportOf(entry.type));
	let title = $derived(entry.name ?? typeLabel(entry.type));
	let when = $derived([activityWhen(entry), location].filter(Boolean).join(" · "));
	let hero = $derived(heroFields(entry));
	let fields = $derived(detailFields(entry, extraFields ?? []));

	let distanceUnit = $derived(entry.distance?.unit ?? "km");
	let elevationUnit = $derived(entry.ascent?.unit ?? "m");

	let ascent = $derived(entry.ascent ? `${entry.ascent.value} ${entry.ascent.unit} ascent` : "");
	let peak = $derived(
		elevation && elevation.length ? Math.round(Math.max(...elevation.map((p) => p.elevation))) : undefined,
	);
	let avgHr = $derived(entry.avg_hr);
</script>

<div class="screen">
	{#if onBack}
		<button class="back" type="button" onclick={onBack}>
			<span aria-hidden="true">‹</span>
			<span>All activities</span>
		</button>
	{/if}

	<header class="header">
		<SportBadge type={entry.type} />
		<h2 class="title">{title}</h2>
		<p class="when">{when}</p>
	</header>

	<!-- Three numbers, promoted out of the grid and given the display size.
	     Which three depends on the sport: a lift has no distance to lead with. -->
	<section class="hero">
		{#each hero as field, i (field.label)}
			{#if i > 0}<span class="divider"></span>{/if}
			<div class="column">
				<div class="label">{field.label}</div>
				<div class="value">
					<span class="number">{field.value}</span>
					{#if field.unit}<span class="unit">{field.unit}</span>{/if}
				</div>
			</div>
		{/each}
	</section>

	<div class="cards">
		{#if elevation && elevation.length >= 2}
			<MetricCard
				title="Elevation"
				subtitle={ascent}
				readout={peak === undefined ? undefined : String(peak)}
				readoutUnit="{elevationUnit} peak"
			>
				<ElevationProfile
					points={elevation}
					unit={distanceUnit}
					{elevationUnit}
					{sport}
				/>
			</MetricCard>
		{/if}

		{#if zones && zones.length > 0}
			<MetricCard
				title="Heart rate zones"
				subtitle="Time spent in each zone"
				readout={avgHr === undefined ? undefined : String(avgHr)}
				readoutUnit="avg bpm"
			>
				<HrZoneBar {zones} />
			</MetricCard>
		{/if}

		{#if splits && splits.length > 0}
			<MetricCard title="Splits" subtitle="Per {distanceUnit === 'mi' ? 'mile' : 'kilometre'}">
				<SplitsTable {splits} unit={distanceUnit} {elevationUnit} {sport} />
			</MetricCard>
		{/if}

		<MetricCard title="All metrics" subtitle="Everything this vault holds">
			<DetailGrid {fields} />
		</MetricCard>
	</div>
</div>

<style>
	.screen {
		display: flex;
		flex-direction: column;
		padding: 14px 16px 32px;
		background: var(--v2-surface-app);
		container-type: inline-size;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		align-self: flex-start;
		margin-bottom: 12px;
		padding: 0;
		border: none;
		background: transparent;
		box-shadow: none;
		color: var(--v2-accent);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}
	.back span:first-child {
		font-size: 14px;
	}
	.header {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		margin-bottom: 20px;
	}
	.title {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
		line-height: 1.3;
		color: var(--gcd-text);
	}
	.when {
		margin: 0;
		font-size: 13px;
		color: var(--gcd-muted);
	}
	.hero {
		display: flex;
		align-items: center;
		margin-bottom: 14px;
		padding: 22px 26px;
		border-radius: 12px;
		background: var(--v2-surface-card);
		box-shadow: var(--v2-shadow-1);
	}
	.column {
		flex: 1 1 130px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.divider {
		width: 1px;
		height: 48px;
		flex: none;
		background: var(--gcd-border);
	}
	.label {
		font-size: 11px;
		font-weight: 500;
		line-height: 1.2;
		letter-spacing: 0.44px;
		text-transform: uppercase;
		color: var(--gcd-muted);
	}
	.value {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}
	.number {
		font-size: 40px;
		font-weight: 600;
		line-height: 1.05;
		color: var(--gcd-text);
	}
	.unit {
		font-size: 15px;
		line-height: 1.4;
		color: var(--gcd-muted);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 14px;
		align-items: start;
	}

	/* A sidebar-width pane cannot hold three 40px numbers side by side. Letting
	   the row wrap strands the divider that belonged before the wrapped column,
	   so the hero stacks instead and drops the dividers altogether — they
	   separate columns, and stacked there are none. The one-row layout is the
	   default, so a renderer without container queries still gets the design. */
	@container (max-width: 520px) {
		.hero {
			flex-direction: column;
			align-items: stretch;
			gap: 14px;
			padding: 18px 20px;
		}
		.column {
			/* The 130px basis is a width on one row; stacked it would become a
			   130px-tall column, which is three screens of air. */
			flex: 0 0 auto;
		}
		.divider {
			display: none;
		}
		.number {
			font-size: 32px;
		}
	}
</style>
