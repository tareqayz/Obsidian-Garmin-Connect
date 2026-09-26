<script lang="ts">
	/** A value over its label, the pair every Garmin card is built from. */
	interface Props {
		value: string | number | undefined;
		label: string;
		size?: "s" | "m" | "l";
	}

	let { value, label, size = "m" }: Props = $props();
</script>

<div class="stat {size}">
	<div class="value">{value ?? "—"}</div>
	<div class="label">{label}</div>
</div>

<style>
	.stat {
		min-width: 0;
	}
	.value {
		font-size: 17px;
		line-height: 22px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.l .value {
		font-size: 22px;
		line-height: 26px;
	}
	.s .value {
		font-size: 15px;
		line-height: 20px;
	}
	.label {
		color: var(--text-muted);
		font-size: 13px;
		line-height: 16px;
	}
</style>
