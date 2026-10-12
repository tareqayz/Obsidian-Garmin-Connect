#!/usr/bin/env node
/**
 * Turns a web capture into an endpoint inventory for one stat.
 *
 *   node scripts/garmin-web/summarize.mjs --export <capture.jsonl> --out <dir>
 *        [--gql <graphql.json>] [--title "<Stat>"] [--since <epoch-ms>] [--requests <network.txt>]
 *
 * --since keeps only responses captured at or after a mark (the capture buffer
 * is never cleared between stats). --requests adds bodiless responses (204,
 * 30x) from `b.sh network` output, which the body capture drops.
 *
 * <capture.jsonl> is `scripts/dev/b.sh network --export` output (one response
 * per line, from `network --capture --filter gc-api`). <graphql.json> is
 * graphql-dump.js output. Writes <dir>/endpoints.md and one sanitised body per
 * distinct endpoint under <dir>/bodies/: response headers are dropped, auth,
 * token and profile URLs are skipped, and the account's display name is
 * replaced by {displayName}. Each endpoint is matched against
 * api/endpoints.json: a catalogue id (with its GarminApi method, or "no
 * wrapper"), or NEW. The most specific path wins (racepredictions/monthly/…
 * over racepredictions/{type}/…). GraphQL POSTs share one path, so each is
 * told apart by its root field (the response's `data` key; the query's first
 * field in the operations list) and matched on the catalogue's `graphql` key.
 *
 * A query parameter sent more than once in one URL is listed once per value
 * (`metric=a&metric=b`); one whose value changed between calls lists the
 * values as `key=a|b`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const opt = (name) => {
	const i = argv.indexOf(`--${name}`);
	return i >= 0 ? argv[i + 1] : undefined;
};
const exportFile = opt("export");
const outDir = opt("out");
if (!exportFile || !outDir) {
	console.error("usage: summarize.mjs --export <capture.jsonl> --out <dir> [--gql <graphql.json>] [--title <Stat>]");
	process.exit(2);
}
const root = fileURLToPath(new URL("../..", import.meta.url));
const catalogue = JSON.parse(readFileSync(join(root, "api/endpoints.json"), "utf8")).endpoints;

// App-shell calls every page makes (preferences, devices, consent, inbox …):
// listed apart from the page's own data so the inventory stays readable.
const SHELL = /userpreference-service|gdprconsent-service|device-service|deviceregistration|info-service|web-gateway\/(inbox|snapshot|device-info)|myfitnesspal|nutrition-service\/user|newsfeed|system-service|trainingplan-service|userprofile-service|activity-service\/activity\/activityTypes|fitnessstats-service\/activity\/availableMetrics|userstats-service\/statistics\/(availability|chartconfig)|activitylist-service\/activities\/list\//i;
const SKIP = /connection-service|oauth|\/token|\/sso\/|socialProfile|personal-information|userprofile-service\/userprofile\/(user-settings|personal)|\/login|\/logout|messaging|notification/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const since = Number(opt("since") ?? 0);
const lines = readFileSync(exportFile, "utf8").split("\n").filter(Boolean);
const responses = lines.map((l) => JSON.parse(l)).filter((r) => !since || (r.timestamp ?? 0) >= since);
// Bodiless responses (204, 30x) only appear in the request log: "GET <url> → 204 (…)".
if (opt("requests")) {
	for (const line of readFileSync(opt("requests"), "utf8").split("\n")) {
		const m = line.match(/^(GET|POST)\s+(\S+)\s+→\s+(\d{3})/);
		if (m && /\/gc-api\//.test(m[2]) && (m[3] === "204" || m[3].startsWith("3"))) {
			responses.push({ url: m[2], status: Number(m[3]), body: "", contentType: "", size: 0, method: m[1] });
		}
	}
}

// The account's display name: a UUID-shaped path segment, or the segment after
// a service that is always keyed by it. Scrubbed from paths and bodies.
const displayNames = new Set();
const KEYED = /\/(?:dailySleepData|dailyHeartRate|usersummary\/daily|fordailysummary|dailyEvents|personalrecord\/prs|pagination)\/([^/?]+)/i;
for (const r of responses) {
	const path = String(r.url).split("?")[0];
	for (const seg of path.split("/")) if (UUID.test(decodeURIComponent(seg))) displayNames.add(decodeURIComponent(seg));
	const m = path.match(KEYED);
	if (m && !DATE.test(m[1]) && !/^\d+$/.test(m[1]) && m[1].length >= 6) displayNames.add(decodeURIComponent(m[1]));
}

// Case-insensitive, and any key ending in "fullName": Garmin writes `fullname`,
// `ownerFullName` and `userProfileFullName` as well as `fullName`.
const PII_KEYS = /^(\w*fullName|firstName|lastName|userName|displayName|email|emailAddress|profileImageUrl\w*|location|birthDate|phoneNumber)$/i;
const redact = (value) => {
	if (Array.isArray(value)) return value.map(redact);
	if (value && typeof value === "object") {
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, PII_KEYS.test(k) && typeof v === "string" ? `{${k}}` : redact(v)]));
	}
	return value;
};
const scrub = (text) => {
	let t = text;
	for (const name of displayNames) t = t.split(name).join("{displayName}");
	return t;
};

function split(url) {
	const u = new URL(url);
	let path = u.pathname.replace(/^\/gc-api/, "").replace(/^\/proxy/, "");
	const query = [...u.searchParams.entries()];
	return { path, query };
}

function template(path) {
	return path
		.split("/")
		.map((seg) => {
			const s = decodeURIComponent(seg);
			if (displayNames.has(s) || UUID.test(s)) return "{displayName}";
			if (DATE.test(s)) return "{date}";
			if (/^\d{6,}$/.test(s)) return "{id}";
			return seg;
		})
		.join("/");
}

const catalogueRegex = catalogue.map((e) => ({
	entry: e,
	re: new RegExp("^" + e.path.split("?")[0].replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{[^}]+\}/g, "[^/]+") + "$"),
	placeholders: (e.path.match(/\{[^}]+\}/g) ?? []).length,
}));

const isGraphql = (path) => /graphql/i.test(path);

/**
 * The fields a GraphQL query selects at its root, aliases resolved to the
 * field: `query{fooScalar(date:"…")}` → fooScalar, `query { a: foo(…) { x } }`
 * → foo. Arguments, strings, nested selections, spreads and directives are
 * skipped.
 */
function rootFields(query) {
	const text = String(query ?? "");
	const fields = [];
	let start = -1; // the root selection set's "{"
	let depth = 0;
	let parens = 0;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (c === '"') {
			for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === "\\") i++;
		} else if (c === "(") parens++;
		else if (c === ")") parens--;
		else if (parens > 0) continue;
		else if (c === "{") {
			if (start < 0) start = i;
			else depth++;
		} else if (c === "}") {
			if (start >= 0 && depth-- === 0) break;
		} else if (start >= 0 && depth === 0 && /[A-Za-z_]/.test(c)) {
			const word = text.slice(i).match(/^(\w+)(?:\s*:\s*(\w+))?/);
			if (!/(?:\.\.\.(?:\s*on)?|@)\s*$/.test(text.slice(start + 1, i))) fields.push(word[2] ?? word[1]);
			i += word[0].length - 1;
		}
	}
	return fields;
}

/** A GraphQL response's root fields: the keys of `data`, read off the start of a truncated body too. */
function responseFields(body) {
	try {
		const data = JSON.parse(body)?.data;
		if (data && typeof data === "object") return Object.keys(data);
	} catch {}
	const head = String(body ?? "").match(/^\s*\{\s*"data"\s*:\s*\{\s*"(\w+)"/);
	return head ? [head[1]] : [];
}

/**
 * The catalogue entry a call belongs to. GraphQL goes by root field (`field`,
 * "" when the response did not say); anything else by path, the most specific
 * first, then one with a wrapper.
 */
function match(path, method = isGraphql(path) ? "POST" : "GET", field = null) {
	if (field !== null) {
		const hit = catalogue.find((e) => e.graphql && e.graphql === field);
		if (hit) return { id: hit.id, plugin: hit.plugin ?? "no wrapper" };
		return { id: field ? "NEW" : "unknown query", plugin: "" };
	}
	const hits = catalogueRegex
		.filter(({ entry, re }) => (entry.method ?? "GET").toUpperCase() === method && re.test(path))
		.sort((a, b) => a.placeholders - b.placeholders || Number(!a.entry.plugin) - Number(!b.entry.plugin));
	if (!hits.length) return { id: "NEW", plugin: "" };
	return { id: hits[0].entry.id, plugin: hits[0].entry.plugin ?? "no wrapper" };
}

function shapeOf(value, depth = 0) {
	if (value === null) return "null";
	if (Array.isArray(value)) return value.length ? `[${value.length}× ${depth > 1 ? "…" : shapeOf(value[0], depth + 1)}]` : "[]";
	if (typeof value === "object") {
		const keys = Object.keys(value);
		if (depth > 1) return `{${keys.length} keys}`;
		return "{" + keys.slice(0, 18).map((k) => `${k}: ${shapeOf(value[k], depth + 1)}`).join(", ") + (keys.length > 18 ? ", …" : "") + "}";
	}
	return typeof value;
}

const groups = new Map();
let skipped = 0;
for (const r of responses) {
	const { path, query } = split(r.url);
	if (SKIP.test(path)) {
		skipped++;
		continue;
	}
	// GraphQL calls all POST to one path: the response's root field tells them apart.
	const field = isGraphql(path) ? responseFields(r.body).join("+") : null;
	const key = template(path) + (field === null ? "" : ` ${field || "?"}`);
	const g = groups.get(key) ?? { key, raw: path, field, method: r.method, queries: new Map(), statuses: new Set(), count: 0, sample: null, sizes: [] };
	g.count++;
	g.statuses.add(r.status);
	g.sizes.push(r.size);
	const inThisCall = new Map();
	for (const [k, v] of query) {
		if (k === "_") continue;
		const value = DATE.test(v) ? "{date}" : /^\d{4}-\d{2}-\d{2}T/.test(v) ? "{timestamp}" : scrub(v);
		const param = g.queries.get(k) ?? { values: [], repeated: false };
		if (!param.values.includes(value)) param.values.push(value);
		inThisCall.set(k, (inThisCall.get(k) ?? 0) + 1);
		if (inThisCall.get(k) > 1) param.repeated = true;
		g.queries.set(k, param);
	}
	if (!g.sample && r.body && /json/i.test(r.contentType || "") && !r.bodyTruncated) {
		try {
			g.sample = JSON.parse(r.body);
		} catch {}
	}
	groups.set(key, g);
}

const gql = opt("gql") ? JSON.parse(readFileSync(opt("gql"), "utf8")) : [];
mkdirSync(join(outDir, "bodies"), { recursive: true });

const rows = [];
const shellRows = [];
let n = 0;
for (const g of [...groups.values()].sort((a, b) => a.key.localeCompare(b.key))) {
	n++;
	const m = match(g.raw, g.method, g.field);
	const slug = g.key.replace(/[{}]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
	let shape = "(no JSON body)";
	if (g.sample !== null) {
		shape = shapeOf(g.sample);
		writeFileSync(join(outDir, "bodies", `${String(n).padStart(2, "0")}-${slug}.json`), scrub(JSON.stringify(redact(g.sample), null, 1)));
	}
	// Sent several times in one URL: each value as its own pair. Changed between calls: a|b.
	const q = [...g.queries.entries()]
		.map(([k, { values, repeated }]) => (repeated ? values.map((v) => `${k}=${v}`).join("&") : `${k}=${values.join("|")}`))
		.join("&");
	const path = g.field === null ? `\`${g.key}\`` : `\`${template(g.raw)}\`<br>\`query{${g.field || "?"}}\``;
	const line = `| ${n} | ${path}${q ? `<br>\`?${q.replace(/\|/g, "\\|")}\`` : ""} | ${[...g.statuses].join(", ")} | ${g.count} | ${m.id} | ${m.plugin || "—"} | ${shape.replace(/\|/g, "\\|").slice(0, 400)} |`;
	(SHELL.test(g.raw) ? shellRows : rows).push(line);
}

// Named by root field, like the calls above. Each query that differs other than
// by its dates is shown once, as first sent.
const ops = new Map();
for (const op of gql) {
	const name = rootFields(op.query).join(" + ") || op.operationName || (op.query ? op.query.trim().split(/\s+/).slice(0, 2).join(" ") : "raw");
	const o = ops.get(name) ?? { name, count: 0, queries: new Map(), variables: new Set() };
	o.count++;
	if (op.query) {
		const text = scrub(op.query.trim());
		const form = text.replace(/\d{4}-\d{2}-\d{2}(?:T[\d:.]+)?/g, "{date}");
		if (!o.queries.has(form)) o.queries.set(form, text);
	}
	for (const k of Object.keys(op.variables || {})) o.variables.add(k);
	ops.set(name, o);
}

const title = opt("title") ?? "Web capture";
const md = [
	`# ${title} — web endpoints`,
	"",
	`Generated by scripts/garmin-web/summarize.mjs from ${lines.length} captured responses (${skipped} auth/profile responses skipped). Bodies: \`bodies/\`.`,
	"",
	"| # | Path (templated) | Status | Calls | Catalogue | GarminApi | Response shape |",
	"|---|---|---|---|---|---|---|",
	...rows,
	"",
	"## GraphQL operations sent",
	"",
	ops.size ? "| Operation | Calls | Variables |\n|---|---|---|" : "None recorded.",
	...[...ops.values()].map((o) => `| ${o.name} | ${o.count} | ${[...o.variables].join(", ") || "—"} |`),
	"",
	...[...ops.values()].filter((o) => o.queries.size).map((o) => `### ${o.name}\n\n${[...o.queries.values()].map((q) => `\`\`\`graphql\n${q}\n\`\`\`\n`).join("\n")}`),
	"",
	"## App-shell calls (every page)",
	"",
	shellRows.length ? "| # | Path (templated) | Status | Calls | Catalogue | GarminApi | Response shape |\n|---|---|---|---|---|---|---|" : "None.",
	...shellRows,
];
writeFileSync(join(outDir, "endpoints.md"), md.join("\n"));
console.log(`${rows.length} page endpoints (${rows.filter((r) => r.includes("| NEW |")).length} NEW), ${shellRows.length} shell, ${ops.size} GraphQL operations → ${join(outDir, "endpoints.md")}`);
