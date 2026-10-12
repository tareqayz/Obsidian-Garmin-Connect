<script lang="ts">
	import type { StatRoute } from "../../../dashboard/routes";
	import type { DayRow } from "../../../dashboard/series";
	import { trainingStatusView, withSelection, type StatusTableRow, type TrainingStatusFactor } from "../../../dashboard/training-status-pages";
	import { vo2Person } from "../../../dashboard/vo2-max-pages";
	import type { AccountInfo } from "../../../sync/account";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { HEAT_ACCLIMATION_INDEX, type HeatAcclimationRow } from "../../../sync/heat-acclimation-index";
	import { HRV_STATUS_INDEX, type HrvStatusRow } from "../../../sync/hrv-status-index";
	import { TRAINING_STATUS_INDEX, type TrainingStatusRow } from "../../../sync/training-status-index";
	import { VO2_MAX_INDEX, type Vo2MaxRow } from "../../../sync/vo2-max-index";
	import StatPageShell from "../health/StatPageShell.svelte";
	import type { PerformanceStatPageProps } from "../performance/pages";
	import StatusCurrent from "./StatusCurrent.svelte";
	import StatusPeriod from "./StatusPeriod.svelte";

	/**
	 * Garmin Connect's Training Status page (Performance Stats). Twin: Figma
	 * page 430:6100 — phone 561:10 (Current), 561:60 (4w), 562:104152 (12w),
	 * 562:104375 / 562:104599 (a row selected), 562:104823 (6m, Inferred),
	 * 561:143 (4w previous, Inferred); panes 564:1979 on. Current has no
	 * period row and opens VO₂ Max, HRV Status, Load and Heat Acclimation from
	 * its rows; 4w, 12w and 6m draw the period's runs and list them. A row's
	 * tap selects its run in the route's `sub`, a second tap clears it, and a
	 * range or a period step drops it. Everything comes from the
	 * training-status index, the day files (Load Focus; the heat % while the
	 * heat-acclimation index has none) and the VO₂ Max, HRV Status and Heat
	 * Acclimation indexes, so the page works offline.
	 */
	let { route, today, canSync, onBack, go, swap, readIndex, onSyncHistory, versions, history, readDays, readAccount }: PerformanceStatPageProps = $props();

	const KIND = TRAINING_STATUS_INDEX.kind;
	const VO2_KIND = VO2_MAX_INDEX.kind;
	const HRV_KIND = HRV_STATUS_INDEX.kind;
	const HEAT_KIND = HEAT_ACCLIMATION_INDEX.kind;

	let rows = $state.raw<TrainingStatusRow[]>([]);
	let meta = $state.raw<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<TrainingStatusRow>(KIND).then(
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

	/* The VO₂ Max row: the vo2-max index's readings. */
	let vo2 = $state.raw<Vo2MaxRow[]>([]);
	$effect(() => {
		void versions[VO2_KIND];
		let live = true;
		readIndex<Vo2MaxRow>(VO2_KIND).then(
			(index) => {
				if (live) vo2 = index.rows;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	/* The HRV Status row: the hrv-status index's nights. */
	let hrv = $state.raw<HrvStatusRow[]>([]);
	$effect(() => {
		void versions[HRV_KIND];
		let live = true;
		readIndex<HrvStatusRow>(HRV_KIND).then(
			(index) => {
				if (live) hrv = index.rows;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	/* The Heat Acclimation row: the heat-acclimation index's days. */
	let heat = $state.raw<HeatAcclimationRow[]>([]);
	$effect(() => {
		void versions[HEAT_KIND];
		let live = true;
		readIndex<HeatAcclimationRow>(HEAT_KIND).then(
			(index) => {
				if (live) heat = index.rows;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	/* Load Focus (and the heat % until the heat index has a row) from the day files; the VO₂ class for the newest chronological age there and the account's sex. */
	let days = $state.raw<DayRow[]>([]);
	$effect(() => {
		void versions["#days"];
		let live = true;
		readDays().then(
			(read) => {
				if (live) days = read;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});
	let account = $state.raw<AccountInfo | null>(null);
	$effect(() => {
		void versions["#account"];
		let live = true;
		readAccount().then(
			(read) => {
				if (live) account = read;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	let complete = $derived(meta?.complete ?? false);
	let view = $derived(trainingStatusView(route, rows, { today, complete, days, vo2, hrv, heat, ...vo2Person(days, account, today) }));

	/** The shell's range control and steppers: a range or a period drops the selected run, which the shell would keep. */
	function move(next: StatRoute) {
		swap(next.range !== route.range || next.offset !== route.offset ? withSelection(next, null) : next);
	}

	/** A row's tap: selects its run, or clears it when it is already selected (Inferred). */
	function select(row: StatusTableRow) {
		swap(withSelection(route, row.selected ? null : row.key));
	}

	/** A Current row: its page on top (Load and Heat Acclimation show "not in this version" until theirs land). */
	function open(factor: TrainingStatusFactor) {
		go(factor.route);
	}
</script>

<StatPageShell
	{route}
	{today}
	label={view.label}
	canGoBack={view.canGoBack}
	canGoForward={view.range !== "1d" && view.canGoForward}
	{onBack}
	swap={move}
	history={{ title: TRAINING_STATUS_INDEX.title, windowDays: TRAINING_STATUS_INDEX.windowDays, complete, walking: history[KIND], canSync, onSync: () => onSyncHistory(KIND) }}
>
	{#snippet children({ pane })}
		{#if view.range === "1d"}
			<StatusCurrent {view} onOpen={open} />
		{:else}
			<StatusPeriod {view} {pane} onSelect={select} />
		{/if}
	{/snippet}
</StatPageShell>
