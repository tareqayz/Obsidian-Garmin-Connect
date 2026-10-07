#!/bin/zsh
# usage: scripts/dev/capture-view.sh KEY 'STACK_JSON' WIDTH ZOOM OUTPREFIX [light|dark] [PREP_JS]
# Opens the Garmin Home view at STACK (a JSON route stack; '' keeps the current
# page), forces .gch-root to WIDTH at ZOOM (402 1 = phone layout, 1190 0.4 =
# wide pane), un-sticks the header and captures the page in slices
# OUTPREFIX-<k>.png. Prints {"tops":[…],"total":…,"visH":…,"dpr":…} for
# `compare.py stitch`. Afterwards it puts back everything it changed: the
# theme classes, .gch-root's width/zoom/margin, sticky headers, the scroll
# position and the page stack you had open. KEY must be unique per capture.
set -u
EV=${0:A:h}/ev.sh
KEY=$1; STACK=$2; W=$3; Z=$4; OUT=${5:A}; THEME=${6:-}; PREP=${7:-}
mkdir -p "${OUT:h}"
JS="(()=>{window.__p0=window.__p0||{}; if(window.__p0['$KEY']!==undefined) return 'already:'+window.__p0['$KEY']; window.__p0['$KEY']='pending';
(async()=>{
 const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
 const leaf=app.workspace.getLeavesOfType('garmin-home')[0]; if(!leaf) throw new Error('no garmin-home view open');
 const v=leaf.view; const before=v.getState(); const wasDark=document.body.classList.contains('theme-dark');
 const setTheme=(dark)=>{document.body.classList.toggle('theme-dark',dark);document.body.classList.toggle('theme-light',!dark);};
 if('$THEME'==='light') setTheme(false); if('$THEME'==='dark') setTheme(true);
 if('$STACK'!=='') { await v.setState({stack: $STACK}, {}); await wait(700); }
 const root=v.contentEl.querySelector('.gch-root'); const saved={w:root.style.width,z:root.style.zoom,m:root.style.margin};
 root.style.width='${W}px'; root.style.zoom='$Z'; root.style.margin='0';
 const sc=v.contentEl; const savedTop=sc.scrollTop; sc.style.scrollBehavior='auto';
 const sticky=[...root.querySelectorAll('.sticky')]; sticky.forEach(e=>e.style.position='static');
 $PREP
 await wait(900);
 const wc=require('electron').remote.getCurrentWebContents(); wc.setBackgroundThrottling(false);
 const rect=sc.getBoundingClientRect(); const z=parseFloat('$Z');
 const visH=Math.floor(rect.height); const total=sc.scrollHeight; const tops=[];
 try {
  for(let k=0; k<20; k++){ const want=Math.min(k*(visH-60), Math.max(0,total-visH)); sc.scrollTop=want; await wait(300); wc.invalidate(); await wait(400);
   const cw=Math.min(rect.width, Math.ceil($W*z)+30);
   const img=await wc.capturePage({x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(cw),height:visH},{stayHidden:true});
   require('fs').writeFileSync('$OUT-'+k+'.png', img.toPNG()); tops.push(sc.scrollTop); if(sc.scrollTop>=total-visH-2) break; }
 } finally {
  sticky.forEach(e=>e.style.position=''); root.style.width=saved.w; root.style.zoom=saved.z; root.style.margin=saved.m;
  if('$STACK'!=='') await v.setState(before, {}); sc.scrollTop=savedTop; setTheme(wasDark);
 }
 window.__p0['$KEY']=JSON.stringify({tops, total, visH, dpr: window.devicePixelRatio});
})().catch(e=>window.__p0['$KEY']='ERR '+e.message); return 'started'})()"
"$EV" "$JS" | tail -1 >/dev/null
for _ in {1..120}; do
	out=$("$EV" "String(window.__p0['$KEY'])" | tail -1)
	if ! print -r -- "$out" | grep -q pending; then print -r -- "${out#=> }"; [[ $out == *ERR* ]] && exit 1; exit 0; fi
	sleep 1
done
print -r -- "timeout"; exit 1
