/** Collects probe output as text that is safe to copy, save, and paste into an issue. */
export class ProbeLog {
	private lines: string[] = [];
	private onAppend?: () => void;

	constructor(onAppend?: () => void) {
		this.onAppend = onAppend;
	}

	line(text = ""): void {
		this.lines.push(text);
		this.onAppend?.();
	}

	section(title: string): void {
		if (this.lines.length) this.line();
		this.line(`── ${title} ${"─".repeat(Math.max(0, 46 - title.length))}`);
	}

	kv(key: string, value: unknown): void {
		this.line(`  ${key.padEnd(22)} ${String(value)}`);
	}

	ok(text: string): void {
		this.line(`  ✓ ${text}`);
	}

	fail(text: string): void {
		this.line(`  ✗ ${text}`);
	}

	warn(text: string): void {
		this.line(`  ! ${text}`);
	}

	render(): string {
		return this.lines.join("\n");
	}
}

/** `tareq.ayz@gmail.com` → `tar***@gmail.com` */
export function redactEmail(email: string): string {
	const at = email.indexOf("@");
	if (at <= 0) return "***";
	return `${email.slice(0, Math.min(3, at))}***${email.slice(at)}`;
}

/** Keep enough of a token to correlate across runs, not enough to use it. */
export function redactToken(token: string | undefined | null): string {
	if (!token) return "(none)";
	return `${token.slice(0, 10)}… (${token.length} chars)`;
}

/** Trim a response body for the log, collapsing whitespace. */
export function snippet(text: string, max = 220): string {
	const flat = text.replace(/\s+/g, " ").trim();
	return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
