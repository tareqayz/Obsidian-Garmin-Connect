<script lang="ts">
	interface Props {
		ids: readonly string[];
		active: string;
		nameOf: (id: string) => string;
		editing: boolean;
		/** True once the pane is narrow enough that "Edit layout" folds into ⋯. */
		compact: boolean;
		onSelect: (id: string) => void;
		onNew: () => void;
		onEdit: () => void;
		onRename: () => void;
		onDuplicate: () => void;
		onReset: () => void;
		onDelete: () => void;
		/** The default is the one layout that cannot be deleted, only reset. */
		isDefault: boolean;
	}

	let {
		ids,
		active,
		nameOf,
		editing,
		compact,
		onSelect,
		onNew,
		onEdit,
		onRename,
		onDuplicate,
		onReset,
		onDelete,
		isDefault,
	}: Props = $props();

	let menu = $state(false);

	function pick(run: () => void) {
		menu = false;
		run();
	}
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && (menu = false)} />

<!-- Above the filter bar, because switching layout changes what the whole pane
     shows, while the filter only scopes it. The track scrolls once the pills
     overflow rather than wrapping: they are a sequence, not a set. -->
<div class="bar">
	<div class="track" role="tablist" aria-label="Dashboard layouts">
		{#each ids as id (id)}
			<button
				class="pill"
				class:selected={id === active}
				role="tab"
				aria-selected={id === active}
				onclick={() => onSelect(id)}>{nameOf(id)}</button
			>
		{/each}
		<button class="pill add" aria-label="New layout" title="New layout" onclick={onNew}>+</button>
	</div>

	<div class="actions">
		{#if !editing && !compact}
			<button class="chip" onclick={onEdit}>Edit layout</button>
		{/if}
		<div class="menu-host">
			<button
				class="icon"
				class:on={menu}
				aria-label="Layout options"
				aria-expanded={menu}
				title="Layout options"
				onclick={() => (menu = !menu)}>⋯</button
			>
			{#if menu}
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<div class="scrim" onclick={() => (menu = false)}></div>
				<div class="menu" role="menu">
					{#if compact && !editing}
						<button role="menuitem" onclick={() => pick(onEdit)}>Edit layout</button>
					{/if}
					<button role="menuitem" onclick={() => pick(onRename)}>Rename…</button>
					<button role="menuitem" onclick={() => pick(onDuplicate)}>Duplicate</button>
					{#if isDefault}
						<button role="menuitem" onclick={() => pick(onReset)}>Reset to the shipped layout</button
						>
					{:else}
						<button class="danger" role="menuitem" onclick={() => pick(onDelete)}>Delete layout</button
						>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
	}
	.track {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 3px;
		border-radius: 999px;
		background: var(--gcd-raised);
		/* Scroll rather than wrap: a layout bar that grows to two rows pushes the
		   dashboard down every time someone adds a layout. */
		overflow-x: auto;
		scrollbar-width: none;
		min-width: 0;
	}
	.track::-webkit-scrollbar {
		display: none;
	}
	.pill {
		flex: none;
		padding: 6px 14px;
		border: none;
		border-radius: 999px;
		background: transparent;
		box-shadow: none;
		color: var(--v2-muted);
		font-size: 12px;
		font-weight: 500;
		line-height: 1.25;
		white-space: nowrap;
		cursor: pointer;
		height: auto;
	}
	.pill:hover:not(.selected) {
		color: var(--gcd-text);
	}
	.pill.selected {
		background: var(--v2-surface-card);
		color: var(--gcd-text);
		box-shadow: var(--v2-shadow-1);
	}
	.pill.add {
		font-size: 15px;
		padding: 4px 12px;
	}
	.actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 6px;
		flex: none;
	}
	.chip {
		padding: 5px 12px;
		border: 1px solid var(--gcd-border);
		border-radius: 999px;
		background: transparent;
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
	.icon {
		width: 26px;
		height: 26px;
		padding: 0;
		border-radius: 50%;
		border: 1px solid var(--gcd-border);
		background: transparent;
		color: var(--gcd-muted);
		font-size: 13px;
		line-height: 1;
		cursor: pointer;
		box-shadow: none;
	}
	.icon:hover,
	.icon.on {
		background: var(--gcd-raised);
		color: var(--gcd-text);
	}
	.menu-host {
		position: relative;
	}
	/* Catches the click that dismisses the menu without stealing it from the
	   rest of the app the way a full-screen overlay would look like it does. */
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 40;
	}
	.menu {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 41;
		min-width: 232px;
		padding: 6px;
		border-radius: 8px;
		background: var(--v2-surface-card);
		box-shadow: var(--v2-shadow-1), 0 8px 24px rgba(0, 0, 0, 0.14);
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.menu button {
		text-align: left;
		padding: 8px 10px;
		border: none;
		border-radius: 6px;
		background: transparent;
		box-shadow: none;
		color: var(--gcd-text);
		font-size: 13px;
		line-height: 1.3;
		height: auto;
		cursor: pointer;
		white-space: nowrap;
	}
	.menu button:hover {
		background: var(--gcd-raised);
	}
	.menu button.danger {
		color: var(--v2-negative);
	}
</style>
