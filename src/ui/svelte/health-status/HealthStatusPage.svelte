<script lang="ts">
	import { healthSheetView, healthStatusDayView, sheetKeyOf } from "../../../dashboard/health-status-pages";
	import type { PeriodRoute } from "../../../dashboard/periods";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { HEALTH_STATUS_INDEX, type HealthMetricKey, type HealthStatusRow } from "../../../sync/health-status-index";
	import type { SleepRow } from "../../../sync/sleep-index";
	import type { HealthStatPageProps } from "../health/pages";
	import StatPageShell from "../health/StatPageShell.svelte";
	import MetricSheet from "./MetricSheet.svelte";
	import MetricTile from "./MetricTile.svelte";

	/**
	 * Garmin Connect's Health Status page: a day's verdict, its five metrics
	 * grouped by status, each scored one opening its sheet (kept in the
	 * route's `sub`). One range, 1d, with the date stepper.
	 */
	let { route, today, canSync, onBack, swap, readIndex, onSyncHistory, versions, history }: HealthStatPageProps = $props();

	const KIND = HEALTH_STATUS_INDEX.kind;

	let rows = $state<HealthStatusRow[]>([]);
	let meta = $state<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<HealthStatusRow>(KIND).then(
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

	/* The sheets' line: the sleep index's nightly values. */
	let sleep = $state<SleepRow[]>([]);
	$effect(() => {
		void versions.sleep;
		let live = true;
		readIndex<SleepRow>("sleep").then(
			(index) => {
				if (live) sleep = index.rows;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	let pageRoute: PeriodRoute = $derived({ range: "1d", offset: route.offset });
	let data = $derived({ rows, complete: meta?.complete ?? false });
	let view = $derived(healthStatusDayView({ data, route: pageRoute, today }));
	let sheetKey = $derived(sheetKeyOf(route.sub));
	let sheet = $derived(sheetKey ? healthSheetView({ data, sleep, date: view.date, key: sheetKey }) : null);

	function open(key: HealthMetricKey) {
		swap({ ...route, sub: key });
	}
	function close() {
		const { sub: _sub, ...rest } = route;
		swap(rest);
	}
</script>

<StatPageShell
	{route}
	{today}
	label={view.label}
	canGoBack={view.canGoBack}
	{onBack}
	{swap}
	history={{
		title: HEALTH_STATUS_INDEX.title,
		windowDays: HEALTH_STATUS_INDEX.windowDays,
		complete: meta?.complete ?? false,
		walking: history[KIND],
		canSync,
		onSync: () => onSyncHistory(KIND),
	}}
>
	{#snippet children()}
		<div class="hs-day">
			<div class="intro">
				<div class="headline">{view.headline}</div>
				<!-- Not a <p>: Obsidian pads it. -->
				<div class="copy">{view.copy}</div>
			</div>
			{#each view.groups as group (group.group)}
				<section class="group">
					<h3>{group.title}</h3>
					<div class="tiles">
						{#each group.metrics as metric (metric.key)}
							<MetricTile {metric} onopen={metric.group === "none" ? undefined : () => open(metric.key)} />
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/snippet}
</StatPageShell>

{#if sheet && sheet.metric.group !== "none"}<MetricSheet view={sheet} onClose={close} />{/if}

<style>
	.hs-day {
		padding: 0 16px 32px;
	}
	.intro {
		max-width: 370px;
		margin-top: 8px;
	}
	.headline {
		font-size: 26px;
		line-height: 32px;
	}
	.copy {
		margin-top: 10px;
		font-size: 15px;
		line-height: 22px;
	}
	.group {
		margin-top: 24px;
	}
	h3 {
		margin: 0 0 12px;
		font-size: 13px;
		font-weight: 400;
		letter-spacing: 0.02em;
		color: var(--text-muted);
	}
	.tiles {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 16px;
	}
	@container (min-width: 640px) {
		.tiles {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@container (min-width: 1000px) {
		.hs-day {
			padding: 0 14px 32px;
		}
		.intro {
			padding: 0 14px;
		}
		.tiles {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 8px;
			padding: 0 14px;
		}
	}
</style>
