import { onDestroy } from "svelte";

/**
 * A token-carrying host on <body> for bits-ui's floating layer.
 *
 * bits-ui portals menus, selects and popovers out to <body> so they cannot be
 * clipped by a scrolling ancestor — which also puts them outside `.gcd-root`,
 * where every --gcd-* variable is defined. Portalling into this host instead
 * keeps the tokens, and keeps `.theme-dark` on <body> matching.
 *
 * Call it at component init and hand the result to <BitsConfig defaultPortalTo>.
 * Deliberately left `position: static`: bits-ui positions its wrapper with
 * `position: absolute`, so a positioned host would move the containing block.
 */
export function portalHost(): HTMLElement {
	const el = document.createElement("div");
	el.className = "gcd-portal";
	document.body.appendChild(el);
	onDestroy(() => el.remove());
	return el;
}
