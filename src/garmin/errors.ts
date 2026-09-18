/**
 * Typed failures. The distinction that matters most is Blocked vs Auth: the
 * phase 0 probe showed Garmin's edge can refuse a request outright, and burying
 * that under a generic "sync failed" would send users hunting for a password
 * problem they do not have.
 */

export class GarminError extends Error {
	constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}
}

/** Bad credentials, or a session that can no longer be refreshed. */
export class GarminAuthError extends GarminError {}

/** Garmin's edge refused the client (bot challenge), not the credentials. */
export class GarminBlockedError extends GarminError {
	readonly status: number;
	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}

/** HTTP 429. Back off; do not retry in a loop. */
export class GarminRateLimitError extends GarminError {
	/** Seconds, from the Retry-After header when Garmin sends one. */
	readonly retryAfter?: number;
	constructor(message: string, retryAfter?: number) {
		super(message);
		this.retryAfter = retryAfter;
	}
}

/** A non-2xx the API tier returned for an ordinary reason. */
export class GarminApiError extends GarminError {
	readonly status: number;
	readonly body: string;
	constructor(message: string, status: number, body: string) {
		super(message);
		this.status = status;
		this.body = body;
	}
}

/** The request never completed: offline, DNS, TLS. */
export class GarminNetworkError extends GarminError {}

/**
 * Garmin demanded a verification code and the caller passed no way to ask for
 * one. Interactive sign-in hands `login()` a prompt and never sees this; it is
 * the honest answer for a caller that has nobody to ask.
 */
export class GarminMfaRequiredError extends GarminError {
	readonly method: string;
	constructor(method: string) {
		super(`MFA required (method: ${method})`);
		this.method = method;
	}
}

/**
 * The person closed the code prompt. Distinct from a failure so the UI can go
 * quiet instead of reporting a problem the user just chose.
 */
export class GarminMfaCancelledError extends GarminError {
	constructor() {
		super("Sign-in cancelled at the verification code prompt");
	}
}
