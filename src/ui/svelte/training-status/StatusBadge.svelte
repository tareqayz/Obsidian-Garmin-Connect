<script lang="ts">
	/**
	 * Current's badge (twin Status Badge 560:174): a Ø 60 disc in the status's
	 * colour with Garmin's runner-and-bars glyph knocked out in the page's
	 * colour, as Garmin draws it — the vector as the twin exports it. White on
	 * the theme's yellow is unreadable, so the glyph is never `--text-on-accent`.
	 * Only Maintaining's badge was seen: every status has this glyph (Inferred).
	 */
	let { color }: { color: string } = $props();
</script>

<svg class="ts-badge" width="60" height="60" viewBox="0 0 60 60" fill="none" aria-hidden="true">
	<circle cx="30" cy="30" r="30" style:fill={color} />
	<path
		class="glyph"
		d="M23.169 21.158L19.879 25.168L20.499 25.918L24.169 23.078L25.499 23.338L26.819 23.838L23.309 28.508L22.719 29.508L22.749 30.168L23.169 30.638L28.319 34.838L28.219 35.838L25.689 42.838L26.169 43.358L26.639 43.168L29.499 38.778L32.089 34.838L31.969 34.508L28.429 29.838L30.479 27.168L30.829 26.948L34.499 28.968L39.249 24.838L38.829 24.368L38.169 24.118L34.499 26.058L33.829 25.648L29.499 21.748L29.169 21.608L28.169 21.358L23.499 20.928L23.169 21.158ZM22.169 32.028L21.739 32.508L20.499 35.648L14.299 39.838L14.259 40.168L15.169 40.668L15.499 40.708L16.499 40.258L22.499 37.108L24.689 34.508L24.719 34.168L22.169 32.028Z"
	/>
	<path
		class="glyph"
		d="M30.694 19.338C30.694 20.1217 31.0053 20.8733 31.5595 21.4275C32.1137 21.9817 32.8653 22.293 33.649 22.293C34.4327 22.293 35.1843 21.9817 35.7385 21.4275C36.2927 20.8733 36.604 20.1217 36.604 19.338C36.604 18.5543 36.2927 17.8027 35.7385 17.2485C35.1843 16.6943 34.4327 16.383 33.649 16.383C32.8653 16.383 32.1137 16.6943 31.5595 17.2485C31.0053 17.8027 30.694 18.5543 30.694 19.338Z"
	/>
	<path class="glyph" d="M33.999 32.298H36.359V43.668H33.999V32.298ZM38.834 27.668H41.194V43.668H38.834V27.668ZM43.669 21.248H46.029V43.668H43.669V21.248Z" />
</svg>

<style>
	.ts-badge {
		display: block;
		flex: none;
	}
	.glyph {
		fill: var(--background-primary);
	}
</style>
