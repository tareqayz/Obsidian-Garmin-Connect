/**
 * Signs in once and writes the refresh token to a file, so the contract check
 * has a session without a password anywhere near it.
 *
 *   npm run api:token                      # prompts for everything
 *   npm run api:token -- --out token.json  # default is .garmin-token.json
 *
 * The file is the credential. It is written 0600, it is gitignored, and neither
 * it nor the password is ever printed. To hand it to CI:
 *
 *   gh secret set GARMIN_TOKENS < .garmin-token.json
 *
 * Garmin may rotate the refresh token when the check uses it, which is what
 * `--save-token` in contract-check.ts and the workflow's write-back step are
 * for. Re-run this whenever CI reports the token was rejected.
 */

import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { FetchHttpClient } from "../../src/fetch-http";
import { GarminClient } from "../../src/garmin/client";
import { MemoryTokenStore } from "../../src/garmin/tokens";

function option(name: string, fallback?: string): string | undefined {
	const index = process.argv.indexOf(`--${name}`);
	return (index >= 0 ? process.argv[index + 1] : undefined) ?? fallback;
}

async function main(): Promise<void> {
	const rl = createInterface({ input: stdin, output: stdout });
	try {
		const email = process.env.GARMIN_EMAIL?.trim() || (await rl.question("Garmin email: "));
		// No masking: node's readline cannot hide input without taking the tty
		// apart, and pretending otherwise would be worse than saying so.
		const password =
			process.env.GARMIN_PASSWORD || (await rl.question("Password (visible as you type): "));

		const store = new MemoryTokenStore();
		const client = new GarminClient({ http: new FetchHttpClient(), store });
		await client.login(email, password, {
			onMfaRequired: async ({ attempt, error }) => {
				if (error) console.error(`  refused: ${error}`);
				const code = await rl.question(`Verification code (attempt ${attempt}): `);
				return code.trim() || null;
			},
		});

		const auth = await store.load();
		if (!auth?.refreshToken) {
			throw new Error("Garmin issued no refresh token — this session cannot be reused");
		}

		const out = option("out", ".garmin-token.json")!;
		writeFileSync(out, `${JSON.stringify(auth, null, "\t")}\n`, { mode: 0o600 });
		console.log(`\n✓ session written to ${out} (DI client ${auth.diClientId})`);
		console.log(`  gh secret set GARMIN_TOKENS < ${out}`);
	} finally {
		rl.close();
	}
}

main().catch((err: unknown) => {
	console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
	process.exit(1);
});
