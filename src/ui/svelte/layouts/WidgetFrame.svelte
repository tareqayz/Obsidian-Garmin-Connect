<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		title: string;
		/** Current size, e.g. "½ · M". Empty for blocks that have no size. */
		badge?: string;
		/** True while this block is the one being dragged. */
		lifted: boolean;
		/** Pointer resizing is a pointer-only affordance; touch uses the panel. */
		canResize: boolean;
		/** Set when the widget has no data in this range. */
		empty?: boolean;
		onGrab: (event: PointerEvent) => void;
		onResize: (event: PointerEvent) => void;
		onSettings: () => void;
		onRemove: () => void;
		children: Snippet;
	}

	let {
		title,
		badge = "",
		lifted,
		canResize,
		empty = false,
		onGrab,
		onResize,
		onSettings,
		onRemove,
		children,
	}: Props = $props();
</script>

<!-- Edit mode replaces the card's own header rather than stacking a second one
     on top of it, so a widget is the same height whether or not it is being
     arranged and nothing below it jumps when edit mode opens. -->
<section class="widget" class:lifted class:empty>
	<header>
		<!-- The grip is the only place a drag can start. On a touchscreen a drag
		     that could begin anywhere on the card would fire every time someone
		     tried to scroll past it. -->
		<button
			class="grip"
			aria-label="Move {title}"
			title="Drag to move"
			onpointerdown={onGrab}
		>
			<span class="dots" aria-hidden="true">
				{#each Array(6) as _, i (i)}<i></i>{/each}
			</span>
		</button>

		<div class="title">{title}</div>

		{#if badge}<span class="badge">{badge}</span>{/if}

		<button class="icon" aria-label="Settings for {title}" title="Settings" onclick={onSettings}
			>⋯</button
		>
		<button class="icon" aria-label="Remove {title}" title="Remove" onclick={onRemove}>✕</button>
	</header>

	<div class="body">
		{#if empty}
			<p class="nothing">Nothing synced for this range yet.</p>
		{:else}
			{@render children()}
		{/if}
	</div>

	{#if canResize}
		<button
			class="resize"
			aria-label="Resize {title}"
			title="Drag to resize"
			onpointerdown={onResize}
		>
			<span aria-hidden="true"></span>
		</button>
	{/if}
</section>

<style>
	.widget {
		position: relative;
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding: 10px 14px 12px;
		border-radius: 8px;
		border: 1px dashed var(--v2-accent);
		background: var(--gcd-surface);
		/* The grid stretches items, so a short chart beside a tall one leaves the
		   same trailing space it does in read mode. */
		height: 100%;
	}
	.widget.empty {
		border-style: dashed;
		border-color: var(--gcd-border);
	}
	.widget.lifted {
		border-style: solid;
		border-width: 1.5px;
		box-shadow: var(--v2-shadow-1), 0 10px 28px rgba(0, 0, 0, 0.18);
		transform: scale(1.01);
		/* Nothing should interrupt the drag, least of all a tooltip from the
		   chart underneath the pointer. */
		pointer-events: none;
		z-index: 5;
	}
	header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
		min-width: 0;
	}
	.title {
		flex: 1;
		min-width: 0;
		font-weight: 600;
		font-size: var(--font-ui-small, 13px);
		color: var(--gcd-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.widget.lifted .title {
		color: var(--v2-accent);
	}
	.badge {
		flex: none;
		padding: 2px 6px;
		border-radius: 3px;
		background: var(--gcd-raised);
		color: var(--v2-muted);
		font-size: 11px;
		line-height: 1.2;
		font-variant-numeric: tabular-nums;
	}
	.widget.lifted .badge {
		background: var(--v2-accent-tint);
		color: var(--v2-accent);
	}
	.grip {
		flex: none;
		display: grid;
		place-items: center;
		width: 22px;
		height: 26px;
		padding: 0;
		border: none;
		background: transparent;
		box-shadow: none;
		color: var(--gcd-muted);
		cursor: grab;
		touch-action: none;
	}
	.grip:active {
		cursor: grabbing;
	}
	.dots {
		display: grid;
		grid-template-columns: repeat(2, 2.5px);
		gap: 3px;
	}
	.dots i {
		width: 2.5px;
		height: 2.5px;
		border-radius: 50%;
		background: currentColor;
	}
	.icon {
		flex: none;
		width: 22px;
		height: 22px;
		padding: 0;
		border-radius: 50%;
		border: 1px solid var(--gcd-border);
		background: transparent;
		color: var(--gcd-muted);
		font-size: 11px;
		line-height: 1;
		cursor: pointer;
		box-shadow: none;
	}
	.icon:hover {
		background: var(--gcd-raised);
		color: var(--gcd-text);
	}
	.body {
		position: relative;
		flex: 1;
		min-width: 0;
	}
	.nothing {
		margin: 0;
		padding: 18px 0;
		text-align: center;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
	}
	.resize {
		position: absolute;
		right: 2px;
		bottom: 2px;
		width: 18px;
		height: 18px;
		padding: 0;
		border: none;
		background: transparent;
		box-shadow: none;
		cursor: nwse-resize;
		touch-action: none;
	}
	.resize span {
		display: block;
		width: 8px;
		height: 8px;
		margin: 4px 0 0 4px;
		border-right: 1.5px solid var(--gcd-muted);
		border-bottom: 1.5px solid var(--gcd-muted);
	}
	.resize:hover span {
		border-color: var(--v2-accent);
	}
</style>
