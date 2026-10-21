<script lang="ts">
	import type { TrainingSegment } from "../../../dashboard/training-load-copy";
	import { trainingLoadView, withTrainingView } from "../../../dashboard/training-load-pages";
	import type { DayRow } from "../../../dashboard/series";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { TRAINING_STATUS_INDEX, type TrainingStatusRow } from "../../../sync/training-status-index";
	import StatPageShell from "../health/StatPageShell.svelte";
	import StatTabs from "../health/StatTabs.svelte";
	import type { PerformanceStatPageProps } from "../performance/pages";
	import ExerciseLoad from "./ExerciseLoad.svelte";
	import LoadFocus from "./LoadFocus.svelte";
	import TrainingLoad from "./TrainingLoad.svelte";

	/**
	 * Garmin Connect's Load page (Performance Stats; hidden: Training
	 * Status's Load row and Home's Load Focus and Training Load cards open
	 * it). Twin: Figma page 430:6102 — phones 603:10 (Load Focus), 604:37 /
	 * 604:405 (Exercise Load, current and previous), 606:454 / 606:659 /
	 * 606:894 / 606:1097 (Training Load: Acute, Acute + Chronic, Ratio,
	 * previous); panes 609:1438, 609:1511, 610:1571, 610:1745.
	 *
	 * Three tabs under the bar (the route's `tab`), no range control: Load
	 * Focus shows its record's window alone, Exercise Load and Training Load
	 * step through 4-week periods. In a pane the tabs take the range
	 * control's place in the header's row. Everything comes from what the
	 * plugin keeps — the day files, the activity index and the
	 * training-status index — so the page works offline.
	 */
	let { route, today, units, canSync, onBack, go, swap, readIndex, onSyncHistory, versions, history, readDays, activities }: PerformanceStatPageProps = $props();

	const KIND = TRAINING_STATUS_INDEX.kind;
	/** The tabs' height (Tabs · Equal · 3 at Load's 51); a pane's header row is 72 with its rule. */
	const TABS = { phone: 51, pane: 71 } as const;

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

	/* Load Focus: the day files' `load_*` and `load_focus`. */
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

	let complete = $derived(meta?.complete ?? false);
	let view = $derived(
		trainingLoadView(route, {
			today,
			units,
			days,
			activities: activities.rows,
			activitiesComplete: activities.complete,
			status: rows,
			statusComplete: complete,
		}),
	);

	function segment(next: TrainingSegment) {
		swap(withTrainingView(route, next));
	}

	function chronic(on: boolean) {
		swap(withTrainingView(route, "acute", on));
	}
</script>

<StatPageShell
	{route}
	{today}
	label={view.label}
	steppers={view.steppers}
	canGoBack={view.canGoBack}
	canGoForward={view.canGoForward}
	{onBack}
	{swap}
	history={view.tab === "training"
		? { title: TRAINING_STATUS_INDEX.title, complete, walking: history[KIND], canSync, onSync: () => onSyncHistory(KIND) }
		: undefined}
>
	{#snippet top({ pane })}
		<div class="load-tabs" class:pane><StatTabs {route} {swap} height={pane ? TABS.pane : TABS.phone} /></div>
	{/snippet}
	{#snippet children({ pane })}
		{#if view.tab === "focus"}
			<LoadFocus {view} {pane} />
		{:else if view.tab === "exercise"}
			<ExerciseLoad {view} {pane} open={(next) => go(next)} />
		{:else}
			<TrainingLoad {view} {pane} onsegment={segment} onchronic={chronic} />
		{/if}
	{/snippet}
</StatPageShell>

<style>
	/* Under the bar the tabs have no rule of their own on top (603:13); in a pane's header row neither, its 402 pt at the left (609:1491). */
	.load-tabs :global(.stat-tabs) {
		border-top: none;
	}
	.load-tabs.pane {
		width: 402px;
		height: 100%;
	}
	.load-tabs.pane :global(.stat-tabs) {
		border-bottom: none;
		background: none;
	}
</style>
