<script lang="ts">
	import type { PeriodRoute } from "../../../dashboard/periods";
	import { ACCLIMATION_POINT_R, acclimationPlot } from "../../../dashboard/pulse-ox-acclimation-charts";
	import { acclimationView, type AcclimationPageData } from "../../../dashboard/pulse-ox-acclimation-pages";
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { PULSE_OX_INDEX, type PulseOxRow } from "../../../sync/pulse-ox-index";
	import type { HealthStatPageProps } from "../health/pages";
	import StatPageShell from "../health/StatPageShell.svelte";

	/**
	 * Garmin Connect's Pulse Ox Acclimation page in the shared shell: a week or
	 * four weeks of daily SpO₂ over the elevation they were taken at, and the
	 * period's Overall average. It reads Pulse Ox's index.
	 */
	let { route, today, canSync, onBack, swap, readIndex, onSyncHistory, versions, history }: HealthStatPageProps = $props();

	const KIND = PULSE_OX_INDEX.kind;

	let rows = $state<PulseOxRow[]>([]);
	let meta = $state<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<PulseOxRow>(KIND).then(
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

	let pageRoute: PeriodRoute = $derived({ range: route.range === "4w" ? "4w" : "7d", offset: route.offset });
	let data: AcclimationPageData = $derived({ rows, complete: meta?.complete ?? false });
	let view = $derived(acclimationView({ data, route: pageRoute, today }));

	let measured = $state(0);

	const LEGEND = [
		{ label: "<70%", colour: "var(--spo2-poor)" },
		{ label: "70-79%", colour: "var(--spo2-low)" },
		{ label: "80-89%", colour: "var(--spo2-mid)" },
		{ label: "90-100%", colour: "var(--spo2-high)" },
	];
</script>

<StatPageShell
	{route}
	{today}
	label={view.label}
	canGoBack={view.canGoBack}
	{onBack}
	{swap}
	history={{ title: PULSE_OX_INDEX.title, windowDays: PULSE_OX_INDEX.windowDays, complete: meta?.complete ?? false, walking: history[KIND], canSync, onSync: () => onSyncHistory(KIND) }}
>
	{#snippet children({ pane })}
		{@const p = acclimationPlot(view, measured || (pane ? PANE_COLUMN : PHONE), pane)}
		<div class="acclimation">
			<p class="caption">{view.caption}</p>
			<div class="overview">
				<div class="chart" bind:clientWidth={measured}>
					{#if view.showChart}
						<svg width={p.width} height={p.height} aria-hidden="true">
							{#each p.grid as line, i (i)}
								<line class="grid" x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />
								<text class="tick" x={p.labelRight} y={line.y} text-anchor="end" dominant-baseline="central">{line.label}</text>
								<text class="tick" x={p.rightX} y={line.y} dominant-baseline="central">{p.rightLabels[i]?.text}</text>
							{/each}
							{#if p.area}<path class="area" d={p.area} />{/if}
							{#each p.dots as dot}<circle class="dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
							{#each p.labels as label}<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>{/each}
							{#each p.points as point}<circle class="point" style:fill="var(--spo2-{point.band})" cx={point.x} cy={point.y} r={ACCLIMATION_POINT_R} />{/each}
						</svg>
						<div class="legend">
							<div class="row">{#each LEGEND as l (l.label)}<span><i style:background={l.colour}></i>{l.label}</span>{/each}</div>
							<div class="row"><span><i class="hollow"></i>Unmeasurable</span><span><i style:background="var(--acclimation-elevation)"></i>Elevation</span></div>
						</div>
					{:else}
						<p class="empty">No pulse ox acclimation data.</p>
					{/if}
				</div>
				<div class="averages">
					<h3>Averages</h3>
					<div class="overall">
						<span class="value">{view.overallText}</span>
						<span class="label">Overall</span>
					</div>
				</div>
			</div>
		</div>
	{/snippet}
</StatPageShell>

<style>
	.acclimation {
		--spo2-high: var(--color-green);
		--spo2-mid: var(--color-yellow);
		--spo2-low: var(--color-orange);
		--spo2-poor: var(--color-red);
		--acclimation-elevation: var(--background-modifier-border-hover);
	}
	.caption {
		margin: -14px 0 0;
		text-align: center;
		font-size: 14px;
		color: var(--text-muted);
	}
	.chart {
		min-width: 0;
		margin-top: 8px;
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
		font-size: 12px;
	}
	.axis {
		font-size: 10px;
	}
	.dot {
		fill: var(--text-faint);
	}
	.area {
		fill: var(--acclimation-elevation);
	}
	.legend {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted);
	}
	.row {
		display: flex;
		gap: 12px;
	}
	.row span {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	.row i {
		width: 11px;
		height: 11px;
		border-radius: 50%;
	}
	.row i.hollow {
		box-sizing: border-box;
		border: 1px solid var(--text-muted);
	}
	.empty {
		margin: 0;
		padding: 140px 16px;
		text-align: center;
		color: var(--text-muted);
	}
	.averages {
		padding: 16px 16px 16px;
	}
	.averages h3 {
		margin: 0 0 8px;
		font-size: 14px;
		font-weight: 400;
		color: var(--text-muted);
	}
	.overall {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 76px;
		border-radius: 8px;
		background: var(--background-secondary);
	}
	.overall .value {
		font-size: 26px;
		line-height: 32px;
		font-weight: 600;
	}
	.overall .label {
		font-size: 13px;
		color: var(--text-muted);
	}

	@container (min-width: 1000px) {
		.overview {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 8px;
			align-items: start;
		}
		.chart {
			margin-top: 32px;
		}
		.averages {
			padding: 32px 0 0;
		}
	}
</style>
