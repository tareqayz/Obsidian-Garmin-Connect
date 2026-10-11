<script lang="ts">
	import { flushSync, onDestroy } from "svelte";
	import { flip } from "svelte/animate";
	import {
		HOME_GLANCE,
		MAX_GLANCE,
		addStat,
		moveStat,
		removeStat,
		sameList,
		statFor,
		type GlanceId,
	} from "../../../dashboard/glance";
	import type { HomeModel } from "../../../dashboard/home";
	import Glance from "./Glance.svelte";
	import HomeCard from "./HomeCard.svelte";
	import PageBar from "./PageBar.svelte";
	import { lucide } from "./lucide";

	/**
	 * At a Glance's See All page, and the edit mode behind its Edit button.
	 *
	 * Editing works on a draft: Cancel throws it away, Save hands it back. Cards
	 * are removed with their badge, moved by dragging (anywhere on the card with
	 * a mouse, by the grip badge on a touch screen, or with the arrow keys on the
	 * grip) and added through Add a Stat. The first eight are the ones Home
	 * shows, which is what the two group labels say.
	 */
	interface Props {
		model: HomeModel;
		list: GlanceId[];
		onBack: () => void;
		onSave: (list: GlanceId[]) => void;
		/** Opens Add a Stat and resolves with the pick, or null. */
		onPick: (current: GlanceId[]) => Promise<GlanceId | null>;
	}

	let { model, list, onBack, onSave, onPick }: Props = $props();

	let editing = $state(false);
	let draft = $state<GlanceId[]>([]);
	let dragging = $state<GlanceId | null>(null);
	let announce = $state("");

	let shown = $derived(editing ? draft : list);
	let changed = $derived(editing && !sameList(draft, list));
	let full = $derived(draft.length >= MAX_GLANCE);

	/* One keyed list, labels included, so a card keeps its element, which a
	   drag holds on to, when the drag carries it across the eight-card line. */
	type Item = { key: string; label: string } | { key: GlanceId; id: GlanceId };
	let items = $derived.by((): Item[] => {
		const cards: Item[] = shown.map((id) => ({ key: id, id }));
		if (!editing) return cards;
		const out: Item[] = [{ key: "label-home", label: "On Home" }, ...cards.slice(0, HOME_GLANCE)];
		if (cards.length > HOME_GLANCE) out.push({ key: "label-rest", label: "See All only" }, ...cards.slice(HOME_GLANCE));
		return out;
	});

	function edit() {
		draft = [...list];
		editing = true;
	}

	function cancel() {
		endDrag?.();
		editing = false;
	}

	function save() {
		if (!changed) return;
		endDrag?.();
		onSave([...draft]);
		editing = false;
	}

	function remove(id: GlanceId) {
		draft = removeStat(draft, id);
		announce = `Removed ${statFor(id).title}.`;
	}

	async function add() {
		if (full) return;
		const id = await onPick([...draft]);
		if (!id || !editing) return;
		draft = addStat(draft, id);
		announce = `Added ${statFor(id).title}.`;
	}

	function move(id: GlanceId, to: number) {
		const next = moveStat(draft, id, to);
		if (sameList(next, draft)) return;
		draft = next;
		announce = `${statFor(id).title} moved to position ${next.indexOf(id) + 1} of ${next.length}.`;
	}

	function onKey(e: KeyboardEvent, id: GlanceId) {
		const at = draft.indexOf(id);
		if (e.key === "ArrowLeft" || e.key === "ArrowUp") move(id, at - 1);
		else if (e.key === "ArrowRight" || e.key === "ArrowDown") move(id, at + 1);
		else return;
		e.preventDefault();
	}

	/* Dragging. The card is lifted out of its cell and follows the pointer,
	   held by the point it was picked up at, while the cell stays behind,
	   dashed, as the place it will land. The card under the pointer is found by
	   hit-testing, and the dragged card takes its place as soon as the pointer
	   is over it, so the cells always show the order that would be saved; the
	   cards it displaces slide out of the way. */
	let grid = $state<HTMLElement | null>(null);
	/** Puts the card in hand straight down in its cell, if one is held or settling. */
	let endDrag: (() => void) | null = null;

	onDestroy(() => endDrag?.());

	const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	/** How long a cell takes to slide to its new place: only while another card is dragged. */
	function slide(key: string): number {
		return dragging && key !== dragging && !calm() ? 200 : 0;
	}

	function startDrag(e: PointerEvent, id: GlanceId, grip: boolean) {
		if (!editing || e.button !== 0) return;
		// A touch that does not start on the grip is a scroll, not a drag.
		if (!grip && e.pointerType !== "mouse") return;
		if ((e.target as HTMLElement).closest(".remove")) return;
		const handle = e.currentTarget as HTMLElement;
		const slot = handle.closest<HTMLElement>(".slot");
		const lift = slot?.querySelector<HTMLElement>(".lift");
		if (!slot || !lift) return;
		e.preventDefault();
		// One card at a time: one still settling, or held by another finger, is put down first.
		endDrag?.();
		handle.setPointerCapture(e.pointerId);
		// A cell still sliding out of the last drag's way gets there now.
		slot.parentElement?.getAnimations().forEach((a) => a.finish());
		dragging = id;

		const box = slot.getBoundingClientRect();
		const grab = { x: e.clientX - box.left, y: e.clientY - box.top };
		lift.style.transformOrigin = `${grab.x}px ${grab.y}px`;
		let x = e.clientX;
		let y = e.clientY;
		let frame = 0;

		const over = () => {
			// What is under the pointer, beneath the card being carried.
			const under = document.elementsFromPoint(x, y).find((el) => !lift.contains(el));
			const cell = under?.closest<HTMLElement>("[data-slot]");
			const target = cell?.dataset.slot as GlanceId | undefined;
			// A card still sliding out of the way is passed over, or the two would trade places back and forth.
			if (!cell || !target || target === id || !draft.includes(target) || cell.getAnimations().length) return;
			move(id, draft.indexOf(target));
		};
		const onMove = (ev: PointerEvent) => {
			if (ev.pointerId !== e.pointerId) return;
			x = ev.clientX;
			y = ev.clientY;
			over();
		};
		// Every frame: keep scrolling while the pointer rests near the pane's top
		// or bottom edge, and put the card back under the pointer, wherever its
		// cell has moved to.
		const scroller = grid?.closest<HTMLElement>(".view-content") ?? null;
		const follow = () => {
			if (scroller) {
				const r = scroller.getBoundingClientRect();
				const step = y < r.top + 56 ? -14 : y > r.bottom - 56 ? 14 : 0;
				const top = scroller.scrollTop;
				if (step) scroller.scrollTop += step;
				if (scroller.scrollTop !== top) {
					over();
					flushSync();
				}
			}
			const at = slot.getBoundingClientRect();
			lift.style.translate = `${x - grab.x - at.left}px ${y - grab.y - at.top}px`;
			frame = requestAnimationFrame(follow);
		};
		// Dropped: the card settles into its cell rather than jumping there.
		const drop = (ev: PointerEvent) => {
			if (ev.pointerId !== e.pointerId) return;
			detach();
			const { translate, scale } = getComputedStyle(lift);
			lift.style.translate = "";
			if (calm()) return end();
			lift
				.animate([{ translate, scale }, { translate: "0px 0px", scale: "1" }], { duration: 160, easing: "ease-out" })
				.finished.then(end, end);
		};
		const detach = () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", drop);
			window.removeEventListener("pointercancel", drop);
		};
		let ended = false;
		const end = () => {
			if (ended) return;
			ended = true;
			detach();
			lift.getAnimations().forEach((a) => a.cancel());
			lift.style.translate = lift.style.transformOrigin = "";
			if (dragging === id) dragging = null;
			if (endDrag === end) endDrag = null;
		};
		endDrag = end;
		// On the window: the handle loses its pointer capture when its cell moves.
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", drop);
		window.addEventListener("pointercancel", drop);
		frame = requestAnimationFrame(follow);
	}
</script>

{#if editing}
	<PageBar title="Edit At a Glance">
		{#snippet left()}<button class="link" onclick={cancel}>Cancel</button>{/snippet}
		{#snippet right()}<button class="link" disabled={!changed} onclick={save}>Save</button>{/snippet}
	</PageBar>
{:else}
	<PageBar title="At a Glance" {onBack} backLabel="Back to Home">
		{#snippet right()}<button class="link" onclick={edit}>Edit</button>{/snippet}
	</PageBar>
{/if}

<div class="content">
	{#if editing}
		<p class="helper">Select up to {MAX_GLANCE} stats for the At a Glance section. The first {HOME_GLANCE} also appear on Home.</p>
	{/if}

	<div class="glance" class:editing bind:this={grid}>
		{#each items as item (item.key)}
			<!-- Every item is one cell, the single element animate: needs. -->
			<div class="cell" class:wide={"label" in item} data-slot={"id" in item ? item.id : undefined} animate:flip={{ duration: slide(item.key) }}>
				{#if "label" in item}
					<div class="group">{item.label}</div>
				{:else}
					<!-- Dragging the card itself is a mouse convenience; the grip is the
					     control, for touch and keyboard alike, and carries the label.
					     No aria-label here: Obsidian turns every one into a hover tooltip. -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="slot" class:dragging={dragging === item.id} onpointerdown={(e) => startDrag(e, item.id, false)}>
						<!-- What leaves the cell and follows the pointer during a drag. -->
						<div class="lift">
							<div class="face"><Glance id={item.id} {model} /></div>
							{#if editing}
								<button class="remove" aria-label="Remove {statFor(item.id).title}" onclick={() => remove(item.id)}>
									<span use:lucide={"minus"}></span>
								</button>
								<button
									class="grip"
									aria-label="Move {statFor(item.id).title}. Use the arrow keys, or drag."
									onpointerdown={(e) => {
										e.stopPropagation();
										startDrag(e, item.id, true);
									}}
									onkeydown={(e) => onKey(e, item.id)}
								>
									<span use:lucide={"grip-vertical"}></span>
								</button>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/each}

		{#if editing}
			<button class="add-tile" class:full disabled={full} onclick={add}>
				<span class="add-icon" use:lucide={"circle-plus"}></span>
				<span class="add-label">Add a Stat</span>
				<span class="add-count">{full ? `${MAX_GLANCE} of ${MAX_GLANCE} · Remove one to add another` : `${draft.length} of ${MAX_GLANCE}`}</span>
			</button>
		{:else if !shown.length}
			<div class="nothing">
				<HomeCard><div class="quiet">No stats here yet. Choose Edit to add some.</div></HomeCard>
			</div>
		{/if}
	</div>
	<div class="sr-only" aria-live="polite">{announce}</div>
</div>

<style>
	.link {
		color: var(--text-accent);
		font-size: 15px;
		background: none;
		box-shadow: none;
		border: none;
		padding: 0 4px;
		height: auto;
		cursor: pointer;
	}
	.link:disabled {
		color: var(--text-faint);
		cursor: default;
	}
	.content {
		padding: 16px 16px 32px;
		max-width: 1126px;
		margin: 0 auto;
		box-sizing: content-box;
	}
	.helper {
		color: var(--text-muted);
		font-size: 14px;
		line-height: 20px;
		margin: 0 0 16px;
	}
	.glance {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--gch-gap);
	}
	.cell {
		display: flex;
		min-width: 0;
	}
	.cell.wide {
		grid-column: 1 / -1;
	}
	.group {
		flex: 1;
		color: var(--text-muted);
		font-size: 12px;
		line-height: 16px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		margin-top: 8px;
	}
	.cell:first-child .group {
		margin-top: 0;
	}
	.slot,
	.lift {
		position: relative;
		display: flex;
		flex: 1;
		min-width: 0;
	}
	/* Not ".card": Obsidian styles that class globally. */
	.face {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}
	.face > :global(*) {
		flex: 1;
	}
	/* While editing, the card is something to arrange, not to use. */
	.editing .face {
		pointer-events: none;
		user-select: none;
	}
	.editing .slot {
		cursor: grab;
	}
	.slot.dragging,
	.slot.dragging .grip {
		cursor: grabbing;
	}
	/* Where the dragged card will land: its own cell, dashed. */
	.slot.dragging::before {
		content: "";
		position: absolute;
		inset: 0;
		border: 1.5px dashed var(--interactive-accent);
		border-radius: 6px;
	}
	/* The card in hand, above the others. The script moves it with `translate`,
	   which applies after this `scale`, so the point it was picked up at stays
	   under the pointer. */
	.slot.dragging .lift {
		z-index: 10;
		scale: 1.03;
		transition: scale 120ms ease-out;
	}
	.slot.dragging .face {
		border-radius: 6px;
		box-shadow: var(--shadow-l);
	}
	.slot.dragging .remove {
		visibility: hidden;
	}
	@media (prefers-reduced-motion: reduce) {
		.slot.dragging .lift {
			transition: none;
		}
	}
	.remove,
	.grip {
		position: absolute;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border-radius: 50%;
		box-shadow: none;
		cursor: pointer;
	}
	.remove {
		top: -7px;
		left: -7px;
		background: var(--color-red);
		color: var(--text-on-accent);
		border: 2px solid var(--background-primary);
	}
	.grip {
		right: -7px;
		bottom: -7px;
		background: var(--interactive-normal);
		color: var(--text-muted);
		border: 1px solid var(--background-modifier-border);
		/* A touch on the grip is always a drag, never a scroll. */
		touch-action: none;
		cursor: grab;
	}
	.remove :global(svg),
	.grip :global(svg) {
		width: 12px;
		height: 12px;
	}
	.add-tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		min-height: 281px;
		height: auto;
		padding: 16px;
		border: 1.5px dashed var(--background-modifier-border);
		border-radius: 6px;
		background: none;
		box-shadow: none;
		color: var(--text-accent);
		white-space: normal;
		cursor: pointer;
	}
	.add-tile:hover:not(:disabled) {
		background: var(--background-modifier-hover);
	}
	.add-tile.full {
		color: var(--text-faint);
		cursor: default;
	}
	.add-icon :global(svg) {
		width: 28px;
		height: 28px;
	}
	.add-label {
		font-size: 15px;
		line-height: 20px;
		margin-top: 8px;
	}
	.add-count {
		color: var(--text-faint);
		font-size: 12px;
		line-height: 16px;
		text-align: center;
	}
	.nothing {
		grid-column: 1 / -1;
	}
	.quiet {
		color: var(--text-faint);
		font-size: 13px;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@container (min-width: 640px) {
		.content {
			--gch-gap: 16px;
			padding: 16px 32px 32px;
		}
		.glance {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
	@container (min-width: 1000px) {
		.glance {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
	}
</style>
