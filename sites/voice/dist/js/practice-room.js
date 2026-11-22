import { html, useCallback, useEffect, useMemo, useRef, useState } from 'htm/preact';
import { playMetronomeClick, playTone } from './piano-audio.js';
import {
  ALL_ROUTINE_STEP_IDS,
  EXERCISES,
  KEYBOARD_KEYS,
  LANES,
  NOTE_BEATS,
  PRE_ROUTINE_COLUMNS,
  computeScalePlan,
  exerciseElapsedDurationSec,
  exerciseTotalDurationSec,
  formatTime,
  isStaticLoopPlan,
  laneForExercise,
  noteName,
  sessionForKey,
  sessionForTabKey,
  stepBeatOffset,
  totalBarBeats,
  videoUrlForExercise,
} from './practice-data.js';

const STORAGE_KEY_PREROUTINE = 'voice_preroutine_collapsed';
const STORAGE_KEY_SHIFTS = 'voice_piano_scale_shifts';
const STORAGE_KEY_TEMPOS = 'voice_piano_bpms';
const STORAGE_KEY_METRONOME = 'voice_piano_metronome';

function readStorageString(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageString(key, value) {
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

function readStorageObject(key) {
  const raw = readStorageString(key);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn(`Failed to parse ${key} from localStorage`, error);
    return {};
  }
}

function resolveExerciseTempo(bpmsMap, key) {
  const saved = Number(bpmsMap[key]);
  const fallback = EXERCISES[key]?.recommendedBpm || 110;
  return saved >= 60 && saved <= 160 ? saved : fallback;
}

function resolveExerciseShift(shiftsMap, key) {
  const entry = shiftsMap[key];
  return {
    keyShift: entry && typeof entry.keyShift === 'number' ? entry.keyShift : 0,
    peakPush: entry && typeof entry.peakPush === 'number' ? entry.peakPush : 0,
  };
}

function idlePhaseText(ex, plan, sessionMode, sessionIndex, sessionLength) {
  const staticLoop = isStaticLoopPlan(plan);
  if (sessionMode) {
    return `Session ${sessionIndex + 1}/${sessionLength} · ${
      staticLoop ? 'Riff loop' : 'Scale up → scale down'
    } → next exercise`;
  }
  return staticLoop ? 'Riff loop → finish' : 'Scale up → scale down → finish';
}

function runningPhaseText(plan, repeatCycle, sessionMode, sessionIndex, sessionLength) {
  const totalBars = plan.all.length;
  const prefix = sessionMode ? `Session ${sessionIndex + 1}/${sessionLength} · ` : '';
  const phase = repeatCycle % totalBars;
  if (isStaticLoopPlan(plan)) {
    return `${prefix}Riff loop · rep ${phase + 1}/${totalBars}`;
  }
  const peakIdx = plan.up.length - 1;
  if (phase < peakIdx) return `${prefix}Scale up · bar ${phase + 1}/${totalBars}`;
  if (phase === peakIdx) return `${prefix}Scale peak · bar ${phase + 1}/${totalBars}`;
  return `${prefix}Scale down · bar ${phase + 1}/${totalBars}`;
}

function Keyboard({ activeNotes, activeLegStartMidi, activeLegEndMidi, onKeyPress }) {
  return html`
    <div class="keyboard-wrap" aria-label="Visual piano keyboard">
      <div class="keyboard" id="keyboard">
        ${KEYBOARD_KEYS.map((k) => {
          const isActive = activeNotes.includes(k.midi);
          const isStart = k.midi === activeLegStartMidi;
          const isEnd = k.midi === activeLegEndMidi && activeLegEndMidi !== activeLegStartMidi;
          const badge =
            isStart && activeLegEndMidi === activeLegStartMidi
              ? 'GROUND'
              : isStart
                ? 'START'
                : isEnd
                  ? 'END'
                  : '';
          const className = [
            'key',
            k.isBlack ? 'black' : 'white',
            isActive ? 'active' : '',
            isStart ? 'ground-start' : '',
            isEnd ? 'ground-end' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return html`
            <div
              key=${k.midi}
              class=${className}
              data-note=${k.note}
              data-midi=${String(k.midi)}
              style=${{ width: `${k.widthPct}%`, left: `${k.leftPct}%` }}
              onPointerDown=${() => onKeyPress(k.midi)}
            >
              <span class="key-badge">${badge}</span>
              <span class="key-label">${k.note}</span>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

function CueCard({ cue }) {
  return html`
    <div class="cue">
      <strong>${cue.title}</strong>
      <p>
        ${cue.body}${cue.emphasis ? html`<em>${cue.emphasis}</em>` : null}${cue.bodyAfterEmphasis ||
        ''}${cue.apply ? html` <strong>How to apply:</strong> ${cue.apply}` : null}
      </p>
    </div>
  `;
}

export function PracticeRoom({ active, onStatusChange }) {
  const [routineCollapsed, setRoutineCollapsed] = useState(
    () => readStorageString(STORAGE_KEY_PREROUTINE) === 'true'
  );
  const [routineChecked, setRoutineChecked] = useState(() =>
    Object.fromEntries(ALL_ROUTINE_STEP_IDS.map((id) => [id, false]))
  );
  const [exerciseShifts, setExerciseShifts] = useState(() => readStorageObject(STORAGE_KEY_SHIFTS));
  const [exerciseBpms, setExerciseBpms] = useState(() => readStorageObject(STORAGE_KEY_TEMPOS));
  const [metronomeOn, setMetronomeOn] = useState(
    () => readStorageString(STORAGE_KEY_METRONOME) === 'true'
  );

  const [selected, setSelected] = useState('head');
  const [activeSession, setActiveSession] = useState('youtube');
  const [sessionMode, setSessionMode] = useState(false);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [repeatCycle, setRepeatCycle] = useState(0);
  const [activeNotes, setActiveNotes] = useState([]);
  const [lcd, setLcd] = useState({ bar: 1, beat: 1, div: 1, activeBeatIndex: -1 });
  const [phaseReadout, setPhaseReadout] = useState(() => {
    const initialEx = EXERCISES.head;
    const initialShift = resolveExerciseShift(readStorageObject(STORAGE_KEY_SHIFTS), 'head');
    const initialPlan = computeScalePlan(initialEx, initialShift.keyShift, initialShift.peakPush);
    return idlePhaseText(initialEx, initialPlan, false, 0, 7);
  });

  const timeSliderRef = useRef(null);
  const timeCurrentRef = useRef(null);
  const timeTotalRef = useRef(null);
  const timelineRef = useRef({ curSec: 0, totalSec: 0 });
  const statusCbRef = useRef(onStatusChange);
  statusCbRef.current = onStatusChange;

  const schedRef = useRef({
    playing: false,
    selected: 'head',
    activeSession: 'youtube',
    sessionMode: false,
    sessionIndex: 0,
    exerciseBpms,
    exerciseShifts,
    metronomeOn,
    step: 0,
    repeatCycle: 0,
    barCount: 0,
    timerId: null,
    beatTimerIds: [],
    noteTimerIds: [],
    previewTimerId: null,
    rafId: null,
    isSeeking: false,
    stepStartTime: 0,
    stepStartSec: 0,
  });

  schedRef.current.exerciseBpms = exerciseBpms;
  schedRef.current.exerciseShifts = exerciseShifts;
  schedRef.current.metronomeOn = metronomeOn;

  const renderTimeSlider = useCallback((curSec, totalSec) => {
    const clampedTotal = Math.max(0, totalSec);
    const clampedCur = Math.min(clampedTotal, Math.max(0, curSec));
    timelineRef.current = { curSec: clampedCur, totalSec: clampedTotal };
    const slider = timeSliderRef.current;
    const curEl = timeCurrentRef.current;
    const totEl = timeTotalRef.current;
    const curFormatted = formatTime(clampedCur);
    const totFormatted = formatTime(clampedTotal);
    if (slider) {
      slider.max = clampedTotal.toFixed(2);
      slider.value = clampedCur.toFixed(2);
      const progressPct = clampedTotal > 0 ? (clampedCur / clampedTotal) * 100 : 0;
      slider.style.setProperty(
        '--control-progress',
        `${Math.min(100, Math.max(0, progressPct))}%`
      );
      slider.setAttribute('aria-valuetext', `${curFormatted} of ${totFormatted}`);
    }
    if (curEl) setDomText(curEl, curFormatted);
    if (totEl) setDomText(totEl, totFormatted);
  }, []);

  const clearScheduledTimers = useCallback(() => {
    const s = schedRef.current;
    if (s.timerId) {
      clearTimeout(s.timerId);
      s.timerId = null;
    }
    s.beatTimerIds.forEach(clearTimeout);
    s.beatTimerIds = [];
    s.noteTimerIds.forEach(clearTimeout);
    s.noteTimerIds = [];
  }, []);

  const stopRafLoop = useCallback(() => {
    const s = schedRef.current;
    if (s.rafId) {
      cancelAnimationFrame(s.rafId);
      s.rafId = null;
    }
  }, []);

  const currentPlanFor = useCallback((exKey, shiftsOverride) => {
    const ex = EXERCISES[exKey];
    const shifts = shiftsOverride || schedRef.current.exerciseShifts;
    const shift = resolveExerciseShift(shifts, exKey);
    return computeScalePlan(ex, shift.keyShift, shift.peakPush);
  }, []);

  const currentBpmFor = useCallback((exKey, bpmsOverride) => {
    const bpms = bpmsOverride || schedRef.current.exerciseBpms;
    return resolveExerciseTempo(bpms, exKey);
  }, []);

  const startRafLoop = useCallback(() => {
    const s = schedRef.current;
    if (s.rafId) cancelAnimationFrame(s.rafId);
    const loop = () => {
      if (!s.playing) {
        s.rafId = null;
        return;
      }
      if (!s.isSeeking) {
        const ex = EXERCISES[s.selected];
        if (ex) {
          const plan = currentPlanFor(s.selected);
          const bpm = currentBpmFor(s.selected);
          const totalSec = exerciseTotalDurationSec(ex, plan, bpm);
          const elapsedInStep = (performance.now() - s.stepStartTime) / 1000;
          const curSec = Math.min(totalSec, s.stepStartSec + Math.max(0, elapsedInStep));
          renderTimeSlider(curSec, totalSec);
        }
      }
      s.rafId = requestAnimationFrame(loop);
    };
    s.rafId = requestAnimationFrame(loop);
  }, [currentBpmFor, currentPlanFor, renderTimeSlider]);

  const scheduleBeatTicks = useCallback((ex, stepIndex, bpm) => {
    const s = schedRef.current;
    s.beatTimerIds.forEach(clearTimeout);
    s.beatTimerIds = [];
    const rawOffset = stepBeatOffset(ex, stepIndex);
    const nearestBeat = Math.round(rawOffset);
    const isOnBeat = Math.abs(rawOffset - nearestBeat) < 1e-6;
    const stepBeats = NOTE_BEATS[ex.steps[stepIndex].duration] || 1;
    const beatMs = 60000 / bpm;
    const currentBar = s.barCount + 1;

    if (isOnBeat) {
      const wholeBeats = Math.max(1, Math.floor(stepBeats + 1e-6));
      for (let b = 0; b < wholeBeats; b++) {
        const beatIdx = nearestBeat + b;
        const run = () => {
          if (!s.playing) return;
          setLcd({ bar: currentBar, beat: beatIdx + 1, div: 1, activeBeatIndex: beatIdx });
          if (s.metronomeOn) playMetronomeClick(beatIdx === 0, statusCbRef.current);
        };
        if (b === 0) run();
        else s.beatTimerIds.push(setTimeout(run, b * beatMs));
      }
    } else {
      const beatIdx = Math.floor(rawOffset + 1e-6);
      const frac = rawOffset - beatIdx;
      const divUnit = ex.steps[stepIndex].duration === 'triplet' ? 1 / 3 : 0.25;
      const subDiv = Math.round(frac / divUnit) + 1;
      setLcd({ bar: currentBar, beat: beatIdx + 1, div: subDiv, activeBeatIndex: beatIdx });
      for (let nextBeat = beatIdx + 1; nextBeat < rawOffset + stepBeats - 1e-6; nextBeat++) {
        const delay = (nextBeat - rawOffset) * beatMs;
        s.beatTimerIds.push(
          setTimeout(() => {
            if (!s.playing) return;
            setLcd({ bar: currentBar, beat: nextBeat + 1, div: 1, activeBeatIndex: nextBeat });
            if (s.metronomeOn) playMetronomeClick(nextBeat === 0, statusCbRef.current);
          }, delay)
        );
      }
    }
  }, []);

  const triggerStepNotes = useCallback((notes, delayMs) => {
    const s = schedRef.current;
    s.noteTimerIds.forEach(clearTimeout);
    s.noteTimerIds = [];
    const durationSec = (delayMs / 1000) * 0.85;
    notes.forEach((midi, i) => {
      if (i === 0) {
        playTone(midi, durationSec, notes.length, statusCbRef.current);
      } else {
        s.noteTimerIds.push(
          setTimeout(() => {
            if (!s.playing) return;
            playTone(midi, durationSec, notes.length, statusCbRef.current);
          }, i * 16)
        );
      }
    });
  }, []);

  const finishPlayback = useCallback(
    (statusMessage) => {
      const s = schedRef.current;
      s.playing = false;
      stopRafLoop();
      clearScheduledTimers();
      s.step = 0;
      s.repeatCycle = 0;
      s.barCount = 0;
      s.stepStartTime = performance.now();
      s.stepStartSec = 0;

      const ex = EXERCISES[s.selected];
      const plan = currentPlanFor(s.selected);
      const bpm = currentBpmFor(s.selected);
      const totalSec = exerciseTotalDurationSec(ex, plan, bpm);

      setPlaying(false);
      setSelected(s.selected);
      setSessionIndex(s.sessionIndex);
      setRepeatCycle(0);
      setPhaseReadout(statusMessage);
      setActiveNotes([]);
      setLcd({ bar: 1, beat: 1, div: 1, activeBeatIndex: -1 });
      renderTimeSlider(0, totalSec);
    },
    [clearScheduledTimers, currentBpmFor, currentPlanFor, renderTimeSlider, stopRafLoop]
  );

  const tickRef = useRef(null);

  const tick = useCallback(() => {
    const s = schedRef.current;
    if (!s.playing) return;
    let ex = EXERCISES[s.selected];
    let plan = currentPlanFor(s.selected);

    if (s.step >= ex.steps.length) {
      s.step = 0;
      s.barCount += 1;
      const cycleBars = plan.all.length;
      if (s.repeatCycle + 1 >= cycleBars) {
        const session = sessionForKey(s.activeSession);
        const seq = session.sequence;
        if (s.sessionMode) {
          if (s.sessionIndex + 1 < seq.length) {
            s.sessionIndex += 1;
            s.selected = seq[s.sessionIndex];
            s.repeatCycle = 0;
            s.barCount = 0;
            setSessionIndex(s.sessionIndex);
            setSelected(s.selected);
            setRepeatCycle(0);
            ex = EXERCISES[s.selected];
            plan = currentPlanFor(s.selected);
          } else {
            s.sessionIndex = 0;
            s.selected = seq[0];
            finishPlayback(
              `Session complete · All ${seq.length} ${session.title} exercises finished`
            );
            return;
          }
        } else {
          finishPlayback(`Exercise complete · ${ex.name} finished`);
          return;
        }
      } else {
        s.repeatCycle = (s.repeatCycle + 1) % cycleBars;
        setRepeatCycle(s.repeatCycle);
      }
    }

    const bpm = currentBpmFor(s.selected);
    const event = ex.steps[s.step];
    const session = sessionForKey(s.activeSession);
    setPhaseReadout(
      runningPhaseText(plan, s.repeatCycle, s.sessionMode, s.sessionIndex, session.sequence.length)
    );
    scheduleBeatTicks(ex, s.step, bpm);

    const phaseIdx = s.repeatCycle % plan.all.length;
    const currentOffset = plan.all[phaseIdx] || 0;
    const prevOffset = phaseIdx === 0 ? plan.all[0] || 0 : plan.all[phaseIdx - 1];
    const stepOffset = event.scale === 'previous' ? prevOffset : currentOffset;
    const notes = event.notes.map((n) => n + stepOffset);
    const delayMs = (60000 / bpm) * (NOTE_BEATS[event.duration] || 1);

    setActiveNotes(notes);
    triggerStepNotes(notes, delayMs);

    s.stepStartTime = performance.now();
    s.stepStartSec = exerciseElapsedDurationSec(ex, s.repeatCycle, s.step, bpm);
    s.step += 1;
    s.timerId = setTimeout(() => tickRef.current?.(), Math.max(40, delayMs));
  }, [
    currentBpmFor,
    currentPlanFor,
    finishPlayback,
    scheduleBeatTicks,
    triggerStepNotes,
  ]);

  tickRef.current = tick;

  const pausePlayback = useCallback(() => {
    const s = schedRef.current;
    if (!s.playing) return;
    s.playing = false;
    stopRafLoop();
    clearScheduledTimers();
    const ex = EXERCISES[s.selected];
    const plan = currentPlanFor(s.selected);
    const session = sessionForKey(s.activeSession);
    const staticLoop = isStaticLoopPlan(plan);
    setPlaying(false);
    setPhaseReadout(
      s.sessionMode
        ? `Session ${s.sessionIndex + 1}/${session.sequence.length} · Paused`
        : staticLoop
          ? 'Riff loop → finish'
          : 'Scale up → scale down → finish'
    );
    setActiveNotes([]);
    setLcd({ bar: 1, beat: 1, div: 1, activeBeatIndex: -1 });
  }, [clearScheduledTimers, currentPlanFor, stopRafLoop]);

  const togglePlay = useCallback(() => {
    const s = schedRef.current;
    if (s.playing) {
      pausePlayback();
      return;
    }
    if (s.previewTimerId) {
      clearTimeout(s.previewTimerId);
      s.previewTimerId = null;
    }
    s.playing = true;
    setPlaying(true);
    startRafLoop();
    tickRef.current?.();
  }, [pausePlayback, startRafLoop]);

  useEffect(() => {
    if (!active && schedRef.current.playing) {
      pausePlayback();
    }
  }, [active, pausePlayback]);

  useEffect(() => {
    const s = schedRef.current;
    const ex = EXERCISES[s.selected];
    const plan = currentPlanFor(s.selected);
    const bpm = currentBpmFor(s.selected);
    renderTimeSlider(0, exerciseTotalDurationSec(ex, plan, bpm));
    return () => {
      stopRafLoop();
      clearScheduledTimers();
      if (s.previewTimerId) clearTimeout(s.previewTimerId);
    };
  }, [clearScheduledTimers, currentBpmFor, currentPlanFor, renderTimeSlider, stopRafLoop]);

  const resetExerciseTransport = useCallback(
    (nextSelected, nextActiveSession, nextSessionMode, nextSessionIndex) => {
      const s = schedRef.current;
      stopRafLoop();
      clearScheduledTimers();
      s.selected = nextSelected;
      s.activeSession = nextActiveSession;
      s.sessionMode = nextSessionMode;
      s.sessionIndex = nextSessionIndex;
      s.step = 0;
      s.repeatCycle = 0;
      s.barCount = 0;
      s.stepStartTime = performance.now();
      s.stepStartSec = 0;

      const ex = EXERCISES[nextSelected];
      const plan = currentPlanFor(nextSelected);
      const bpm = currentBpmFor(nextSelected);
      const session = sessionForKey(nextActiveSession);
      const totalSec = exerciseTotalDurationSec(ex, plan, bpm);

      setSelected(nextSelected);
      setActiveSession(nextActiveSession);
      setSessionMode(nextSessionMode);
      setSessionIndex(nextSessionIndex);
      setRepeatCycle(0);
      setPhaseReadout(
        idlePhaseText(ex, plan, nextSessionMode, nextSessionIndex, session.sequence.length)
      );
      setActiveNotes([]);
      setLcd({ bar: 1, beat: 1, div: 1, activeBeatIndex: -1 });
      renderTimeSlider(0, totalSec);

      if (s.playing) {
        startRafLoop();
        s.timerId = setTimeout(() => tickRef.current?.(), 120);
      }
    },
    [clearScheduledTimers, currentBpmFor, currentPlanFor, renderTimeSlider, startRafLoop, stopRafLoop]
  );

  const handleLaneChange = useCallback(
    (laneId) => {
      const currentLane = laneForExercise(schedRef.current.selected);
      if (currentLane.id === laneId) return;
      const targetLane = LANES.find((l) => l.id === laneId);
      if (!targetLane) return;
      const nextActiveSession = targetLane.session
        ? targetLane.session.key
        : schedRef.current.activeSession;
      resetExerciseTransport(targetLane.defaultExercise, nextActiveSession, false, 0);
    },
    [resetExerciseTransport]
  );

  const handleTabClick = useCallback(
    (tabKey) => {
      const s = schedRef.current;
      const targetSession = sessionForTabKey(tabKey);
      let nextSelected = s.selected;
      let nextActiveSession = s.activeSession;
      let nextSessionMode = s.sessionMode;
      let nextSessionIndex = s.sessionIndex;

      if (targetSession) {
        if (s.sessionMode && s.activeSession === targetSession.key) {
          nextSessionMode = false;
        } else {
          nextActiveSession = targetSession.key;
          nextSessionMode = true;
          const curIdx = targetSession.sequence.indexOf(s.selected);
          nextSessionIndex = curIdx >= 0 ? curIdx : 0;
          nextSelected = targetSession.sequence[nextSessionIndex];
        }
      } else {
        nextSelected = tabKey;
        const lane = laneForExercise(tabKey);
        if (lane.session) nextActiveSession = lane.session.key;
        if (s.sessionMode) {
          const seq = sessionForKey(nextActiveSession).sequence;
          const idx = seq.indexOf(nextSelected);
          if (idx >= 0) nextSessionIndex = idx;
          else nextSessionMode = false;
        }
      }
      resetExerciseTransport(nextSelected, nextActiveSession, nextSessionMode, nextSessionIndex);
    },
    [resetExerciseTransport]
  );

  const handleSetTempo = useCallback(
    (nextRawBpm) => {
      const s = schedRef.current;
      const clamped = Math.max(60, Math.min(160, nextRawBpm));
      const nextBpms = { ...s.exerciseBpms, [s.selected]: clamped };
      s.exerciseBpms = nextBpms;
      setExerciseBpms(nextBpms);
      writeStorageString(STORAGE_KEY_TEMPOS, JSON.stringify(nextBpms));

      const ex = EXERCISES[s.selected];
      const plan = currentPlanFor(s.selected);
      s.stepStartTime = performance.now();
      s.stepStartSec = exerciseElapsedDurationSec(ex, s.repeatCycle, s.step, clamped);
      renderTimeSlider(s.stepStartSec, exerciseTotalDurationSec(ex, plan, clamped));
    },
    [currentPlanFor, renderTimeSlider]
  );

  const handleToggleMetronome = useCallback(() => {
    setMetronomeOn((prev) => {
      const next = !prev;
      schedRef.current.metronomeOn = next;
      writeStorageString(STORAGE_KEY_METRONOME, String(next));
      return next;
    });
  }, []);

  const applyShiftValues = useCallback(
    (nextKeyShift, nextPeakPush) => {
      const s = schedRef.current;
      const nextShifts = {
        ...s.exerciseShifts,
        [s.selected]: { keyShift: nextKeyShift, peakPush: nextPeakPush },
      };
      s.exerciseShifts = nextShifts;
      setExerciseShifts(nextShifts);
      writeStorageString(STORAGE_KEY_SHIFTS, JSON.stringify(nextShifts));

      const ex = EXERCISES[s.selected];
      const plan = currentPlanFor(s.selected, nextShifts);
      const bpm = currentBpmFor(s.selected);
      const session = sessionForKey(s.activeSession);
      setPhaseReadout(
        runningPhaseText(plan, s.repeatCycle, s.sessionMode, s.sessionIndex, session.sequence.length)
      );
      renderTimeSlider(s.stepStartSec, exerciseTotalDurationSec(ex, plan, bpm));

      if (s.playing) {
        const event = ex.steps[s.step];
        if (event) {
          const phaseIdx = s.repeatCycle % plan.all.length;
          const currentOffset = plan.all[phaseIdx] || 0;
          const prevOffset = phaseIdx === 0 ? plan.all[0] || 0 : plan.all[phaseIdx - 1];
          const stepOffset = event.scale === 'previous' ? prevOffset : currentOffset;
          setActiveNotes(event.notes.map((n) => n + stepOffset));
        }
      }
    },
    [currentBpmFor, currentPlanFor, renderTimeSlider]
  );

  const handleShiftDelta = useCallback(
    (dKey, dPeak) => {
      const cur = resolveExerciseShift(schedRef.current.exerciseShifts, schedRef.current.selected);
      const nextKey = Math.max(-6, Math.min(6, cur.keyShift + dKey));
      const nextPeak = Math.max(-4, Math.min(6, cur.peakPush + dPeak));
      applyShiftValues(nextKey, nextPeak);
    },
    [applyShiftValues]
  );

  const handleResetShift = useCallback(() => {
    applyShiftValues(0, 0);
  }, [applyShiftValues]);

  const seekToTime = useCallback(
    (targetSec) => {
      const s = schedRef.current;
      const ex = EXERCISES[s.selected];
      if (!ex) return;
      const plan = currentPlanFor(s.selected);
      const bpm = currentBpmFor(s.selected);
      const totalSec = exerciseTotalDurationSec(ex, plan, bpm);
      const clampedSec = Math.max(0, Math.min(totalSec, targetSec));
      const beatSec = 60 / bpm;
      const totalBeats = clampedSec / beatSec;
      const barBeats = totalBarBeats(ex);
      const totalBars = plan.all.length;

      let targetCycle = Math.floor(totalBeats / barBeats);
      if (targetCycle >= totalBars) targetCycle = totalBars - 1;
      const beatsInBar = totalBeats - targetCycle * barBeats;

      let targetStep = 0;
      for (let idx = 0; idx < ex.steps.length; idx++) {
        const sOffset = stepBeatOffset(ex, idx);
        if (beatsInBar >= sOffset - 1e-4) targetStep = idx;
      }

      s.repeatCycle = targetCycle;
      s.step = targetStep;
      s.barCount = targetCycle;

      clearScheduledTimers();

      const session = sessionForKey(s.activeSession);
      setRepeatCycle(targetCycle);
      setPhaseReadout(
        runningPhaseText(
          plan,
          targetCycle,
          s.sessionMode,
          s.sessionIndex,
          session.sequence.length
        )
      );

      const event = ex.steps[targetStep];
      const phaseIdx = targetCycle % plan.all.length;
      const currentOffset = plan.all[phaseIdx] || 0;
      const prevOffset = phaseIdx === 0 ? plan.all[0] || 0 : plan.all[phaseIdx - 1];
      const stepOffset = event.scale === 'previous' ? prevOffset : currentOffset;
      const notes = event.notes.map((n) => n + stepOffset);
      setActiveNotes(notes);

      s.stepStartTime = performance.now();
      s.stepStartSec = clampedSec;
      renderTimeSlider(clampedSec, totalSec);

      if (s.playing) {
        scheduleBeatTicks(ex, targetStep, bpm);
        const delayMs = (60000 / bpm) * (NOTE_BEATS[event.duration] || 1);
        triggerStepNotes(notes, delayMs);
        s.step += 1;
        s.timerId = setTimeout(() => tickRef.current?.(), Math.max(40, delayMs));
        startRafLoop();
      } else {
        const rawOffset = stepBeatOffset(ex, targetStep);
        const nearestBeat = Math.round(rawOffset);
        setLcd({
          bar: targetCycle + 1,
          beat: nearestBeat + 1,
          div: 1,
          activeBeatIndex: nearestBeat,
        });
      }
    },
    [
      clearScheduledTimers,
      currentBpmFor,
      currentPlanFor,
      renderTimeSlider,
      scheduleBeatTicks,
      startRafLoop,
      triggerStepNotes,
    ]
  );

  const handleSliderInput = useCallback((event) => {
    const slider = event.currentTarget;
    schedRef.current.isSeeking = true;
    const val = Number(slider.value);
    const max = Number(slider.max) || 1;
    const pct = Math.min(100, Math.max(0, (val / max) * 100));
    slider.style.setProperty('--control-progress', `${pct}%`);
    const curFormatted = formatTime(val);
    const totFormatted = timeTotalRef.current?.textContent || formatTime(max);
    if (timeCurrentRef.current) setDomText(timeCurrentRef.current, curFormatted);
    slider.setAttribute('aria-valuetext', `${curFormatted} of ${totFormatted}`);
  }, []);

  const handleSliderChange = useCallback(
    (event) => {
      const val = Number(event.currentTarget.value);
      seekToTime(val);
      schedRef.current.isSeeking = false;
    },
    [seekToTime]
  );

  const handleKeyPress = useCallback((midi) => {
    playTone(midi, 0.75, 1, statusCbRef.current);
    const s = schedRef.current;
    if (!s.playing) {
      if (s.previewTimerId) clearTimeout(s.previewTimerId);
      setActiveNotes([midi]);
      s.previewTimerId = setTimeout(() => {
        if (!schedRef.current.playing) setActiveNotes([]);
        schedRef.current.previewTimerId = null;
      }, 500);
    }
  }, []);

  const handleToggleRoutineCollapse = useCallback(() => {
    setRoutineCollapsed((prev) => {
      const next = !prev;
      writeStorageString(STORAGE_KEY_PREROUTINE, String(next));
      return next;
    });
  }, []);

  const handleToggleRoutineStep = useCallback((stepId) => {
    setRoutineChecked((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  }, []);

  const handleResetRoutine = useCallback(() => {
    setRoutineChecked(Object.fromEntries(ALL_ROUTINE_STEP_IDS.map((id) => [id, false])));
  }, []);

  const ex = EXERCISES[selected];
  const currentLane = laneForExercise(selected);
  const currentSession = sessionForKey(activeSession);
  const currentShift = resolveExerciseShift(exerciseShifts, selected);
  const currentBpm = resolveExerciseTempo(exerciseBpms, selected);
  const plan = useMemo(
    () => computeScalePlan(ex, currentShift.keyShift, currentShift.peakPush),
    [ex, currentShift.keyShift, currentShift.peakPush]
  );
  const barBeatsCount = useMemo(() => Math.round(totalBarBeats(ex)), [ex]);
  const videoUrl = videoUrlForExercise(selected);

  const exerciseLabelText = sessionMode
    ? `${currentSession.title} · ${sessionIndex + 1}/${currentSession.sequence.length} · ${
        ex.label.split(' · ').slice(-1)[0]
      }`
    : ex.label;

  const noteReadoutText = activeNotes.length ? activeNotes.map(noteName).join(' · ') : '—';

  const groundBaseMidi =
    typeof ex.groundMidi === 'number'
      ? ex.groundMidi
      : ex.steps[ex.steps.length - 1].notes[0];
  const goingUp = (repeatCycle % plan.all.length) < plan.up.length;
  const upStartMidi = groundBaseMidi + plan.up[0];
  const upEndMidi = groundBaseMidi + plan.up[plan.up.length - 1];
  const downStartMidi = plan.down.length ? groundBaseMidi + plan.down[0] : upEndMidi;
  const downEndMidi = plan.down.length ? groundBaseMidi + plan.down[plan.down.length - 1] : upStartMidi;
  const activeLegStartMidi = goingUp ? upStartMidi : downStartMidi;
  const activeLegEndMidi = goingUp ? upEndMidi : downEndMidi;

  const shiftTagParts = [];
  if (currentShift.keyShift !== 0) {
    shiftTagParts.push(`${currentShift.keyShift > 0 ? '+' : ''}${currentShift.keyShift} st`);
  }
  if (currentShift.peakPush !== 0) {
    shiftTagParts.push(`${currentShift.peakPush > 0 ? '+' : ''}${currentShift.peakPush} top`);
  }
  const shiftTagNode = shiftTagParts.length
    ? html` <span class="grounding-shift-tag">(${shiftTagParts.join(' · ')})</span>`
    : null;

  const staticLoop = isStaticLoopPlan(plan);
  const shiftsAreDefault = currentShift.keyShift === 0 && currentShift.peakPush === 0;

  return html`
    <section class="route-page" id="practicePage" data-route-page="practice" hidden=${!active}>
      <section class="hero">
        <div>
          <div class="eyebrow">Practice, not performance</div>
          <h1>Give your voice a little room to open.</h1>
          <p>
            A gentle piano companion shaped around your Vocal Coach’s lesson: relaxed head voice,
            chest-voice clarity, R&B agility, and open resonance.
          </p>
        </div>
        <div class="hero-note">
          Each lane starts with a clear key cue, repeats its figure without doubling the tonic, then
          changes scale with two slow notes: the current tonic followed by the next tonic.
        </div>
      </section>

      <section class="app-grid" aria-label="Practice player">
        <article class="card player">
          <section
            class=${`pre-routine-card${routineCollapsed ? ' collapsed' : ''}`}
            id="preVocalRoutine"
            aria-label="Pre-vocal body, breath and diction routine"
          >
            <div class="pre-routine-head">
              <div class="pre-routine-title-wrap">
                <span class="pre-routine-eyebrow">Stage 0 · Before the Piano Scales</span>
                <h2 class="pre-routine-title">Body, Breath & 10× Diction Routine</h2>
              </div>
              <div class="pre-routine-actions">
                <button
                  class="pre-routine-btn"
                  id="preRoutineReset"
                  type="button"
                  onClick=${handleResetRoutine}
                >
                  Reset
                </button>
                <button
                  class="pre-routine-btn"
                  id="preRoutineToggle"
                  type="button"
                  aria-expanded=${String(!routineCollapsed)}
                  onClick=${handleToggleRoutineCollapse}
                >
                  ${routineCollapsed ? 'Expand' : 'Collapse'}
                </button>
              </div>
            </div>
            <div class="pre-routine-body">
              ${PRE_ROUTINE_COLUMNS.map(
                (col) => html`
                  <div class="routine-col" key=${col.label}>
                    <div class="routine-col-label">${col.label}</div>
                    ${col.steps.map((stepItem) => {
                      const pressed = Boolean(routineChecked[stepItem.id]);
                      return html`
                        <button
                          key=${stepItem.id}
                          class="routine-step-btn"
                          type="button"
                          data-routine-step=${stepItem.id}
                          aria-pressed=${String(pressed)}
                          onClick=${() => handleToggleRoutineStep(stepItem.id)}
                        >
                          <span class="routine-check" aria-hidden="true">✓</span>
                          <span class="routine-step-copy">
                            <strong>${stepItem.title}</strong>
                            <span>${stepItem.description}</span>
                          </span>
                        </button>
                      `;
                    })}
                  </div>
                `
              )}
            </div>
          </section>

          <div class="card-head">
            <div>
              <h2 class="card-title">Piano room</h2>
              <p class="card-subtitle">Choose a lane, then let the pattern loop beneath you.</p>
            </div>
          </div>

          <div class="now-playing">
            <div class="now-picker">
              <div class="lane-radio-group" role="radiogroup" aria-label="Practice lane">
                ${LANES.map(
                  (lane) => html`
                    <label class="lane-radio" key=${lane.id}>
                      <input
                        type="radio"
                        name="practiceLane"
                        value=${lane.id}
                        checked=${lane.id === currentLane.id}
                        onChange=${() => handleLaneChange(lane.id)}
                      />
                      <span>${lane.radioLabel}</span>
                    </label>
                  `
                )}
              </div>

              <div class="exercise-groups" role="tablist" aria-label="Exercise patterns">
                ${LANES.map((lane) => {
                  const isActiveLane = lane.id === currentLane.id;
                  const sessionTabActive =
                    Boolean(lane.session) && sessionMode && activeSession === lane.session.key;
                  return html`
                    <div
                      key=${lane.id}
                      class="exercise-group"
                      data-lane=${lane.id}
                      hidden=${!isActiveLane}
                    >
                      <div class="exercise-group-label">
                        ${lane.videoUrl
                          ? html`
                              <span>${lane.groupLabel}</span>
                              <a
                                class="group-video-link"
                                href=${lane.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                ↗ YouTube
                              </a>
                            `
                          : lane.groupLabel}
                      </div>
                      <div class="exercise-tabs">
                        ${lane.session
                          ? html`
                              <button
                                class=${`exercise-tab session-tab${sessionTabActive ? ' active' : ''}`}
                                type="button"
                                data-exercise=${lane.session.tabKey}
                                role="tab"
                                aria-selected=${String(sessionTabActive)}
                                onClick=${() => handleTabClick(lane.session.tabKey)}
                              >
                                ${lane.session.tabLabel}
                              </button>
                            `
                          : null}
                        ${lane.tabs.map((tab) => {
                          const isCurrent = tab.id === selected;
                          const seqIdx =
                            sessionMode && lane.session && activeSession === lane.session.key
                              ? lane.session.sequence.indexOf(tab.id)
                              : -1;
                          const isDone = sessionMode && seqIdx >= 0 && seqIdx < sessionIndex;
                          const cls = [
                            'exercise-tab',
                            isCurrent ? 'active' : '',
                            isDone ? 'done' : '',
                          ]
                            .filter(Boolean)
                            .join(' ');
                          return html`
                            <button
                              key=${tab.id}
                              class=${cls}
                              type="button"
                              data-exercise=${tab.id}
                              role="tab"
                              aria-selected=${String(isCurrent)}
                              onClick=${() => handleTabClick(tab.id)}
                            >
                              ${tab.label}
                            </button>
                          `;
                        })}
                      </div>
                    </div>
                  `;
                })}
              </div>
            </div>

            <div class="now-details">
              <div class="now-label-row">
                <div class="now-label" id="exerciseLabel">${exerciseLabelText}</div>
                <a
                  class="now-video-link"
                  id="nowVideoLink"
                  href=${videoUrl || '#practice'}
                  target="_blank"
                  rel="noopener noreferrer"
                  hidden=${!videoUrl}
                >
                  ↗ Watch on YouTube
                </a>
              </div>
              <h3 class="now-name" id="exerciseName">${ex.name}</h3>
              <p class="now-description" id="exerciseDescription">${ex.description}</p>
              <div class="note-readout" id="noteReadout" aria-live="polite">${noteReadoutText}</div>
              <div class="phase-readout" id="phaseReadout">${phaseReadout}</div>
              <div class="scale-shift-bar" aria-label="Scale shift adjustments">
                <div class="shift-control" role="group" aria-label="Key transposition shift">
                  <span class="shift-label">Key Shift</span>
                  <div class="shift-stepper">
                    <button
                      class="shift-btn"
                      id="keyShiftDown"
                      type="button"
                      aria-label="Decrease key shift by 1 semitone"
                      onClick=${() => handleShiftDelta(-1, 0)}
                    >
                      −
                    </button>
                    <span class="shift-val" id="keyShiftVal">
                      ${`${currentShift.keyShift > 0 ? '+' : ''}${currentShift.keyShift} st`}
                    </span>
                    <button
                      class="shift-btn"
                      id="keyShiftUp"
                      type="button"
                      aria-label="Increase key shift by 1 semitone"
                      onClick=${() => handleShiftDelta(1, 0)}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div class="shift-control" role="group" aria-label="Top peak range push">
                  <span class="shift-label">Top Push</span>
                  <div class="shift-stepper">
                    <button
                      class="shift-btn"
                      id="peakPushDown"
                      type="button"
                      aria-label="Decrease top peak range"
                      onClick=${() => handleShiftDelta(0, -1)}
                    >
                      −
                    </button>
                    <span class="shift-val" id="peakPushVal">
                      ${`${currentShift.peakPush > 0 ? '+' : ''}${currentShift.peakPush} top`}
                    </span>
                    <button
                      class="shift-btn"
                      id="peakPushUp"
                      type="button"
                      aria-label="Increase top peak range"
                      onClick=${() => handleShiftDelta(0, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  class=${`shift-reset-btn${shiftsAreDefault ? ' hidden' : ''}`}
                  id="shiftResetBtn"
                  type="button"
                  aria-label="Reset scale shifts to default"
                  onClick=${handleResetShift}
                >
                  Reset
                </button>
              </div>
              <div
                class="grounding-strip"
                id="groundingStrip"
                aria-label="Scale starting and ending grounding notes"
              >
                ${staticLoop
                  ? html`
                      <span class="grounding-pill active-up">
                        ↻ Riff loop (${plan.all.length}× in key):${' '}
                        <strong>Tonic ${noteName(upStartMidi)}</strong>${shiftTagNode}
                      </span>
                      <span class="grounding-pill">
                        Use <strong>Key Shift</strong> to transpose or <strong>Top Push</strong> to
                        add ascending keys
                      </span>
                    `
                  : html`
                      <span class=${`grounding-pill${goingUp ? ' active-up' : ''}`}>
                        ↑ Scale up (${plan.up.length} bars):${' '}
                        <strong>Start ${noteName(upStartMidi)} → Peak ${noteName(upEndMidi)}</strong>${shiftTagNode}
                      </span>
                      <span class=${`grounding-pill${!goingUp ? ' active-down' : ''}`}>
                        ↓ Scale down (${plan.down.length} bars):${' '}
                        <strong>Start ${noteName(downStartMidi)} → End ${noteName(downEndMidi)}</strong>
                      </span>
                    `}
              </div>
            </div>

            <button
              class=${`play-button${playing ? ' playing' : ''}`}
              id="playButton"
              type="button"
              aria-label=${playing ? 'Stop piano pattern' : 'Play piano pattern'}
              title=${playing ? 'Stop piano pattern' : 'Play piano pattern'}
              onClick=${togglePlay}
            >
              ${playing ? 'Ⅱ' : '▶'}
            </button>

            <div class="timeline-row">
              <span class="time-label" id="timeCurrent" ref=${timeCurrentRef}></span>
              <div class="time-slider-wrap">
                <input
                  type="range"
                  id="timeSlider"
                  class="time-slider"
                  min="0"
                  step="0.01"
                  aria-label="Exercise time progression"
                  ref=${timeSliderRef}
                  onInput=${handleSliderInput}
                  onChange=${handleSliderChange}
                />
              </div>
              <span class="time-label" id="timeTotal" ref=${timeTotalRef}></span>
            </div>
          </div>

          <section class="card transport-card" aria-label="Transport, tempo and metronome">
            <div class="logic-lcd" aria-label="Bar and beat counter">
              <div class="lcd-metrics">
                <div class="lcd-cell">
                  <span class="lcd-label">Bar</span>
                  <span class="lcd-value" id="lcdBar">${lcd.bar}</span>
                </div>
                <div class="lcd-divider"></div>
                <div class="lcd-cell">
                  <span class="lcd-label">Beat</span>
                  <span class="lcd-value" id="lcdBeat">${lcd.beat}</span>
                </div>
                <div class="lcd-divider"></div>
                <div class="lcd-cell">
                  <span class="lcd-label">Div</span>
                  <span class="lcd-value" id="lcdDiv">${lcd.div}</span>
                </div>
                <div class="lcd-divider"></div>
                <div class="lcd-cell">
                  <span class="lcd-label">Sig</span>
                  <span class="lcd-value" id="lcdSig">${`${barBeatsCount}/4`}</span>
                </div>
              </div>
              <div class="beat-dots" id="beatDots" aria-hidden="true">
                ${Array.from({ length: barBeatsCount }, (_, idx) => {
                  const dotCls = [
                    'beat-dot',
                    idx === 0 ? 'downbeat' : '',
                    idx === lcd.activeBeatIndex ? 'active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return html`<span key=${idx} class=${dotCls}></span>`;
                })}
              </div>
            </div>
            <div class="controlbar-actions">
              <div class="tempo-stepper" role="group" aria-label="Tempo">
                <button
                  class="tempo-step-btn"
                  id="tempoDown"
                  type="button"
                  aria-label="Decrease tempo"
                  onClick=${() => handleSetTempo(currentBpm - 1)}
                >
                  −
                </button>
                <output class="tempo-readout" id="tempoValue">${`${currentBpm} BPM`}</output>
                <button
                  class="tempo-step-btn"
                  id="tempoUp"
                  type="button"
                  aria-label="Increase tempo"
                  onClick=${() => handleSetTempo(currentBpm + 1)}
                >
                  +
                </button>
              </div>
              <button
                class=${`metronome-btn${metronomeOn ? ' active' : ''}`}
                id="metronomeButton"
                type="button"
                aria-pressed=${String(metronomeOn)}
                title="Toggle metronome click"
                onClick=${handleToggleMetronome}
              >
                ◷ Metronome
              </button>
            </div>
          </section>

          <${Keyboard}
            activeNotes=${activeNotes}
            activeLegStartMidi=${activeLegStartMidi}
            activeLegEndMidi=${activeLegEndMidi}
            onKeyPress=${handleKeyPress}
          />

          <div class="lane-cues" aria-label="Selected lane guidance">
            ${LANES.map(
              (lane) => html`
                <section
                  key=${lane.id}
                  class="side-panel"
                  data-side-panel=${lane.id}
                  hidden=${lane.id !== currentLane.id}
                >
                  <div class="section-title">
                    <h2>${lane.cuesHeading}</h2>
                    ${lane.videoUrl
                      ? html`
                          <a
                            class="cue-video-link"
                            href=${lane.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            ${lane.cuesLinkText}
                          </a>
                        `
                      : html`<span>${lane.cuesMeta}</span>`}
                  </div>
                  <div class="cue-list">
                    ${lane.cues.map((cue) => html`<${CueCard} key=${cue.title} cue=${cue} />`)}
                  </div>
                </section>
              `
            )}
          </div>
        </article>
      </section>

      <div class="footer">
        A calm practice tool for consistency. Your voice does not need to be forced into progress.
      </div>
    </section>
  `;
}
