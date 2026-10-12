<script lang="ts">
	/**
	 * Training Status as a strip of periods, oldest first, each as long as
	 * its days and in its status's colour.
	 *
	 * - "card": Home's In Focus card, 12 pt rounded bars, the space between
	 *   shared by days.
	 * - "page": the Training Status page (twin 443:682), 64 pt tall and
	 *   clipped to a 4 pt left and 2 pt right corner; a day is (width + 2) /
	 *   days and each period gives its last 2 pt to the gap. With a
	 *   `selected` period (a row tapped) it stays full and the rest drop to a
	 *   16 pt foot.
	 *
	 * A period without a colour is days without a row: its slot stays empty.
	 */
	interface Props {
		periods: ReadonlyArray<{ days: number; color?: string }>;
		size?: "card" | "page";
		selected?: number;
	}

	let { periods, size = "card", selected }: Props = $props();

	let total = $derived(periods.reduce((n, p) => n + p.days, 0) || 1);
</script>

{#if size === "card"}
	<div class="strip">
		{#each periods as p, i (i)}
			<span style:flex-grow={p.days} style:background={p.color}></span>
		{/each}
	</div>
{:else}
	<div class="strip page">
		{#each periods as p, i (i)}
			<span class:short={selected !== undefined && selected !== i} style:flex-basis="calc((100% + 2px) * {p.days / total} - 2px)" style:background={p.color}></span>
		{/each}
	</div>
{/if}

<style>
	.strip {
		display: flex;
		gap: 2px;
		height: 12px;
	}
	.strip span {
		flex-basis: 0;
		border-radius: 6px;
	}
	.page {
		align-items: flex-end;
		height: 64px;
		overflow: hidden;
		border-radius: 4px 2px 2px 4px;
	}
	.page span {
		flex-grow: 0;
		flex-shrink: 0;
		height: 100%;
		border-radius: 0;
	}
	.page span.short {
		height: 16px;
	}
</style>
