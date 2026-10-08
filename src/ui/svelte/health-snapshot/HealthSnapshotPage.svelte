<script lang="ts">
	import { snapshotDetailView, snapshotListView } from "../../../dashboard/health-snapshot-pages";
	import { healthStatRoute } from "../../../dashboard/routes";
	import { shiftDate } from "../../../dashboard/series";
	import { SNAPSHOT_DAY, SNAPSHOT_LIST, snapshotDayIn, snapshotListIn, type SnapshotRow, type SnapshotSample } from "../../../sync/health-snapshot-index";
	import type { HealthStatPageProps } from "../health/pages";
	import StatPageShell from "../health/StatPageShell.svelte";
	import SnapshotDetail from "./SnapshotDetail.svelte";
	import SnapshotList from "./SnapshotList.svelte";

	/**
	 * Garmin Connect's Health Snapshot pages: the list, and a snapshot's
	 * detail on top of it (`sub` = its uuid, `date` = its local day). No
	 * ranges and no stepper. Twin: page 239:25.
	 */
	let { route, today, onBack, go, swap, readSeries, loadIntraday, seriesVersion }: HealthStatPageProps = $props();

	/* The list loads on view into today's file; offline on a new day, the newest of the last week's. */
	let rows = $state<SnapshotRow[] | null>(null);
	$effect(() => {
		void seriesVersion;
		let live = true;
		loadIntraday(today, [SNAPSHOT_LIST.key]).then(
			async (load) => {
				let list = snapshotListIn(load.series);
				if (!list) {
					const days = Array.from({ length: 7 }, (_, i) => shiftDate(today, -i));
					const files = await readSeries(days);
					for (const d of days) {
						list = snapshotListIn(files.get(d));
						if (list) break;
					}
				}
				if (live) rows = list ?? [];
			},
			() => {
				if (live) rows = [];
			},
		);
		return () => {
			live = false;
		};
	});

	let selected = $derived(route.sub && rows ? rows.find((r) => r.uuid === route.sub) ?? null : null);

	/* A snapshot's samples load on view into its own day's file. */
	let loaded = $state<{ uuid: string; samples: SnapshotSample[] | null } | null>(null);
	$effect(() => {
		const uuid = route.sub;
		const date = route.date ?? selected?.date;
		void seriesVersion;
		if (!uuid || !date) return;
		let live = true;
		loadIntraday(date, [SNAPSHOT_DAY.key]).then(
			(load) => {
				if (live) loaded = { uuid, samples: snapshotDayIn(load.series)?.[uuid] ?? null };
			},
			() => {
				if (live) loaded = { uuid, samples: null };
			},
		);
		return () => {
			live = false;
		};
	});

	let detail = $derived(selected ? snapshotDetailView(selected, loaded?.uuid === selected.uuid ? loaded.samples : undefined) : null);
	let items = $derived(rows ? snapshotListView(rows) : []);
</script>

<StatPageShell {route} {today} label={null} title={detail?.title} canGoBack={false} {onBack} {swap}>
	{#snippet children()}
		{#if route.sub}
			{#if detail}
				<SnapshotDetail view={detail} />
			{:else if rows}
				<p class="hs-empty">This snapshot isn’t available.</p>
			{/if}
		{:else if rows && !items.length}
			<p class="hs-empty">No Health Snapshots yet. Start one from your watch to record two minutes of heart rate, HRV, Pulse Ox, respiration and stress.</p>
		{:else}
			<SnapshotList {items} onopen={(item) => go(healthStatRoute("health-snapshot", { sub: item.uuid, date: item.date }))} />
		{/if}
	{/snippet}
</StatPageShell>

<style>
	.hs-empty {
		margin: 32px 16px;
		color: var(--text-muted);
		text-align: center;
	}
</style>
