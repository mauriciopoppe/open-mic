#!/usr/bin/env python3
"""Compare vocal separators using identical pYIN and RMVPE pitch analysis."""

from __future__ import annotations

import argparse
import json
import math
import shutil
from pathlib import Path

import librosa
import numpy as np

from open_mic.karaoke.compare import _rms_strength, align, extract_pyin, run_rmvpe


COLORS = {"demucs": "#f6c453", "mdx23c": "#ff7897", "combined": "#69e6ff"}


VIEWER = r'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vocal separator pitch comparison</title><style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#0c0f17;color:#f7f3e8}*{box-sizing:border-box}body{margin:0;padding:24px;background:radial-gradient(circle at 15% 0,#202944,#0c0f17 46%)}main{max-width:1320px;margin:auto}h1{font-size:clamp(28px,4vw,50px);margin:0}.sub{color:#acb5ca}.panel{background:#141925;border:1px solid #2c3448;border-radius:18px;padding:16px;margin:14px 0}.controls,.toggles,.cues{display:flex;gap:9px;flex-wrap:wrap;align-items:center}button,label{background:#1c2332;border:1px solid #354057;border-radius:999px;color:inherit;padding:9px 12px;cursor:pointer}label:has(input:checked),button.active{background:#303a51}input[type=range]{flex:1;min-width:220px}canvas{display:block;width:100%;height:560px;border-radius:12px;background:#0e121b}.time{font-variant-numeric:tabular-nums;min-width:90px}.key{font-size:13px;color:#aab4ca}.key b{color:#f4f1e8}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-top:12px}.stat{padding:10px;border-radius:10px;background:#10151f;color:#b9c1d1}.stat strong{display:block;color:#fff}.cue{text-align:left;border-radius:12px}.cue small{display:block;color:#aab4ca}</style>
<main><h1>MDX23C + Demucs vocal evidence</h1><p class="sub">The combined contour starts with cleaner MDX23C evidence, then uses Demucs only to confirm or safely restore short details.</p>
<section class="panel"><div class="controls"><button id="play">▶ Play</button><span id="clock" class="time">0:00.00</span><input id="seek" type="range" min="0" step=".01"><label>Window <select id="window"><option>6</option><option selected>10</option><option>16</option></select>s</label></div></section>
<section class="panel"><div id="toggles" class="toggles"></div><p class="key"><b>Thick solid</b> = pYIN structure · <b>fine translucent</b> = RMVPE detail · vertical gold = playback</p><canvas id="chart"></canvas><div id="stats" class="stats"></div></section>
<section class="panel"><h2>Evaluation passages</h2><div id="cues" class="cues"></div></section><audio id="audio" preload="metadata"></audio></main>
<script>const $=s=>document.querySelector(s),audio=$('#audio'),canvas=$('#chart'),ctx=canvas.getContext('2d'),state={data:null,time:0};
function fmt(t){return `${Math.floor(t/60)}:${(t%60).toFixed(2).padStart(5,'0')}`}function resize(){let d=devicePixelRatio||1,b=canvas.getBoundingClientRect();canvas.width=b.width*d;canvas.height=b.height*d;ctx.setTransform(d,0,0,d,0,0);draw()}
function path(frames,start,end,w,h,color,width,alpha){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.globalAlpha=alpha;ctx.lineJoin='round';ctx.lineCap='round';let prev=null;for(const f of frames){if(f.time<start)continue;if(f.time>end)break;if(!f.voiced){prev=null;continue}let p={x:(f.time-start)/(end-start)*w,y:h-(f.midi-38)/42*h};if(prev&&f.time-prev.time<.055){ctx.beginPath();ctx.moveTo(prev.x,prev.y);ctx.lineTo(p.x,p.y);ctx.stroke()}prev={...p,time:f.time}}ctx.globalAlpha=1}
function draw(){if(!state.data)return;let w=canvas.clientWidth,h=canvas.clientHeight,t=audio.paused?state.time:audio.currentTime,span=+$ ('#window').value,start=Math.max(0,t-span*.28),end=start+span;ctx.fillStyle='#0e121b';ctx.fillRect(0,0,w,h);for(let n=38;n<=80;n++){let y=h-(n-38)/42*h;ctx.strokeStyle=n%12===0?'#3b465e':'#222938';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}for(const [id,item] of Object.entries(state.data.separators)){if(!document.querySelector(`[data-id="${id}"]`).checked)continue;path(item.rmvpe,start,end,w,h,item.color,1,.48);path(item.pyin,start,end,w,h,item.color,3,1)}let x=(t-start)/(end-start)*w;ctx.strokeStyle='#f6c453';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();$('#clock').textContent=fmt(t)}
fetch('comparison.json').then(r=>r.json()).then(d=>{state.data=d;audio.src='audio-original.mp3';$('#seek').max=d.duration;for(const [id,v] of Object.entries(d.separators)){let l=document.createElement('label');l.innerHTML=`<input type="checkbox" ${v.default?'checked':''} data-id="${id}"><span style="color:${v.color}">●</span> ${v.label}`;l.onchange=draw;$('#toggles').append(l);let s=document.createElement('div');s.className='stat';s.innerHTML=`<strong style="color:${v.color}">${v.label}</strong>pYIN voiced ${v.stats.pyinVoiced}% · RMVPE voiced ${v.stats.rmvpeVoiced}%`;$('#stats').append(s)}for(const c of d.cues){let b=document.createElement('button');b.className='cue';b.innerHTML=`${c.label}<small>${fmt(c.start)}–${fmt(c.end)}</small>`;b.onclick=()=>{state.time=c.start;audio.currentTime=c.start;$('#seek').value=c.start;draw()};$('#cues').append(b)}resize()});
$('#play').onclick=()=>audio.paused?audio.play():audio.pause();audio.onplay=()=>$('#play').textContent='❚❚ Pause';audio.onpause=()=>$('#play').textContent='▶ Play';audio.ontimeupdate=()=>{state.time=audio.currentTime;$('#seek').value=state.time;draw()};$('#seek').oninput=e=>{state.time=+e.target.value;audio.currentTime=state.time;draw()};$('#window').onchange=draw;addEventListener('resize',resize);</script></html>'''


def frames(midi: np.ndarray, confidence: np.ndarray, rate: int) -> list[dict]:
    confidence = np.pad(confidence, (0, max(0, len(midi) - len(confidence))))[: len(midi)]
    return [{"time": round(i/rate,3), "midi": None if math.isnan(v) else round(float(v),3), "confidence": round(float(confidence[i]),3), "voiced": not math.isnan(v)} for i,v in enumerate(midi)]


def fuse(primary: np.ndarray, secondary: np.ndarray, confidence: np.ndarray, *, maximum_gap: int = 8) -> tuple[np.ndarray, np.ndarray]:
    """Keep MDX as truth and use Demucs only for pitch-consistent brief gaps."""
    secondary = align(secondary, len(primary))
    confidence = np.nan_to_num(align(confidence, len(primary)), nan=0.0)
    output = primary.copy()
    output_confidence = confidence.copy()
    both = ~np.isnan(primary) & ~np.isnan(secondary)
    agree = both & (np.abs(primary - secondary) <= 0.7)
    output[agree] = primary[agree] * 0.75 + secondary[agree] * 0.25
    missing = np.isnan(primary) & ~np.isnan(secondary)
    index = 0
    while index < len(output):
        if not missing[index]:
            index += 1
            continue
        end = index
        while end < len(output) and missing[end]:
            end += 1
        left, right = index - 1, end
        if end - index <= maximum_gap and left >= 0 and right < len(output) and not np.isnan(primary[left]) and not np.isnan(primary[right]):
            expected = np.linspace(primary[left], primary[right], end - index + 2)[1:-1]
            candidate = secondary[index:end]
            safe = np.abs(candidate - expected) <= 0.9
            output[index:end][safe] = candidate[safe]
            output_confidence[index:end][safe] = 0.65
        index = end
    return output, output_confidence


def parse_args() -> argparse.Namespace:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--stem", action="append", required=True, metavar="NAME=PATH")
    p.add_argument("--mix", required=True, type=Path)
    p.add_argument("--output-dir", required=True, type=Path)
    p.add_argument("--rmvpe-repo", required=True, type=Path)
    p.add_argument("--rmvpe-model", required=True, type=Path)
    p.add_argument("--frame-rate", type=int, default=100)
    return p.parse_args()


def main() -> None:
    a=parse_args(); stems={}
    for spec in a.stem:
        name,sep,path=spec.partition("=")
        if not sep or name not in {"demucs", "mdx23c"}: raise ValueError("Stem must be demucs=PATH or mdx23c=PATH")
        stems[name]=Path(path)
    for p in [a.mix,*stems.values()]:
        if not p.is_file(): raise FileNotFoundError(p)
    a.output_dir.mkdir(parents=True,exist_ok=True); rate=a.frame_rate; result={}; raw={}; duration=0.0; primary_strength=None
    for name,path in stems.items():
        print(f"Analyzing {name}: pYIN",flush=True); y,sr=librosa.load(path,sr=16000,mono=True); duration=max(duration,len(y)/sr); length=round(len(y)/sr*rate)+1
        if name == "mdx23c":
            primary_strength = _rms_strength(y, sr, rate, length)
        cache=a.output_dir/f"{name}-pyin.npz"
        if cache.is_file(): z=np.load(cache); pyin,pc=z['midi'],z['confidence']
        else: pyin,pc=extract_pyin(y,sr,rate,librosa.note_to_hz('E2'),librosa.note_to_hz('C5')); np.savez_compressed(cache,midi=pyin,confidence=pc)
        print(f"Analyzing {name}: RMVPE",flush=True); rmvpe,rc=run_rmvpe(path,a.output_dir/f"{name}-rmvpe.csv",repository=a.rmvpe_repo,model=a.rmvpe_model)
        pyin=align(pyin,length); pc=np.nan_to_num(align(pc,length),nan=0); rmvpe=align(rmvpe,length); rc=np.nan_to_num(align(rc,length),nan=0)
        raw[name] = {"pyin": (pyin, pc), "rmvpe": (rmvpe, rc)}
        result[name]={"label":{"demucs":"Demucs","mdx23c":"MDX23C"}[name],"color":COLORS[name],"default":False,"pyin":frames(pyin,pc,rate),"rmvpe":frames(rmvpe,rc,rate),"stats":{"pyinVoiced":round(float(np.mean(~np.isnan(pyin))*100),1),"rmvpeVoiced":round(float(np.mean(~np.isnan(rmvpe))*100),1)}}
    if {"demucs", "mdx23c"} <= raw.keys():
        combined = {}
        for tracker in ("pyin", "rmvpe"):
            primary, confidence = raw["mdx23c"][tracker]
            secondary, _ = raw["demucs"][tracker]
            combined[tracker] = fuse(primary, secondary, confidence)
        pyin, pc = combined["pyin"]; rmvpe, rc = combined["rmvpe"]
        result = {"combined": {"label":"Combined · recommended","color":COLORS["combined"],"default":True,"pyin":frames(pyin,pc,rate),"rmvpe":frames(rmvpe,rc,rate),"stats":{"pyinVoiced":round(float(np.mean(~np.isnan(pyin))*100),1),"rmvpeVoiced":round(float(np.mean(~np.isnan(rmvpe))*100),1)}}, **result}
    payload={"duration":round(duration,3),"frameRate":rate,"separators":result,"strength":[round(float(value),3) for value in (primary_strength if primary_strength is not None else np.zeros(round(duration*rate)+1))],"cues":[{"label":"Opening / first verse","start":18,"end":43},{"label":"Sustained phrase","start":66,"end":70},{"label":"Fast run","start":149,"end":155},{"label":"Silence check","start":8,"end":14}]}
    (a.output_dir/'comparison.json').write_text(json.dumps(payload,separators=(',',':')));(a.output_dir/'index.html').write_text(VIEWER)
    dest=a.output_dir/'audio-original.mp3'
    if dest.exists() or dest.is_symlink(): dest.unlink()
    try: dest.symlink_to(a.mix.resolve())
    except OSError: shutil.copy2(a.mix,dest)
    print(f"Viewer: {a.output_dir/'index.html'}")


if __name__=='__main__':
    try: main()
    except (FileNotFoundError,ValueError) as e: raise SystemExit(f"Error: {e}") from e
