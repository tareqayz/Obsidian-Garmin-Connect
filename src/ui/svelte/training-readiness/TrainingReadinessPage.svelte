<script lang="ts">
	import { dayOf } from "../../../dashboard/periods";
	import { trainingReadinessView, type ReadinessFactor } from "../../../dashboard/training-readiness-pages";
	import type { DayIndexMeta, DayRow } from "../../../sync/day-index";
	import { HRV_STATUS_INDEX, type HrvStatusRow } from "../../../sync/hrv-status-index";
	import type { DaySeries } from "../../../sync/intraday";
	import type { SleepRow } from "../../../sync/sleep-index";
	import { STRESS_INDEX, type StressRow } from "../../../sync/stress-index";
	import { READINESS_DAY, TRAINING_READINESS_INDEX, readinessDayIn, type TrainingReadinessRow } from "../../../sync/training-readiness-index";
	import { TRAINING_STATUS_INDEX, type TrainingStatusRow } from "../../../sync/training-status-index";
	import StatPageShell from "../health/StatPageShell.svelte";
	import type { PerformanceStatPageProps } from "../performance/pages";
	import ReadinessDay from "./ReadinessDay.svelte";
	import ReadinessSheet from "./ReadinessSheet.svelte";

	/**
	 * Garmin Connect's Training Readiness page (Performance Stats). Twin:
	 * Figma page 430:6106 — phone (Light 652:50, Dark 655:835) today 652:51,
	 * a past day 652:244, no reading yet 652:445, the six sheets 654:195 /
	 * 654:444 / 654:564 / 654:766 / 654:1009 / 654:1224 and Recovered
	 * 654:1414; panes (Light 656:1615, Dark 657:1760) 656:1616 and the HRV
	 * dialog 656:1688. A day at a time: the shell's day stepper, no range
	 * control and no Help.
	 *
	 * Today shows its newest reading and a past day its morning one: the day's
	 * readings come from its series file (`loadIntraday(date,
	 * [READINESS_DAY.key])`, kept by every sync, fetched on view otherwise),
	 * the past days' from the training-readiness index meanwhile. A factor's
	 * sheet reads the Training Status, HRV Status, sleep and stress indexes
	 * and the day's hypnogram, so the page asks nothing else on view.
	 */
	let { route, today, canSync, onBack, swap, readIndex, loadIntraday, onSyncHistory, versions, seriesVersion, history, openSheet }: PerformanceStatPageProps =
		$props();

	const KIND = TRAINING_READINESS_INDEX.kind;

	/** An index's rows and meta, re-read whenever its folder changes. */
	function watchIndex<R extends DayRow>(kind: string, take: (rows: R[], meta: DayIndexMeta | null) => void): void {
		$effect(() => {
			void versions[kind];
			let live = true;
			readIndex<R>(kind).then(
				(index) => {
					if (live) take(index.rows, index.meta);
				},
				() => {},
			);
			return () => {
				live = false;
			};
		});
	}

	let rows = $state.raw<TrainingReadinessRow[]>([]);
	let meta = $state.raw<DayIndexMeta | null>(null);
	let status = $state.raw<TrainingStatusRow[]>([]);
	let hrv = $state.raw<HrvStatusRow[]>([]);
	let sleep = $state.raw<SleepRow[]>([]);
	let stress = $state.raw<StressRow[]>([]);
	watchIndex<TrainingReadinessRow>(KIND, (r, m) => {
		rows = r;
		meta = m;
	});
	watchIndex<TrainingStatusRow>(TRAINING_STATUS_INDEX.kind, (r) => (status = r));
	watchIndex<HrvStatusRow>(HRV_STATUS_INDEX.kind, (r) => (hrv = r));
	watchIndex<SleepRow>("sleep", (r) => (sleep = r));
	watchIndex<StressRow>(STRESS_INDEX.kind, (r) => (stress = r));

	/* The day's readings and its hypnogram: the series file, or the readings fetched for it. */
	let date = $derived(dayOf(route, today));
	let loaded = $state.raw<{ date: string; series: DaySeries | null } | null>(null);
	$effect(() => {
		const d = date;
		void seriesVersion;
		let live = true;
		loadIntraday(d, [READINESS_DAY.key]).then(
			(load) => {
				if (live) loaded = { date: d, series: load.series };
			},
			() => {
				if (live) loaded = { date: d, series: null };
			},
		);
		return () => {
			live = false;
		};
	});
	let series = $derived(loaded?.date === date ? loaded.series : undefined);
	let readings = $derived(series === undefined ? undefined : readinessDayIn(series));

	let complete = $derived(meta?.complete ?? false);
	let view = $derived(trainingReadinessView(route, { rows, complete, readings }, { today, status, hrv, sleep, stress, series }));

	function openFactor(factor: ReadinessFactor) {
		openSheet(factor.sheet.title, ReadinessSheet, { sheet: factor.sheet });
	}
</script>

<StatPageShell
	{route}
	{today}
	label={view.label}
	canGoBack={view.canGoBack}
	canGoForward={view.canGoForward}
	{onBack}
	{swap}
	history={{ title: TRAINING_READINESS_INDEX.title, windowDays: TRAINING_READINESS_INDEX.windowDays, complete, walking: history[KIND], canSync, onSync: () => onSyncHistory(KIND) }}
>
	{#snippet children()}
		<ReadinessDay {view} onFactor={openFactor} />
	{/snippet}
</StatPageShell>
