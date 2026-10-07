// Run with `scripts/dev/b.sh eval scripts/garmin-web/graphql-hook.js` after the
// Garmin web app has loaded. `$B network --capture` records response bodies but
// not request bodies, so this wraps fetch and XHR to keep each GraphQL
// operation the page sends (name, query, variables) in window.__gcGql. Headers
// are never read. Idempotent: a second run reports the count instead.
(() => {
	if (window.__gcGql) return "already: " + window.__gcGql.length + " operations";
	window.__gcGql = [];
	const isGql = (u) => /graphql/i.test(String(u || ""));
	const path = (u) => String(u).replace(/^https?:\/\/[^/]+/, "");
	const keep = (url, body) => {
		let ops = [];
		try {
			const parsed = typeof body === "string" ? JSON.parse(body) : null;
			ops = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
		} catch (e) {
			window.__gcGql.push({ t: Date.now(), url: path(url), raw: String(body).slice(0, 4000) });
			return;
		}
		for (const op of ops) {
			window.__gcGql.push({
				t: Date.now(),
				url: path(url),
				operationName: op.operationName || null,
				query: op.query || null,
				variables: op.variables || null,
			});
		}
	};
	const nativeFetch = window.fetch;
	window.fetch = function (input, init) {
		try {
			const url = typeof input === "string" || input instanceof URL ? String(input) : input && input.url;
			if (isGql(url)) {
				if (init && typeof init.body === "string") keep(url, init.body);
				else if (input instanceof Request) input.clone().text().then((t) => keep(url, t)).catch(() => {});
			}
		} catch (e) {}
		return nativeFetch.apply(this, arguments);
	};
	const open = XMLHttpRequest.prototype.open;
	const send = XMLHttpRequest.prototype.send;
	XMLHttpRequest.prototype.open = function (method, url) {
		this.__gcUrl = url;
		return open.apply(this, arguments);
	};
	XMLHttpRequest.prototype.send = function (body) {
		try {
			if (isGql(this.__gcUrl)) keep(this.__gcUrl, body);
		} catch (e) {}
		return send.apply(this, arguments);
	};
	return "installed";
})()
