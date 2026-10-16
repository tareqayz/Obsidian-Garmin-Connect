import { GarminAuthError, GarminBlockedError, GarminRateLimitError, GarminRefreshError } from "../garmin/errors";
import { NewerDataError } from "./file-health";

/**
 * Errors that make every later request pointless: a 429, Garmin's edge
 * refusing the client (asking on keeps a block in place), a dead session, a
 * session Garmin couldn't refresh just now, or files a newer build of the
 * plugin wrote. One rule for the day sync, the timelines and the activity
 * pages, so none of them carries on where another would stop.
 */
export function isFatal(err: unknown): boolean {
	return (
		err instanceof GarminRateLimitError ||
		err instanceof GarminBlockedError ||
		err instanceof GarminAuthError ||
		err instanceof GarminRefreshError ||
		err instanceof NewerDataError
	);
}
