<script lang="ts">
	import StatusRow from "./StatusRow.svelte";

	/**
	 * A stat page's table (twins 443:773, 443:824, 443:835): an optional
	 * title band, a header on its divider, and rows, each kind with the app's
	 * columns.
	 *
	 * - "records": Cycling Power Records, Peak · Watts (centred) · Date, the
	 *   date a link to its ride, or muted text where the row opens nothing
	 *   (rides have no page yet, twin 779:131507); rows alternate from the
	 *   card colour.
	 * - "based-on": FTP's Based On, three plain columns on the page.
	 * - "results": Critical Swim Speed's Pace (over its unit) · Date.
	 * - "status": Training Status's Status · Dates, its rows `StatusRow`s
	 *   alternating from the page colour, newest first.
	 *
	 * Columns sit where the twin has them on a 402 pt phone, as fractions of
	 * the row, so a pane spreads them the same way.
	 */
	interface Row {
		key: string;
		cells: readonly string[];
		/** "records": the date's link; "status": the row's own tap. */
		onclick?: () => void;
		/** "status": the period's colour, and whether another row is selected. */
		color?: string;
		dimmed?: boolean;
	}

	interface Props {
		kind: "records" | "based-on" | "results" | "status";
		title?: string;
		header?: readonly string[];
		/** "results": the line under the first header, "min/100m". */
		sub?: string;
		rows: readonly Row[];
		/** The first row's colour, the rest alternating; "none" keeps them all the page's. */
		zebra?: "card" | "page" | "none";
	}

	let { kind, title, header, sub, rows, zebra }: Props = $props();

	const ZEBRA: Record<Props["kind"], NonNullable<Props["zebra"]>> = { records: "card", status: "page", "based-on": "none", results: "none" };
	let first = $derived(zebra ?? ZEBRA[kind]);
	const toneOf = (i: number, from: "card" | "page" | "none"): "card" | "page" =>
		from === "none" ? "page" : (i % 2 === 0) === (from === "card") ? "card" : "page";
</script>

<div class="stat-table {kind}">
	{#if title}<div class="title">{title}</div>{/if}
	{#if header}
		<div class="header">
			{#each header as cell, i (i)}
				<span class="c{i + 1}">{cell}{#if i === 0 && sub}<span class="sub">{sub}</span>{/if}</span>
			{/each}
		</div>
	{/if}
	{#each rows as row, i (row.key)}
		{#if kind === "status"}
			<StatusRow status={row.cells[0] ?? ""} dates={row.cells[1] ?? ""} color={row.color ?? "var(--background-modifier-border)"} tone={toneOf(i, first)} dimmed={row.dimmed} onclick={row.onclick} />
		{:else}
			<div class="row" class:alt={toneOf(i, first) === "card"}>
				{#each row.cells as cell, c (c)}
					{#if kind === "records" && c === 2 && row.onclick}
						<button class="c3 link" onclick={row.onclick}>{cell}</button>
					{:else}
						<span class="c{c + 1}">{cell}</span>
					{/if}
				{/each}
			</div>
		{/if}
	{/each}
</div>

<style>
	.stat-table {
		font-size: 15px;
		line-height: 20px;
		color: var(--text-normal);
	}
	.title {
		display: flex;
		align-items: flex-end;
		box-sizing: border-box;
		height: 44.33px;
		padding: 0 16.5px 3.11px;
		font-size: 18px;
		line-height: 22px;
		font-weight: 700;
		background: var(--background-primary);
	}
	.results .title {
		align-items: center;
		height: 53px;
		padding-bottom: 0;
	}
	.header,
	.row {
		position: relative;
		box-sizing: border-box;
		height: 52px;
		white-space: nowrap;
	}
	.header {
		background: var(--background-secondary);
		border-bottom: 2px solid var(--background-modifier-border);
		font-weight: 600;
	}
	.row {
		background: var(--background-primary);
	}
	/* The zebra's card colour. Not `.card`: Obsidian styles that class globally (padding, a 10 pt margin, a border). */
	.row.alt {
		background: var(--background-primary-alt);
	}
	.header > span,
	.row > span,
	.row > .link {
		position: absolute;
		top: 16px;
	}
	.header > span {
		top: 15.46px;
	}
	/* Records: Peak at 25.5, Watts centred on 201, Date at 282 (of 402). */
	.records .c1 {
		left: 25.5px;
	}
	.records .c2 {
		left: 50%;
		width: 120px;
		margin-left: -60px;
		text-align: center;
	}
	.records .c3 {
		left: 70.15%;
	}
	/* A date that opens nothing is muted, not dressed as a link. */
	.records .row > span.c3 {
		color: var(--text-muted);
	}
	.link {
		height: auto;
		margin: 0;
		padding: 0;
		border: none;
		box-shadow: none;
		background: none;
		font: inherit;
		color: var(--text-accent);
		cursor: pointer;
	}
	/* Based On: 16.5 · 201.5 · 294; Results: 16.5 · 201.5. */
	.based-on .c1,
	.results .c1 {
		left: 16.5px;
	}
	.based-on .c2,
	.results .c2 {
		left: 50.12%;
	}
	.based-on .c3 {
		left: 73.13%;
	}
	.based-on .header,
	.results .header {
		font-weight: 600;
	}
	.results .header {
		height: 52.33px;
	}
	.results .header .c1 {
		top: 8.8px;
	}
	.results .header .c2 {
		top: 7.8px;
	}
	.sub {
		display: block;
		margin-top: -2.37px;
		font-size: 14px;
		line-height: 18px;
		font-weight: 400;
		color: var(--text-muted);
	}
	/* Status: Status at 16, Dates at 209.5, set high in the header, regular weight. */
	.status .header {
		font-weight: 400;
	}
	.status .header > span {
		top: 10.13px;
	}
	.status .header .c1 {
		left: 16px;
	}
	.status .header .c2 {
		left: 52.11%;
	}
</style>
