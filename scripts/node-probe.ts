/**
 * Runs the real auth module outside Obsidian, over `fetch`.
 *
 * Default: step 0 only — no credentials, no login attempt, no rate-limit cost.
 * It exists to prove the Garmin logic is transport-agnostic and to give you a
 * baseline to compare Obsidian's result against.
 *
 *   npm run probe:node
 */
import { CookieJar } from "../src/http";
import { FetchHttpClient } from "../src/fetch-http";
import { ProbeLog } from "../src/log";
import { probeSsoReachability, type AuthContext } from "../src/garmin/auth";

const log = new ProbeLog();
const ctx: AuthContext = {
	http: new FetchHttpClient(),
	jar: new CookieJar(),
	log,
	domain: "garmin.com",
};

log.step("Step 0 — node/fetch baseline");
const reachable = await probeSsoReachability(ctx);
log.line();
log.detail("cookie jar", ctx.jar.size ? ctx.jar.names().join(", ") : "(empty)");
console.log(log.render());
process.exit(reachable ? 0 : 1);
