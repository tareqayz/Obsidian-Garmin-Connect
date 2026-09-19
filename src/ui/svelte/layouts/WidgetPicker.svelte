<script lang="ts">
	import { CARD_ORDER, cardTitle } from "../../../dashboard/layouts";
	import { SECTIONS, type SectionId } from "../../../dashboard/metrics";

	interface Props {
		compact: boolean;
		/** Cards this layout already holds. */
		present: ReadonlySet<string>;
		/** Cards the vault actually has data for in the current range. */
		available: ReadonlySet<string>;
		/** Where the widget will land, named for the person's benefit. */
		destination: string;
		hasStats: boolean;
		hasRings: boolean;
		onAddCard: (card: string) => void;
		onAddSection: () => void;
		onAddStats: () => void;
		onAddRings: () => void;
		onClose: () => void;
	}

	let {
		compact,
		present,
		available,
		destination,
		hasStats,
		hasRings,
		onAddCard,
		onAddSection,
		onAddStats,
		onAddRings,
		onClose,
	}: Props = $props();

	let query = $state("");
	let only = $state<SectionId | "all">("all");

	interface Row {
		id: string;
		title: string;
		subtitle: string;
		added: boolean;
		synced: boolean;
	}

	let groups = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		const out: Array<{ id: SectionId; title: string; rows: Row[] }> = [];
		for (const section of SECTIONS) {
			if (only !== "all" && only !== section.id) continue;
			const rows: Row[] = [];
			for (const card of CARD_ORDER[section.id]) {
				const def = cardTitle(card);
				if (!def) continue;
				if (needle && !`${def.title} ${def.subtitle}`.toLowerCase().includes(needle)) continue;
				rows.push({
					id: card,
					title: def.title,
					subtitle: def.subtitle,
					added: present.has(card),
					synced: available.has(card),
				});
			}
			if (rows.length > 0) out.push({ id: section.id, title: section.title, rows });
		}
		return out;
	});

	let total = $derived(SECTIONS.reduce((n, s) => n + CARD_ORDER[s.id].length, 0));
	let showStructure = $derived(only === "all" && query.trim() === "");
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onClose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="scrim" onclick={onClose}></div>

<div class="picker" class:sheet={compact} role="dialog" aria-label="Add widget">
	<header>
		<div class="heading">
			<div class="name">Add widget</div>
			<div class="sub">to {destination}</div>
		</div>
		<button class="done" onclick={onClose}>Done</button>
	</header>

	<div class="controls">
		<input
			class="search"
			type="search"
			placeholder="Search {total} widgets…"
			bind:value={query}
			aria-label="Search widgets"
		/>
		<div class="filters">
			<button class="chip" class:on={only === "all"} onclick={() => (only = "all")}>All</button>
			{#each SECTIONS as section (section.id)}
				<button
					class="chip"
					class:on={only === section.id}
					onclick={() => (only = section.id)}>{section.title}</button
				>
			{/each}
		</div>
	</div>

	<div class="list">
		{#if showStructure}
			<div class="group">Layout</div>
			<div class="row">
				<div class="thumb structure" aria-hidden="true"><i></i><i></i></div>
				<div class="copy">
					<div class="title">Section heading</div>
					<div class="desc">A collapsible divider. Everything under it belongs to it.</div>
				</div>
				<button class="add" onclick={onAddSection}>Add</button>
			</div>
			<div class="row" class:dim={hasStats}>
				<div class="thumb structure" aria-hidden="true"><i></i><i></i></div>
				<div class="copy">
					<div class="title">Key stats</div>
					<div class="desc">One row of tiles. Its settings choose which measures show.</div>
				</div>
				{#if hasStats}
					<span class="state added">✓ Added</span>
				{:else}
					<button class="add" onclick={onAddStats}>Add</button>
				{/if}
			</div>
			<div class="row" class:dim={hasRings}>
				<div class="thumb structure" aria-hidden="true"><i></i><i></i></div>
				<div class="copy">
					<div class="title">Goal rings</div>
					<div class="desc">Steps, intensity minutes and floors against Garmin's targets.</div>
				</div>
				{#if hasRings}
					<span class="state added">✓ Added</span>
				{:else}
					<button class="add" onclick={onAddRings}>Add</button>
				{/if}
			</div>
		{/if}

		{#each groups as group (group.id)}
			<div class="group">{group.title}</div>
			{#each group.rows as row (row.id)}
				<div class="row" class:dim={!row.synced}>
					<div class="thumb" class:flat={!row.synced} aria-hidden="true">
						<i style="height: 8px"></i><i style="height: 14px"></i><i style="height: 10px"
						></i><i style="height: 17px"></i>
					</div>
					<div class="copy">
						<div class="title">{row.title}</div>
						<div class="desc">{row.subtitle}</div>
					</div>
					{#if row.added}
						<span class="state added">✓ Added</span>
					{:else if !row.synced}
						<!-- Listed rather than hidden: an absent widget makes the dashboard
						     look broken, where a greyed one with a reason makes it look
						     unconfigured — which is what it is. -->
						<span class="state" title="No data in this range yet">Not synced</span>
					{:else}
						<button class="add" onclick={() => onAddCard(row.id)}>Add</button>
					{/if}
				</div>
			{/each}
		{/each}

		{#if groups.length === 0 && !showStructure}
			<p class="none">Nothing matches “{query}”.</p>
		{/if}
	</div>

	<footer>
		A widget with no data still appears here — switch its metric group on in Settings → Metrics,
		then sync.
	</footer>
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: rgba(10, 10, 10, 0.42);
	}
	.picker {
		position: fixed;
		z-index: 51;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(640px, calc(100vw - 48px));
		max-height: min(680px, calc(100vh - 96px));
		display: flex;
		flex-direction: column;
		border-radius: 12px;
		background: var(--v2-surface-card);
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28);
		overflow: hidden;
	}
	.picker.sheet {
		top: auto;
		left: 0;
		right: 0;
		bottom: 0;
		transform: none;
		width: auto;
		max-height: 88vh;
		border-radius: 12px 12px 0 0;
	}
	header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 16px 18px 12px;
		flex: none;
	}
	.name {
		font-weight: 600;
		font-size: 15px;
		color: var(--gcd-text);
	}
	.sub {
		font-size: var(--font-ui-smaller, 12px);
		color: var(--v2-muted);
	}
	.done {
		margin-left: auto;
		padding: 5px 14px;
		border: 1px solid var(--v2-accent);
		border-radius: 999px;
		background: transparent;
		color: var(--v2-accent);
		font-size: 12px;
		font-weight: 600;
		line-height: 1.25;
		height: auto;
		box-shadow: none;
		cursor: pointer;
	}
	.controls {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 0 16px 10px;
		flex: none;
	}
	.search {
		width: 100%;
		font-size: var(--font-ui-small, 13px);
	}
	.filters {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.filters::-webkit-scrollbar {
		display: none;
	}
	.chip {
		flex: none;
		padding: 4px 11px;
		border: 1px solid var(--gcd-border);
		border-radius: 999px;
		background: transparent;
		color: var(--v2-muted);
		font-size: 12px;
		line-height: 1.25;
		height: auto;
		box-shadow: none;
		cursor: pointer;
		white-space: nowrap;
	}
	.chip.on {
		border-color: var(--v2-accent);
		color: var(--v2-accent);
		font-weight: 500;
	}
	.list {
		flex: 1;
		overflow-y: auto;
		padding: 0 16px 12px;
	}
	.group {
		padding: 12px 0 4px;
		font-size: var(--font-ui-smaller, 12px);
		font-weight: 600;
		color: var(--v2-muted);
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 10px;
		margin: 0 -10px;
		border-radius: 8px;
	}
	.row:hover {
		background: var(--gcd-raised);
	}
	.row.dim .title,
	.row.dim .desc {
		color: var(--v2-muted);
	}
	.thumb {
		flex: none;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 3px;
		width: 44px;
		height: 34px;
		padding-bottom: 7px;
		border-radius: 6px;
		background: var(--gcd-raised);
	}
	.thumb i {
		width: 4px;
		border-radius: 1px;
		background: var(--v2-accent);
	}
	.thumb.flat i {
		background: var(--gcd-axis);
	}
	.thumb.structure {
		align-items: center;
		flex-direction: column;
		gap: 3px;
		padding: 0;
	}
	.thumb.structure i {
		width: 26px;
		height: 5px;
		border-radius: 2px;
		background: var(--gcd-axis);
	}
	.copy {
		flex: 1;
		min-width: 0;
	}
	.title {
		font-weight: 600;
		font-size: var(--font-ui-small, 13px);
		color: var(--gcd-text);
	}
	.desc {
		font-size: var(--font-ui-smaller, 12px);
		color: var(--v2-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.add {
		flex: none;
		padding: 5px 14px;
		border: 1px solid var(--gcd-border);
		border-radius: 999px;
		background: transparent;
		color: var(--gcd-text);
		font-size: 12px;
		line-height: 1.25;
		height: auto;
		box-shadow: none;
		cursor: pointer;
	}
	.add:hover {
		border-color: var(--v2-accent);
		color: var(--v2-accent);
	}
	.state {
		flex: none;
		padding: 3px 9px;
		border-radius: 999px;
		background: var(--gcd-raised);
		color: var(--v2-muted);
		font-size: 11px;
		line-height: 1.3;
	}
	.state.added {
		background: var(--v2-positive-tint);
		color: var(--v2-positive);
	}
	.none {
		padding: 28px 0;
		text-align: center;
		color: var(--gcd-muted);
		font-size: var(--font-ui-small, 13px);
	}
	footer {
		flex: none;
		padding: 12px 18px calc(12px + env(safe-area-inset-bottom, 0px));
		background: var(--v2-surface-app);
		color: var(--v2-muted);
		font-size: var(--font-ui-smaller, 12px);
		line-height: 1.45;
	}
</style>
