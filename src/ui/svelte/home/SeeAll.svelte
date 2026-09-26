<script lang="ts">
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

	/* One keyed list, labels included, so a card keeps its element (and the
	   pointer it captured) when a drag carries it across the eight-card line. */
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
		editing = false;
		dragging = null;
	}

	function save() {
		if (!changed) return;
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

	/* Dragging. The card under the pointer is found by hit-testing, and the
	   dragged card takes its place as soon as the pointer is over it, so what
	   is on screen is always the order that would be saved. */
	let grid = $state<HTMLElement | null>(null);
	let scrollTimer = 0;

	function startDrag(e: PointerEvent, id: GlanceId, grip: boolean) {
		if (!editing || e.button !== 0) return;
		// A touch that does not start on the grip is a scroll, not a drag.
		if (!grip && e.pointerType !== "mouse") return;
		if ((e.target as HTMLElement).closest(".remove")) return;
		e.preventDefault();
		const handle = e.currentTarget as HTMLElement;
		handle.setPointerCapture(e.pointerId);
		dragging = id;
		let lastY = e.clientY;

		const over = (x: number, y: number) => {
			const slot = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-slot]");
			const target = slot?.dataset.slot as GlanceId | undefined;
			if (target && target !== id && draft.includes(target)) move(id, draft.indexOf(target));
		};
		const onMove = (ev: PointerEvent) => {
			lastY = ev.clientY;
			over(ev.clientX, ev.clientY);
		};
		// Near the pane's top or bottom edge, keep scrolling while the pointer rests.
		const scroller = grid?.closest<HTMLElement>(".view-content") ?? null;
		const tick = () => {
			if (scroller) {
				const r = scroller.getBoundingClientRect();
				const step = lastY < r.top + 56 ? -14 : lastY > r.bottom - 56 ? 14 : 0;
				if (step) scroller.scrollTop += step;
			}
			scrollTimer = requestAnimationFrame(tick);
		};
		scrollTimer = requestAnimationFrame(tick);
		const end = () => {
			cancelAnimationFrame(scrollTimer);
			dragging = null;
			handle.removeEventListener("pointermove", onMove);
			handle.removeEventListener("pointerup", end);
			handle.removeEventListener("pointercancel", end);
		};
		handle.addEventListener("pointermove", onMove);
		handle.addEventListener("pointerup", end);
		handle.addEventListener("pointercancel", end);
	}
</script>

<header class="page-bar">
	{#if editing}
		<button class="link" onclick={cancel}>Cancel</button>
		<strong>Edit At a Glance</strong>
		<button class="link" disabled={!changed} onclick={save}>Save</button>
	{:else}
		<button class="clickable-icon back" aria-label="Back to Home" onclick={onBack}><span use:lucide={"chevron-left"}></span></button>
		<strong>At a Glance</strong>
		<button class="link" onclick={edit}>Edit</button>
	{/if}
</header>

<div class="content">
	{#if editing}
		<p class="helper">Select up to {MAX_GLANCE} stats for the At a Glance section. The first {HOME_GLANCE} also appear on Home.</p>
	{/if}

	<div class="glance" class:editing bind:this={grid}>
		{#each items as item (item.key)}
			{#if "label" in item}
				<div class="group">{item.label}</div>
			{:else}
				<!-- Dragging the card itself is a mouse convenience; the grip is the
				     control, for touch and keyboard alike, and carries the label.
				     No aria-label here: Obsidian turns every one into a hover tooltip. -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="slot" class:dragging={dragging === item.id} data-slot={item.id} onpointerdown={(e) => startDrag(e, item.id, false)}>
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
			{/if}
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
	.page-bar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 12px;
		min-height: 44px;
		padding: 0 16px 0 12px;
		border-bottom: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
	}
	.page-bar strong {
		font-size: 15px;
		font-weight: 600;
		text-align: center;
		white-space: nowrap;
	}
	.page-bar > :first-child {
		justify-self: start;
	}
	.page-bar > :last-child {
		justify-self: end;
	}
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
	.back {
		color: var(--text-muted);
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
	.group {
		grid-column: 1 / -1;
		color: var(--text-muted);
		font-size: 12px;
		line-height: 16px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		margin-top: 8px;
	}
	.group:first-child {
		margin-top: 0;
	}
	.slot {
		position: relative;
		display: flex;
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
	.slot.dragging {
		opacity: 0.55;
		cursor: grabbing;
	}
	.slot.dragging .face {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		border-radius: 6px;
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
		.page-bar {
			padding: 0 24px 0 20px;
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
