/**
 * What the core is allowed to know about logging: it narrates a procedure, and
 * something else decides whether that reaches a modal, a file, or nowhere.
 */
export interface Log {
	step(title: string): void;
	detail(key: string, value: unknown): void;
	ok(message: string): void;
	warn(message: string): void;
	fail(message: string): void;
}

/** Default for callers that want no output. */
export const silentLog: Log = {
	step() {},
	detail() {},
	ok() {},
	warn() {},
	fail() {},
};

/**
 * Collects probe output as text meant to be copied, saved and pasted into an
 * issue. Every line is scrubbed on the way in (see `scrub`), and values the
 * probe was told to hide — the display name, the account id — are swapped for
 * placeholders, so a forgotten call site can't leak them.
 */
export class ProbeLog implements Log {
	private lines: string[] = [];
	private onAppend?: () => void;
	private hidden = new Map<string, string>();

	constructor(onAppend?: () => void) {
		this.onAppend = onAppend;
	}

	/** Keeps `value` out of every line from now on, written as `as`. Short values are left alone. */
	hide(value: string | number | null | undefined, as: string): void {
		const text = value === null || value === undefined ? "" : String(value);
		if (text.length >= 3) this.hidden.set(text, as);
	}

	line(text = ""): void {
		let clean = scrub(text);
		for (const [value, as] of this.hidden) clean = clean.split(value).join(as).split(encodeURIComponent(value)).join(as);
		this.lines.push(clean);
		this.onAppend?.();
	}

	step(title: string): void {
		if (this.lines.length) this.line();
		this.line(`── ${title} ${"─".repeat(Math.max(0, 46 - title.length))}`);
	}

	detail(key: string, value: unknown): void {
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

/**
 * What no log line may carry: email addresses (masked to their first three
 * characters), bearer tokens (cut to their start), and IP addresses (masked
 * whole).
 */
export function scrub(text: string): string {
	return text
		.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, (email) => redactEmail(email))
		.replace(/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g, (token) => redactToken(token))
		.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "x.x.x.x")
		.replace(/\b(?:[0-9a-f]{1,4}:){4,7}[0-9a-f]{1,4}\b/gi, "x:x:x:x");
}

/** `someone@example.com` → `som***@example.com` */
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
