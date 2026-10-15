<script lang="ts">
	import { untrack } from "svelte";

	/**
	 * The search under the bar: Obsidian's own search input, with its
	 * magnifier and its clear button. What is typed reaches the route 200 ms
	 * after the last key, so the list doesn't redraw on every letter; Enter
	 * sends it at once. 16 px text, so iOS doesn't zoom in on it.
	 */
	interface Props {
		/** The route's search. */
		value: string;
		onSearch: (text: string) => void;
	}

	let { value, onSearch }: Props = $props();

	const PAUSE = 200;

	// svelte-ignore state_referenced_locally
	let text = $state(value);
	let timer: number | undefined;

	// The route moved on its own (Clear All): follow it, unless it is only what's typed, trimmed.
	$effect(() => {
		const next = value;
		untrack(() => {
			if (timer === undefined && text.trim() !== next) text = next;
		});
	});

	// Leaving the page mid-pause drops the pending search.
	$effect(() => () => window.clearTimeout(timer));

	function send() {
		window.clearTimeout(timer);
		timer = undefined;
		onSearch(text);
	}

	function input(e: Event & { currentTarget: HTMLInputElement }) {
		text = e.currentTarget.value;
		window.clearTimeout(timer);
		timer = window.setTimeout(send, PAUSE);
	}

	function key(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (e.key !== "Enter") return;
		send();
		e.currentTarget.blur();
	}

	function clear() {
		text = "";
		send();
	}
</script>

<div class="search-input-container search">
	<input type="search" enterkeyhint="search" spellcheck="false" autocomplete="off" placeholder="Search" value={text} oninput={input} onkeydown={key} />
	<button class="search-input-clear-button" aria-label="Clear search" onclick={clear}></button>
</div>

<style>
	.search {
		--input-height: 36px;
		position: relative;
	}
	.search input {
		height: var(--input-height);
		font-size: 16px;
	}
	/* Obsidian draws the button's cross; the button itself is bare. */
	.search button {
		margin: 0;
		border: none;
		box-shadow: none;
	}
</style>
