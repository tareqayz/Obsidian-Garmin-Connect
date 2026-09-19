<script lang="ts">
	import type { TileDef } from "../../../dashboard/metrics";
	import {
		HEIGHTS,
		WIDTHS,
		WIDTH_LABELS,
		type CardOptions,
		type LayoutBlock,
		type WidgetHeight,
		type WidgetWidth,
	} from "../../../dashboard/layouts";
	import SegmentedControl from "../v2/SegmentedControl.svelte";

	interface Props {
		block: LayoutBlock;
		title: string;
		/** True on a one-column pane, where this opens as a sheet. */
		compact: boolean;
		/** Columns the pane currently has, so the width note can be honest. */
		columns: 1 | 2 | 4;
		tiles: readonly TileDef[];
		heatChoices: readonly { key: string; label: string }[];
		onResize: (size: { width?: WidgetWidth; height?: WidgetHeight }) => void;
		onOptions: (patch: Partial<CardOptions>) => void;
		onMetrics: (metrics: string[]) => void;
		onTitle: (title: string) => void;
		onRemove: () => void;
		onClose: () => void;
	}

	let {
		block,
		title,
		compact,
		columns,
		tiles,
		heatChoices,
		onResize,
		onOptions,
		onMetrics,
		onTitle,
		onRemove,
		onClose,
	}: Props = $props();

	const widthOptions = WIDTHS.map((w) => ({ value: String(w), label: WIDTH_LABELS[w] }));
	const heightOptions = HEIGHTS.map((h) => ({ value: h, label: h }));
	const rangeOptions = [
		{ value: "follow", label: "Follow" },
		{ value: "7", label: "7d" },
		{ value: "30", label: "30d" },
		{ value: "365", label: "1y" },
	];

	let sizable = $derived(block.type === "card" || block.type === "stats" || block.type === "rings");
	let width = $derived(sizable && "width" in block ? block.width : 4);
	let options = $derived(block.type === "card" ? block.options : null);
	let rangeValue = $derived(
		options ? (options.range === "follow" ? "follow" : String(options.range)) : "follow",
	);
	let chosen = $derived(new Set(block.type === "stats" ? block.metrics : []));

	function toggleMetric(key: string) {
		if (block.type !== "stats") return;
		const next = block.metrics.includes(key)
			? block.metrics.filter((m) => m !== key)
			: [...block.metrics, key];
		onMetrics(next);
	}
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onClose()} />

{#if compact}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="scrim" onclick={onClose}></div>
{/if}

<div class="panel" class:sheet={compact} role="dialog" aria-label="{title} settings">
	<header>
		<div class="heading">
			<div class="name">{title}</div>
			<div class="sub">Widget settings</div>
		</div>
		<button class="icon" aria-label="Close" onclick={onClose}>✕</button>
	</header>

	{#if block.type === "section"}
		<label class="field">
			<span class="label">HEADING</span>
			<input
				type="text"
				value={block.title}
				oninput={(e) => onTitle(e.currentTarget.value)}
				placeholder="Section name"
			/>
		</label>
	{/if}

	{#if sizable}
		<div class="field">
			<span class="label">WIDTH</span>
			<SegmentedControl
				label="Width"
				options={widthOptions}
				value={String(width)}
				onSelect={(v) => onResize({ width: Number(v) as WidgetWidth })}
			/>
			{#if columns < 4}
				<!-- Saying nothing here would make the control look broken: the
				     person taps ¼ and the widget does not move. -->
				<p class="note">
					This pane is {columns === 1 ? "one column" : "two columns"} wide, so the choice takes
					effect on a wider one. The layout itself is the same everywhere.
				</p>
			{/if}
		</div>
	{/if}

	{#if block.type === "card"}
		<div class="field">
			<span class="label">HEIGHT</span>
			<SegmentedControl
				label="Height"
				options={heightOptions}
				value={block.height}
				onSelect={(v) => onResize({ height: v as WidgetHeight })}
			/>
		</div>

		<div class="field">
			<span class="label">DATE RANGE</span>
			<SegmentedControl
				label="Date range"
				options={rangeOptions}
				value={rangeValue}
				onSelect={(v) => onOptions({ range: v === "follow" ? "follow" : Number(v) })}
			/>
			<p class="note">
				“Follow” uses whatever the filter bar is showing. Anything else pins this widget to its
				own window.
			</p>
		</div>

		{#if block.card === "calendar" && heatChoices.length > 1}
			<label class="field">
				<span class="label">MEASURE</span>
				<select
					value={block.options.metric ?? heatChoices[0]?.key}
					onchange={(e) => onOptions({ metric: e.currentTarget.value })}
				>
					{#each heatChoices as choice (choice.key)}
						<option value={choice.key}>{choice.label}</option>
					{/each}
				</select>
			</label>
		{/if}

		<div class="field">
			<span class="label">DISPLAY</span>
			<label class="toggle">
				<span>Goal line</span>
				<input
					type="checkbox"
					checked={block.options.goalLine}
					onchange={(e) => onOptions({ goalLine: e.currentTarget.checked })}
				/>
			</label>
			<label class="toggle">
				<span>Summary statistics when expanded</span>
				<input
					type="checkbox"
					checked={block.options.summary}
					onchange={(e) => onOptions({ summary: e.currentTarget.checked })}
				/>
			</label>
		</div>
	{/if}

	{#if block.type === "stats"}
		<div class="field">
			<span class="label">TILES</span>
			<div class="metrics">
				{#each tiles as tile (tile.key)}
					<button
						class="metric"
						class:on={chosen.has(tile.key)}
						aria-pressed={chosen.has(tile.key)}
						onclick={() => toggleMetric(tile.key)}>{tile.label}</button
					>
				{/each}
			</div>
			<p class="note">Tiles appear in the order the dashboard defines them, not the order you tap.</p>
		</div>
	{/if}

	<div class="rule"></div>
	<button class="remove" onclick={onRemove}>Remove from this layout</button>
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: rgba(10, 10, 10, 0.42);
	}
	.panel {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 51;
		width: 320px;
		max-width: calc(100vw - 24px);
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 14px 16px;
		border-radius: 12px;
		background: var(--v2-surface-card);
		box-shadow: var(--v2-shadow-1), 0 12px 32px rgba(0, 0, 0, 0.18);
	}
	/* On one column the anchored panel would cover the widget it belongs to and
	   sit out of thumb reach, so it becomes a sheet at the foot of the pane. */
	.panel.sheet {
		position: fixed;
		inset: auto 0 0 0;
		width: auto;
		max-width: none;
		max-height: 80vh;
		overflow-y: auto;
		border-radius: 12px 12px 0 0;
		padding-bottom: calc(16px + env(safe-area-inset-bottom, 12px));
	}
	header {
		display: flex;
		align-items: flex-start;
		gap: 8px;
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
	.icon {
		margin-left: auto;
		width: 24px;
		height: 24px;
		padding: 0;
		border-radius: 50%;
		border: 1px solid var(--gcd-border);
		background: transparent;
		color: var(--gcd-muted);
		font-size: 11px;
		line-height: 1;
		cursor: pointer;
		box-shadow: none;
		flex: none;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.label {
		font-size: var(--font-ui-smaller, 12px);
		font-weight: 600;
		color: var(--v2-muted);
		letter-spacing: 0.02em;
	}
	.note {
		margin: 0;
		font-size: var(--font-ui-smaller, 12px);
		line-height: 1.45;
		color: var(--v2-muted);
	}
	.field input[type="text"],
	.field select {
		width: 100%;
		font-size: var(--font-ui-small, 13px);
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 4px 0;
		font-size: var(--font-ui-small, 13px);
		color: var(--gcd-text);
		cursor: pointer;
	}
	.toggle span {
		flex: 1;
	}
	.toggle input {
		flex: none;
	}
	.metrics {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.metric {
		padding: 5px 10px;
		border: 1px solid var(--gcd-border);
		border-radius: 999px;
		background: transparent;
		color: var(--v2-muted);
		font-size: 12px;
		line-height: 1.25;
		height: auto;
		box-shadow: none;
		cursor: pointer;
	}
	.metric.on {
		border-color: var(--v2-accent);
		background: var(--v2-accent-tint);
		color: var(--v2-accent);
		font-weight: 500;
	}
	.rule {
		height: 1px;
		background: var(--gcd-border);
	}
	.remove {
		align-self: flex-start;
		padding: 0;
		border: none;
		background: transparent;
		box-shadow: none;
		color: var(--v2-negative);
		font-size: var(--font-ui-small, 13px);
		height: auto;
		cursor: pointer;
	}
</style>
