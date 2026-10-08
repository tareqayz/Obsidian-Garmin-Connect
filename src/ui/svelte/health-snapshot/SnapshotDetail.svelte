<script lang="ts">
	import type { SnapshotDetailView } from "../../../dashboard/health-snapshot-pages";
	import SnapshotChart from "./SnapshotChart.svelte";

	/** A snapshot: its date and time, four sections (figures, then chart), the device. Twin 347:163 / 347:529. */
	let { view }: { view: SnapshotDetailView } = $props();
</script>

<div class="hs-detail">
	<div class="when">
		<strong>{view.date}</strong>
		<span>{view.time}</span>
	</div>
	<div class="sections">
		{#each view.sections as section (section.id)}
			<section class="hs-section">
				<h3>{section.title}</h3>
				<div class="figures">
					{#each section.figures as f (f.label)}
						<div class="figure"><span class="value">{f.value}</span><span class="label">{f.label}</span></div>
					{/each}
				</div>
				{#if view.samples}<SnapshotChart {section} />{/if}
			</section>
		{/each}
		{#if view.device}
			<section class="device">
				<h4>Device</h4>
				<div class="device-row">
					<span class="name">{view.device.name}</span>
					{#if view.device.version}<span class="version">{view.device.version}</span>{/if}
				</div>
			</section>
		{/if}
	</div>
</div>

<style>
	.when {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 19px 16px 0;
	}
	.when strong {
		font-size: 19px;
		line-height: 22px;
	}
	.when span {
		font-size: 13px;
		color: var(--text-muted);
	}
	.sections {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		row-gap: 38px;
		padding: 38px 0 32px;
	}
	h3 {
		margin: 0 16px;
		font-size: 18px;
		line-height: 22px;
		font-weight: 400;
	}
	.figures {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px 15px;
		margin: 17px 16px 0;
	}
	.figure {
		display: flex;
		flex-direction: column;
		height: 62px;
		box-sizing: border-box;
		padding-top: 8px;
		border-top: 1px solid var(--background-modifier-border);
	}
	.value {
		font-size: 22px;
		line-height: 28px;
	}
	.label {
		font-size: 14px;
		line-height: 18px;
		color: var(--text-muted);
	}
	h4 {
		margin: 0 16px 4px;
		font-size: 13px;
		font-weight: 400;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.device-row {
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-height: 68px;
		padding: 0 16px;
		background: var(--background-secondary);
	}
	.name {
		font-size: 17px;
	}
	.version {
		font-size: 13px;
		color: var(--text-muted);
	}

	@container (min-width: 640px) {
		.sections {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			column-gap: 16px;
		}
	}

	/* The twin's pane: three sections a row, the date under the bar with a rule. */
	@container (min-width: 1000px) {
		.when {
			align-items: flex-start;
			padding: 24px 0 8px 92px;
			border-bottom: 1px solid var(--background-modifier-border);
		}
		.sections {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			padding-top: 32px;
		}
		h3,
		.figures {
			margin-left: 0;
			margin-right: 0;
		}
	}
</style>
