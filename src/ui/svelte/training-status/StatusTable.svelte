<script lang="ts">
	import StatusRow from "../health/StatusRow.svelte";

	/**
	 * One column of the runs' table (twin Table Header 443:773 over Status
	 * Rows 443:735): "Status" at x 16 and "Dates" at 209.5 on a 50 pt band and
	 * its 2 pt divider, then a row a run, the zebra from the page's colour.
	 * Its own colour is the twin's --background-secondary, which the dimmed
	 * rows show through at half opacity while a run is selected. The header's
	 * columns are pinned like the rows', so a pane's 370 pt column lines up.
	 */
	interface Row {
		key: string;
		status: string;
		dates: string;
		color: string;
		dimmed: boolean;
		onclick: () => void;
	}

	let { rows }: { rows: readonly Row[] } = $props();
</script>

<div class="ts-table">
	<div class="header"><span class="c1">Status</span><span class="c2">Dates</span></div>
	{#each rows as row, i (row.key)}
		<StatusRow status={row.status} dates={row.dates} color={row.color} tone={i % 2 === 0 ? "page" : "card"} dimmed={row.dimmed} onclick={row.onclick} />
	{/each}
</div>

<style>
	.ts-table {
		background: var(--background-secondary);
		color: var(--text-normal);
		font-size: 15px;
		line-height: 20px;
	}
	/* Set high, as the twin's: the words 10.13 under the band's top. */
	.header {
		position: relative;
		box-sizing: border-box;
		height: 52px;
		border-bottom: 2px solid var(--background-modifier-border);
		background: var(--background-secondary);
		white-space: nowrap;
	}
	.header span {
		position: absolute;
		top: 10.13px;
	}
	.c1 {
		left: 16px;
	}
	.c2 {
		left: 209.5px;
	}
</style>
