<script lang="ts">
	import type { FtpHelpSheet } from "../../../dashboard/ftp-copy";

	/**
	 * What "Learn how to update your … FTP" opens (Inferred: the phone's link
	 * target wasn't captured): the web Help's "How to Get a Measurement", its
	 * heading and paragraph. The title and the close button are the modal's.
	 */
	interface Props {
		sheet: FtpHelpSheet;
		onClose: () => void;
	}

	let { sheet }: Props = $props();
</script>

<div class="ftp-sheet">
	<h3>{sheet.heading}</h3>
	<p>{sheet.body}</p>
</div>

<style>
	/* As the other sheets set their copy: under the modal's header, its end clearing a phone's home indicator. */
	.ftp-sheet {
		box-sizing: border-box;
		padding: 8px 16px calc(25px + var(--safe-area-inset-bottom, 0px));
		background: var(--background-primary);
		color: var(--text-normal);
	}
	h3 {
		margin: 0;
		font-size: 17px;
		line-height: 22px;
		font-weight: 700;
	}
	p {
		margin: 8px 0 0;
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
	}
</style>
