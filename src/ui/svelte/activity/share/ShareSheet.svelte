<script lang="ts" module>
	import { DEFAULT_RATIO, type ShareRatioId } from "../../../../dashboard/activity-share";

	/** The ratio picked last, while Obsidian stays open (Inferred: whether Garmin remembers it isn't known). */
	let lastRatio: ShareRatioId = DEFAULT_RATIO;
</script>

<script lang="ts">
	import type { Units } from "../../../../dashboard/activities";
	import { ratioOf, SHARE_RATIOS, shareFileName, shareView } from "../../../../dashboard/activity-share";
	import { shareScene, templatesFor, type ShareScene } from "../../../../dashboard/share-layout";
	import { toIsoDate } from "../../../../garmin/endpoints";
	import type { ActivityDetail } from "../../../../sync/activity-detail";
	import type { TileSource } from "../../../map/tile-source";
	import type { ShareActions } from "../../../share/actions";
	import { paintScene, renderScene } from "../../../share/draw";
	import { lucide } from "../../home/lucide";

	/**
	 * Garmin's Share Activity, as a sheet: "Choose an aspect ratio", then
	 * "CHOOSE AN IMAGE", a carousel of the templates drawn for this activity,
	 * with Share (where the device has a share sheet for files) and Save under
	 * it. Garmin's Copy is left out, as the plugin never touches the clipboard.
	 */
	interface Props {
		detail: ActivityDetail;
		units: Units;
		actions: ShareActions;
		/** The Map template's tiles, or null when map tiles are off. */
		tiles: TileSource | null;
		onClose: () => void;
	}

	let { detail, units, actions, tiles }: Props = $props();

	let view = $derived(shareView(detail, units, toIsoDate()));
	let templates = $derived(templatesFor(view));
	let step = $state<"ratio" | "image">("ratio");
	let ratio = $state<ShareRatioId>(lastRatio);
	let index = $state(0);
	let scenes = $derived(templates.map((t) => shareScene(view, t.id, ratio)));
	let size = $derived(ratioOf(ratio));
	// Asked once: a device's share sheet doesn't come or go while the sheet is open.
	// svelte-ignore state_referenced_locally
	const canShare = actions.canShare();

	/** The picked image drawn full size, ready before the tap: the share sheet opens only on a tap's own turn. */
	let image = $state<Blob | null>(null);
	let saving = $state(false);

	function pick(id: ShareRatioId) {
		ratio = id;
		lastRatio = id;
	}

	function next() {
		index = 0;
		step = "image";
	}

	$effect(() => {
		if (step !== "image") return;
		const scene = scenes[index];
		image = null;
		if (!scene) return;
		let stale = false;
		// A pause while the carousel is swiped past several images.
		const timer = window.setTimeout(() => {
			renderScene(scene, { tiles }).then(
				(blob) => {
					if (!stale) image = blob;
				},
				() => undefined,
			);
		}, 120);
		return () => {
			stale = true;
			window.clearTimeout(timer);
		};
	});

	/* The carousel and its dots, as Home's In Focus carousel. */
	let carousel = $state<HTMLElement | null>(null);
	function onScroll() {
		if (!carousel) return;
		const first = carousel.firstElementChild as HTMLElement | null;
		const stepWidth = (first?.offsetWidth ?? carousel.clientWidth) + 16;
		index = Math.max(0, Math.min(templates.length - 1, Math.round(carousel.scrollLeft / stepWidth)));
	}
	function goTo(i: number) {
		const el = carousel?.children[i] as HTMLElement | undefined;
		el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
	}
	function onKey(event: KeyboardEvent) {
		if (event.key === "ArrowRight" && index < templates.length - 1) goTo(index + 1);
		else if (event.key === "ArrowLeft" && index > 0) goTo(index - 1);
		else return;
		event.preventDefault();
	}

	/** Draws a preview at the canvas's own width; a newer scene overtakes one still drawing. */
	function preview(node: HTMLCanvasElement, scene: ShareScene) {
		let drawn = 0;
		const paint = (next: ShareScene) => {
			const turn = ++drawn;
			const target = createEl("canvas");
			void paintScene(target, next, (node.clientWidth || 240) * (window.devicePixelRatio || 1), { tiles }).then(() => {
				if (turn !== drawn) return;
				node.width = target.width;
				node.height = target.height;
				node.getContext("2d")?.drawImage(target, 0, 0);
			});
		};
		paint(scene);
		return { update: paint };
	}

	function share() {
		if (image) actions.share(image, shareFileName(view));
	}

	async function save() {
		if (!image || saving) return;
		saving = true;
		await actions.save(image, shareFileName(view));
		saving = false;
	}

	/** Marks the modal the sheet is in, for its size. */
	function sheet(node: HTMLElement) {
		const modal = node.closest<HTMLElement>(".modal");
		modal?.classList.add("gch-share-sheet");
		return { destroy: () => modal?.classList.remove("gch-share-sheet") };
	}
</script>

<div class="share" use:sheet>
	{#if step === "ratio"}
		<div class="intro">
			<h3 class="heading">Choose an aspect ratio</h3>
			<p class="text">We’ll scale the image for your shared activity based on this selection.</p>
		</div>
		<div class="ratios" role="radiogroup" aria-label="Aspect ratio">
			{#each SHARE_RATIOS as r (r.id)}
				<button class="ratio" role="radio" aria-checked={ratio === r.id} onclick={() => pick(r.id)}>
					<span class="shape-box"><span class="shape" style:aspect-ratio="{r.width} / {r.height}"></span></span>
					<span class="ratio-label">{r.label}</span>
					{#if ratio === r.id}<span class="tick" use:lucide={"check"}></span>{/if}
				</button>
			{/each}
		</div>
		<div class="buttons">
			<button class="mod-cta" onclick={next}>Next</button>
		</div>
	{:else}
		<div class="bar">
			<button class="clickable-icon back" aria-label="Choose an aspect ratio" onclick={() => (step = "ratio")}>
				<span use:lucide={"chevron-left"}></span>
			</button>
			<span class="caption" id="gch-share-images">Choose an image</span>
		</div>
		<div
			class="carousel"
			bind:this={carousel}
			onscroll={onScroll}
			onkeydown={onKey}
			tabindex="0"
			role="listbox"
			aria-labelledby="gch-share-images"
			style:--share-ratio="{size.width} / {size.height}"
			style:--share-r={size.width / size.height}
		>
			{#each templates as template, i (template.id)}
				<div class="slide" role="option" aria-selected={i === index}>
					<button class="frame" class:checker={scenes[i]?.transparent} class:selected={i === index} onclick={() => goTo(i)}>
						<span class="gc-hidden">Image {i + 1}</span>
						{#if scenes[i]}<canvas class="image" use:preview={scenes[i]}></canvas>{/if}
						{#if template.chip}<span class="chip">{template.chip}</span>{/if}
					</button>
				</div>
			{/each}
		</div>
		{#if templates.length > 1}
			<div class="dots">
				{#each templates as template, i (template.id)}
					<button class:active={i === index} aria-label="Image {i + 1}" onclick={() => goTo(i)}></button>
				{/each}
			</div>
		{/if}
		<div class="buttons">
			{#if canShare}
				<button class="mod-cta" disabled={!image} onclick={share}><span class="button-icon" use:lucide={"share"}></span>Share</button>
			{/if}
			<button disabled={!image || saving} onclick={save}><span class="button-icon" use:lucide={"download"}></span>Save</button>
		</div>
	{/if}
</div>

<style>
	.share {
		container-type: inline-size;
		display: flex;
		flex-direction: column;
		padding-bottom: calc(16px + var(--safe-area-inset-bottom, 0px));
	}
	.intro {
		padding: 8px 16px 20px;
	}
	.heading {
		margin: 0 0 12px;
		font-size: 24px;
		line-height: 1.2;
		font-weight: 600;
	}
	.text {
		margin: 0;
		color: var(--text-muted);
		font-size: 15px;
		line-height: 1.35;
	}
	.ratios {
		display: flex;
		flex-direction: column;
		background-color: var(--background-secondary);
	}
	.ratio {
		display: flex;
		align-items: center;
		gap: 18px;
		width: 100%;
		height: 56px;
		margin: 0;
		padding: 0 20px;
		border-radius: 0;
		background: none;
		box-shadow: none;
		font-size: 16px;
		cursor: pointer;
	}
	.ratio[aria-checked="true"] {
		background-color: var(--background-modifier-hover);
	}
	/* The shapes in one column, so the labels line up. */
	.shape-box {
		flex: none;
		display: flex;
		justify-content: center;
		width: 24px;
	}
	.shape {
		flex: none;
		box-sizing: border-box;
		height: 22px;
		border: 2px solid var(--text-normal);
		border-radius: 2px;
	}
	.ratio-label {
		flex: 1;
		text-align: start;
	}
	.tick {
		display: flex;
		color: var(--interactive-accent);
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 12px 8px;
	}
	.caption {
		color: var(--text-muted);
		font-size: 14px;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}
	.carousel {
		/* As large as fits: 72% of the sheet's width, or the height a short window leaves. */
		--share-slide: min(72cqw, calc(min(52vh, 560px) * var(--share-r)));
		display: flex;
		gap: 16px;
		padding: 16px calc((100cqw - var(--share-slide)) / 2);
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		background-color: var(--background-secondary);
		outline: none;
	}
	.carousel::-webkit-scrollbar {
		display: none;
	}
	.slide {
		flex: none;
		width: var(--share-slide);
		scroll-snap-align: center;
	}
	.frame {
		position: relative;
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: var(--share-ratio);
		margin: 0;
		padding: 0;
		border-radius: 0;
		background-color: var(--background-primary);
		box-shadow: none;
		overflow: hidden;
		cursor: pointer;
	}
	.frame.selected {
		box-shadow: 0 0 0 2px var(--text-normal);
	}
	/* A see-through image over Garmin's grey checkerboard. */
	.frame.checker {
		background-color: #8c8c8c;
		background-image: conic-gradient(#767676 25%, transparent 0 50%, #767676 0 75%, transparent 0);
		background-size: 28px 28px;
	}
	.image {
		display: block;
		width: 100%;
		height: 100%;
	}
	/* A preview's name, for screen readers only: an aria-label would show as Obsidian's tooltip. */
	.gc-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.chip {
		position: absolute;
		right: 6%;
		bottom: 3%;
		padding: 2px 8px;
		border-radius: 4px;
		background-color: rgba(0, 0, 0, 0.75);
		color: #ffffff;
		font-size: 12px;
		letter-spacing: 0.04em;
	}
	.dots {
		display: flex;
		justify-content: center;
		gap: 8px;
		padding: 14px 0 4px;
	}
	.dots button {
		width: 7px;
		height: 7px;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: var(--text-faint);
		box-shadow: none;
		cursor: pointer;
	}
	.dots button.active {
		background: var(--text-normal);
	}
	.buttons {
		display: flex;
		gap: 12px;
		padding: 16px 16px 0;
	}
	.buttons button {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		height: 44px;
		font-size: 16px;
	}
	.button-icon {
		display: flex;
	}

	:global(.modal.gch-sheet.gch-share-sheet) {
		width: 440px;
	}
	:global(.is-phone .modal.gch-sheet.gch-share-sheet) {
		width: 100%;
	}
</style>
