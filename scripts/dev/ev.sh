#!/bin/zsh
# usage: scripts/dev/ev.sh '<js expression>'
# `obsidian eval` with retries. The CLI drops its output now and then, so this
# retries until a "=>" result line appears. Keep expressions idempotent: a try
# whose output was lost may still have run.
OBS=${OBSIDIAN_CLI:-/Applications/Obsidian.app/Contents/MacOS/obsidian}
for _ in {1..10}; do
	out=$("$OBS" eval code="$1" 2>&1)
	if print -r -- "$out" | grep -q '=>'; then print -r -- "$out" | grep -v installer; exit 0; fi
	sleep 0.4
done
print -r -- "NO OUTPUT: $out"
exit 1
