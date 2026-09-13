<script lang="ts">
	import { DropdownMenu } from "bits-ui";
	import type { Snippet } from "svelte";

	export type Entry =
		| { kind: "item"; label: string; onSelect: () => void; disabled?: boolean; danger?: boolean }
		| { kind: "check"; label: string; checked: boolean; onCheckedChange: (v: boolean) => void }
		| { kind: "heading"; label: string }
		| { kind: "separator" };

	interface Props {
		entries: readonly Entry[];
		/** Names the trigger for screen readers, e.g. "Steps options". */
		label: string;
		/** The trigger's contents. Omit for the default "⋯". */
		trigger?: Snippet;
	}

	let { entries, label, trigger }: Props = $props();

	/**
	 * A heading has to sit inside a `DropdownMenu.Group`: bits-ui resolves its
	 * labelling context with `MenuGroupContext.get()`, which throws when there
	 * is no group above it. The throw happens while the portal mounts its
	 * content, so nothing reaches the console — the trigger flips to `open` and
	 * the menu simply never appears. Folding the flat list into blocks here
	 * keeps the caller's API flat and the markup correct.
	 */
	type Block =
		| { kind: "loose"; items: Entry[] }
		| { kind: "group"; label: string; items: Entry[] }
		| { kind: "separator" };

	let blocks = $derived.by(() => {
		const out: Block[] = [];
		// The block currently collecting items. A separator ends it, so the next
		// item starts a fresh one rather than joining the group above.
		let open: Exclude<Block, { kind: "separator" }> | null = null;

		for (const entry of entries) {
			if (entry.kind === "separator") {
				open = null;
				out.push({ kind: "separator" });
			} else if (entry.kind === "heading") {
				open = { kind: "group", label: entry.label, items: [] };
				out.push(open);
			} else {
				if (open === null) {
					open = { kind: "loose", items: [] };
					out.push(open);
				}
				open.items.push(entry);
			}
		}
		return out;
	});

	// A key that survives reordering without forcing callers to invent ids.
	function key(entry: Entry, index: number): string {
		return entry.kind === "separator" ? `sep-${index}` : `${entry.kind}-${entry.label}`;
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger aria-label={label} title={label} class="gcd-menu-trigger">
		{#if trigger}{@render trigger()}{:else}⋯{/if}
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content sideOffset={6} align="end" class="gcd-menu">
			{#each blocks as block, b (b)}
				{#if block.kind === "separator"}
					<DropdownMenu.Separator class="gcd-menu-sep" />
				{:else if block.kind === "group"}
					<DropdownMenu.Group>
						<DropdownMenu.GroupHeading class="gcd-menu-heading">
							{block.label}
						</DropdownMenu.GroupHeading>
						{@render rows(block.items)}
					</DropdownMenu.Group>
				{:else}
					{@render rows(block.items)}
				{/if}
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>

{#snippet rows(items: Entry[])}
	{#each items as entry, i (key(entry, i))}
		{#if entry.kind === "check"}
			<DropdownMenu.CheckboxItem
				checked={entry.checked}
				onCheckedChange={entry.onCheckedChange}
				closeOnSelect={false}
				class="gcd-menu-item"
			>
				{#snippet children({ checked })}
					<span class="tick" aria-hidden="true">{checked ? "✓" : ""}</span>
					{entry.label}
				{/snippet}
			</DropdownMenu.CheckboxItem>
		{:else if entry.kind === "item"}
			<DropdownMenu.Item
				onSelect={entry.onSelect}
				disabled={entry.disabled}
				class="gcd-menu-item {entry.danger ? 'gcd-menu-danger' : ''}"
			>
				<span class="tick" aria-hidden="true"></span>
				{entry.label}
			</DropdownMenu.Item>
		{/if}
	{/each}
{/snippet}

<style>
	:global(.gcd-menu-trigger) {
		width: 22px;
		height: 22px;
		padding: 0;
		border-radius: 50%;
		border: 1px solid var(--gcd-border);
		background: transparent;
		color: var(--gcd-muted);
		font-size: 12px;
		line-height: 1;
		cursor: pointer;
		box-shadow: none;
	}
	:global(.gcd-menu-trigger:hover),
	:global(.gcd-menu-trigger[data-state="open"]) {
		background: var(--gcd-raised);
		color: var(--gcd-text);
	}
	:global(.gcd-menu-trigger:focus-visible) {
		outline: 2px solid var(--gcd-series);
		outline-offset: 2px;
	}

	:global(.gcd-menu) {
		z-index: var(--gcd-layer, 1000);
		min-width: 11rem;
		max-height: min(20rem, var(--bits-dropdown-menu-content-available-height, 20rem));
		overflow-y: auto;
		padding: 4px;
		border-radius: var(--gcd-radius, 8px);
		border: 1px solid var(--gcd-border);
		background: var(--gcd-surface);
		box-shadow: var(--gcd-shadow);
	}
	:global(.gcd-menu-item) {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 8px;
		border-radius: 4px;
		font-size: var(--font-ui-smaller, 12px);
		cursor: pointer;
		user-select: none;
	}
	:global(.gcd-menu-item[data-highlighted]) {
		background: var(--gcd-raised);
	}
	:global(.gcd-menu-item[data-disabled]) {
		opacity: 0.5;
		cursor: default;
	}
	:global(.gcd-menu-danger) {
		color: var(--gcd-bad);
	}
	:global(.gcd-menu-heading) {
		padding: 6px 8px 4px;
		color: var(--gcd-muted);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	:global(.gcd-menu-sep) {
		height: 1px;
		margin: 4px 0;
		background: var(--gcd-border);
	}
	.tick {
		width: 12px;
		flex: none;
		color: var(--gcd-series);
		font-size: 11px;
	}
</style>
