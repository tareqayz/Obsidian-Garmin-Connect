<script lang="ts">
	interface Props {
		name: string;
		/** Set while a widget is being dragged, so the strip narrates the gesture. */
		moving: string | null;
		/** True on a narrow pane, where the actions live in the bottom bar instead. */
		compact: boolean;
		/** Only the shipped default has something to reset to. */
		canReset: boolean;
		onAdd: () => void;
		onReset: () => void;
		onDone: () => void;
	}

	let { name, moving, compact, canReset, onAdd, onReset, onDone }: Props = $props();

	let title = $derived(moving ? `Moving “${moving}”` : `Editing “${name}”`);
	let hint = $derived(
		moving
			? compact
				? "Lift to the edge of the pane to scroll · release to drop"
				: "Release to drop it in the highlighted slot · Esc cancels"
			: compact
				? "Hold the grip to move a widget · tap ⋯ to resize it"
				: "Drag a card to move it · drag its corner to resize",
	);
</script>

<!-- Tinted rather than outlined. Edit mode changes what a drag does, so it
     should never be something you have to look for evidence of. -->
<div class="toolbar" class:compact aria-live="polite">
	<div class="copy">
		<div class="title">{title}</div>
		<div class="hint">{hint}</div>
	</div>

	<div class="actions">
		<button class="chip" onclick={onAdd}>+ Add widget</button>
		{#if canReset}
			<button class="chip" onclick={onReset}>Reset</button>
		{/if}
		<button class="chip primary" onclick={onDone}>Done</button>
	</div>
</div>

<style>
	.toolbar {
		/* Stuck to the top rather than floating at the foot of the pane: on
		   Obsidian mobile the thumb arc is already occupied by the app's own
		   floating toolbar, which would sit over a bottom bar and swallow
		   "Done". Sticky here keeps both actions reachable at any scroll
		   position without fighting the host chrome. */
		position: sticky;
		top: 0;
		z-index: 20;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		margin-bottom: 14px;
		border-radius: 8px;
		background: var(--v2-accent-tint);
	}
	.toolbar.compact {
		flex-wrap: wrap;
		gap: 8px;
	}
	.toolbar.compact .actions {
		margin-left: 0;
		width: 100%;
	}
	.toolbar.compact .chip {
		flex: 1;
		min-height: 34px;
	}
	.copy {
		min-width: 0;
	}
	.title {
		font-weight: 600;
		font-size: var(--font-ui-small, 13px);
		color: var(--gcd-text);
	}
	.hint {
		font-size: var(--font-ui-smaller, 12px);
		color: var(--v2-muted);
	}
	.actions {
		margin-left: auto;
		display: flex;
		gap: 6px;
		flex: none;
	}
	.chip {
		padding: 5px 12px;
		border: 1px solid var(--gcd-border);
		border-radius: 999px;
		background: var(--gcd-surface);
		color: var(--gcd-text);
		font-size: 12px;
		line-height: 1.25;
		height: auto;
		box-shadow: none;
		cursor: pointer;
		white-space: nowrap;
	}
	.chip:hover {
		background: var(--gcd-raised);
	}
	.chip.primary {
		border-color: var(--v2-accent);
		color: var(--v2-accent);
		font-weight: 600;
	}
</style>
