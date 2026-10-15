<script lang="ts">
	import { Menu } from "obsidian";
	import { SORT_OPTIONS } from "../../../../dashboard/all-activities";
	import type { AllSort } from "../../../../dashboard/routes";
	import { lucide } from "../../home/lucide";

	/**
	 * How many activities match ("341 ACTIVITIES": the exact count, where
	 * Garmin pages to "100+"), and the Sort button. Sort opens Obsidian's own
	 * menu with the current order checked: a dropdown under the button in a
	 * pane, a sheet from the bottom on a phone.
	 */
	interface Props {
		label: string;
		sort: AllSort | undefined;
		onSort: (sort: AllSort | undefined) => void;
	}

	let { label, sort, onSort }: Props = $props();

	function open(e: MouseEvent & { currentTarget: HTMLElement }) {
		const menu = new Menu();
		for (const option of SORT_OPTIONS) {
			menu.addItem((item) =>
				item
					.setTitle(option.label)
					.setChecked(option.sort === sort)
					.onClick(() => {
						if (option.sort !== sort) onSort(option.sort);
					}),
			);
		}
		// Under the button and right-aligned to it, opening leftwards from its right end. Given
		// only a point, Obsidian moves a menu that would overflow wholly left of it: beside the button.
		const box = e.currentTarget.getBoundingClientRect();
		menu.showAtPosition({ x: box.left, y: box.bottom + 4, width: box.width, overlap: true, left: true });
	}
</script>

<div class="count-row">
	<span class="count">{label}</span>
	<button class="sort" onclick={open}>
		<span>Sort</span>
		<span class="chev" use:lucide={"chevron-down"}></span>
	</button>
</div>

<style>
	.count-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.count {
		font-size: 13px;
		line-height: 16px;
		letter-spacing: 0.02em;
		color: var(--text-muted);
	}
	/* Obsidian's button, at the phone's 81.7 × 33.7. */
	.sort {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex: none;
		height: 34px;
		margin: 0;
		padding: 0 12px 0 14px;
		font-size: 13px;
		cursor: pointer;
	}
	.chev {
		display: inline-flex;
		color: var(--text-muted);
	}
	.chev :global(svg) {
		width: 14px;
		height: 14px;
	}
</style>
