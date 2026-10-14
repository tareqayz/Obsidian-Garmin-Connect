<script lang="ts">
	import { formatBytes, formatDuration } from "../../sync/estimate";
	import type { UpdateLine } from "../setup-flow";

	/**
	 * Plugin-only: asked once after an update that adds data for the history
	 * the vault already holds. Every line starts ticked; Later puts them all
	 * off, to Settings → Data.
	 */
	interface Props {
		lines: UpdateLine[];
		onDownload: (keys: string[], later: string[]) => void;
		onLater: () => void;
	}

	let { lines, onDownload, onLater }: Props = $props();

	// svelte-ignore state_referenced_locally
	let picked = $state<string[]>(lines.map((line) => line.key));
	let chosen = $derived(lines.filter((line) => picked.includes(line.key)));
	let bytes = $derived(chosen.reduce((n, line) => n + line.bytes, 0));
	let seconds = $derived(chosen.reduce((n, line) => n + line.seconds, 0));

	function toggle(key: string, on: boolean) {
		picked = on ? [...new Set([...picked, key])] : picked.filter((k) => k !== key);
	}

	function size(line: UpdateLine): string {
		return line.bytes >= 1_000_000 ? `≈ ${formatBytes(line.bytes)} · ${formatDuration(line.seconds)}` : `≈ ${line.requests.toLocaleString()} requests`;
	}
</script>

<div class="gch-update">
	<div class="intro">This version of Garmin Connect can fill in more of your history.</div>
	<ul>
		{#each lines as line (line.key)}
			<li>
				<label>
					<input type="checkbox" checked={picked.includes(line.key)} onchange={(e) => toggle(line.key, e.currentTarget.checked)} />
					<span class="text">
						<span class="title">{line.title} <span class="muted">— {line.detail}</span></span>
						<span class="meta">{size(line)}</span>
					</span>
				</label>
			</li>
		{/each}
	</ul>
	<div class="total">{chosen.length ? `≈ ${formatBytes(bytes)} · ${formatDuration(seconds)}` : "Nothing picked"}</div>
	<div class="footer">
		<button onclick={onLater}>Later</button>
		<button
			class="mod-cta"
			disabled={!chosen.length}
			onclick={() => onDownload(chosen.map((line) => line.key), lines.filter((line) => !picked.includes(line.key)).map((line) => line.key))}
		>
			Download now
		</button>
	</div>
</div>

<style>
	.gch-update {
		container-type: inline-size;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.intro {
		color: var(--text-muted);
		font-size: var(--font-ui-small);
	}
	ul {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
	}
	li + li {
		border-top: 1px solid var(--background-modifier-border);
	}
	label {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 10px 14px;
		cursor: pointer;
	}
	input {
		margin-top: 3px;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.title {
		font-size: var(--font-ui-small);
		font-weight: 600;
	}
	.muted {
		color: var(--text-muted);
		font-weight: 400;
	}
	.meta {
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
	}
	.total {
		padding: 10px 14px;
		border-radius: var(--radius-m);
		background: var(--background-secondary);
		font-weight: 600;
	}
	.footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	@container (max-width: 480px) {
		.footer {
			flex-direction: column-reverse;
			align-items: stretch;
		}
	}
</style>
