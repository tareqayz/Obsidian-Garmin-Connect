<script lang="ts">
	import type { Units } from "../../../../dashboard/activities";
	import {
		applyDraft,
		draftOf,
		filterTree,
		footerOf,
		rangeScales,
		setDates,
		setFlag,
		setRange,
		toggleEvent,
		toggleType,
		yearOptions,
		type AllDraft,
		type RangeScale,
	} from "../../../../dashboard/all-activities";
	import type { AllRoute } from "../../../../dashboard/routes";
	import type { ActivityRow } from "../../../../sync/activity-index";
	import { obsidianToggle } from "../../activity/map/toggle";
	import Accordion from "./Accordion.svelte";
	import DateRange from "./DateRange.svelte";
	import EventChips from "./EventChips.svelte";
	import MinMaxInputs from "./MinMaxInputs.svelte";
	import RangeSlider from "./RangeSlider.svelte";
	import TypeTree from "./TypeTree.svelte";

	/**
	 * The Filters sheet (filters/01–17): sections that open on their own —
	 * Activities, Date Range, Distance, Time, Total Ascent, Event Type — then
	 * the Favorite Activities and Personal Records switches, over a footer that
	 * stays put: Clear All, and "Show N Activities", counted as the choices
	 * change. The sheet edits a draft of the page's filters; Show swaps the
	 * page to it and closes, the modal's × closes and drops it. The search and
	 * the sort are the page's and stay as they are.
	 *
	 * Full height on a phone, as Garmin's is, and a fixed height in a pane, so
	 * the footer doesn't move as sections open and close.
	 */
	interface Props {
		rows: readonly ActivityRow[];
		route: AllRoute;
		units: Units;
		today: string;
		onApply: (route: AllRoute) => void;
		onClose: () => void;
	}

	let { rows, route, units, today, onApply, onClose }: Props = $props();

	// svelte-ignore state_referenced_locally
	let draft = $state.raw<AllDraft>(draftOf(route));
	let open = $state<Record<string, boolean>>({});

	let footer = $derived(footerOf(rows, route, draft));
	let tree = $derived(filterTree(rows));
	let years = $derived(yearOptions(rows, today));
	let scales = $derived(rangeScales(units));

	const toggle = (section: string) => () => (open[section] = !open[section]);
	const ends = (scale: RangeScale) => [draft[scale.keys[0]], draft[scale.keys[1]]] as const;
	const captions = (scale: RangeScale) => [`gch-filter-${scale.kind}-min`, `gch-filter-${scale.kind}-max`] as const;

	function apply() {
		onApply(applyDraft(route, draft));
		onClose();
	}

	/** Marks the modal the sheet is in, for its height. */
	function sheet(node: HTMLElement) {
		const modal = node.closest<HTMLElement>(".modal");
		modal?.classList.add("gch-filters-sheet");
		return { destroy: () => modal?.classList.remove("gch-filters-sheet") };
	}
</script>

<div class="filters" use:sheet>
	<Accordion title="Activities" open={open.types === true} onToggle={toggle("types")}>
		<TypeTree groups={tree} ticked={draft.types ?? []} onToggle={(group, id) => (draft = toggleType(draft, group, id))} />
	</Accordion>

	<Accordion title="Date Range" open={open.dates === true} onToggle={toggle("dates")}>
		<DateRange from={draft.from} to={draft.to} {today} {years} onChange={(from, to) => (draft = setDates(draft, from, to))} />
	</Accordion>

	{#each scales as scale (scale.kind)}
		{@const [min, max] = ends(scale)}
		<Accordion title={scale.title} open={open[scale.kind] === true} onToggle={toggle(scale.kind)}>
			{#if scale.step !== undefined}
				<RangeSlider {scale} {min} {max} labels={captions(scale)} onChange={(lo, hi) => (draft = setRange(draft, scale, lo, hi))} />
			{/if}
			<MinMaxInputs {scale} {min} {max} ids={captions(scale)} onChange={(lo, hi) => (draft = setRange(draft, scale, lo, hi))} />
		</Accordion>
	{/each}

	<Accordion title="Event Type" open={open.events === true} onToggle={toggle("events")}>
		<EventChips events={draft.events} onToggle={(key) => (draft = toggleEvent(draft, key))} />
	</Accordion>

	<div class="switches">
		<div class="switch-row">
			<span>Favorite Activities</span>
			<div use:obsidianToggle={{ value: draft.fav === true, onChange: (on) => (draft = setFlag(draft, "fav", on)) }}></div>
		</div>
		<div class="switch-row">
			<span>Personal Records</span>
			<div use:obsidianToggle={{ value: draft.pr === true, onChange: (on) => (draft = setFlag(draft, "pr", on)) }}></div>
		</div>
	</div>

	<div class="actions">
		<button class="clear" disabled={!footer.clear} onclick={() => (draft = {})}>Clear All</button>
		<button class="mod-cta" onclick={apply}>{footer.label}</button>
	</div>
</div>

<style>
	/* Sections 8 apart on the sheet's ground, as the phone's bands between them. */
	/* As tall as what it holds, and at least the sheet: never shrunk to it (a phone's modal
	   content is a flex box), or the footer would stick to a box shorter than the sections. */
	.filters {
		display: flex;
		flex-direction: column;
		flex: none;
		gap: 8px;
		box-sizing: border-box;
		min-height: 100%;
		padding-top: 8px;
		background: var(--background-secondary);
		color: var(--text-normal);
	}
	.switches {
		background: var(--background-primary);
	}
	.switch-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		height: 63px;
		padding: 0 16px;
		font-size: 17px;
		line-height: 22px;
	}
	/* The footer stays on the sheet's bottom edge, clear of a phone's home indicator. */
	.actions {
		position: sticky;
		bottom: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
		margin-top: auto;
		padding: 16px 16px calc(16px + var(--safe-area-inset-bottom, 0px));
		border-top: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
	}
	.actions button {
		width: 100%;
		min-width: 0;
		height: 50px;
		margin: 0;
		font-size: 15px;
		cursor: pointer;
	}

	:global(.modal.gch-sheet.gch-filters-sheet) {
		height: min(800px, 85vh);
	}
	:global(.is-phone .modal.gch-sheet.gch-filters-sheet) {
		height: calc(100% - var(--safe-area-inset-top) - 48px);
	}
</style>
