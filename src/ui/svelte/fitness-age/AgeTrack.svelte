<script lang="ts">
	/**
	 * The thin track with two dots: a bold one (the main figure, its label
	 * over it and its value under it) and a small grey one (the comparison).
	 * Fitness Age's hero (Fitness Age / Age) and the BMI sheet's (Avg BMI /
	 * Target). Positions are fractions of the track, from the view model.
	 */
	interface Mark {
		label: string;
		value: string;
		at: number;
	}
	let { main, other }: { main: Mark; other?: Mark } = $props();
</script>

<div class="fa-track">
	<div class="labels">
		<span class="main-label" style:left="{main.at * 100}%">{main.label}</span>
		{#if other}<span class="other-label" style:left="{other.at * 100}%">{other.label}</span>{/if}
	</div>
	<div class="rail">
		<span class="dot main" style:left="{main.at * 100}%"></span>
		{#if other}<span class="dot other" style:left="{other.at * 100}%"></span>{/if}
	</div>
	<div class="values">
		<span class="main-value" style:left="{main.at * 100}%">{main.value}</span>
		{#if other}<span class="other-value" style:left="{other.at * 100}%">{other.value}</span>{/if}
	</div>
</div>

<style>
	.fa-track {
		position: relative;
	}
	.labels,
	.values {
		position: relative;
	}
	.labels {
		height: 24px;
	}
	.values {
		height: 40px;
	}
	.labels span,
	.values span {
		position: absolute;
		transform: translateX(-50%);
		white-space: nowrap;
	}
	.labels span {
		bottom: 2px;
	}
	.main-label {
		font-size: 17px;
		font-weight: 700;
	}
	.other-label {
		font-size: 15px;
		color: var(--text-muted);
	}
	.rail {
		position: relative;
		height: 1px;
		margin: 8px 0;
		background: var(--text-muted);
	}
	.dot {
		position: absolute;
		top: 50%;
		border-radius: 50%;
		transform: translate(-50%, -50%);
	}
	.dot.main {
		width: 9px;
		height: 9px;
		background: var(--text-normal);
	}
	.dot.other {
		width: 6px;
		height: 6px;
		background: var(--text-faint);
	}
	.values span {
		top: 2px;
	}
	.main-value {
		font-size: 34px;
		line-height: 38px;
		font-weight: 700;
	}
	.other-value {
		font-size: 15px;
		line-height: 20px;
	}
</style>
