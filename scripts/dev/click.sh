#!/bin/zsh
# usage: scripts/dev/click.sh '<JS expression returning an element>'
# Scrolls the element into view and clicks its centre through CDP. A synthetic
# el.click() does not reach Svelte 5 handlers inside Obsidian. Needs
# `obsidian dev:debug on` first (and `dev:debug off` afterwards).
OBS=${OBSIDIAN_CLI:-/Applications/Obsidian.app/Contents/MacOS/obsidian}
EV=${0:A:h}/ev.sh
pos=$("$EV" "(()=>{const e=($1); if(!e) return 'none'; e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return Math.round(r.x+r.width/2)+' '+Math.round(r.y+r.height/2)})()" | tail -1 | sed 's/^=> //')
if [[ $pos == none* || -z $pos ]]; then print "no element"; exit 1; fi
x=${pos%% *}; y=${pos##* }
sleep 0.3
"$OBS" dev:cdp method=Input.dispatchMouseEvent params="{\"type\":\"mousePressed\",\"x\":$x,\"y\":$y,\"button\":\"left\",\"clickCount\":1}" >/dev/null 2>&1
"$OBS" dev:cdp method=Input.dispatchMouseEvent params="{\"type\":\"mouseReleased\",\"x\":$x,\"y\":$y,\"button\":\"left\",\"clickCount\":1}" >/dev/null 2>&1
print "clicked $x,$y"
