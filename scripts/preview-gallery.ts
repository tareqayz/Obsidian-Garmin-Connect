/**
 * Mounts the component gallery in a plain browser, so the bits-ui prototypes
 * can be poked at without reloading Obsidian.
 *
 *   npm run preview:gallery
 */
import { mount } from "svelte";
import Gallery from "../src/ui/svelte/gallery/Gallery.svelte";

mount(Gallery, {
	target: document.getElementById("app") as HTMLElement,
	props: { today: new Date().toISOString().slice(0, 10), showThemeToggle: true },
});

(window as unknown as { __ready: boolean }).__ready = true;
