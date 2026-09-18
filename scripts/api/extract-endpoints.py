#!/usr/bin/env python3
"""Mine Garmin's endpoint surface out of cyberjunky/python-garminconnect.

That library is the closest thing Garmin Connect has to a specification: it is
kept current against the live API by people who notice when it breaks. Rather
than copying paths by hand, this reads its AST and emits `api/endpoints.json`.

    python3 scripts/api/extract-endpoints.py --source ~/Dev/python-garminconnect
    python3 scripts/api/extract-endpoints.py --check     # CI: is the catalogue stale?

Hand-written keys in the catalogue (`plugin`, `groups`, `check`, `critical`,
`notes`, `schema`) survive a regeneration; the request shape and everything
under `upstream` is overwritten. An endpoint that disappears upstream is kept
and marked `"status": "gone-upstream"` rather than silently dropped — a path
Garmin retired is exactly the news this file exists to carry.

Python 3.9+, standard library only. A development tool: it never runs in the
plugin and never runs in the release build.
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = Path.home() / "Dev" / "python-garminconnect"
DEFAULT_OUT = REPO / "api" / "endpoints.json"

# Calls that actually reach Garmin. `connectwebproxy` goes to the older web
# tier, which the plugin does not use but which is worth cataloguing.
REQUESTERS = {"connectapi", "download", "connectwebproxy"}
CLIENT_VERBS = {"get": "GET", "post": "POST", "put": "PUT", "delete": "DELETE"}
KNOWN_VERBS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"}

# Upstream's parameter names are inconsistent (`cdate`, `fordate`, `startdate`)
# because they accreted over years. The catalogue is read by someone deciding
# what to send, so normalise them to one vocabulary.
ALIASES = {
    "self._require_display_name()": "displayName",
    "date.today()": "today",
    "cdate": "date",
    "fordate": "date",
    "requested_date": "date",
    "current_start.isoformat()": "startDate",
    "chunk_start_str": "startDate",
    "chunk_end.isoformat()": "endDate",
    "chunk_end_str": "endDate",
    "startdate": "startDate",
    "enddate": "endDate",
    "start": "startDate",
    "end": "endDate",
    "month - 1": "monthIndex",
    "_type": "type",
    "normalized_sport": "sport",
    "gearUUID": "gearUuid",
    "userProfileNumber": "userProfileId",
    "defaultGearString": "defaultSuffix",
}

# Plumbing rather than endpoints.
SKIP_METHODS = {"connectapi", "connectwebproxy", "download", "login", "logout", "typed"}

# Read verbs only: `add_weigh_in` stays `add-weigh-in`, because dropping the
# verb there would collide with `delete_weigh_in`.
ID_PREFIX = re.compile(r"^(get|count)_")


def camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(part[:1].upper() + part[1:] for part in rest)


def kebab(name: str) -> str:
    name = re.sub(r"[_\s]+", "-", name)
    name = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "-", name)
    return re.sub(r"-+", "-", name).strip("-").lower()


def placeholder(expr: str) -> str:
    return ALIASES.get(expr) or (camel(expr) if "_" in expr else expr)


def unparse(node: ast.AST) -> str:
    try:
        return ast.unparse(node)
    except Exception:  # pragma: no cover - total on supported Pythons
        return "?"


def segments(path: str) -> list[str]:
    """Literal path segments, placeholders dropped."""
    return [s for s in path.strip("/").split("/") if s and "{" not in s]


class Extractor:
    """Folds the library's URL expressions back into path templates."""

    def __init__(self, source: Path):
        path = source / "garminconnect" / "__init__.py"
        if not path.is_file():
            raise SystemExit(
                f"not a python-garminconnect checkout: {source}\n"
                "pass --source, or set GARMINCONNECT_SRC"
            )
        self.source = source
        self.tree = ast.parse(path.read_text(encoding="utf-8"))
        self.cls = next(
            n for n in self.tree.body if isinstance(n, ast.ClassDef) and n.name == "Garmin"
        )
        self.attrs: dict[str, str] = {}
        self._collect_url_attributes()

    # -- constant folding -------------------------------------------------

    def _collect_url_attributes(self) -> None:
        init = next(
            n for n in self.cls.body if isinstance(n, ast.FunctionDef) and n.name == "__init__"
        )
        for stmt in ast.walk(init):
            if not (isinstance(stmt, ast.Assign) and len(stmt.targets) == 1):
                continue
            target = stmt.targets[0]
            if not (
                isinstance(target, ast.Attribute)
                and isinstance(target.value, ast.Name)
                and target.value.id == "self"
            ):
                continue
            value = self.fold(stmt.value, {})
            if isinstance(value, str) and "/" in value:
                self.attrs[target.attr] = value

    def fold(self, node, env: dict, depth: int = 0) -> str | None:
        """Fold one expression to a single string, or None if it cannot be."""
        if node is None or depth > 8:
            return None
        if isinstance(node, ast.Constant):
            return node.value if isinstance(node.value, str) else None
        if isinstance(node, ast.JoinedStr):
            parts = []
            for piece in node.values:
                if isinstance(piece, ast.Constant):
                    parts.append(str(piece.value))
                elif isinstance(piece, ast.FormattedValue):
                    inner = self.fold(piece.value, env, depth + 1)
                    parts.append(inner if inner is not None else "{%s}" % placeholder(unparse(piece.value)))
            return "".join(parts)
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
            left = self.fold(node.left, env, depth + 1)
            right = self.fold(node.right, env, depth + 1)
            return None if left is None or right is None else left + right
        if (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id == "self"
        ):
            return self.attrs.get(node.attr)
        if isinstance(node, ast.Name):
            value = env.get(node.id)
            return value if isinstance(value, str) else None
        return None

    def fold_labelled(self, node, env: dict) -> list[tuple[str | None, str]]:
        """`(label, path)` pairs — a dict lookup contributes one pair per entry.

        `download_activity` picks its path out of a format→URL dict. Every entry
        is a real endpoint, and the dict key is the best name each one will get.
        """
        single = self.fold(node, env)
        if single is not None:
            return [(None, single)]
        if isinstance(node, ast.Subscript) and isinstance(node.value, ast.Name):
            node = node.value
        if isinstance(node, ast.Name):
            bucket = env.get(node.id)
            if isinstance(bucket, list) and bucket and isinstance(bucket[0], tuple):
                return list(bucket)
        return []

    @staticmethod
    def dict_keys(node, env: dict) -> list[str] | None:
        if isinstance(node, ast.Dict):
            return [
                key.value if isinstance(key, ast.Constant) and isinstance(key.value, str)
                else unparse(key)
                for key in node.keys
            ]
        if isinstance(node, ast.Name):
            value = env.get(node.id)
            if isinstance(value, list) and all(isinstance(v, str) for v in value):
                return value
        return None

    def build_env(self, fn) -> dict:
        """Local name → folded string, or → `(label, path)` list for URL dicts."""
        env: dict = {}
        for stmt in ast.walk(fn):
            if not (
                isinstance(stmt, ast.Assign)
                and len(stmt.targets) == 1
                and isinstance(stmt.targets[0], ast.Name)
            ):
                continue
            name = stmt.targets[0].id
            folded = self.fold(stmt.value, env)
            if folded is not None:
                env[name] = folded
                continue
            if isinstance(stmt.value, ast.Dict):
                pairs = []
                for key, value in zip(stmt.value.keys, stmt.value.values):
                    url = self.fold(value, env)
                    if isinstance(url, str) and url.startswith("/"):
                        pairs.append((unparse(key).split(".")[-1], url))
                env[name] = pairs or self.dict_keys(stmt.value, env) or []
                continue
            # `url = urls[dl_fmt]` — keep every branch of the dict in play.
            if isinstance(stmt.value, ast.Subscript) and isinstance(stmt.value.value, ast.Name):
                bucket = env.get(stmt.value.value.id)
                if isinstance(bucket, list) and bucket and isinstance(bucket[0], tuple):
                    env[name] = bucket
        return env

    # -- call sites -------------------------------------------------------

    def calls_in(self, fn) -> list[dict]:
        env = self.build_env(fn)
        found: list[dict] = []
        for node in ast.walk(fn):
            if isinstance(node, ast.Call):
                found.extend(self._classify(node, env))
        return found

    def _classify(self, node: ast.Call, env: dict) -> list[dict]:
        func = node.func
        if not isinstance(func, ast.Attribute):
            return []
        note = None

        # self.connectapi(url, ...) / self.download(url, ...)
        if isinstance(func.value, ast.Name) and func.value.id == "self":
            if func.attr not in REQUESTERS or not node.args:
                return []
            verb = "GET"
            targets = self.fold_labelled(node.args[0], env)
            tier = "connect" if func.attr == "connectwebproxy" else "connectapi"
            binary = func.attr == "download"

        # self.client.post("connectapi", url, ...) / self.client.request(verb, tier, url, ...)
        elif (
            isinstance(func.value, ast.Attribute)
            and func.value.attr == "client"
            and isinstance(func.value.value, ast.Name)
            and func.value.value.id == "self"
        ):
            if func.attr in CLIENT_VERBS and len(node.args) >= 2:
                verb = CLIENT_VERBS[func.attr]
                tier = self.fold(node.args[0], env) or "connectapi"
                targets = self.fold_labelled(node.args[1], env)
            elif func.attr == "request" and len(node.args) >= 3:
                folded = self.fold(node.args[0], env)
                verb = (folded or "").upper()
                if verb not in KNOWN_VERBS:
                    # `set_gear_default` picks PUT or DELETE from a flag.
                    verb, note = "VARIES", unparse(node.args[0])
                tier = self.fold(node.args[1], env) or "connectapi"
                targets = self.fold_labelled(node.args[2], env)
            else:
                return []
            binary = False
        else:
            return []

        query, body = None, False
        for kw in node.keywords:
            if kw.arg == "params":
                query = self.dict_keys(kw.value, env)
            elif kw.arg == "method":
                folded = (self.fold(kw.value, env) or "").upper()
                verb = folded if folded in KNOWN_VERBS else verb
            elif kw.arg in ("json", "files", "data"):
                body = True

        return [
            {
                "label": label,
                "path": path,
                "method": verb,
                "methodNote": note,
                "tier": tier,
                "query": query or [],
                "hasBody": body,
                "binary": binary,
            }
            for label, path in targets
            if path.startswith("/")
        ]

    # -- the catalogue ----------------------------------------------------

    def endpoints(self) -> list[dict]:
        raw: list[dict] = []
        for fn in self.cls.body:
            if not isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            if fn.name.startswith("_") or fn.name in SKIP_METHODS:
                continue
            calls = self.merge_calls(self.calls_in(fn))
            if not calls:
                continue
            doc = (ast.get_docstring(fn) or "").strip()
            summary = " ".join(doc.split("\n")[0].split())
            args = [a.arg for a in fn.args.args if a.arg != "self"]
            paths = [c["path"] for c in calls]
            for index, call in enumerate(calls):
                raw.append(
                    {
                        "fn": fn.name,
                        "base": kebab(ID_PREFIX.sub("", fn.name)),
                        "suffix": self._suffix(call, paths, index) if len(calls) > 1 else "",
                        "call": call,
                        "upstream": {
                            "method": fn.name,
                            "summary": summary,
                            "args": args,
                            "line": fn.lineno,
                        },
                    }
                )
        return self._assign_ids(raw)

    @staticmethod
    def merge_calls(calls: list[dict]) -> list[dict]:
        """One entry per (path, verb); query keys are unioned across call sites.

        `get_race_predictions` calls the same path twice — once with a date
        range and once without — and both sets of parameters are real.
        """
        merged: dict[tuple, dict] = {}
        for call in calls:
            key = (call["path"], call["method"])
            if key not in merged:
                merged[key] = dict(call)
                continue
            into = merged[key]
            for name in call["query"]:
                if name not in into["query"]:
                    into["query"].append(name)
            into["hasBody"] = into["hasBody"] or call["hasBody"]
        return list(merged.values())

    @staticmethod
    def _suffix(call: dict, paths: list[str], index: int) -> str:
        """Tell apart several endpoints reached from one upstream method."""
        if call["label"]:
            return kebab(call["label"])
        shared = set.intersection(*(set(segments(p)) for p in paths))
        distinct = [s for s in segments(call["path"]) if s not in shared]
        return kebab("-".join(distinct)) if distinct else str(index + 1)

    @staticmethod
    def _trim(suffix: str, base: str) -> str:
        """`lactate-threshold-stats-lactate-threshold-speed-range` reads worse
        than `lactate-threshold-stats-speed-range` and says no more."""
        words = set(base.split("-"))
        kept = [w for w in suffix.split("-") if w not in words]
        return "-".join(kept) or suffix

    @staticmethod
    def _assign_ids(raw: list[dict]) -> list[dict]:
        """Short ids where they are unambiguous, full method names where not."""
        by_base: dict[str, list[dict]] = {}
        for item in raw:
            by_base.setdefault(item["base"], []).append(item)

        out = []
        for base, group in by_base.items():
            # Two different upstream methods want the same short id (`add_weigh_in`
            # and `delete_weigh_in` both want `weigh-in`). Give the whole group
            # its full method name rather than picking a winner.
            collides = len({item["fn"] for item in group}) > 1
            for item in group:
                stem = kebab(item["fn"]) if collides else base
                suffix = Extractor._trim(item["suffix"], stem) if item["suffix"] else ""
                out.append({**item, "id": f"{stem}-{suffix}" if suffix else stem})

        seen: dict[str, int] = {}
        entries = []
        for item in sorted(out, key=lambda i: (i["id"], i["call"]["method"])):
            endpoint_id = item["id"]
            if endpoint_id in seen:  # last resort; nothing currently hits it
                seen[endpoint_id] += 1
                endpoint_id = f"{endpoint_id}-{seen[endpoint_id]}"
            else:
                seen[endpoint_id] = 1
            entries.append(entry(endpoint_id, item))
        return entries


def entry(endpoint_id: str, item: dict) -> dict:
    call = item["call"]
    path = call["path"]
    built = {
        "id": endpoint_id,
        "method": call["method"],
        "path": path,
        "service": path.strip("/").split("/")[0],
        "tier": call["tier"],
        "pathParams": re.findall(r"\{([^}]+)\}", path),
        "query": call["query"],
        "requestBody": call["hasBody"],
        "returns": "binary" if call["binary"] else "json",
        "upstream": item["upstream"],
    }
    if call["methodNote"]:
        built["methodNote"] = f"verb chosen at runtime: {call['methodNote']}"
    return built


# -- merge ----------------------------------------------------------------

# Overwritten on every run. Anything else in an entry is hand-written and kept.
GENERATED_KEYS = {
    "id", "method", "path", "service", "tier",
    "pathParams", "query", "requestBody", "returns", "methodNote", "upstream",
}


def merge(previous: dict, endpoints: list[dict], source: Path) -> dict:
    old = {e["id"]: e for e in previous.get("endpoints", [])}
    merged = []
    for endpoint in endpoints:
        kept = {k: v for k, v in old.get(endpoint["id"], {}).items() if k not in GENERATED_KEYS}
        kept.pop("status", None)
        merged.append({**endpoint, **kept})
    live = {e["id"] for e in endpoints}
    for endpoint_id, existing in old.items():
        if endpoint_id in live:
            continue
        # `social-profile` is reached from a private helper upstream, so the AST
        # walk never sees it. Entries that declare themselves plugin-sourced are
        # hand-maintained and must not be mistaken for a retired path.
        if existing.get("source") == "plugin":
            merged.append(existing)
        else:
            merged.append({**existing, "status": "gone-upstream"})
    merged.sort(key=lambda e: e["id"])
    generated = {
        "by": "scripts/api/extract-endpoints.py",
        "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": describe(source),
    }
    # A regeneration that found nothing new should not show up as a diff, so
    # keep the old timestamp unless something around it actually moved.
    old = previous.get("generated", {})
    if {k: v for k, v in old.items() if k != "at"} == {k: v for k, v in generated.items() if k != "at"}:
        if [e for e in previous.get("endpoints", [])] == merged:
            generated["at"] = old.get("at", generated["at"])
    head = {k: v for k, v in previous.items() if k not in ("generated", "endpoints")}
    return {**{k: head.pop(k) for k in ("about",) if k in head}, "generated": generated, **head, "endpoints": merged}


def describe(source: Path) -> dict:
    def git(*args: str) -> str | None:
        try:
            done = subprocess.run(
                ["git", "-C", str(source), *args], capture_output=True, text=True, check=True
            )
            return done.stdout.strip()
        except Exception:
            return None

    version = None
    pyproject = source / "pyproject.toml"
    if pyproject.is_file():
        match = re.search(r'^version\s*=\s*"([^"]+)"', pyproject.read_text(), re.M)
        version = match.group(1) if match else None
    return {
        "repo": "https://github.com/cyberjunky/python-garminconnect",
        "version": version,
        "commit": git("rev-parse", "HEAD"),
        "committedAt": git("log", "-1", "--format=%cI"),
    }


def report_drift(previous: dict, catalogue: dict) -> int:
    def shape(entries):
        return {
            e["id"]: {k: e.get(k) for k in GENERATED_KEYS if k != "upstream"}
            for e in entries
            if e.get("source") != "plugin"
        }

    before, after = shape(previous.get("endpoints", [])), shape(catalogue["endpoints"])
    if before == after:
        print(f"catalogue is current — {len(after)} endpoints")
        return 0
    for endpoint_id in sorted(set(after) - set(before)):
        print(f"+ {endpoint_id}  {after[endpoint_id]['method']} {after[endpoint_id]['path']}")
    for endpoint_id in sorted(set(before) - set(after)):
        print(f"- {endpoint_id}  {before[endpoint_id]['method']} {before[endpoint_id]['path']}")
    for endpoint_id in sorted(set(before) & set(after)):
        if before[endpoint_id] != after[endpoint_id]:
            print(f"~ {endpoint_id}  {before[endpoint_id]['path']} -> {after[endpoint_id]['path']}")
    print("\nrun: npm run api:extract", file=sys.stderr)
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=None, help="python-garminconnect checkout")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument(
        "--check", action="store_true", help="do not write; exit 1 if the catalogue is stale"
    )
    args = parser.parse_args()

    source = args.source or Path(os.environ.get("GARMINCONNECT_SRC", DEFAULT_SOURCE)).expanduser()
    previous = json.loads(args.out.read_text()) if args.out.is_file() else {}
    catalogue = merge(previous, Extractor(source).endpoints(), source)

    if args.check:
        return report_drift(previous, catalogue)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(catalogue, indent="\t") + "\n")
    print(f"{args.out.relative_to(REPO)} — {len(catalogue['endpoints'])} endpoints")
    return 0


if __name__ == "__main__":
    sys.exit(main())
