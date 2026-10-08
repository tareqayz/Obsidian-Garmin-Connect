<script lang="ts">
	import { BP_BAR_WIDTH, bloodPressurePlot } from "../../../dashboard/blood-pressure-charts";
	import { BP_CATEGORIES, BP_DISCLAIMER, bloodPressureDayView, bloodPressurePeriodView, type BloodPressurePageData } from "../../../dashboard/blood-pressure-pages";
	import type { PeriodRoute } from "../../../dashboard/periods";
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";
	import { BLOOD_PRESSURE_INDEX, type BloodPressureRow } from "../../../sync/blood-pressure-index";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { lucide } from "../home/lucide";
	import type { HealthStatPageProps } from "../health/pages";
	import StatFigures from "../health/StatFigures.svelte";
	import StatPageShell from "../health/StatPageShell.svelte";

	/**
	 * Garmin Connect's Blood Pressure page in the shared shell. Built against
	 * the empty pages the phone showed; a reading's hero and bars are Inferred
	 * and appear only if Garmin ever sends one. "Add a Reading" is left out.
	 */
	let { route, today, canSync, onBack, swap, readIndex, onSyncHistory, versions, history }: HealthStatPageProps = $props();

	const KIND = BLOOD_PRESSURE_INDEX.kind;

	let rows = $state<BloodPressureRow[]>([]);
	let meta = $state<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<BloodPressureRow>(KIND).then(
			(index) => {
				if (!live) return;
				rows = index.rows;
				meta = index.meta;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	let pageRoute: PeriodRoute = $derived(route.date ? { range: route.range, offset: route.offset, date: route.date } : { range: route.range, offset: route.offset });
	let data: BloodPressurePageData = $derived({ rows, complete: meta?.complete ?? false });
	let dayView = $derived(pageRoute.range === "1d" ? bloodPressureDayView({ data, route: pageRoute, today }) : null);
	let periodView = $derived(pageRoute.range === "1d" ? null : bloodPressurePeriodView({ data, route: pageRoute, today }));

	let measured = $state(0);
</script>

<StatPageShell
	{route}
	{today}
	label={dayView?.label ?? periodView?.label ?? ""}
	canGoBack={dayView?.canGoBack ?? periodView?.canGoBack ?? false}
	{onBack}
	{swap}
	history={{ title: BLOOD_PRESSURE_INDEX.title, windowDays: BLOOD_PRESSURE_INDEX.windowDays, complete: meta?.complete ?? false, walking: history[KIND], canSync, onSync: () => onSyncHistory(KIND) }}
>
	{#snippet children({ pane })}
		<div class="blood-pressure">
			{#if dayView}
				<div class="day">
					<span class="glyph" use:lucide={"heart-pulse"}></span>
					<span class="hero" class:reading={dayView.hasReading}>{dayView.hero}{#if dayView.hasReading}<small>mmHg</small>{/if}</span>
					{#if dayView.hasReading}
						{#if dayView.pulse}<p class="copy">Pulse {dayView.pulse}</p>{/if}
					{:else}
						<strong class="none">No Readings</strong>
						<p class="copy">Measure your blood pressure with a Garmin Index BPM or enter a reading manually.</p>
					{/if}
				</div>
			{:else if periodView}
				{@const p = bloodPressurePlot(periodView, measured || (pane ? PANE_COLUMN : PHONE), pane)}
				<div class="overview">
					<div class="chart" bind:clientWidth={measured}>
						<h3 class="title">{periodView.title}</h3>
						<svg width={p.width} height={p.height} aria-hidden="true">
							{#each p.grid as line (line.label)}
								{#if line.x2 > line.x1}<line class="grid" x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />{/if}
								<text class="tick" x={p.labelRight} y={line.y} text-anchor="end" dominant-baseline="central">{line.label}</text>
							{/each}
							{#each p.bars as bar}<line class="bar" style:stroke="var(--bp-{bar.category})" x1={bar.x} x2={bar.x} y1={bar.top} y2={bar.bottom} stroke-width={BP_BAR_WIDTH} />{/each}
							{#each p.dots as dot}<circle class="dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
							{#each p.labels as label}
								{#if label.rotated}
									<text class="axis" x={label.x} y={label.y} text-anchor="end" dominant-baseline="central" transform="rotate(-90 {label.x} {label.y})">{label.text}</text>
								{:else}
									<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>
								{/if}
							{/each}
							{#if !p.bars.length}<text class="empty" x={p.width / 2} y={p.emptyY} text-anchor="middle" dominant-baseline="central">No data available</text>{/if}
						</svg>
						<div class="legend">
							{#each BP_CATEGORIES as c (c.id)}<span><i style:background="var(--bp-{c.id})"></i>{c.label}</span>{/each}
						</div>
						<p class="disclaimer">{BP_DISCLAIMER}</p>
					</div>
					<div class="figures"><StatFigures figures={periodView.tiles.map((t) => ({ value: t.value, label: t.label }))} /></div>
				</div>
			{/if}
		</div>
	{/snippet}
</StatPageShell>

<style>
	/* The twin's bp/* aliases: the ISH categories. */
	.blood-pressure {
		--bp-normal: var(--color-green);
		--bp-high-normal: var(--color-yellow);
		--bp-grade1: var(--color-orange);
		--bp-grade2: var(--color-red);
	}
	.day {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 54px 40px 16px;
		text-align: center;
	}
	.glyph {
		color: var(--color-red);
	}
	.glyph :global(svg) {
		width: 32px;
		height: 32px;
	}
	.hero {
		margin-top: 40px;
		font-size: 40px;
		line-height: 48px;
		font-weight: 700;
	}
	.hero small {
		margin-left: 4px;
		font-size: 17px;
		font-weight: 400;
	}
	.none {
		margin-top: 56px;
		font-size: 20px;
		line-height: 25px;
	}
	.copy {
		margin: 12px 0 0;
		font-size: 16px;
		line-height: 21px;
		color: var(--text-muted);
	}
	.title {
		margin: 24px 0 0;
		padding-left: 16px;
		font-size: 22px;
		line-height: 25px;
		font-weight: 400;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--background-modifier-border);
		stroke-width: 0.5;
	}
	.tick,
	.axis {
		fill: var(--text-muted);
		font-size: 10px;
	}
	.dot {
		fill: var(--text-faint);
	}
	.empty {
		fill: var(--text-muted);
		font-size: 14px;
	}
	.bar {
		stroke-linecap: round;
	}
	.legend {
		display: flex;
		justify-content: center;
		gap: 12px;
		margin-top: 8px;
		font-size: 13px;
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	.legend i {
		width: 16px;
		height: 16px;
		border-radius: 50%;
	}
	.disclaimer {
		margin: 12px 16px 0;
		font-size: 11px;
		line-height: 14px;
		color: var(--text-muted);
	}
	.figures {
		padding: 16px 16px;
	}

	@container (min-width: 1000px) {
		.overview {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 8px;
			align-items: start;
			--stat-figure-gap: 16px;
		}
		.title {
			padding-left: 0;
		}
		.figures {
			padding: 82px 0 0;
		}
	}
</style>
