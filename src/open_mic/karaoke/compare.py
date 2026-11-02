#!/usr/bin/env python3
"""Compare singing pitch trackers and create a local synchronized A/B viewer."""

from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

import librosa
import numpy as np


COLORS = {
    "pyin_vocal": "#f6c453",
    "torchcrepe_vocal": "#62d6c5",
    "praat_vocal": "#9c8cff",
    "rmvpe_vocal": "#ff7b72",
    "rmvpe_mix": "#78a9ff",
}


def _midi(frequency: np.ndarray) -> np.ndarray:
    result = np.full(np.asarray(frequency).shape, np.nan, dtype=float)
    valid = np.asarray(frequency) > 0
    result[valid] = librosa.hz_to_midi(np.asarray(frequency)[valid])
    return result


def _rms_strength(audio: np.ndarray, sample_rate: int, frame_rate: int, length: int) -> np.ndarray:
    hop = max(1, round(sample_rate / frame_rate))
    rms = librosa.feature.rms(y=audio, frame_length=2048, hop_length=hop, center=True)[0]
    rms = np.pad(rms, (0, max(0, length - len(rms))))[:length]
    peak = max(float(np.max(rms)), 1e-8)
    relative_db = librosa.amplitude_to_db(np.maximum(rms, 1e-8), ref=peak, top_db=80.0)
    floor_db = -42.0
    scaled = np.clip((relative_db - floor_db) / -floor_db, 0.0, 1.0)
    return scaled ** 1.6


def extract_pyin(audio: np.ndarray, sample_rate: int, frame_rate: int, fmin: float, fmax: float) -> tuple[np.ndarray, np.ndarray]:
    hop = max(1, round(sample_rate / frame_rate))
    f0, voiced, probability = librosa.pyin(
        audio, fmin=fmin, fmax=fmax, sr=sample_rate, frame_length=2048, hop_length=hop
    )
    probability = np.nan_to_num(probability, nan=0.0)
    midi = _midi(np.nan_to_num(f0, nan=0.0))
    midi[(~voiced) | (probability < 0.10)] = np.nan
    return midi, probability


def extract_torchcrepe(audio: np.ndarray, sample_rate: int, frame_rate: int, fmin: float, fmax: float) -> tuple[np.ndarray, np.ndarray]:
    try:
        import torch
        import torchcrepe
    except ImportError as error:
        raise RuntimeError("torchcrepe is required; install requirements.txt") from error
    hop = max(1, round(sample_rate / frame_rate))
    waveform = torch.from_numpy(audio.astype(np.float32)).unsqueeze(0)
    with torch.no_grad():
        frequency, periodicity = torchcrepe.predict(
            waveform,
            sample_rate,
            hop,
            fmin,
            fmax,
            model="full",
            decoder=torchcrepe.decode.viterbi,
            batch_size=512,
            device="cpu",
            return_periodicity=True,
            pad=True,
        )
    frequency = frequency.squeeze(0).cpu().numpy()
    confidence = periodicity.squeeze(0).cpu().numpy()
    midi = _midi(frequency)
    midi[confidence < 0.18] = np.nan
    return midi, confidence


def extract_torchcrepe_ranges(
    audio: np.ndarray,
    sample_rate: int,
    frame_rate: int,
    fmin: float,
    fmax: float,
    ranges: list[tuple[float, float]],
) -> tuple[np.ndarray, np.ndarray]:
    """Run the full CREPE model only around evaluation passages."""
    length = round(len(audio) / sample_rate * frame_rate) + 1
    midi = np.full(length, np.nan)
    confidence = np.zeros(length)
    merged: list[list[float]] = []
    for start, end in sorted((max(0.0, start - 1.0), end + 1.0) for start, end in ranges):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    for start, end in merged:
        sample_start = round(start * sample_rate)
        sample_end = min(len(audio), round(end * sample_rate))
        segment_midi, segment_confidence = extract_torchcrepe(
            audio[sample_start:sample_end], sample_rate, frame_rate, fmin, fmax
        )
        frame_start = round(start * frame_rate)
        frame_end = min(length, frame_start + len(segment_midi))
        midi[frame_start:frame_end] = segment_midi[:frame_end - frame_start]
        confidence[frame_start:frame_end] = segment_confidence[:frame_end - frame_start]
    return midi, confidence


def extract_praat(audio: np.ndarray, sample_rate: int, frame_rate: int, fmin: float, fmax: float) -> tuple[np.ndarray, np.ndarray]:
    try:
        import parselmouth
    except ImportError as error:
        raise RuntimeError("praat-parselmouth is required; install requirements.txt") from error
    sound = parselmouth.Sound(audio, sampling_frequency=sample_rate)
    pitch = sound.to_pitch_ac(
        time_step=1.0 / frame_rate,
        pitch_floor=fmin,
        pitch_ceiling=fmax,
        very_accurate=True,
    )
    length = round(len(audio) / sample_rate * frame_rate) + 1
    frequency = np.array([
        pitch.get_value_at_time(index / frame_rate) for index in range(length)
    ])
    frequency = np.nan_to_num(frequency, nan=0.0)
    midi = _midi(frequency)
    confidence = np.where(frequency > 0, 1.0, 0.0)
    return midi, confidence


def run_rmvpe(
    audio_path: Path,
    output_csv: Path,
    *,
    repository: Path,
    model: Path,
) -> tuple[np.ndarray, np.ndarray]:
    repository = repository.resolve()
    model = model.resolve()
    if not (repository / "main.py").is_file():
        raise FileNotFoundError(f"RMVPE main.py not found under {repository}")
    if not model.is_file():
        raise FileNotFoundError(f"RMVPE model not found: {model}")
    if not output_csv.is_file():
        subprocess.run(
            [
                sys.executable,
                str(repository / "main.py"),
                "--model",
                str(model),
                "--input",
                str(audio_path.resolve()),
                "--output",
                str(output_csv.resolve()),
                "--device",
                "cpu",
                "--hop_length",
                "160",
                "--threhold",
                "0.03",
            ],
            cwd=repository,
            check=True,
        )
    values = np.loadtxt(output_csv, delimiter=",")
    frequency = values[:, 1]
    return _midi(frequency), np.where(frequency > 0, 1.0, 0.0)


def align(values: np.ndarray, length: int) -> np.ndarray:
    return np.pad(np.asarray(values, dtype=float), (0, max(0, length - len(values))), constant_values=np.nan)[:length]


def cached_track(path: Path, extractor) -> tuple[np.ndarray, np.ndarray]:
    if path.is_file():
        saved = np.load(path)
        return saved["midi"], saved["confidence"]
    midi, confidence = extractor()
    np.savez_compressed(path, midi=midi, confidence=confidence)
    return midi, confidence


def serialize_track(midi: np.ndarray, confidence: np.ndarray, frame_rate: int) -> list[dict]:
    confidence = np.pad(confidence, (0, max(0, len(midi) - len(confidence))))[:len(midi)]
    return [
        {
            "time": round(index / frame_rate, 3),
            "midi": None if math.isnan(value) else round(float(value), 3),
            "confidence": round(float(confidence[index]), 3),
            "voiced": not math.isnan(value),
        }
        for index, value in enumerate(midi)
    ]


def disagreement(midi_tracks: dict[str, np.ndarray], frame_rate: int, threshold_cents: float = 70.0) -> list[dict]:
    length = max(map(len, midi_tracks.values()))
    result = []
    for index in range(length):
        values = [track[index] for track in midi_tracks.values() if index < len(track) and not np.isnan(track[index])]
        spread = (max(values) - min(values)) * 100.0 if len(values) >= 2 else 0.0
        if spread >= threshold_cents:
            result.append({"time": round(index / frame_rate, 3), "spreadCents": round(spread, 1)})
    return result


VIEWER_HTML = r'''<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Singing pitch tracker comparison</title>
<style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#0d0f16;color:#f5f3ed}*{box-sizing:border-box}
body{margin:0;padding:24px;background:radial-gradient(circle at 20% 0,#20253a,#0d0f16 45%)}main{max-width:1280px;margin:auto}
h1{font-size:clamp(28px,4vw,52px);margin:0 0 8px}.sub{color:#aeb5c8;margin:0 0 20px}.panel{background:#151925;border:1px solid #2a3041;border-radius:18px;padding:18px;margin:14px 0;box-shadow:0 16px 40px #0005}
.controls,.tracks,.sources{display:flex;gap:10px;flex-wrap:wrap;align-items:center}button,label{border:1px solid #343b50;background:#1e2433;color:inherit;padding:9px 12px;border-radius:999px;cursor:pointer}button.active,label:has(input:checked){background:#343b50;border-color:#7f8bb2}input[type=checkbox]{accent-color:#f6c453}
canvas{width:100%;height:520px;display:block;border-radius:12px;background:#10131c}.time{font-variant-numeric:tabular-nums;color:#cbd1df;min-width:95px}input[type=range]{flex:1;min-width:220px}
.cues{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.cue{text-align:left;border-radius:12px}.cue strong,.cue span{display:block}.cue span{color:#aeb5c8;font-size:12px;margin-top:4px}
.legend{font-size:13px;color:#aeb5c8}.warn{color:#ff918a}.playhead{color:#f6c453}</style>
<main><h1>Which tracker hears the phrase?</h1><p class="sub">Local evaluation only · raw synchronized F0 · red bands mark ≥70¢ disagreement.</p>
<section class="panel"><div class="sources"><button id="vocalSource" class="active">Isolated vocal</button><button id="mixSource">Original mix</button><button id="play">▶ Play</button><span class="time" id="clock">0:00.00</span><input id="seek" type="range" min="0" value="0" step="0.01"></div></section>
<section class="panel"><div class="tracks" id="trackControls"></div><p class="legend">Line position is pitch. Opacity is tracker confidence. Gold vertical line is playback time.</p><canvas id="chart"></canvas></section>
<section class="panel"><h2>Coach passages</h2><div class="cues" id="cues"></div></section>
<audio id="audio" preload="metadata"></audio></main>
<script>
const state={data:null,time:0,window:8};const audio=document.querySelector('#audio'),canvas=document.querySelector('#chart'),ctx=canvas.getContext('2d');
const $=s=>document.querySelector(s);function fmt(t){return `${Math.floor(t/60)}:${(t%60).toFixed(2).padStart(5,'0')}`}
function source(kind){audio.src=kind==='mix'?'audio-original.mp3':'audio-vocal.mp3';$('#vocalSource').classList.toggle('active',kind==='vocal');$('#mixSource').classList.toggle('active',kind==='mix');audio.currentTime=state.time}
function resize(){const d=devicePixelRatio||1,box=canvas.getBoundingClientRect();canvas.width=box.width*d;canvas.height=box.height*d;ctx.setTransform(d,0,0,d,0,0);draw()}
function draw(){if(!state.data)return;const w=canvas.clientWidth,h=canvas.clientHeight,t=audio.paused?state.time:audio.currentTime,start=Math.max(0,t-state.window*.3),end=start+state.window;
ctx.clearRect(0,0,w,h);ctx.fillStyle='#10131c';ctx.fillRect(0,0,w,h);for(let note=40;note<=76;note++){const y=h-(note-40)/36*h;ctx.strokeStyle=note%12===0?'#3c455d':'#242a39';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();if(note%12===0){ctx.fillStyle='#8690a8';ctx.fillText(['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'][note%12]+(Math.floor(note/12)-1),5,y-4)}}
const disagreements=state.data.disagreements.filter(x=>x.time>=start&&x.time<=end);ctx.fillStyle='#ff5b5730';for(const d of disagreements){const x=(d.time-start)/(end-start)*w;ctx.fillRect(x-2,0,4,h)}
for(const [id,track] of Object.entries(state.data.tracks)){const input=document.querySelector(`[data-track="${id}"]`);if(!input?.checked)continue;ctx.strokeStyle=state.data.trackInfo[id].color;ctx.lineWidth=2.4;let previous=null;for(const f of track){if(f.time<start||f.time>end||!f.voiced){previous=null;continue}const point={x:(f.time-start)/(end-start)*w,y:h-(f.midi-40)/36*h,confidence:f.confidence};if(previous){ctx.globalAlpha=.28+.72*Math.min(previous.confidence,point.confidence);ctx.beginPath();ctx.moveTo(previous.x,previous.y);ctx.lineTo(point.x,point.y);ctx.stroke()}previous=point}ctx.globalAlpha=1}
const px=(t-start)/(end-start)*w;ctx.strokeStyle='#f6c453';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,h);ctx.stroke();$('#clock').textContent=fmt(t)}
fetch('comparison.json').then(r=>r.json()).then(data=>{state.data=data;$('#seek').max=data.duration;$('#seek').value=0;for(const [id,info] of Object.entries(data.trackInfo)){const label=document.createElement('label');label.innerHTML=`<input type="checkbox" checked data-track="${id}"><span style="color:${info.color}">●</span> ${info.label}`;label.onchange=draw;$('#trackControls').append(label)}for(const cue of data.cues){const b=document.createElement('button');b.className='cue';b.innerHTML=`<strong>${cue.fragment}</strong><span>${fmt(cue.start)}–${fmt(cue.end)}</span>`;b.onclick=()=>{state.time=Math.max(0,cue.start-1);audio.currentTime=state.time;$('#seek').value=state.time;draw()};$('#cues').append(b)}source('vocal');resize()});
$('#vocalSource').onclick=()=>source('vocal');$('#mixSource').onclick=()=>source('mix');$('#play').onclick=()=>audio.paused?audio.play():audio.pause();audio.onplay=()=>$('#play').textContent='❚❚ Pause';audio.onpause=()=>$('#play').textContent='▶ Play';audio.ontimeupdate=()=>{if(!audio.paused){state.time=audio.currentTime;$('#seek').value=state.time;draw()}};$('#seek').oninput=e=>{state.time=+e.target.value;audio.currentTime=state.time;draw()};addEventListener('resize',resize);
</script></html>'''


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vocal", required=True, type=Path, help="Isolated lead-vocal audio")
    parser.add_argument("--mix", required=True, type=Path, help="Original full mix")
    parser.add_argument("--song-id", required=True)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--cues", type=Path, help="Optional Song Lab cues.json")
    parser.add_argument("--frame-rate", type=int, default=100)
    parser.add_argument("--minimum-note", default="E2")
    parser.add_argument("--maximum-note", default="C5")
    parser.add_argument("--rmvpe-repo", type=Path)
    parser.add_argument("--rmvpe-model", type=Path)
    parser.add_argument("--skip-rmvpe", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    for path in (args.vocal, args.mix):
        if not path.is_file():
            raise FileNotFoundError(path)
    output = args.output_dir or Path("workspace") / "karaoke" / args.song_id / "comparison"
    output.mkdir(parents=True, exist_ok=True)
    frame_rate = args.frame_rate
    fmin = float(librosa.note_to_hz(args.minimum_note))
    fmax = float(librosa.note_to_hz(args.maximum_note))
    vocal, sample_rate = librosa.load(args.vocal, sr=16000, mono=True)
    duration = len(vocal) / sample_rate
    target_length = round(duration * frame_rate) + 1
    cues = []
    if args.cues and args.cues.is_file():
        cue_data = json.loads(args.cues.read_text())
        cues = cue_data.get("cues", cue_data) if isinstance(cue_data, dict) else cue_data
    tracks: dict[str, tuple[np.ndarray, np.ndarray]] = {}
    print("Extracting pYIN…", flush=True)
    tracks["pyin_vocal"] = cached_track(
        output / "pyin-vocal.npz",
        lambda: extract_pyin(vocal, sample_rate, frame_rate, fmin, fmax),
    )
    print("Extracting torchcrepe full + Viterbi around coach passages…", flush=True)
    ranges = [(float(cue["start"]), float(cue["end"])) for cue in cues] or [(0.0, duration)]
    tracks["torchcrepe_vocal"] = cached_track(
        output / "torchcrepe-vocal.npz",
        lambda: extract_torchcrepe_ranges(vocal, sample_rate, frame_rate, fmin, fmax, ranges),
    )
    print("Extracting Praat autocorrelation…", flush=True)
    tracks["praat_vocal"] = cached_track(
        output / "praat-vocal.npz",
        lambda: extract_praat(vocal, sample_rate, frame_rate, fmin, fmax),
    )
    if not args.skip_rmvpe:
        if not args.rmvpe_repo or not args.rmvpe_model:
            raise ValueError("Provide --rmvpe-repo and --rmvpe-model, or use --skip-rmvpe")
        print("Extracting RMVPE from isolated vocal…", flush=True)
        tracks["rmvpe_vocal"] = run_rmvpe(
            args.vocal, output / "rmvpe-vocal.csv", repository=args.rmvpe_repo, model=args.rmvpe_model
        )
        print("Extracting RMVPE from original mix…", flush=True)
        tracks["rmvpe_mix"] = run_rmvpe(
            args.mix, output / "rmvpe-mix.csv", repository=args.rmvpe_repo, model=args.rmvpe_model
        )
    aligned = {
        name: (
            align(midi, target_length),
            np.nan_to_num(align(confidence, target_length), nan=0.0),
        )
        for name, (midi, confidence) in tracks.items()
    }
    strength = _rms_strength(vocal, sample_rate, frame_rate, target_length)
    payload = {
        "songId": args.song_id,
        "duration": round(duration, 3),
        "frameRate": frame_rate,
        "trackInfo": {
            name: {
                "label": (
                    "torchcrepe full · coach passages" if name == "torchcrepe_vocal"
                    else name.replace("_", " · ")
                ),
                "color": COLORS[name],
            }
            for name in aligned
        },
        "tracks": {name: serialize_track(midi, confidence, frame_rate) for name, (midi, confidence) in aligned.items()},
        "strength": [round(float(value), 3) for value in strength],
        "disagreements": disagreement(
            {name: value[0] for name, value in aligned.items() if not name.endswith("_mix")},
            frame_rate,
        ),
        "cues": cues,
    }
    (output / "comparison.json").write_text(json.dumps(payload, separators=(",", ":")))
    (output / "index.html").write_text(VIEWER_HTML)
    for source, name in ((args.vocal, "audio-vocal.mp3"), (args.mix, "audio-original.mp3")):
        destination = output / name
        if destination.exists() or destination.is_symlink():
            destination.unlink()
        try:
            destination.symlink_to(source.resolve())
        except OSError:
            shutil.copy2(source, destination)
    print(f"Comparison viewer: {output / 'index.html'}")
    print(f"Serve locally: python -m http.server --directory {output}")


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, RuntimeError, ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"Error: {error}") from error
