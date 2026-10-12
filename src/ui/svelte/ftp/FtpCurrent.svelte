<script lang="ts">
	import type { FtpCurrent } from "../../../dashboard/ftp-pages";
	import StatDial from "../health/StatDial.svelte";
	import StatTable from "../health/StatTable.svelte";

	/**
	 * Current (twin 727:9 Cycling, 727:112 Cross Country Skiing without a
	 * fresh FTP; Inferred 728:515 Cycling once stale, 728:580 a fresh skiing
	 * FTP; pane 730:1919): the tab's title, the date line or Garmin's "no
	 * data in the past year", then the dial — or, in its place, the number
	 * over its unit word where the dial's would be — and either Based On's
	 * two rows or the link to how to update it.
	 *
	 * A pane sets Based On in the 370 pt column beside the dial, its heading
	 * level with the title and its rows 16 pt into the gap, as the twin does.
	 */
	interface Props {
		current: FtpCurrent;
		/** "Learn how to update your … FTP": opens its sheet. */
		onlink: () => void;
	}

	let { current, onlink }: Props = $props();
</script>

<div class="ftp-current">
	<div class="main">
		<p class="title">{current.title}</p>
		<p class="line">{current.line}</p>
		<div class="dial">
			{#if current.dial}
				<StatDial kind="ftp" gauge={current.dial.gauge} />
			{:else if current.figure}
				<StatDial kind="ftp" value={current.figure.value} label={current.figure.unit} />
			{/if}
		</div>
		{#if current.link}
			<button class="link" onclick={onlink}>
				{#each current.link.lines as line, i (i)}<span>{line}</span>{/each}
			</button>
		{/if}
	</div>
	{#if current.basedOn.length}
		<div class="side">
			<h3>Based On</h3>
			<StatTable kind="based-on" rows={current.basedOn.map((row) => ({ key: row.label, cells: [row.label, row.value, row.date ?? ""] }))} />
		</div>
	{/if}
</div>

<style>
	/*
	 * The phone (727:9): the title 54.53 under the tabs, Title S centred; the
	 * line 5.94 under it; the dial's box 6.71 under that (centre 201, 367.51).
	 * Based On's heading 17.01 under the dial's box at x 16, its rows 6.81
	 * under the heading (511.33, 563.33). Without a fresh FTP (727:112) the
	 * link's lines, 17.67 apart, start 23.62 under the dial's box.
	 */
	.ftp-current {
		padding-bottom: 24px;
	}
	.main {
		text-align: center;
	}
	.title,
	.line {
		margin: 0;
		padding: 0 16px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.title {
		margin-top: 54.53px;
		font-size: 17px;
		line-height: 22px;
		font-weight: 700;
		color: var(--text-normal);
	}
	.line {
		margin-top: 5.94px;
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
	}
	.dial {
		display: flex;
		justify-content: center;
		height: 196px;
		margin-top: 6.71px;
	}
	/* The twin sets the number in proportional figures: "111", not tabular "1 1 1". */
	.dial :global(.stat-dial .value) {
		font-variant-numeric: normal;
	}
	/* Body Semibold in the accent, its lines left-aligned in a block centred on the page; 17.67 apart, so each line box starts 1.17 lower than a 20 pt one would. */
	.link {
		display: block;
		width: fit-content;
		height: auto;
		margin: 24.79px auto 0;
		padding: 0;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: none;
		font: inherit;
		font-size: 15px;
		line-height: 17.67px;
		font-weight: 600;
		text-align: left;
		color: var(--text-accent);
		cursor: pointer;
	}
	.link:hover {
		color: var(--text-accent-hover);
	}
	.link span {
		display: block;
		white-space: nowrap;
	}
	.side h3 {
		margin: 17.01px 0 0;
		padding: 0 16px;
		font-size: 17px;
		line-height: 22px;
		font-weight: 700;
		color: var(--text-normal);
	}
	.side :global(.stat-table) {
		margin-top: 6.81px;
	}

	/*
	 * The pane (730:1919): the dial's column is the chart's 748, its title,
	 * line and dial centred on 406; Based On in the 370 column beside it, the
	 * heading level with the title at 788, its rows from 772 (text at 788.5).
	 */
	@container (min-width: 1000px) {
		.ftp-current {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 8px;
			align-items: start;
		}
		.side h3 {
			margin-top: 54.53px;
			padding: 0;
		}
		.side :global(.stat-table) {
			margin-left: -16px;
		}
	}
</style>
