<script lang="ts">
	import { untrack } from "svelte";
	import { fieldText, typedEnd, type RangeScale } from "../../../../dashboard/all-activities";

	/**
	 * A range section's Minimum and Maximum fields (filters/16–17), with the
	 * scale's placeholders ("0" / "150+", "0m" / "24h+"). A typed value counts
	 * when the field is left or Enter is pressed: 0, or the scale's end and
	 * past it, is no bound; text that isn't a value goes back to what was
	 * there. Distance and ascent bring up the decimal keypad; Time takes
	 * "1h 30m", so it keeps the keyboard. 17 px, so iOS doesn't zoom.
	 */
	interface Props {
		scale: RangeScale;
		min: number | undefined;
		max: number | undefined;
		onChange: (min: number | undefined, max: number | undefined) => void;
		/** Ids for the two captions, which the slider's thumbs are named by. */
		ids: readonly [string, string];
	}

	let { scale, min, max, onChange, ids }: Props = $props();

	const ENDS = ["Minimum", "Maximum"] as const;

	// svelte-ignore state_referenced_locally
	let texts = $state([fieldText(scale, min), fieldText(scale, max)]);
	let editing: number | null = null;

	// The slider moved: show its values, but not over what is being typed.
	$effect(() => {
		const next = [fieldText(scale, min), fieldText(scale, max)];
		untrack(() => {
			texts = texts.map((text, i) => (i === editing ? text : next[i]!));
		});
	});

	function commit(i: number) {
		editing = null;
		const value = typedEnd(scale, i === 0 ? "min" : "max", texts[i]!);
		if (value === null) {
			texts[i] = fieldText(scale, i === 0 ? min : max);
			return;
		}
		texts[i] = fieldText(scale, value);
		if (i === 0) onChange(value, max);
		else onChange(min, value);
	}

	function key(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (e.key === "Enter") e.currentTarget.blur();
	}
</script>

<div class="fields">
	{#each ENDS as end, i (end)}
		<label class="end">
			<span class="caption" id={ids[i]}>{end}</span>
			<input
				type="text"
				inputmode={scale.kind === "time" ? "text" : "decimal"}
				enterkeyhint="done"
				autocomplete="off"
				spellcheck="false"
				placeholder={scale.placeholders[i]}
				bind:value={texts[i]}
				onfocus={() => (editing = i)}
				onchange={() => commit(i)}
				onkeydown={key}
			/>
		</label>
	{/each}
</div>

<style>
	/* Two 181 × 47 fields, 8 apart; their captions above at x 16 and 204. */
	.fields {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
		padding: 0 16px;
	}
	.end {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}
	.caption {
		font-size: 15px;
		line-height: 20px;
		color: var(--text-normal);
	}
	input {
		box-sizing: border-box;
		width: 100%;
		height: 47px;
		padding: 0 8px;
		border-radius: 8px;
		font-size: 17px;
	}
</style>
