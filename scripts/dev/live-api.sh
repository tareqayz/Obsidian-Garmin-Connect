#!/bin/zsh
# usage: scripts/dev/live-api.sh KEY OUT.json GET <path> [query-string]
#        scripts/dev/live-api.sh KEY OUT.json graphql '<query { … }>'
# Calls Garmin through the running plugin's own client (the sync's token and
# paths, no credentials in the shell), writes the response body to OUT.json and
# prints a one-line projection. Read-only by construction: GET, or a GraphQL
# query (mutations are refused). One call at a time across all agents (a lock),
# at most one per second. KEY must be unique per call: a retried eval whose
# output was lost may already have started the request, and the window.__p0
# guard stops a second copy.
set -u
die() { print -u2 "live-api: $1"; exit 2; }
(( $# >= 4 )) || die "usage: live-api.sh KEY OUT.json GET <path> [query] | graphql '<query>'"
KEY=$1; OUT=${2:A}; KIND=$3; ARG=$4; QS=${5:-}
EV=${0:A:h}/ev.sh
[[ $KEY =~ '^[A-Za-z0-9_.:-]+$' ]] || die "KEY may only hold letters, digits and _.:-"
case $KIND in
	GET) [[ $ARG == /* ]] || die "the path must start with /" ;;
	graphql) print -r -- "$ARG" | grep -qiw mutation && die "GraphQL mutations are refused" ;;
	*) die "only GET or graphql" ;;
esac
mkdir -p "${OUT:h}"
LOCK=${TMPDIR:-/tmp}/garmin-live-api.lock
for _ in {1..600}; do mkdir "$LOCK" 2>/dev/null && break; sleep 0.5; done
[[ -d $LOCK ]] || die "lock busy for 5 min: $LOCK"
trap 'rmdir "$LOCK" 2>/dev/null' EXIT
STAMP=${TMPDIR:-/tmp}/garmin-live-api.last
if [[ -e $STAMP ]] && (( $(date +%s) - $(stat -f %m "$STAMP") < 1 )); then sleep 1; fi
touch "$STAMP"
js() { python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"; }
K=$(js "$KEY"); O=$(js "$OUT"); P=$(js "$ARG")
if [[ $KIND == GET ]]; then
	Q=$(python3 -c 'import json,sys,urllib.parse; print(json.dumps(dict(urllib.parse.parse_qsl(sys.argv[1]))))' "$QS")
	CALL="g.request($P, {query: $Q})"
else
	CALL="g.graphql($P)"
fi
START="(()=>{window.__p0=window.__p0||{}; const k=$K; if (window.__p0[k]!==undefined) return 'already: '+String(window.__p0[k]).slice(0,80); window.__p0[k]='pending'; const g=app.plugins.plugins['garmin-connect'].garmin; (async()=>{try{const r=await $CALL; require('fs').writeFileSync($O, JSON.stringify(r)); const d=r==null?'null':Array.isArray(r)?'array['+r.length+']':typeof r==='object'?'{'+Object.keys(r).slice(0,14).join(', ')+'}':typeof r; window.__p0[k]='done '+d;}catch(e){window.__p0[k]='ERR '+(e&&e.message)}})(); return 'started'})()"
"$EV" "$START" | tail -1 >/dev/null
for _ in {1..120}; do
	out=$("$EV" "String(window.__p0[$K])" | tail -1)
	if ! print -r -- "$out" | grep -q pending; then print -r -- "${out#=> }"; [[ $out == *ERR* ]] && exit 1; exit 0; fi
	sleep 0.5
done
print -r -- "timeout: still pending"; exit 1
