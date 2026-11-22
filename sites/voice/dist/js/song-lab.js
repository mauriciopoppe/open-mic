import { html, useCallback, useEffect, useMemo, useRef, useState } from 'htm/preact';
import { NOTE_NAMES } from './practice-data.js';

const PITCH_VIEW_SECONDS = 12;
const PITCH_TILE_SECONDS = 10;
const MAX_CACHED_TILES = 8;
const RULER_SUBDIVISIONS = 32;
const RULER_TICKS = Array.from({ length: RULER_SUBDIVISIONS + 1 }, (_, i) => i);
const SONG_ASSET_CACHE = new Map();

function releaseSceneTiles(tileMap) {
  for (const tile of tileMap.values()) {
    if (tile?.canvas) {
      tile.canvas.width = 0;
      tile.canvas.height = 0;
    }
  }
  tileMap.clear();
}

const DEFAULT_HERO_DESCRIPTION =
  'Follow the original pitch contour while keeping your coach’s pronunciation and placement cues close at hand.';

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage`, error);
  }
}

function setDomText(el, text) {
  if (!el) return;
  const first = el.firstChild;
  if (first && first.nodeType === 3 && !first.nextSibling) {
    if (first.data !== text) first.data = text;
  } else {
    el.textContent = text;
  }
}

function yieldToMain() {
  if (
    typeof window !== 'undefined' &&
    'scheduler' in window &&
    typeof window.scheduler?.yield === 'function'
  ) {
    return window.scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function parseLrc(text) {
  const lines = [];
  const tagPattern = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  String(text || '')
    .split(/\r?\n/)
    .forEach((rawLine) => {
      const matches = [...rawLine.matchAll(tagPattern)];
      if (!matches.length) return;
      const lyricText = rawLine.replace(tagPattern, '').trim();
      if (!lyricText) return;
      matches.forEach((match) => {
        const minutes = Number(match[1]) || 0;
        const seconds = Number(match[2]) || 0;
        const fracRaw = match[3] || '0';
        const fraction = Number(fracRaw) / Math.pow(10, fracRaw.length);
        lines.push({ time: minutes * 60 + seconds + fraction, text: lyricText });
      });
    });
  lines.sort((a, b) => a.time - b.time);
  return lines;
}

function normalizePhrase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchCuesToLyrics(lines, cues) {
  const map = new Map();
  if (!lines.length || !cues.length) return map;
  cues.forEach((cue) => {
    const frag = normalizePhrase(cue.fragment).split(' ').slice(0, 4).join(' ');
    let bestIdx = -1;
    if (frag.length >= 4) {
      bestIdx = lines.findIndex(
        (line) => Math.abs(line.time - cue.start) <= 10 && normalizePhrase(line.text).includes(frag)
      );
    }
    if (bestIdx < 0) {
      const inWindowIdx = lines.findIndex(
        (line) => line.time >= cue.start - 0.8 && line.time <= cue.end
      );
      if (inWindowIdx >= 0) bestIdx = inWindowIdx;
    }
    if (bestIdx < 0) {
      let bestDiff = Infinity;
      lines.forEach((line, idx) => {
        const diff = Math.abs(line.time - cue.start);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = idx;
        }
      });
    }
    if (bestIdx >= 0) {
      if (!map.has(bestIdx)) map.set(bestIdx, []);
      map.get(bestIdx).push(cue);
    }
  });
  return map;
}

function formatSongTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
}

function formatSongDebugTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(safe / 60)}:${(safe % 60).toFixed(3).padStart(6, '0')}`;
}

function midiName(value) {
  if (value == null) return '—';
  const rounded = Math.round(value);
  return `${NOTE_NAMES[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`;
}

function canvasColor(variable, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback;
}

function LyricsPanel({ lyrics, cues, onSeekLine, controllerRef }) {
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1);
  const [lyricsAutoScroll, setLyricsAutoScrollState] = useState(true);

  const scrollerRef = useRef(null);
  const listRef = useRef(null);
  const stateRef = useRef({
    lines: lyrics,
    activeIndex: -1,
    autoScroll: true,
    programmaticScrollUntil: 0,
  });
  stateRef.current.lines = lyrics;

  const scrollActiveLyricIntoView = useCallback((index, smooth = true) => {
    const scroller = scrollerRef.current;
    const listEl = listRef.current;
    if (!scroller || !listEl || index < 0) return;
    const itemEl = listEl.children[index];
    const activeBtn = itemEl?.firstElementChild;
    if (!activeBtn) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    if (scrollerRect.height <= 0) return;
    const currentScrollTop = scroller.scrollTop;
    const targetTop =
      currentScrollTop +
      (btnRect.top - scrollerRect.top) -
      scrollerRect.height / 2 +
      btnRect.height / 2;
    stateRef.current.programmaticScrollUntil = performance.now() + 550;
    scroller.scrollTo({ top: Math.max(0, targetTop), behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const setLyricsAutoScroll = useCallback(
    (enabled) => {
      const flag = Boolean(enabled);
      stateRef.current.autoScroll = flag;
      setLyricsAutoScrollState(flag);
      if (flag && stateRef.current.activeIndex >= 0) {
        scrollActiveLyricIntoView(stateRef.current.activeIndex, true);
      }
    },
    [scrollActiveLyricIntoView]
  );

  useEffect(() => {
    if (stateRef.current.autoScroll && activeLyricIndex >= 0) {
      scrollActiveLyricIntoView(activeLyricIndex, true);
    }
  }, [activeLyricIndex, scrollActiveLyricIntoView]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    const bypassLyricsAutoScroll = () => {
      const st = stateRef.current;
      if (performance.now() < st.programmaticScrollUntil) return;
      if (st.autoScroll) setLyricsAutoScroll(false);
    };
    scroller.addEventListener('wheel', bypassLyricsAutoScroll, { passive: true });
    scroller.addEventListener('touchmove', bypassLyricsAutoScroll, { passive: true });
    scroller.addEventListener('scroll', bypassLyricsAutoScroll, { passive: true });
    return () => {
      scroller.removeEventListener('wheel', bypassLyricsAutoScroll);
      scroller.removeEventListener('touchmove', bypassLyricsAutoScroll);
      scroller.removeEventListener('scroll', bypassLyricsAutoScroll);
    };
  }, [setLyricsAutoScroll]);

  controllerRef.current = {
    syncTime(time) {
      const st = stateRef.current;
      const lines = st.lines;
      if (!lines.length) return;
      const t = time + 0.08;
      const cur = st.activeIndex;
      if (
        cur >= 0 &&
        cur < lines.length &&
        t >= lines[cur].time &&
        (cur + 1 >= lines.length || t < lines[cur + 1].time)
      ) {
        return;
      }
      if (cur < 0 && t < lines[0].time) {
        return;
      }
      let lo = 0;
      let hi = lines.length - 1;
      let nextIndex = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (t >= lines[mid].time) {
          nextIndex = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (nextIndex === st.activeIndex) return;
      st.activeIndex = nextIndex;
      setActiveLyricIndex(nextIndex);
    },
    reset() {
      const st = stateRef.current;
      st.activeIndex = -1;
      st.autoScroll = true;
      setActiveLyricIndex(-1);
      setLyricsAutoScrollState(true);
      if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
    },
  };

  const handleLineClick = useCallback(
    (lineTime) => {
      setLyricsAutoScroll(true);
      onSeekLine(lineTime);
    },
    [onSeekLine, setLyricsAutoScroll]
  );

  const cueMap = useMemo(() => matchCuesToLyrics(lyrics, cues), [lyrics, cues]);

  return html`
    <section
      class="lyrics-panel"
      id="songLyricsPanel"
      aria-labelledby="songLyricsHeading"
      hidden=${!lyrics.length}
    >
      <div class="lyrics-header">
        <span class="lyrics-header-title" id="songLyricsHeading">
          Synced Lyrics & Coach Notes <span class="lyrics-format-badge">LRC</span>
        </span>
        <button
          class="lyrics-sync-btn"
          id="songLyricsSyncBtn"
          type="button"
          hidden=${lyricsAutoScroll}
          onClick=${() => setLyricsAutoScroll(true)}
        >
          ↻ Sync to playhead
        </button>
      </div>
      <div class="lyrics-scroller-frame">
        <div class="lyrics-scroller" id="songLyricsScroller" ref=${scrollerRef}>
          <ol class="lyrics-list" id="songLyricsList" role="list" ref=${listRef}>
            ${lyrics.map((line, index) => {
              const isActive = index === activeLyricIndex;
              const isPast = activeLyricIndex > index;
              const matchedCues = cueMap.get(index) || [];
              const btnClass = isActive
                ? 'lyrics-line-btn active'
                : isPast
                  ? 'lyrics-line-btn past'
                  : 'lyrics-line-btn';
              return html`
                <li key=${`${index}-${line.time}`}>
                  <button
                    type="button"
                    class=${btnClass}
                    data-lyric-index=${String(index)}
                    aria-current=${isActive ? 'step' : undefined}
                    onClick=${() => handleLineClick(line.time)}
                  >
                    <span class="lyrics-line-main">
                      <span class="lyrics-line-text">${line.text}</span>
                      ${matchedCues.length
                        ? html`
                            <span class="lyrics-line-cue">
                              ${matchedCues.map(
                                (c, cIdx) =>
                                  html`${cIdx > 0 ? ' · ' : ''}<strong>${c.title}:</strong>${' '}${c.text}`
                              )}
                            </span>
                          `
                        : null}
                    </span>
                    <span class="lyrics-line-time">${formatSongTime(line.time)}</span>
                  </button>
                </li>
              `;
            })}
          </ol>
        </div>
      </div>
    </section>
  `;
}

function SongRulerSections({ sections, safeDuration }) {
  const sectionEntries = useMemo(
    () => Object.entries(sections).filter(([id]) => id !== 'full'),
    [sections]
  );
  return html`
    <div class="song-ruler-sections" id="songRulerSections">
      ${sectionEntries.map(([id, section]) => {
        const label = section.label || id;
        return html`
          <button
            key=${id}
            type="button"
            class="song-ruler-section"
            data-song-ruler-section=${id}
            aria-label=${`Toggle loop: ${label}`}
            style=${{
              left: `${(section.start / safeDuration) * 100}%`,
              width: `${((section.end - section.start) / safeDuration) * 100}%`,
            }}
          >
            ${label}
          </button>
        `;
      })}
    </div>
  `;
}

function SongRulerScale({ duration }) {
  return html`
    <div class="song-ruler-scale" id="songRulerScale">
      ${RULER_TICKS.map((idx) => {
        const major = idx % 8 === 0;
        const tickTime = (duration * idx) / RULER_SUBDIVISIONS;
        return html`
          <span
            key=${idx}
            class=${major ? 'song-ruler-tick' : 'song-ruler-tick minor'}
            style=${{ left: `${(idx / RULER_SUBDIVISIONS) * 100}%` }}
          >
            ${major ? html`<span>${formatSongTime(tickTime)}</span>` : null}
          </span>
        `;
      })}
    </div>
  `;
}

export function SongLab({ active, songId, onLoadedSongTitle }) {
  const [catalogSongs, setCatalogSongs] = useState([
    { id: 'japanese-denim', title: 'Japanese Denim', artist: 'Daniel Caesar' },
  ]);
  const [heroDescription, setHeroDescription] = useState(DEFAULT_HERO_DESCRIPTION);
  const [dataStatus, setDataStatus] = useState('Loading pitch map…');
  const [frameStatus, setFrameStatus] = useState('Loading song…');
  const [playbackTitle, setPlaybackTitle] = useState('Reference · official YouTube audio');
  const [playbackStatus, setPlaybackStatus] = useState('Ready');
  const [duration, setDuration] = useState(270.6);
  const [sections, setSections] = useState({ full: { start: 0, end: 270.6, label: 'Full song' } });
  const [cycleActive, setCycleActive] = useState(false);
  const [cycleRange, setCycleRangeState] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [coachNote, setCoachNote] = useState(null);
  const [lyrics, setLyrics] = useState([]);
  const [cues, setCues] = useState([]);

  const pitchCanvasRef = useRef(null);
  const pitchOrbRef = useRef(null);
  const songRulerRef = useRef(null);
  const songCycleSelectionRef = useRef(null);
  const songRulerPlayheadRef = useRef(null);
  const songCurrentTimeRef = useRef(null);
  const songLiveNoteRef = useRef(null);
  const songLiveRegisterRef = useRef(null);
  const youtubeHostRef = useRef(null);
  const referenceAudioRef = useRef(null);
  const lyricsControllerRef = useRef(null);

  const titleCbRef = useRef(onLoadedSongTitle);
  titleCbRef.current = onLoadedSongTitle;

  const rtRef = useRef({
    active: false,
    songId: songId || 'japanese-denim',
    loadedSongId: '',
    loadId: 0,
    manifest: null,
    youtubeVideoId: '',
    sectionId: 'full',
    sections: { full: { start: 0, end: 270.6, label: 'Full song' } },
    cycleRange: null,
    cycleActive: false,
    speed: 1,
    frames: [],
    breaths: [],
    cues: [],
    lyrics: [],
    frameRate: 40,
    duration: 270.6,
    alignmentOffset: 0,
    playing: false,
    buffering: false,
    operationId: 0,
    seeking: false,
    youtubeReady: false,
    youtubePlayer: null,
    localReferencePlayback: false,
    previewTime: 0,
    lastPlayheadTime: 0,
    pendingSeekTarget: null,
    pendingSeekUntil: 0,
    audioContext: null,
    mediaElementSource: null,
    localReferenceUrl: '',
    audioAnchorPitchTime: 0,
    audioAnchorContextTime: 0,
    audioClockReady: false,
    sceneTiles: new Map(),
    sceneSignature: '',
    goldColor: '',
    canvasWidth: 0,
    canvasHeight: 0,
    rulerWidth: 0,
    pitchContext: null,
    rulerDrag: null,
    raf: 0,
    singleRaf: 0,
    pendingFrameTime: null,
    prewarmToken: 0,
    prewarmTimer: 0,
    dom: {
      timeText: '',
      playheadTransform: '',
      noteText: '',
      regText: '',
      regColor: null,
      orbTransform: '',
      orbOpacity: '',
      orbBg: '',
    },
  });

  rtRef.current.active = active;
  rtRef.current.songId = songId || 'japanese-denim';

  const playbackToPitchTime = useCallback((seconds) => {
    return Math.max(0, Number(seconds || 0) - rtRef.current.alignmentOffset);
  }, []);

  const pitchToPlaybackTime = useCallback((seconds) => {
    const rt = rtRef.current;
    return Math.max(0, Math.min(rt.duration, Number(seconds || 0) + rt.alignmentOffset));
  }, []);

  const currentSongTime = useCallback(() => {
    const rt = rtRef.current;
    const audioEl = referenceAudioRef.current;
    if (rt.seeking || rt.buffering) return rt.previewTime;
    if (!rt.playing) return rt.previewTime;
    if (rt.localReferencePlayback) {
      if (rt.audioClockReady && rt.audioContext?.getOutputTimestamp) {
        const output = rt.audioContext.getOutputTimestamp();
        const elapsed = Math.max(0, output.contextTime - rt.audioAnchorContextTime) * rt.speed;
        return Math.min(rt.duration, rt.audioAnchorPitchTime + elapsed);
      }
      return playbackToPitchTime(audioEl?.currentTime || 0);
    }
    if (rt.youtubeReady && rt.youtubePlayer?.getCurrentTime) {
      const actual = rt.youtubePlayer.getCurrentTime() || 0;
      if (
        rt.pendingSeekTarget != null &&
        performance.now() < rt.pendingSeekUntil &&
        Math.abs(playbackToPitchTime(actual) - rt.pendingSeekTarget) > 1
      ) {
        return rt.pendingSeekTarget;
      }
      rt.pendingSeekTarget = null;
      return playbackToPitchTime(actual);
    }
    return Number(rt.previewTime) || 0;
  }, [playbackToPitchTime]);

  const renderCycleSelectionDom = useCallback((range, isCycleActive) => {
    const el = songCycleSelectionRef.current;
    if (!el) return;
    const dur = Math.max(0.001, rtRef.current.duration);
    if (!range || range.end <= range.start) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.style.left = `${(range.start / dur) * 100}%`;
    el.style.width = `${((range.end - range.start) / dur) * 100}%`;
    el.classList.toggle('inactive', !isCycleActive);
  }, []);

  const pitchSceneTile = useCallback((tileIndex, width, height, ratio, yFor) => {
    const rt = rtRef.current;
    const pixelsPerSecond = width / PITCH_VIEW_SECONDS;
    const tileWidth = PITCH_TILE_SECONDS * pixelsPerSecond;
    const range = rt.manifest?.pitchRange || {};
    const signature = `${rt.songId}:${Math.round(width)}:${Math.round(height)}:${ratio}:${
      range.minimumMidi ?? 42
    }:${range.maximumMidi ?? 76}`;
    if (rt.sceneSignature !== signature) {
      rt.sceneSignature = signature;
      releaseSceneTiles(rt.sceneTiles);
    }
    if (rt.sceneTiles.has(tileIndex)) {
      const hit = rt.sceneTiles.get(tileIndex);
      rt.sceneTiles.delete(tileIndex);
      rt.sceneTiles.set(tileIndex, hit);
      return hit;
    }

    if (!rt.goldColor) {
      rt.goldColor = canvasColor('--gold', '#f2c66e');
    }

    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = Math.max(1, Math.ceil(tileWidth * ratio));
    tileCanvas.height = Math.max(1, Math.ceil(height * ratio));
    const context = tileCanvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const tileStart = tileIndex * PITCH_TILE_SECONDS;
    const tileEnd = tileStart + PITCH_TILE_SECONDS;
    const first = Math.max(0, Math.floor(tileStart * rt.frameRate) - 1);
    const last = Math.min(rt.frames.length - 1, Math.ceil(tileEnd * rt.frameRate) + 1);
    const xFor = (value) => (value - tileStart) * pixelsPerSecond;

    const gold = rt.goldColor;
    const headVoiceColor = '#6fe3ff';
    const mixVoiceColor = '#a6e5dc';
    const expressive = '#ff70d2';
    const loudnessColor = '#f48b72';
    const vibratoLaneColor = '#b58cff';
    const brightnessColor = '#7ce8b6';
    const breathCueColor = '#ffe178';

    function fillRibbonSegments(predicate, color, alpha) {
      if (last < first) return;
      context.fillStyle = color;
      context.globalAlpha = alpha;
      let segStart = -1;
      for (let index = first; index <= last + 1; index++) {
        const frame = index <= last ? rt.frames[index] : null;
        const match = Boolean(frame && frame.midi != null && predicate(frame));
        if (match) {
          if (segStart < 0) segStart = index;
        } else if (segStart >= 0) {
          const segEnd = index - 1;
          if (segEnd - segStart >= 1) {
            context.beginPath();
            for (let i = segStart; i <= segEnd; i++) {
              const f = rt.frames[i];
              const halfWidth = (2.5 + (f.strength ?? 0.5) * 8.5) / 2;
              const x = xFor(f.time);
              const y = yFor(f.midi) - halfWidth;
              if (i === segStart) context.moveTo(x, y);
              else context.lineTo(x, y);
            }
            for (let i = segEnd; i >= segStart; i--) {
              const f = rt.frames[i];
              const halfWidth = (2.5 + (f.strength ?? 0.5) * 8.5) / 2;
              context.lineTo(xFor(f.time), yFor(f.midi) + halfWidth);
            }
            context.closePath();
            context.fill();
          }
          segStart = -1;
        }
      }
    }

    fillRibbonSegments((frame) => frame.voiced, gold, 0.94);
    fillRibbonSegments((frame) => frame.voiced && (frame.headVoice ?? 0) >= 0.35, mixVoiceColor, 0.62);
    fillRibbonSegments(
      (frame) => frame.voiced && (frame.headVoice ?? 0) >= 0.48,
      headVoiceColor,
      0.96
    );

    context.globalAlpha = 1;
    context.strokeStyle = expressive;
    context.lineWidth = 1;
    context.lineCap = 'butt';
    context.lineJoin = 'round';
    context.shadowBlur = 0;
    if (last >= first) {
      let vibStart = -1;
      for (let index = first; index <= last + 1; index++) {
        const frame = index <= last ? rt.frames[index] : null;
        const match = Boolean(frame && frame.expressiveMidi != null && frame.vibratoDepth > 0);
        if (match) {
          if (vibStart < 0) vibStart = index;
        } else if (vibStart >= 0) {
          const vibEnd = index - 1;
          if (vibEnd - vibStart >= 1) {
            context.beginPath();
            for (let i = vibStart; i <= vibEnd; i++) {
              const f = rt.frames[i];
              const x = xFor(f.time);
              const y = yFor(f.expressiveMidi);
              if (i === vibStart) context.moveTo(x, y);
              else context.lineTo(x, y);
            }
            context.stroke();
          }
          vibStart = -1;
        }
      }
    }

    if (Array.isArray(rt.breaths) && rt.breaths.length) {
      const laneLimitY = height - 118;
      rt.breaths.forEach((breath) => {
        if (!breath || breath.time == null || breath.midi == null) return;
        if (breath.onsetTime < tileStart - 0.5 || breath.time > tileEnd + 0.5) return;
        const bx = xFor(breath.time);
        const ox = xFor(breath.onsetTime ?? breath.time);
        const ny = Math.max(24, Math.min(laneLimitY - 12, yFor(breath.midi)));
        const badgeY = Math.max(15, ny - 18);

        context.save();
        context.strokeStyle = 'rgba(255, 225, 120, 0.55)';
        context.lineWidth = 1;
        context.setLineDash([2, 2]);
        context.beginPath();
        context.moveTo(bx, badgeY + 6);
        context.lineTo(bx, ny);
        context.lineTo(ox, ny);
        context.stroke();
        context.setLineDash([]);

        context.fillStyle = 'rgba(20, 22, 34, 0.88)';
        context.strokeStyle = 'rgba(255, 225, 120, 0.72)';
        context.lineWidth = 1;
        const bw = 14;
        const bh = 13;
        context.beginPath();
        if (typeof context.roundRect === 'function') {
          context.roundRect(bx - bw / 2, badgeY - bh / 2, bw, bh, 3.5);
        } else {
          context.rect(bx - bw / 2, badgeY - bh / 2, bw, bh);
        }
        context.fill();
        context.stroke();

        context.fillStyle = breathCueColor;
        context.font = '800 9px ui-monospace, SFMono-Regular, Menlo, monospace';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('∨', bx, badgeY + 0.5);
        context.restore();
      });
    }

    function drawExpressionLane(valueFor, centerY, maximumHalfWidth, color) {
      if (last - first < 1) return;
      context.fillStyle = color;
      context.globalAlpha = 0.76;
      context.beginPath();
      let started = false;
      for (let index = first; index <= last; index++) {
        const frame = rt.frames[index];
        if (!frame) continue;
        const x = xFor(frame.time);
        const y = centerY - valueFor(frame) * maximumHalfWidth;
        if (!started) {
          context.moveTo(x, y);
          started = true;
        } else {
          context.lineTo(x, y);
        }
      }
      if (!started) return;
      for (let index = last; index >= first; index--) {
        const frame = rt.frames[index];
        if (!frame) continue;
        context.lineTo(xFor(frame.time), centerY + valueFor(frame) * maximumHalfWidth);
      }
      context.closePath();
      context.fill();
    }

    drawExpressionLane(
      (frame) =>
        frame.voiced
          ? Math.max(0, Math.min(1, (1 - (frame.headVoice ?? 0)) * Math.max(0.4, frame.strength ?? 0.6)))
          : 0,
      height - 99,
      5.5,
      gold
    );
    drawExpressionLane(
      (frame) =>
        frame.voiced
          ? Math.max(0, Math.min(1, (frame.headVoice ?? 0) * Math.max(0.4, frame.strength ?? 0.6)))
          : 0,
      height - 78,
      5.5,
      headVoiceColor
    );
    drawExpressionLane(
      (frame) => Math.max(0, Math.min(1, frame.strength ?? 0)),
      height - 57,
      5.5,
      loudnessColor
    );
    drawExpressionLane(
      (frame) => Math.max(0, Math.min(1, (frame.vibratoDepth ?? 0) / 80)),
      height - 36,
      5.5,
      vibratoLaneColor
    );
    drawExpressionLane(
      (frame) => Math.max(0, Math.min(1, frame.brightness ?? 0)),
      height - 15,
      5.5,
      brightnessColor
    );
    context.shadowBlur = 0;
    context.globalAlpha = 1;

    const tile = { canvas: tileCanvas, width: tileWidth };
    rt.sceneTiles.set(tileIndex, tile);
    while (rt.sceneTiles.size > MAX_CACHED_TILES) {
      const oldestKey = rt.sceneTiles.keys().next().value;
      const evicted = rt.sceneTiles.get(oldestKey);
      rt.sceneTiles.delete(oldestKey);
      if (evicted?.canvas) {
        evicted.canvas.width = 0;
        evicted.canvas.height = 0;
      }
    }
    return tile;
  }, []);

  const scheduleTilePrewarm = useCallback(
    (aroundTime = 0) => {
      const rt = rtRef.current;
      const token = ++rt.prewarmToken;
      if (rt.prewarmTimer) {
        clearTimeout(rt.prewarmTimer);
        rt.prewarmTimer = 0;
      }
      if (!rt.active || !rt.frames.length) return;
      rt.prewarmTimer = setTimeout(async () => {
        rt.prewarmTimer = 0;
        if (token !== rt.prewarmToken || !rt.active || !rt.frames.length) return;
        const width = rt.canvasWidth;
        const height = rt.canvasHeight;
        if (width <= 0 || height <= 0) return;
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const range = rt.manifest?.pitchRange || {};
        const minMidi = range.minimumMidi ?? 42;
        const maxMidi = range.maximumMidi ?? 76;
        const laneTop = height - 114;
        const yFor = (value) => 14 + ((maxMidi - value) / (maxMidi - minMidi)) * (laneTop - 24);
        const maxTile = Math.max(0, Math.ceil(rt.duration / PITCH_TILE_SECONDS));
        const startTile = Math.max(0, Math.floor(Math.max(0, aroundTime - 3.6) / PITCH_TILE_SECONDS));
        const endTile = Math.min(maxTile, startTile + 3);

        for (let tileIndex = startTile; tileIndex <= endTile; tileIndex++) {
          if (token !== rt.prewarmToken || !rt.active) return;
          if (rt.canvasWidth !== width || rt.canvasHeight !== height) return;
          if (rt.sceneTiles.has(tileIndex)) continue;
          pitchSceneTile(tileIndex, width, height, ratio, yFor);
          await yieldToMain();
        }
      }, 32);
    },
    [pitchSceneTile]
  );

  const renderFrame = useCallback(
    (time) => {
      const rt = rtRef.current;
      lyricsControllerRef.current?.syncTime(time);

      const canvas = pitchCanvasRef.current;
      const ruler = songRulerRef.current;

      // Batch geometry reads first (only when ResizeObserver cache is cold)
      if (canvas && (rt.canvasWidth <= 0 || rt.canvasHeight <= 0)) {
        rt.canvasWidth = canvas.clientWidth;
        rt.canvasHeight = canvas.clientHeight;
      }
      if (ruler && rt.rulerWidth <= 0) {
        rt.rulerWidth = ruler.clientWidth;
      }

      const width = rt.canvasWidth;
      const height = rt.canvasHeight;
      const range = rt.manifest?.pitchRange || {};
      const minMidi = range.minimumMidi ?? 42;
      const maxMidi = range.maximumMidi ?? 76;
      const laneTop = height - 114;
      const yFor = (value) => 14 + ((maxMidi - value) / (maxMidi - minMidi)) * (laneTop - 24);

      if (canvas && width > 0 && height > 0) {
        if (!rt.pitchContext) {
          rt.pitchContext = canvas.getContext('2d');
        }
        const pitchContext = rt.pitchContext;
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const targetW = Math.round(width * ratio);
        const targetH = Math.round(height * ratio);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        pitchContext.setTransform(ratio, 0, 0, ratio, 0, 0);
        pitchContext.clearRect(0, 0, width, height);

        const start = time - 3.6;
        const end = time + 8.4;
        const xFor = (value) => ((value - start) / (end - start)) * width;

        pitchContext.fillStyle = 'rgba(7,8,15,.54)';
        pitchContext.fillRect(0, laneTop, width, height - laneTop);
        pitchContext.strokeStyle = 'rgba(255,255,255,.13)';
        pitchContext.lineWidth = 1;
        pitchContext.beginPath();
        pitchContext.moveTo(0, laneTop);
        pitchContext.lineTo(width, laneTop);
        pitchContext.stroke();

        pitchContext.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
        const firstGridMidi = Math.ceil(minMidi + 1);
        const lastGridMidi = Math.floor(maxMidi - 1);
        for (let midi = firstGridMidi; midi <= lastGridMidi; midi += 4) {
          const y = yFor(midi);
          pitchContext.strokeStyle = 'rgba(255,255,255,.08)';
          pitchContext.lineWidth = 1;
          pitchContext.beginPath();
          pitchContext.moveTo(0, y);
          pitchContext.lineTo(width, y);
          pitchContext.stroke();
          pitchContext.fillStyle = 'rgba(255,255,255,.48)';
          pitchContext.fillText(midiName(midi), 8, y - 5);
        }

        for (let second = Math.ceil(start); second < end; second++) {
          const x = xFor(second);
          pitchContext.strokeStyle = 'rgba(255,255,255,.045)';
          pitchContext.beginPath();
          pitchContext.moveTo(x, 0);
          pitchContext.lineTo(x, height);
          pitchContext.stroke();
        }

        if (rt.frames.length) {
          const pixelsPerSecond = width / PITCH_VIEW_SECONDS;
          const firstTile = Math.max(0, Math.floor(start / PITCH_TILE_SECONDS));
          const lastTile = Math.max(
            firstTile,
            Math.floor(Math.max(start, end - 0.001) / PITCH_TILE_SECONDS)
          );
          for (let tileIndex = firstTile; tileIndex <= lastTile; tileIndex++) {
            const tile = pitchSceneTile(tileIndex, width, height, ratio, yFor);
            const worldStart = tileIndex * PITCH_TILE_SECONDS;
            const destinationX = (worldStart - start) * pixelsPerSecond;
            pitchContext.drawImage(tile.canvas, destinationX, 0, tile.width, height);
          }
          const nextTileIndex = lastTile + 1;
          const maxTileIndex = Math.ceil(rt.duration / PITCH_TILE_SECONDS);
          if (
            rt.playing &&
            nextTileIndex <= maxTileIndex &&
            !rt.sceneTiles.has(nextTileIndex) &&
            !rt.prewarmTimer
          ) {
            scheduleTilePrewarm(time);
          }
        }

        pitchContext.globalAlpha = 1;
        pitchContext.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
        pitchContext.fillStyle = '#f2c66e';
        pitchContext.fillText('CHEST VOICE', 8, height - 101);
        pitchContext.fillStyle = '#6fe3ff';
        pitchContext.fillText('HEAD VOICE', 8, height - 80);
        pitchContext.fillStyle = '#f48b72';
        pitchContext.fillText('LOUDNESS', 8, height - 59);
        pitchContext.fillStyle = '#b58cff';
        pitchContext.fillText('VIBRATO', 8, height - 38);
        pitchContext.fillStyle = '#7ce8b6';
        pitchContext.fillText('BRIGHTNESS', 8, height - 17);
      }

      // Batch dirty-checked DOM writes last (compositor transforms + in-place Text.data)
      const formattedTime = formatSongDebugTime(time);
      if (rt.dom.timeText !== formattedTime) {
        rt.dom.timeText = formattedTime;
        setDomText(songCurrentTimeRef.current, formattedTime);
      }

      const playheadEl = songRulerPlayheadRef.current;
      if (playheadEl) {
        const safeDur = Math.max(0.001, rt.duration);
        const clampedRatio = Math.max(0, Math.min(1, time / safeDur));
        const xPx = clampedRatio * rt.rulerWidth;
        const nextTransform = `translate3d(${xPx.toFixed(2)}px, 0, 0)`;
        if (rt.dom.playheadTransform !== nextTransform) {
          rt.dom.playheadTransform = nextTransform;
          playheadEl.style.transform = nextTransform;
        }
      }

      const frameIndex = rt.frames.length
        ? Math.max(0, Math.min(rt.frames.length - 1, Math.round(time * rt.frameRate)))
        : -1;
      const frame = frameIndex >= 0 ? rt.frames[frameIndex] : null;
      const orbEl = pitchOrbRef.current;
      const noteEl = songLiveNoteRef.current;
      const regEl = songLiveRegisterRef.current;

      if (frame?.voiced && frame.midi != null) {
        const noteStr = midiName(frame.midi);
        const hv = frame.headVoice ?? 0;
        const regLabel = hv >= 0.48 ? 'Head' : hv >= 0.32 ? 'Mix' : 'Chest';
        const regColor = hv >= 0.48 ? '#6fe3ff' : hv >= 0.32 ? '#a6e5dc' : '#f2c66e';

        if (orbEl && height > 0) {
          const clampedY = Math.max(10, Math.min(laneTop - 8, yFor(frame.midi)));
          const nextOrbTransform = `translate3d(0, ${(clampedY - 9).toFixed(2)}px, 0)`;
          if (rt.dom.orbTransform !== nextOrbTransform) {
            rt.dom.orbTransform = nextOrbTransform;
            orbEl.style.transform = nextOrbTransform;
          }
          if (rt.dom.orbOpacity !== '0.999') {
            rt.dom.orbOpacity = '0.999';
            orbEl.style.opacity = '0.999';
          }
          if (rt.dom.orbBg !== regColor) {
            rt.dom.orbBg = regColor;
            orbEl.style.background = regColor;
          }
        }
        if (rt.dom.noteText !== noteStr) {
          rt.dom.noteText = noteStr;
          setDomText(noteEl, noteStr);
        }
        if (rt.dom.regText !== regLabel) {
          rt.dom.regText = regLabel;
          setDomText(regEl, regLabel);
        }
        if (regEl && rt.dom.regColor !== regColor) {
          rt.dom.regColor = regColor;
          regEl.style.color = regColor;
        }
      } else {
        if (orbEl && rt.dom.orbOpacity !== '0.25') {
          rt.dom.orbOpacity = '0.25';
          orbEl.style.opacity = '0.25';
        }
        if (rt.dom.noteText !== '—') {
          rt.dom.noteText = '—';
          setDomText(noteEl, '—');
        }
        if (rt.dom.regText !== '—') {
          rt.dom.regText = '—';
          setDomText(regEl, '—');
        }
        if (regEl && rt.dom.regColor !== '') {
          rt.dom.regColor = '';
          regEl.style.color = '';
        }
      }
    },
    [pitchSceneTile, scheduleTilePrewarm]
  );

  const requestSingleFrame = useCallback(
    (timeOverride = null) => {
      const rt = rtRef.current;
      if (!rt.active) return;
      rt.pendingFrameTime = timeOverride;
      if (rt.raf || rt.singleRaf) return;
      rt.singleRaf = requestAnimationFrame(() => {
        rt.singleRaf = 0;
        if (!rt.active || rt.raf) return;
        const target = rt.pendingFrameTime != null ? rt.pendingFrameTime : currentSongTime();
        rt.pendingFrameTime = null;
        renderFrame(target);
      });
    },
    [currentSongTime, renderFrame]
  );

  const stopLoops = useCallback(() => {
    const rt = rtRef.current;
    if (rt.raf) {
      cancelAnimationFrame(rt.raf);
      rt.raf = 0;
    }
    if (rt.singleRaf) {
      cancelAnimationFrame(rt.singleRaf);
      rt.singleRaf = 0;
    }
    rt.pendingFrameTime = null;
  }, []);

  const tickRef = useRef(null);

  const startPlaybackLoop = useCallback(() => {
    const rt = rtRef.current;
    if (rt.raf || !rt.active || !rt.playing) return;
    if (rt.singleRaf) {
      cancelAnimationFrame(rt.singleRaf);
      rt.singleRaf = 0;
      rt.pendingFrameTime = null;
    }
    rt.raf = requestAnimationFrame(() => tickRef.current?.());
  }, []);

  const reflectSongPlaying = useCallback(
    (playingNow) => {
      const rt = rtRef.current;
      rt.playing = playingNow;
      setPlaying(playingNow);
      if (playingNow && rt.active) {
        startPlaybackLoop();
      } else if (!playingNow && rt.raf) {
        cancelAnimationFrame(rt.raf);
        rt.raf = 0;
      }
    },
    [startPlaybackLoop]
  );

  const pauseSong = useCallback(() => {
    const rt = rtRef.current;
    const audioEl = referenceAudioRef.current;
    rt.operationId++;
    if (rt.playing) {
      if (rt.localReferencePlayback) {
        rt.previewTime = playbackToPitchTime(audioEl?.currentTime || 0);
      } else if (rt.youtubeReady && rt.youtubePlayer?.getCurrentTime) {
        rt.previewTime = playbackToPitchTime(rt.youtubePlayer.getCurrentTime() || 0);
      }
    }
    audioEl?.pause();
    rt.buffering = false;
    rt.audioClockReady = false;
    if (rt.youtubeReady && rt.youtubePlayer?.pauseVideo) {
      rt.youtubePlayer.pauseVideo();
    }
    reflectSongPlaying(false);
    if (rt.active) {
      renderFrame(rt.previewTime);
    }
  }, [playbackToPitchTime, reflectSongPlaying, renderFrame]);

  const anchorLocalAudioClock = useCallback((pitchTime) => {
    const rt = rtRef.current;
    if (!rt.audioContext) return;
    rt.audioAnchorPitchTime = pitchTime;
    rt.audioAnchorContextTime = rt.audioContext.currentTime;
    rt.audioClockReady = true;
  }, []);

  const ensureAudioDiagnostics = useCallback(async () => {
    const rt = rtRef.current;
    const audioEl = referenceAudioRef.current;
    if (!rt.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      rt.audioContext = new AudioCtx();
    }
    if (rt.localReferencePlayback && audioEl && !rt.mediaElementSource) {
      rt.mediaElementSource = rt.audioContext.createMediaElementSource(audioEl);
      rt.mediaElementSource.connect(rt.audioContext.destination);
    }
    if (rt.audioContext.state === 'suspended') {
      await rt.audioContext.resume();
    }
  }, []);

  const localBufferContains = useCallback((time) => {
    const audioEl = referenceAudioRef.current;
    if (!audioEl || audioEl.seeking) return false;
    if (audioEl.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return false;
    for (let index = 0; index < audioEl.buffered.length; index++) {
      if (audioEl.buffered.start(index) <= time && audioEl.buffered.end(index) > time) {
        return true;
      }
    }
    return false;
  }, []);

  const waitForLocalBuffer = useCallback(
    (time) => {
      const audioEl = referenceAudioRef.current;
      if (!audioEl || localBufferContains(time)) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const events = ['progress', 'canplay', 'canplaythrough', 'loadeddata', 'seeked'];
        const cleanup = () => events.forEach((evt) => audioEl.removeEventListener(evt, check));
        const check = () => {
          if (!localBufferContains(time)) return;
          clearTimeout(timeout);
          cleanup();
          resolve();
        };
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('Audio buffering timed out'));
        }, 10000);
        events.forEach((evt) => audioEl.addEventListener(evt, check));
        check();
      });
    },
    [localBufferContains]
  );

  const seekSong = useCallback(
    (seconds) => {
      const rt = rtRef.current;
      const audioEl = referenceAudioRef.current;
      const target = Math.max(0, Math.min(rt.duration, Number(seconds) || 0));
      const playbackTarget = pitchToPlaybackTime(target);
      if (rt.localReferencePlayback && audioEl) {
        audioEl.currentTime = playbackTarget;
      } else if (rt.youtubeReady && rt.youtubePlayer?.seekTo) {
        rt.youtubePlayer.seekTo(playbackTarget, true);
      }
      if (!rt.localReferencePlayback) {
        rt.pendingSeekTarget = target;
        rt.pendingSeekUntil = performance.now() + 1600;
      }
      rt.previewTime = target;
      rt.lastPlayheadTime = target;
      if (rt.localReferencePlayback && !rt.buffering && rt.audioContext?.state === 'running') {
        anchorLocalAudioClock(target);
      }
      if (rt.active) {
        renderFrame(target);
      }
    },
    [anchorLocalAudioClock, pitchToPlaybackTime, renderFrame]
  );

  const previewSongSeek = useCallback(
    (seconds) => {
      const rt = rtRef.current;
      const target = Math.max(0, Math.min(rt.duration, Number(seconds) || 0));
      rt.seeking = true;
      rt.previewTime = target;
      rt.lastPlayheadTime = target;
      requestSingleFrame(target);
    },
    [requestSingleFrame]
  );

  const commitSongSeek = useCallback(
    async (seconds) => {
      const rt = rtRef.current;
      const audioEl = referenceAudioRef.current;
      const target = Math.max(0, Math.min(rt.duration, Number(seconds) || 0));
      const playbackTarget = pitchToPlaybackTime(target);
      const resume = rt.playing;
      const operation = ++rt.operationId;
      if (rt.localReferencePlayback && resume && audioEl && !localBufferContains(playbackTarget)) {
        rt.buffering = true;
        audioEl.pause();
        rt.audioClockReady = false;
        seekSong(target);
        setPlaybackStatus('Buffering…');
        await waitForLocalBuffer(playbackTarget);
        if (operation !== rt.operationId) return;
        await audioEl.play();
        if (operation !== rt.operationId) {
          audioEl.pause();
          return;
        }
        anchorLocalAudioClock(target);
        rt.buffering = false;
        reflectSongPlaying(true);
        setPlaybackStatus('Playing local reference');
      } else {
        seekSong(target);
      }
      rt.seeking = false;
    },
    [
      anchorLocalAudioClock,
      localBufferContains,
      pitchToPlaybackTime,
      reflectSongPlaying,
      seekSong,
      waitForLocalBuffer,
    ]
  );

  const seekFromRuler = useCallback(
    (time) => {
      previewSongSeek(time);
      commitSongSeek(time).catch((error) => {
        rtRef.current.buffering = false;
        rtRef.current.seeking = false;
        reflectSongPlaying(false);
        setPlaybackStatus(error.message);
      });
    },
    [commitSongSeek, previewSongSeek, reflectSongPlaying]
  );

  tickRef.current = () => {
    const rt = rtRef.current;
    rt.raf = 0;
    if (!rt.active || !rt.playing) return;
    const time = currentSongTime();
    const prevTime = rt.lastPlayheadTime ?? time;
    rt.lastPlayheadTime = time;
    if (!rt.seeking && !rt.buffering) {
      rt.previewTime = time;
    }
    const cycle = rt.cycleActive ? rt.cycleRange : null;
    if (!rt.seeking && !rt.buffering && cycle && prevTime < cycle.end && time >= cycle.end) {
      seekFromRuler(cycle.start);
      if (rt.active && rt.playing && !rt.raf) {
        rt.raf = requestAnimationFrame(() => tickRef.current?.());
      }
      return;
    }
    if (!rt.seeking && !rt.buffering && !cycle && time >= rt.duration) {
      pauseSong();
      return;
    }
    renderFrame(time);
    if (rt.active && rt.playing && !rt.raf) {
      rt.raf = requestAnimationFrame(() => tickRef.current?.());
    }
  };

  const syncCycleState = useCallback(
    (nextRange, nextActive, nextSectionId) => {
      const rt = rtRef.current;
      rt.cycleRange = nextRange;
      rt.cycleActive = nextActive;
      if (nextSectionId !== undefined) rt.sectionId = nextSectionId;
      setCycleRangeState(nextRange);
      setCycleActive(nextActive);
      renderCycleSelectionDom(nextRange, nextActive);
    },
    [renderCycleSelectionDom]
  );

  const setCycleRange = useCallback(
    (start, end, sectionId = 'custom') => {
      const rt = rtRef.current;
      const left = Math.max(0, Math.min(rt.duration, Math.min(start, end)));
      const right = Math.max(0, Math.min(rt.duration, Math.max(start, end)));
      if (right - left < 0.1) return;
      const range = { start: left, end: right };
      if (sectionId !== 'custom') {
        writeStorage(`voice_song_section_${rt.songId}`, sectionId);
      }
      syncCycleState(range, true, sectionId);
    },
    [syncCycleState]
  );

  const disableCycle = useCallback(() => {
    const rt = rtRef.current;
    writeStorage(`voice_song_section_${rt.songId}`, 'full');
    syncCycleState(rt.cycleRange, false, 'full');
  }, [syncCycleState]);

  const toggleSectionCycle = useCallback(
    (sectionId) => {
      const rt = rtRef.current;
      const section = rt.sections[sectionId];
      if (!section || sectionId === 'full') {
        disableCycle();
        return;
      }
      if (rt.cycleActive && rt.sectionId === sectionId) {
        disableCycle();
      } else {
        setCycleRange(section.start, section.end, sectionId);
        seekFromRuler(section.start);
      }
    },
    [disableCycle, seekFromRuler, setCycleRange]
  );

  const toggleCycleMode = useCallback(() => {
    const rt = rtRef.current;
    if (rt.cycleActive) {
      syncCycleState(rt.cycleRange, false, rt.sectionId);
      return;
    }
    if (rt.cycleRange && rt.cycleRange.end > rt.cycleRange.start) {
      const nextSection = rt.sectionId === 'full' ? 'custom' : rt.sectionId;
      syncCycleState(rt.cycleRange, true, nextSection);
      return;
    }
    const firstSectionId = Object.keys(rt.sections).find((id) => id !== 'full');
    if (firstSectionId && rt.sections[firstSectionId]) {
      setCycleRange(
        rt.sections[firstSectionId].start,
        rt.sections[firstSectionId].end,
        firstSectionId
      );
    } else {
      const start = Math.max(0, Math.min(Math.max(0, rt.duration - 16), currentSongTime()));
      setCycleRange(start, Math.min(rt.duration, start + 16), 'custom');
    }
  }, [currentSongTime, setCycleRange, syncCycleState]);

  const toggleSong = useCallback(async () => {
    const rt = rtRef.current;
    const audioEl = referenceAudioRef.current;
    if (rt.playing) {
      pauseSong();
      return;
    }
    const operation = ++rt.operationId;
    await ensureAudioDiagnostics();
    if (rt.localReferencePlayback && audioEl) {
      const target = rt.previewTime;
      const playbackTarget = pitchToPlaybackTime(target);
      audioEl.currentTime = playbackTarget;
      rt.buffering = true;
      setPlaybackStatus('Buffering…');
      await waitForLocalBuffer(playbackTarget);
      if (operation !== rt.operationId) return;
      await audioEl.play();
      if (operation !== rt.operationId) {
        audioEl.pause();
        return;
      }
      anchorLocalAudioClock(target);
      rt.buffering = false;
      reflectSongPlaying(true);
      setPlaybackStatus('Playing local reference');
    } else {
      if (!rt.youtubeReady || !rt.youtubePlayer) {
        setPlaybackStatus('Reference player is still loading');
        return;
      }
      rt.youtubePlayer.seekTo(pitchToPlaybackTime(rt.previewTime), true);
      rt.pendingSeekTarget = rt.previewTime;
      rt.pendingSeekUntil = performance.now() + 1600;
      rt.youtubePlayer.playVideo();
    }
  }, [
    anchorLocalAudioClock,
    ensureAudioDiagnostics,
    pauseSong,
    pitchToPlaybackTime,
    reflectSongPlaying,
    waitForLocalBuffer,
  ]);

  const createOrUpdateYouTubePlayer = useCallback(() => {
    const rt = rtRef.current;
    if (!rt.youtubeVideoId || !window.YT?.Player) return;
    if (rt.youtubePlayer?.cueVideoById) {
      rt.youtubePlayer.cueVideoById(rt.youtubeVideoId);
      return;
    }
    const hostEl = youtubeHostRef.current;
    if (!hostEl) return;
    let targetEl = hostEl.querySelector('#youtubePlayer');
    if (!targetEl) {
      targetEl = document.createElement('div');
      targetEl.id = 'youtubePlayer';
      hostEl.appendChild(targetEl);
    }
    rt.youtubePlayer = new window.YT.Player(targetEl, {
      width: 200,
      height: 200,
      videoId: rt.youtubeVideoId,
      playerVars: { controls: 0, playsinline: 1, origin: location.origin },
      events: {
        onReady: () => {
          rt.youtubeReady = true;
          rt.youtubePlayer.setPlaybackRate(rt.speed);
          if (!rt.localReferencePlayback) setPlaybackStatus('Ready');
        },
        onStateChange: (event) => {
          const YTState = window.YT?.PlayerState;
          if (!YTState) return;
          if (event.data === YTState.PLAYING) {
            rt.buffering = false;
            reflectSongPlaying(true);
            setPlaybackStatus('Playing');
          } else if (event.data === YTState.BUFFERING) {
            rt.buffering = true;
            setPlaybackStatus('Buffering…');
          } else if (event.data === YTState.PAUSED || event.data === YTState.CUED) {
            rt.buffering = false;
            reflectSongPlaying(false);
          } else if (event.data === YTState.ENDED) {
            pauseSong();
          }
        },
        onError: () => {
          setPlaybackStatus('YouTube playback is unavailable');
          reflectSongPlaying(false);
        },
      },
    });
  }, [pauseSong, reflectSongPlaying]);

  const loadYouTubeApi = useCallback(() => {
    window.onYouTubeIframeAPIReady = () => createOrUpdateYouTubePlayer();
    if (window.YT?.Player) {
      createOrUpdateYouTubePlayer();
      return;
    }
    if (document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) return;
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  }, [createOrUpdateYouTubePlayer]);

  const loadLocalReference = useCallback(async (path, loadToken) => {
    const rt = rtRef.current;
    const audioEl = referenceAudioRef.current;
    if (!audioEl) return;
    setPlaybackStatus('Loading reference audio…');
    const response = await fetch(path);
    if (!response.ok) throw new Error('Local reference audio is unavailable');
    const blob = await response.blob();
    if (loadToken !== rt.loadId) return;
    if (rt.localReferenceUrl) URL.revokeObjectURL(rt.localReferenceUrl);
    rt.localReferenceUrl = URL.createObjectURL(blob);
    await new Promise((resolve, reject) => {
      const ready = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(new Error('Local reference audio could not be decoded'));
      };
      const cleanup = () => {
        audioEl.removeEventListener('canplay', ready);
        audioEl.removeEventListener('error', failed);
      };
      audioEl.addEventListener('canplay', ready, { once: true });
      audioEl.addEventListener('error', failed, { once: true });
      audioEl.src = rt.localReferenceUrl;
      audioEl.load();
    });
  }, []);

  const loadSongData = useCallback(
    async (requestedSongId) => {
      const rt = rtRef.current;
      const loadToken = ++rt.loadId;
      try {
        pauseSong();
        let cached = SONG_ASSET_CACHE.get(requestedSongId);
        if (!cached) {
          const base = `assets/${requestedSongId}`;
          const manifestResponse = await fetch(`${base}/manifest.json`);
          if (!manifestResponse.ok) throw new Error(`Unknown song: ${requestedSongId}`);
          const manifest = await manifestResponse.json();
          const [pitchResponse, cuesResponse, lyricsResponse] = await Promise.all([
            fetch(`${base}/${manifest.pitch || 'pitch.json'}`),
            fetch(`${base}/${manifest.cues || 'cues.json'}`),
            fetch(`${base}/${manifest.lyrics || 'lyrics.lrc'}`),
          ]);
          if (loadToken !== rt.loadId) return;
          if (!pitchResponse.ok) throw new Error('Pitch metadata is unavailable');
          const pitch = await pitchResponse.json();
          if (loadToken !== rt.loadId) return;

          let loadedCues = [];
          if (cuesResponse.ok) {
            const cueData = await cuesResponse.json();
            loadedCues = cueData.cues || [];
          }
          let loadedLyrics = [];
          if (lyricsResponse.ok) {
            const lrcText = await lyricsResponse.text();
            loadedLyrics = parseLrc(lrcText);
          }
          if (loadToken !== rt.loadId) return;

          cached = { manifest, pitch, loadedCues, loadedLyrics };
          if (SONG_ASSET_CACHE.size >= 4) {
            const oldestKey = SONG_ASSET_CACHE.keys().next().value;
            SONG_ASSET_CACHE.delete(oldestKey);
          }
          SONG_ASSET_CACHE.set(requestedSongId, cached);
        }

        const { manifest, pitch, loadedCues, loadedLyrics } = cached;
        if (loadToken !== rt.loadId) return;

        const resolvedId = manifest.id || requestedSongId;
        const resolvedDuration = manifest.duration || 270.6;
        const resolvedSections = {
          ...(manifest.sections || {
            full: { start: 0, end: resolvedDuration, label: 'Full song' },
          }),
        };
        resolvedSections.full = {
          ...(resolvedSections.full || { start: 0, label: 'Full song' }),
          end: resolvedDuration,
        };

        const savedSection = readStorage(`voice_song_section_${resolvedId}`);
        const initialSectionId =
          savedSection && resolvedSections[savedSection] ? savedSection : 'full';
        const initialCycleActive = initialSectionId !== 'full';
        const initialCycleRange = initialCycleActive
          ? {
              start: resolvedSections[initialSectionId].start,
              end: resolvedSections[initialSectionId].end,
            }
          : null;

        rt.manifest = manifest;
        rt.songId = resolvedId;
        rt.loadedSongId = requestedSongId;
        rt.sections = resolvedSections;
        rt.sectionId = initialSectionId;
        rt.cycleActive = initialCycleActive;
        rt.cycleRange = initialCycleRange;
        rt.frames = pitch.frames || [];
        rt.breaths = pitch.breaths || [];
        rt.cues = loadedCues;
        rt.lyrics = loadedLyrics;
        rt.frameRate = manifest.frameRate || 40;
        rt.duration = resolvedDuration;
        rt.alignmentOffset = Number(manifest.alignmentOffset) || 0;
        releaseSceneTiles(rt.sceneTiles);
        rt.sceneSignature = '';
        rt.previewTime = 0;
        rt.lastPlayheadTime = 0;

        setCoachNote(
          manifest.coachNote?.text
            ? {
                title: manifest.coachNote.title || 'From your voice teacher',
                text: manifest.coachNote.text,
              }
            : null
        );
        setCues(loadedCues);
        setLyrics(loadedLyrics);
        lyricsControllerRef.current?.reset();

        setDuration(resolvedDuration);
        setSections(resolvedSections);
        setCycleRangeState(initialCycleRange);
        setCycleActive(initialCycleActive);
        setHeroDescription(
          `Follow ${manifest.artist ? `${manifest.artist}’s` : 'the'} original pitch contour while keeping your coach’s pronunciation and placement cues close at hand.`
        );
        setDataStatus('Pitch map ready');
        setFrameStatus(`${rt.frames.length.toLocaleString()} frames`);
        titleCbRef.current?.(manifest.title || '');

        renderCycleSelectionDom(initialCycleRange, initialCycleActive);
        renderFrame(0);
        scheduleTilePrewarm();

        const isLocalRef =
          ['127.0.0.1', 'localhost'].includes(location.hostname) &&
          Boolean(manifest.localReferencePath);
        rt.localReferencePlayback = isLocalRef;

        const audioEl = referenceAudioRef.current;
        if (isLocalRef) {
          await loadLocalReference(manifest.localReferencePath, loadToken);
          if (loadToken !== rt.loadId) return;
        } else {
          if (rt.localReferenceUrl) URL.revokeObjectURL(rt.localReferenceUrl);
          rt.localReferenceUrl = '';
          if (audioEl) {
            audioEl.removeAttribute('src');
            audioEl.load();
          }
        }

        const sourceMatch = String(manifest.sourceUrl || '').match(/[?&]v=([^&]+)/);
        rt.youtubeVideoId = manifest.youtubeVideoId || sourceMatch?.[1] || '';
        if (!isLocalRef && rt.youtubeVideoId) {
          loadYouTubeApi();
        }
        setPlaybackTitle(
          isLocalRef ? 'Reference · local source audio' : 'Reference · official YouTube audio'
        );
        setPlaybackStatus(
          isLocalRef ? 'Local reference ready' : rt.youtubeReady ? 'Ready' : 'Loading reference player…'
        );
        if (rt.active) {
          renderFrame(0);
        }
      } catch (error) {
        if (loadToken !== rt.loadId) return;
        rt.manifest = null;
        rt.loadedSongId = '';
        rt.frames = [];
        rt.breaths = [];
        rt.cues = [];
        rt.lyrics = [];
        setCues([]);
        setLyrics([]);
        lyricsControllerRef.current?.reset();
        setCoachNote(null);
        setDataStatus('Pitch map unavailable');
        setFrameStatus(error.message);
        setPlaybackStatus(error.message);
        titleCbRef.current?.('');
        if (rt.active) {
          renderFrame(0);
        }
      }
    },
    [
      loadLocalReference,
      loadYouTubeApi,
      pauseSong,
      renderCycleSelectionDom,
      renderFrame,
      scheduleTilePrewarm,
    ]
  );

  useEffect(() => {
    const rt = rtRef.current;
    setDomText(songCurrentTimeRef.current, '0:00.000');
    setDomText(songLiveNoteRef.current, '—');
    setDomText(songLiveRegisterRef.current, '—');
    rt.dom.timeText = '0:00.000';
    rt.dom.noteText = '—';
    rt.dom.regText = '—';
    rt.dom.regColor = '';

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('assets/songs.json');
        if (!response.ok) return;
        const catalog = await response.json();
        if (!cancelled && Array.isArray(catalog.songs) && catalog.songs.length) {
          setCatalogSongs(catalog.songs);
        }
      } catch (error) {
        console.warn('Could not load song catalog', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const rt = rtRef.current;
    if (!active) {
      rt.prewarmToken++;
      if (rt.prewarmTimer) {
        clearTimeout(rt.prewarmTimer);
        rt.prewarmTimer = 0;
      }
      pauseSong();
      stopLoops();
      return undefined;
    }

    // Re-measure dimensions upon route un-hide before painting initial frame
    if (pitchCanvasRef.current) {
      rt.canvasWidth = Math.round(pitchCanvasRef.current.clientWidth);
      rt.canvasHeight = Math.round(pitchCanvasRef.current.clientHeight);
    }
    if (songRulerRef.current) {
      rt.rulerWidth = Math.round(songRulerRef.current.clientWidth);
    }

    if (rt.loadedSongId !== songId) {
      loadSongData(songId);
    } else {
      const nowTime = currentSongTime();
      renderFrame(nowTime);
      scheduleTilePrewarm(nowTime);
    }

    if (rt.playing) {
      startPlaybackLoop();
    }

    return () => {
      stopLoops();
    };
  }, [
    active,
    currentSongTime,
    loadSongData,
    pauseSong,
    renderFrame,
    scheduleTilePrewarm,
    songId,
    startPlaybackLoop,
    stopLoops,
  ]);

  useEffect(() => {
    const rt = rtRef.current;
    const canvas = pitchCanvasRef.current;
    const ruler = songRulerRef.current;

    let observer = null;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver((entries) => {
        let needsRender = false;
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const cr = entry.contentRect;
          if (entry.target === canvas) {
            const nextW = Math.round(cr.width);
            const nextH = Math.round(cr.height);
            if (rt.canvasWidth !== nextW || rt.canvasHeight !== nextH) {
              rt.canvasWidth = nextW;
              rt.canvasHeight = nextH;
              if (nextW > 0 && nextH > 0) needsRender = true;
            }
          } else if (entry.target === ruler) {
            const nextRulerW = Math.round(cr.width);
            if (rt.rulerWidth !== nextRulerW) {
              rt.rulerWidth = nextRulerW;
              if (nextRulerW > 0) needsRender = true;
            }
          }
        }
        if (needsRender && rt.active) {
          requestSingleFrame();
          scheduleTilePrewarm(currentSongTime());
        }
      });
      if (canvas) observer.observe(canvas);
      if (ruler) observer.observe(ruler);
    }

    const onWindowResize = () => {
      if (!rt.active) return;
      if (!observer) {
        if (canvas) {
          rt.canvasWidth = Math.round(canvas.clientWidth);
          rt.canvasHeight = Math.round(canvas.clientHeight);
        }
        if (ruler) {
          rt.rulerWidth = Math.round(ruler.clientWidth);
        }
      }
      requestSingleFrame();
      scheduleTilePrewarm(currentSongTime());
    };
    window.addEventListener('resize', onWindowResize, { passive: true });

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', onWindowResize);
    };
  }, [currentSongTime, requestSingleFrame, scheduleTilePrewarm]);

  useEffect(() => {
    return () => {
      const rt = rtRef.current;
      rt.prewarmToken++;
      if (rt.prewarmTimer) clearTimeout(rt.prewarmTimer);
      stopLoops();
      releaseSceneTiles(rt.sceneTiles);
      if (rt.localReferenceUrl) URL.revokeObjectURL(rt.localReferenceUrl);
    };
  }, [stopLoops]);

  const songTimeFromRulerPointer = useCallback((event) => {
    const rt = rtRef.current;
    const ruler = songRulerRef.current;
    if (!ruler) return 0;
    const rect = ruler.getBoundingClientRect();
    rt.rulerWidth = rect.width;
    return Math.max(
      0,
      Math.min(
        rt.duration,
        ((event.clientX - rect.left) / Math.max(1, rect.width)) * rt.duration
      )
    );
  }, []);

  const handleRulerPointerDown = useCallback(
    (event) => {
      const rt = rtRef.current;
      const ruler = songRulerRef.current;
      if (!rt.manifest || !ruler) return;
      const rect = ruler.getBoundingClientRect();
      rt.rulerWidth = rect.width;
      const upperLane = event.clientY - rect.top < 26;
      const pointerTime = Math.max(
        0,
        Math.min(rt.duration, ((event.clientX - rect.left) / Math.max(1, rect.width)) * rt.duration)
      );
      rt.rulerDrag = {
        pointerId: event.pointerId,
        start: pointerTime,
        current: pointerTime,
        upperLane,
        moved: false,
        sectionId:
          event.target.closest('[data-song-ruler-section]')?.dataset.songRulerSection || null,
      };
      if (!upperLane) previewSongSeek(pointerTime);
      ruler.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [previewSongSeek]
  );

  const handleRulerPointerMove = useCallback(
    (event) => {
      const rt = rtRef.current;
      const drag = rt.rulerDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag.current = songTimeFromRulerPointer(event);
      if (!drag.upperLane) {
        previewSongSeek(drag.current);
        return;
      }
      if (Math.abs(drag.current - drag.start) > rt.duration * 0.004) drag.moved = true;
      if (drag.moved) {
        renderCycleSelectionDom(
          {
            start: Math.min(drag.start, drag.current),
            end: Math.max(drag.start, drag.current),
          },
          true
        );
      }
    },
    [previewSongSeek, renderCycleSelectionDom, songTimeFromRulerPointer]
  );

  const handleRulerPointerUp = useCallback(
    (event) => {
      const rt = rtRef.current;
      const drag = rt.rulerDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      rt.rulerDrag = null;
      if (!drag.upperLane) {
        seekFromRuler(songTimeFromRulerPointer(event));
      } else if (drag.moved) {
        setCycleRange(drag.start, drag.current, 'custom');
      } else if (drag.sectionId) {
        toggleSectionCycle(drag.sectionId);
      } else if (rt.cycleRange) {
        const nextActive = !rt.cycleActive;
        const nextSection = nextActive ? 'custom' : 'full';
        syncCycleState(rt.cycleRange, nextActive, nextSection);
      } else {
        renderCycleSelectionDom(rt.cycleRange, rt.cycleActive);
      }
    },
    [
      renderCycleSelectionDom,
      seekFromRuler,
      setCycleRange,
      songTimeFromRulerPointer,
      syncCycleState,
      toggleSectionCycle,
    ]
  );

  const handleRulerPointerCancel = useCallback(() => {
    const rt = rtRef.current;
    rt.rulerDrag = null;
    rt.seeking = false;
    renderCycleSelectionDom(rt.cycleRange, rt.cycleActive);
  }, [renderCycleSelectionDom]);

  const handleSongSelectChange = useCallback((event) => {
    location.hash = `#karaoke/${event.currentTarget.value}`;
  }, []);

  const handleRewind = useCallback(() => {
    const rt = rtRef.current;
    const cycleStart = rt.cycleActive && rt.cycleRange ? rt.cycleRange.start : 0;
    const target = currentSongTime() > cycleStart + 0.25 ? cycleStart : 0;
    seekFromRuler(target);
  }, [currentSongTime, seekFromRuler]);

  const handlePlayClick = useCallback(() => {
    toggleSong().catch((error) => {
      rtRef.current.buffering = false;
      reflectSongPlaying(false);
      setPlaybackStatus(error.message);
    });
  }, [reflectSongPlaying, toggleSong]);

  const pickerOptions = useMemo(() => {
    if (catalogSongs.some((s) => s.id === songId)) return catalogSongs;
    return [...catalogSongs, { id: songId, title: songId, artist: '' }];
  }, [catalogSongs, songId]);

  const safeDuration = Math.max(0.001, duration);

  const hasValidCycleRange = Boolean(cycleRange && cycleRange.end > cycleRange.start);
  const cycleStyle = hasValidCycleRange
    ? {
        left: `${(cycleRange.start / safeDuration) * 100}%`,
        width: `${((cycleRange.end - cycleRange.start) / safeDuration) * 100}%`,
      }
    : undefined;

  return html`
    <section class="route-page song-lab" id="karaokePage" data-route-page="karaoke" hidden=${!active}>
      <div class="song-hero">
        <div class="song-hero-copy">
          <div class="eyebrow">Song lab · pitch & diction</div>
          <h1>Trace the shape. Then make it yours.</h1>
          <p id="songHeroDescription">${heroDescription}</p>
        </div>
      </div>

      <div class="song-shell">
        <div class="song-workspace">
          <article class="pitch-card" aria-label="Tracks area">
            <div
              class="tracks-menubar"
              role="toolbar"
              aria-label="Song selector, transport controls and pitch legend"
            >
              <div class="tracks-menubar-left">
                <label class="sr-only" for="songPicker">Song</label>
                <select
                  class="song-select"
                  id="songPicker"
                  aria-label="Song"
                  value=${songId}
                  onChange=${handleSongSelectChange}
                >
                  ${pickerOptions.map(
                    (song) => html`
                      <option key=${song.id} value=${song.id}>
                        ${song.artist ? `${song.title} · ${song.artist}` : song.title}
                      </option>
                    `
                  )}
                </select>
                <div class="song-status">
                  <strong id="songDataStatus">${dataStatus}</strong>
                  <span>·</span>
                  <span id="songFrameStatus">${frameStatus}</span>
                </div>
              </div>

              <div class="logic-controlbar-center">
                <div class="logic-transport-group" role="group" aria-label="Transport buttons">
                  <button
                    class="logic-transport-btn"
                    id="songRewind"
                    type="button"
                    aria-label="Return to beginning"
                    onClick=${handleRewind}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M2.5 3h2v10h-2V3zm2.8 5L13 3v10L5.3 8z" />
                    </svg>
                  </button>
                  <button
                    class=${`logic-transport-btn logic-play-btn${playing ? ' playing' : ''}`}
                    id="songPlay"
                    type="button"
                    aria-label=${playing ? 'Pause song' : 'Play song'}
                    onClick=${handlePlayClick}
                  >
                    ${playing ? 'Ⅱ' : '▶'}
                  </button>
                  <button
                    class=${`logic-transport-btn logic-cycle-btn${cycleActive ? ' active' : ''}`}
                    id="songCycleToggle"
                    type="button"
                    aria-label="Toggle cycle mode"
                    aria-pressed=${String(Boolean(cycleActive))}
                    onClick=${toggleCycleMode}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path
                        d="M4.5 4.5h6.2l-1.3-1.3 1.1-1.1 3.2 3.2-3.2 3.2-1.1-1.1 1.3-1.3H4.5a1.5 1.5 0 0 0-1.5 1.5v1H1.5v-1a3 3 0 0 1 3-3zm7 7H5.3l1.3 1.3-1.1 1.1-3.2-3.2 3.2-3.2 1.1 1.1-1.3 1.3h6.2a1.5 1.5 0 0 0 1.5-1.5v-1h1.5v1a3 3 0 0 1-3 3z"
                      />
                    </svg>
                  </button>
                </div>

                <div class="logic-song-lcd" aria-label="Time, pitch and reference display">
                  <div class="lcd-cell lcd-pos-cell">
                    <span class="lcd-label">Pos</span>
                    <span class="lcd-value" id="songCurrentTime" ref=${songCurrentTimeRef}></span>
                  </div>
                  <div class="lcd-divider"></div>
                  <div class="lcd-cell lcd-length-cell">
                    <span class="lcd-label">Length</span>
                    <span class="lcd-value lcd-sub" id="songDuration">
                      ${formatSongTime(duration)}
                    </span>
                  </div>
                  <div class="lcd-divider"></div>
                  <div class="lcd-cell lcd-pitch-cell">
                    <span class="lcd-label">Pitch</span>
                    <span class="lcd-value lcd-note" id="songLiveNote" ref=${songLiveNoteRef}></span>
                  </div>
                  <div class="lcd-divider"></div>
                  <div class="lcd-cell lcd-register-cell">
                    <span class="lcd-label">Register</span>
                    <span
                      class="lcd-value lcd-register"
                      id="songLiveRegister"
                      ref=${songLiveRegisterRef}
                    ></span>
                  </div>
                  <div class="lcd-divider"></div>
                  <div class="lcd-status-cell">
                    <span class="lcd-label" id="songPlaybackTitle">${playbackTitle}</span>
                    <span class="lcd-status-value" id="songPlaybackStatus">${playbackStatus}</span>
                  </div>
                </div>
              </div>

              <div class="pitch-legend" aria-label="Pitch graph legend">
                <span class="pitch-legend-item pitch-legend-pitch">
                  <span class="pitch-legend-ribbon" aria-hidden="true"></span>
                  <b>Chest → Head pitch</b>
                </span>
                <span class="pitch-legend-item pitch-legend-vibrato">
                  <svg class="pitch-legend-wave" viewBox="0 0 29 10" aria-hidden="true">
                    <path
                      d="M0 5 C2 1 4 1 6 5 S10 9 12 5 S16 1 18 5 S22 9 24 5 S27 1 29 5"
                      fill="none"
                      stroke="#ff70d2"
                      stroke-width="1"
                    />
                  </svg>
                  <b>Vibrato detail</b>
                </span>
                <span class="pitch-legend-item pitch-legend-strength">
                  <span class="pitch-legend-width" aria-hidden="true"></span>
                  <b>Vocal strength</b>
                </span>
                <span class="pitch-legend-item pitch-legend-brightness">
                  <span class="pitch-legend-bright-swatch" aria-hidden="true"></span>
                  <b>Brightness</b>
                </span>
                <span class="pitch-legend-item pitch-legend-breath">
                  <span class="pitch-legend-breath-mark" aria-hidden="true">∨</span>
                  <b>Breath cue</b>
                </span>
              </div>
            </div>

            <div class="tracks-area-frame">
              <div
                class="song-ruler"
                id="songRuler"
                aria-label="Song ruler. Click or drag lower half to scrub; drag upper half to loop a range."
                ref=${songRulerRef}
                onPointerDown=${handleRulerPointerDown}
                onPointerMove=${handleRulerPointerMove}
                onPointerUp=${handleRulerPointerUp}
                onPointerCancel=${handleRulerPointerCancel}
              >
                <div class="song-cycle-lane">
                  <${SongRulerSections} sections=${sections} safeDuration=${safeDuration} />
                  <div
                    class=${`song-cycle-selection${cycleActive ? '' : ' inactive'}`}
                    id="songCycleSelection"
                    hidden=${!hasValidCycleRange}
                    style=${cycleStyle}
                    ref=${songCycleSelectionRef}
                  ></div>
                </div>
                <${SongRulerScale} duration=${duration} />
                <div
                  class="song-ruler-playhead"
                  id="songRulerPlayhead"
                  ref=${songRulerPlayheadRef}
                ></div>
              </div>

              <div class="pitch-stage">
                <canvas
                  id="pitchCanvas"
                  aria-label="Scrolling reference pitch contour over time"
                  ref=${pitchCanvasRef}
                ></canvas>
                <div class="pitch-playhead"></div>
                <div class="pitch-orb" id="pitchOrb" ref=${pitchOrbRef}></div>
              </div>

              <${LyricsPanel}
                lyrics=${lyrics}
                cues=${cues}
                onSeekLine=${seekFromRuler}
                controllerRef=${lyricsControllerRef}
              />
            </div>

            <div class="coach-note-banner" id="coachNoteBanner" hidden=${!coachNote}>
              <strong id="coachNoteTitle">${coachNote?.title || 'From your voice teacher'}</strong>
              <span id="coachNoteText">${coachNote?.text || ''}</span>
            </div>
          </article>
        </div>
      </div>

      <div class="youtube-host" aria-hidden="true" ref=${youtubeHostRef}></div>
      <audio
        id="referenceAudio"
        preload="metadata"
        ref=${referenceAudioRef}
        onEnded=${pauseSong}
      ></audio>

      <div class="footer">Reference playback comes from the official YouTube player.</div>
    </section>
  `;
}
