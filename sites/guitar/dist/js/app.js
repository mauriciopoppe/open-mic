import {
  html,
  render,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'htm/preact';
import { click, pluck, preloadGuitarSamples } from './audio.js';
import {
  allLessons,
  defaultKey,
  degreeMap,
  foundationHelp,
  isFoundationLesson,
  lessonQuestionBanks,
  notes,
  phases,
  stringNames,
  tuning,
} from './curriculum-data.js';

export const COMPLETION_STORAGE_KEY = 'guitar-room-complete';
export const HIDE_CIRCLES_STORAGE_KEY = 'guitar-room-hide-circles';

const IDLE_PRACTICE_INTRO =
  'Press Start practicing to quiz yourself using material from the current story step.';

const LABEL_START_INDEX = allLessons.findIndex((item) => item.id === '1.6');
const CAGED_START_INDEX = allLessons.findIndex((item) => item.id === '2.2');
const KEY_START_INDEX = allLessons.findIndex((item) => item.id === '3.1');
const TRAINER_START_INDEX = allLessons.findIndex((item) => item.id === '4.1');

const LABEL_MODES = [
  { name: 'Degrees', help: 'Numbers show each note’s job in the selected key' },
  { name: 'Notes', help: 'E–A–D–G–B–E on the open strings' },
  { name: 'Fingers', help: 'Suggested fretting-hand fingers' },
];

const BOX_OPTIONS = ['All', 'Box 1', 'Box 2', 'Box 3', 'Box 4', 'Box 5'];
const BOX_RANGES = [
  [0, 15],
  [0, 4],
  [3, 7],
  [6, 10],
  [9, 13],
  [12, 15],
];
const FRET_NUMBERS = Array.from({ length: 15 }, (_, index) => index + 1);
const DOTMARK_FRETS = [3, 5, 7, 9, 12, 15];

const SUPPORTS_INVOKER_COMMANDS =
  typeof HTMLButtonElement !== 'undefined' &&
  Object.hasOwn(HTMLButtonElement.prototype, 'commandForElement');

const INITIAL_QUIZ_STATE = {
  active: false,
  kind: null,
  target: null,
  answer: null,
  answered: false,
  result: '',
  intro: IDLE_PRACTICE_INTRO,
  prompt: '',
  hint: '',
  feedback: '',
};

/**
 * Loads per-lesson completion status from localStorage.
 * Migrates legacy array format (e.g. ["1.1", "1.2"]) into a normalized
 * { [lessonId]: boolean } map covering all 17 lessons in the curriculum.
 */
function loadCompletionMap() {
  const base = Object.fromEntries(allLessons.map((lesson) => [lesson.id, false]));
  try {
    const raw = localStorage.getItem(COMPLETION_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const id of parsed) {
        if (Object.hasOwn(base, id)) base[id] = true;
      }
    } else if (parsed && typeof parsed === 'object') {
      for (const lesson of allLessons) {
        if (Object.hasOwn(parsed, lesson.id)) {
          base[lesson.id] = Boolean(parsed[lesson.id]);
        }
      }
    }
  } catch {
    // Ignore storage read/parse errors in restricted browsing contexts.
  }
  return base;
}

function saveCompletionMap(map) {
  const normalized = Object.fromEntries(
    allLessons.map((lesson) => [lesson.id, Boolean(map[lesson.id])])
  );
  try {
    localStorage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage quota/security errors.
  }
  return normalized;
}

function loadCirclesHidden() {
  try {
    return localStorage.getItem(HIDE_CIRCLES_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveCirclesHidden(hidden) {
  try {
    localStorage.setItem(HIDE_CIRCLES_STORAGE_KEY, String(Boolean(hidden)));
  } catch {
    // Ignore storage quota/security errors.
  }
}

function lessonFromHash() {
  if (typeof location === 'undefined') return null;
  const match = location.hash.match(/^#lesson-(\d+\.\d+)$/);
  return match ? allLessons.find((item) => item.id === match[1]) || null : null;
}

function fretFromKeyboardEvent(event) {
  const match = event.code.match(/^Digit([0-9])$/);
  if (!match) return null;
  const digit = Number(match[1]);
  if (!event.shiftKey) return digit;
  return digit <= 5 ? 10 + digit : null;
}

function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function drawBalanced(bagState, items, scope, signatureOf) {
  if (bagState.scope !== scope || !bagState.bag?.length) {
    const bag = shuffled(items);
    if (bag.length > 1 && signatureOf(bag[0]) === bagState.lastSignature) {
      const swapIndex = bag.findIndex(
        (item, index) => index > 0 && signatureOf(item) !== bagState.lastSignature
      );
      if (swapIndex > 0) {
        [bag[0], bag[swapIndex]] = [bag[swapIndex], bag[0]];
      }
    }
    bagState.bag = bag;
    bagState.scope = scope;
  }
  const chosen = bagState.bag.shift();
  bagState.lastSignature = signatureOf(chosen);
  return chosen;
}

function buildQuizPositions(lesson, exIndex, keyPc) {
  const exercise = lesson.exercises[exIndex];
  const shift = (keyPc - defaultKey(lesson.id) + 12) % 12;

  let frets = [
    ...new Set(
      exercise.frets
        .map((fret) => (fret + shift) % 12)
        .map((fret) => (fret === 0 && shift ? 12 : fret))
        .filter((fret) => fret >= 0 && fret <= 15)
    ),
  ];

  if (isFoundationLesson(lesson.id) || !frets.length) {
    frets = [0, ...frets];
  }

  const positions = [];
  for (const string of exercise.strings) {
    for (const fret of frets) {
      positions.push({
        string,
        fret,
        midi: tuning[string] + fret,
        pc: (tuning[string] + fret) % 12,
      });
    }
  }

  return positions.length
    ? positions
    : tuning.map((midi, string) => ({ string, fret: 0, midi, pc: midi % 12 }));
}

function pickNextQuestion(bagState, lesson, exIndex, keyPc) {
  if (lesson.id === '1.5') {
    const candidates = [
      { string: 2, fret: 5 },
      { string: 3, fret: 5 },
      { string: 4, fret: 8 },
      { string: 5, fret: 8 },
    ].map((pair) => {
      const midi = tuning[pair.string] + pair.fret;
      return {
        kind: 'name',
        intro: 'Octave shapes: recognize the repeated note by ear.',
        prompt: `Find the note you hear on the ${stringNames[pair.string]} string.`,
        hint: 'Listen for the octave, then locate that exact pitch. Space reveals the answer.',
        target: { string: pair.string, fret: pair.fret, midi, pc: midi % 12 },
        answer: `${notes[midi % 12]} on the ${stringNames[pair.string]} string, fret ${pair.fret}.`,
      };
    });

    return drawBalanced(
      bagState,
      candidates,
      `${lesson.id}|${exIndex}|octaves`,
      (q) => `${lesson.id}|${q.kind}|${q.target.string}|${q.target.fret}`
    );
  }

  const bank = lessonQuestionBanks[lesson.id];
  if (bank) {
    const candidates = bank.map(([topic, prompt, answer]) => ({
      kind: 'recall',
      intro: `${topic[0].toUpperCase() + topic.slice(1)} questions for this lesson.`,
      prompt,
      hint: `Think in terms of this lesson’s ${topic}. Space reveals the answer.`,
      target: null,
      answer,
    }));

    return drawBalanced(
      bagState,
      candidates,
      `${lesson.id}|${exIndex}|recall`,
      (q) => `${lesson.id}|${q.kind}|${q.prompt}`
    );
  }

  const positions = buildQuizPositions(lesson, exIndex, keyPc);
  const scope = `${lesson.id}|${exIndex}|${positions.map((p) => `${p.string}:${p.fret}`).join(',')}`;
  const target = drawBalanced(
    bagState,
    positions,
    scope,
    (item) => `${lesson.id}|name|${item.string}|${item.fret}|${item.pc}`
  );

  return {
    kind: 'name',
    intro: 'Every fretboard question trains your ear: listen, then find the exact pitch.',
    prompt: `Which fret makes the note you hear on the ${stringNames[target.string]} string?`,
    hint: 'Click the matching fret. The note plays automatically; press R to replay.',
    target,
    answer: `${notes[target.pc]} on the ${stringNames[target.string]} string, fret ${target.fret}.`,
  };
}

function buildFretboardModel({ lesson, exIndex, keyPc, boxValue, labelIndex }) {
  const exercise = lesson.exercises[exIndex];
  const foundation = isFoundationLesson(lesson.id);

  const openNotes = Array.from({ length: 6 }, (_, string) => {
    const y = 90 - string * 16;
    const pc = tuning[string] % 12;
    const rel = (pc - keyPc + 12) % 12;
    return {
      id: `open:${string}`,
      string,
      fret: 0,
      midi: tuning[string],
      y,
      thickness: 2.8 - string * 0.28,
      label: [degreeMap[rel], notes[pc], '-'][labelIndex],
      title: `Open string ${6 - string}: ${notes[pc]}`,
    };
  });

  const shift = (keyPc - defaultKey(lesson.id) + 12) % 12;
  const boxIndex = boxValue === 'All' ? 0 : Number(boxValue.slice(-1));
  const range = BOX_RANGES[boxIndex];

  const baseFrets = [
    ...new Set(
      exercise.frets
        .map((fret) => (fret + shift) % 12)
        .map((fret) => (fret === 0 && shift ? 12 : fret))
        .filter((fret) => fret > 0 && fret >= range[0] && fret <= range[1])
    ),
  ];

  const theoryNotes = [];
  baseFrets.forEach((fret, idx) => {
    for (let string = 0; string < 6; string++) {
      if (!exercise.strings.includes(string)) continue;
      const pc = (tuning[string] + fret) % 12;
      const rel = (pc - keyPc + 12) % 12;
      if (![0, 2, 3, 4, 5, 7, 9, 10, 11].includes(rel)) continue;
      if (idx > 3 && string % 2 && !foundation) continue;

      const type = foundation
        ? 'root'
        : rel === 0
          ? 'root'
          : [3, 4, 7, 10, 11].includes(rel)
            ? 'chord'
            : 'scale';

      theoryNotes.push({
        id: `theory:${string}:${fret}`,
        string,
        fret,
        midi: tuning[string] + fret,
        type,
        x: ((fret - 0.5) / 15) * 100,
        y: 90 - string * 16,
        label: [degreeMap[rel], notes[pc], String([1, 2, 3, 4][idx % 4])][labelIndex],
        title: `String ${6 - string}, fret ${fret}: ${notes[pc]}`,
      });
    }
  });

  let playableNotes;
  if (foundation) {
    playableNotes =
      lesson.id === '1.1'
        ? openNotes
        : [
            ...openNotes.filter((note) => exercise.strings.includes(note.string)),
            ...theoryNotes.filter((note) => note.type === 'root'),
          ];
  } else {
    playableNotes = [...openNotes, ...theoryNotes];
  }

  return { openNotes, theoryNotes, playableNotes };
}

function Topbar() {
  return html`
    <header class="topbar">
      <div class="brand">
        <div class="mark">G</div>
        <div>
          <strong>Practice Room</strong>
          <small>Fretboard · pocket · song transfer</small>
        </div>
      </div>
      <div class="status"><i></i>local practice studio</div>
    </header>
  `;
}

function Hero() {
  return html`
    <section class="hero">
      <div>
        <div class="eyebrow">Five phases · fourteen practical lessons</div>
        <h1>See the neck.<br />Play the song.</h1>
        <p>
          Theory becomes useful when your hands, time, and ears learn it together. Pick a lesson,
          load a drill, and make the fretboard answer back.
        </p>
      </div>
      <div class="hero-note">
        New to guitar theory? Begin with Lesson 1.1 and Exercise A. The page will introduce one
        idea at a time.
      </div>
    </section>
  `;
}

function Fretboard({
  model,
  circlesHidden,
  pressedCoord,
  flashedNoteId,
  answerIndicator,
  onPlayFret,
}) {
  const preventFocus = (event) => event.preventDefault();

  return html`
    <div class="fret-wrap">
      <div class="fretboard ${circlesHidden ? 'hide-circles' : ''}" id="fretboard">
        ${FRET_NUMBERS.map(
          (fret) => html`<i key="wire-${fret}" class="fret" style="left:${(fret / 15) * 100}%"></i>`
        )}

        ${model.openNotes.map(
          (openNote) => html`
            <i
              key="string-${openNote.string}"
              class="string"
              style="top:${openNote.y}%;height:${openNote.thickness}px"
            ></i>
            <button
              key=${openNote.id}
              type="button"
              tabIndex=${-1}
              class="note open-note ${pressedCoord === `${openNote.string}:0` ? 'pressed' : ''} ${
                flashedNoteId === openNote.id ? 'flash' : ''
              }"
              data-fret="0"
              data-string=${openNote.string}
              style="top:${openNote.y}%"
              title=${openNote.title}
              onPointerDown=${preventFocus}
              onClick=${() => onPlayFret(openNote.string, 0)}
            >
              ${openNote.label}
            </button>
            ${FRET_NUMBERS.map((fret) => {
              const coord = `${openNote.string}:${fret}`;
              const noteName = notes[(tuning[openNote.string] + fret) % 12];
              return html`
                <button
                  key="hit-${coord}"
                  type="button"
                  tabIndex=${-1}
                  class="fret-hit ${pressedCoord === coord ? 'pressed' : ''}"
                  data-fret=${fret}
                  data-string=${openNote.string}
                  style="left:${((fret - 1) / 15) * 100}%;top:${openNote.y}%;width:${
                    100 / 15
                  }%;height:16%"
                  title="String ${6 - openNote.string}, fret ${fret}: ${noteName}"
                  onPointerDown=${preventFocus}
                  onClick=${() => onPlayFret(openNote.string, fret)}
                ></button>
              `;
            })}
          `
        )}

        ${DOTMARK_FRETS.flatMap((fret) =>
          (fret === 12 ? [38, 70] : [54]).map(
            (y) => html`
              <i
                key="dot-${fret}-${y}"
                class="dotmark"
                style="left:${((fret - 0.5) / 15) * 100}%;top:${y}%"
              ></i>
            `
          )
        )}

        ${model.theoryNotes.map(
          (item) => html`
            <button
              key=${item.id}
              type="button"
              tabIndex=${-1}
              class="note theory-note ${item.type} ${
                pressedCoord === `${item.string}:${item.fret}` ? 'pressed' : ''
              } ${flashedNoteId === item.id ? 'flash' : ''}"
              data-fret=${item.fret}
              data-string=${item.string}
              style="left:${item.x}%;top:${item.y}%"
              title=${item.title}
              onPointerDown=${preventFocus}
              onClick=${() => onPlayFret(item.string, item.fret)}
            >
              ${item.label}
            </button>
          `
        )}

        ${answerIndicator
          ? html`
              <i
                class="note answer-indicator ${answerIndicator.result}"
                style="left:${
                  answerIndicator.target.fret === 0
                    ? '-30px'
                    : `${((answerIndicator.target.fret - 0.5) / 15) * 100}%`
                };top:${90 - answerIndicator.target.string * 16}%"
                title="Correct answer: ${notes[answerIndicator.target.pc]}, ${
                  stringNames[answerIndicator.target.string]
                }, fret ${answerIndicator.target.fret}"
              >
                ${notes[answerIndicator.target.pc]}
              </i>
            `
          : null}
      </div>

      <div class="fret-numbers" id="fretNumbers">
        ${FRET_NUMBERS.map((fret) => html`<span key=${fret}>${fret}</span>`)}
      </div>
    </div>
  `;
}

function LessonPractice({
  expanded,
  quiz,
  circlesHidden,
  practiceContentRef,
  onToggleExpandFallback,
  onTogglePractice,
  onReplay,
  onToggleCircles,
}) {
  const replayAvailable = quiz.active && Boolean(quiz.target);
  const replayTitle = replayAvailable
    ? 'Replay the current note'
    : quiz.active
      ? 'This question has no audio note'
      : 'Start practicing to hear a note';

  return html`
    <section class="practice-questions" id="practiceSection">
      <div class="practice-head">
        <div>
          <h3>Lesson practice</h3>
          <p class="question-intro" id="practiceSummary">
            Optional ear & fretboard recall drills—expand when you are ready to practice.
          </p>
        </div>
        <button
          type="button"
          class="quiz-action practice-toggle"
          id="practiceExpandBtn"
          commandfor="practiceContent"
          command="--toggle"
          aria-expanded=${String(expanded)}
          onClick=${SUPPORTS_INVOKER_COMMANDS ? undefined : onToggleExpandFallback}
        >
          <span class="expand">Expand practice</span>
          <span class="collapse">Collapse</span>
        </button>
      </div>

      <div
        class="practice-content"
        id="practiceContent"
        ref=${practiceContentRef}
        hidden=${expanded ? false : 'until-found'}
      >
        <div class="practice-controls">
          <button
            type="button"
            class="guided practice-start ${quiz.active ? 'active' : ''}"
            id="startPracticeBtn"
            aria-pressed=${String(quiz.active)}
            onClick=${onTogglePractice}
          >
            ${quiz.active ? '■ Stop practicing' : '▶ Start practicing'}
          </button>
          <button
            type="button"
            class="quiz-action"
            id="replayButton"
            disabled=${!replayAvailable}
            title=${replayTitle}
            onClick=${onReplay}
          >
            🔊 Replay · R
          </button>
          <button
            type="button"
            class="quiz-action"
            id="circleToggle"
            aria-pressed=${String(circlesHidden)}
            title="Hide or show fretboard note circles"
            onClick=${onToggleCircles}
          >
            ${circlesHidden ? '👁 Show circles · H' : '👁 Hide circles · H'}
          </button>
        </div>

        <p class="question-intro" id="questionIntro">${quiz.intro}</p>

        <div class="quiz-body ${quiz.active ? 'visible' : ''}" id="quizBody">
          <div class="quiz-question-row">
            <i
              class=${`quiz-current ${quiz.result}`.trim()}
              id="quizCurrent"
              aria-label="Question ${quiz.result || 'unanswered'}"
            ></i>
            <div class="quiz-prompt" id="quizPrompt">${quiz.prompt}</div>
          </div>
          <div class="quiz-hint" id="quizHint">${quiz.hint}</div>
          <div class="quiz-answers" id="quizAnswers"></div>
          <div class="quiz-actions" id="quizActions">
            <span class="muted">
              ${quiz.target
                ? 'Fret keys: 0–9 · Shift+0–5: frets 10–15 · Space: reveal · R: replay'
                : 'Space: reveal answer'}
            </span>
          </div>
          <div class="quiz-feedback ${quiz.result}" id="quizFeedback">${quiz.feedback}</div>
        </div>
      </div>
    </section>
  `;
}

function Curriculum({
  activeLessonId,
  completionMap,
  openPhases,
  onSelectLesson,
  onSetLessonComplete,
  onPhaseToggle,
  onToggleAllFallback,
}) {
  const completedCount = allLessons.reduce(
    (sum, item) => sum + (completionMap[item.id] ? 1 : 0),
    0
  );
  const allOpen = openPhases.length === phases.length;

  return html`
    <section class="card drawer">
      <div class="drawer-head">
        <h2>Curriculum</h2>
        <div class="drawer-actions">
          <span class="progress" id="progress">
            ${completedCount} / ${allLessons.length} complete
          </span>
          <button
            type="button"
            class="tiny"
            id="toggleAllPhases"
            commandfor="curriculum"
            command="--toggle-all"
            aria-expanded=${String(allOpen)}
            onClick=${SUPPORTS_INVOKER_COMMANDS ? undefined : onToggleAllFallback}
          >
            <span class="expand">Expand lessons</span>
            <span class="collapse">Collapse lessons</span>
          </button>
        </div>
      </div>

      <div id="curriculum">
        ${phases.map(
          (phase, phaseIndex) => html`
            <details
              key=${phase.title}
              class="phase"
              data-phase=${phaseIndex}
              open=${openPhases.includes(phaseIndex)}
              onToggle=${(event) => onPhaseToggle(phaseIndex, event.currentTarget.open)}
            >
              <summary class="phase-title">
                <span class="phase-copy">
                  ${phase.title}
                  <span class="muted">${phase.goal}</span>
                </span>
              </summary>
              <div class="phase-lessons">
                ${phase.lessons.map((item) => {
                  const isDone = Boolean(completionMap[item.id]);
                  const isActive = item.id === activeLessonId;
                  const checkId = `complete-${item.id.replace('.', '-')}`;
                  return html`
                    <div key=${item.id} class="lesson-row ${isActive ? 'active' : ''}">
                      <label class="lesson-check-wrap" for=${checkId}>
                        <input
                          type="checkbox"
                          class="lesson-check"
                          id=${checkId}
                          data-complete=${item.id}
                          checked=${isDone}
                          onChange=${(event) =>
                            onSetLessonComplete(item.id, event.currentTarget.checked)}
                        />
                        <span class="visually-hidden">
                          Mark lesson ${item.id} ${item.title} complete
                        </span>
                      </label>
                      <button
                        type="button"
                        class="lesson-link ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}"
                        data-lesson=${item.id}
                        onClick=${() => onSelectLesson(item.id)}
                      >
                        ${item.id} · ${item.title}
                      </button>
                    </div>
                  `;
                })}
              </div>
            </details>
          `
        )}
      </div>
    </section>
  `;
}

function LessonDoc({ lesson, exIndex, isComplete, onToggleComplete }) {
  const current = lesson.exercises[exIndex];

  return html`
    <article class="card lesson-doc" id="lessonDoc">
      <div class="doc-top">
        <div class="ref">${lesson.phase} · ${lesson.ref}</div>
        <h2>${lesson.id} · ${lesson.title}</h2>
        <p>${lesson.goal}</p>
      </div>
      <section class="doc-card">
        <h3>The idea</h3>
        <ul>
          ${lesson.mental.map((point) => html`<li key=${point}>${point}</li>`)}
        </ul>
      </section>
      <section class="doc-card">
        <h3>See it on the fretboard</h3>
        <div class="blueprint">${lesson.blueprint}</div>
      </section>
      <section class="doc-card">
        <h3>Story step ${exIndex + 1} of ${lesson.exercises.length}</h3>
        <div class="exercise-load">
          <span class="exercise-top">
            <strong>${current.name}</strong>
            <span>${current.bpm} BPM</span>
          </span>
          <p>${current.description}</p>
        </div>
      </section>
      <section class="doc-card">
        <h3>What your hands should feel</h3>
        <div class="cue"><strong>Stay relaxed.</strong> ${lesson.cue}</div>
      </section>
      <section class="doc-card">
        <h3>Finish this chapter</h3>
        <label class="checkpoint" for="complete">
          <input
            type="checkbox"
            id="complete"
            checked=${isComplete}
            onChange=${(event) => onToggleComplete(event.currentTarget.checked)}
          />
          <span>${lesson.mastery}</span>
        </label>
      </section>
    </article>
  `;
}

function App() {
  const initialLesson = useMemo(() => lessonFromHash() || allLessons[0], []);

  const [lessonId, setLessonId] = useState(initialLesson.id);
  const [exIndex, setExIndex] = useState(0);
  const [bpm, setBpm] = useState(initialLesson.exercises[0].bpm);
  const [keyPc, setKeyPc] = useState(() => defaultKey(initialLesson.id));
  const [boxValue, setBoxValue] = useState('All');
  const [labelIndex, setLabelIndex] = useState(1);
  const [clickMode, setClickMode] = useState('standard');
  const [playing, setPlaying] = useState(false);
  const [transportPos, setTransportPos] = useState({ bar: 1, beat: 0 });
  const [flashedNoteId, setFlashedNoteId] = useState(null);
  const [pressedCoord, setPressedCoord] = useState(null);
  const [circlesHidden, setCirclesHidden] = useState(() => loadCirclesHidden());
  const [completionMap, setCompletionMap] = useState(() => saveCompletionMap(loadCompletionMap()));
  const [openPhases, setOpenPhases] = useState(() => [initialLesson.phaseIndex]);
  const [practiceExpanded, setPracticeExpanded] = useState(false);
  const [quiz, setQuiz] = useState(INITIAL_QUIZ_STATE);
  const [sampleStatus, setSampleStatus] = useState({
    text: 'loading acoustic guitar…',
    state: '',
  });

  const lesson = useMemo(
    () => allLessons.find((item) => item.id === lessonId) || allLessons[0],
    [lessonId]
  );
  const lessonIndex = useMemo(
    () => allLessons.findIndex((item) => item.id === lesson.id),
    [lesson.id]
  );
  const exercise = lesson.exercises[exIndex];
  const foundation = isFoundationLesson(lesson.id);

  const fretboardModel = useMemo(
    () => buildFretboardModel({ lesson, exIndex, keyPc, boxValue, labelIndex }),
    [lesson, exIndex, keyPc, boxValue, labelIndex]
  );

  const practiceContentRef = useRef(null);
  const pressedTimerRef = useRef(null);
  const quizAudioTimerRef = useRef(null);
  const quizAdvanceTimerRef = useRef(null);
  const quizBagRef = useRef({ bag: null, scope: null, lastSignature: '' });
  const transportRunRef = useRef({ beat: 0, step: 0, loops: 0 });

  const playNote = useCallback(
    (midi) => {
      pluck(midi, 2.2, setSampleStatus);
    },
    []
  );

  const clearQuizTimers = useCallback(() => {
    clearTimeout(quizAudioTimerRef.current);
    clearTimeout(quizAdvanceTimerRef.current);
  }, []);

  const resetPractice = useCallback(() => {
    clearQuizTimers();
    quizBagRef.current = { bag: null, scope: null, lastSignature: '' };
    setQuiz(INITIAL_QUIZ_STATE);
  }, [clearQuizTimers]);

  const stopPlayback = useCallback(() => {
    setPlaying(false);
    setFlashedNoteId(null);
  }, []);

  const resetTransport = useCallback(() => {
    transportRunRef.current = { beat: 0, step: 0, loops: 0 };
    setTransportPos({ bar: 1, beat: 0 });
    setFlashedNoteId(null);
  }, []);

  const setLessonComplete = useCallback((targetId, done) => {
    setCompletionMap((prev) => {
      if (!Object.hasOwn(prev, targetId)) return prev;
      const next = { ...prev, [targetId]: Boolean(done) };
      return saveCompletionMap(next);
    });
  }, []);

  const selectLesson = useCallback(
    (nextId, updateHash = true) => {
      const nextLesson = allLessons.find((item) => item.id === nextId);
      if (!nextLesson) return;

      stopPlayback();
      resetTransport();
      resetPractice();
      setPracticeExpanded(false);
      setLessonId(nextLesson.id);
      setExIndex(0);
      setBpm(nextLesson.exercises[0].bpm);
      setKeyPc(defaultKey(nextLesson.id));
      setOpenPhases((prev) =>
        prev.includes(nextLesson.phaseIndex) ? prev : [...prev, nextLesson.phaseIndex]
      );

      if (updateHash && location.hash !== `#lesson-${nextLesson.id}`) {
        history.pushState(null, '', `#lesson-${nextLesson.id}`);
      }
    },
    [resetPractice, resetTransport, stopPlayback]
  );

  const selectExercise = useCallback(
    (nextIndex) => {
      stopPlayback();
      resetTransport();
      resetPractice();
      setExIndex(nextIndex);
      setBpm(lesson.exercises[nextIndex].bpm);
    },
    [lesson, resetPractice, resetTransport, stopPlayback]
  );

  const startNextQuestion = useCallback(
    (targetLesson = lesson, targetExIndex = exIndex, targetKeyPc = keyPc) => {
      clearQuizTimers();
      const picked = pickNextQuestion(quizBagRef.current, targetLesson, targetExIndex, targetKeyPc);
      setQuiz({
        active: true,
        kind: picked.kind,
        target: picked.target,
        answer: picked.answer,
        answered: false,
        result: '',
        intro: picked.intro,
        prompt: picked.prompt,
        hint: picked.hint,
        feedback: '',
      });

      if (picked.target) {
        quizAudioTimerRef.current = setTimeout(() => {
          playNote(picked.target.midi);
        }, 120);
      }
    },
    [clearQuizTimers, exIndex, keyPc, lesson, playNote]
  );

  const togglePractice = useCallback(() => {
    if (quiz.active) {
      resetPractice();
    } else {
      setPracticeExpanded(true);
      quizBagRef.current = { bag: null, scope: null, lastSignature: '' };
      startNextQuestion();
    }
  }, [quiz.active, resetPractice, startNextQuestion]);

  const setExpandedState = useCallback(
    (nextExpanded) => {
      const value = Boolean(nextExpanded);
      setPracticeExpanded(value);
      if (!value) {
        resetPractice();
      }
    },
    [resetPractice]
  );

  const recordQuizResult = useCallback(
    (currentQuiz, correct, revealed = false) => {
      clearQuizTimers();
      const result = revealed ? 'revealed' : correct ? 'correct' : 'wrong';
      const isMobile = matchMedia('(max-width: 700px), (pointer: coarse)').matches;
      const nextText = isMobile
        ? ' Next question shortly.'
        : ' Press Space for the next question.';
      const answer = currentQuiz.answer || '';
      const feedback = revealed
        ? `Answer: ${answer}${nextText}`
        : correct
          ? `Correct.${nextText}`
          : `Not yet. The answer is ${answer}${nextText}`;

      setQuiz((prev) => ({
        ...prev,
        answered: true,
        result,
        feedback,
      }));

      if (result === 'wrong' && currentQuiz.target) {
        quizAudioTimerRef.current = setTimeout(() => {
          playNote(currentQuiz.target.midi);
        }, 180);
      }

      if (isMobile) {
        quizAdvanceTimerRef.current = setTimeout(() => {
          startNextQuestion();
        }, 1800);
      }
    },
    [clearQuizTimers, playNote, startNextQuestion]
  );

  const handlePlayFret = useCallback(
    (string, fret) => {
      playNote(tuning[string] + fret);
      clearTimeout(pressedTimerRef.current);
      setPressedCoord(`${string}:${fret}`);
      pressedTimerRef.current = setTimeout(() => setPressedCoord(null), 180);

      if (quiz.active && quiz.kind === 'name' && !quiz.answered && quiz.target) {
        const playedMidi = tuning[string] + fret;
        const correct = string === quiz.target.string && playedMidi === quiz.target.midi;
        recordQuizResult(quiz, correct, false);
      }
    },
    [playNote, quiz, recordQuizResult]
  );

  const replayCurrentNote = useCallback(() => {
    if (quiz.active && quiz.target) {
      playNote(quiz.target.midi);
    }
  }, [playNote, quiz.active, quiz.target]);

  const revealOrAdvance = useCallback(() => {
    if (!quiz.active) return;
    if (quiz.answered) {
      startNextQuestion();
    } else {
      if (quiz.target) playNote(quiz.target.midi);
      recordQuizResult(quiz, false, true);
    }
  }, [playNote, quiz, recordQuizResult, startNextQuestion]);

  const toggleCircles = useCallback(() => {
    setCirclesHidden((prev) => {
      const next = !prev;
      saveCirclesHidden(next);
      return next;
    });
  }, []);

  const toggleAllPhases = useCallback(() => {
    setOpenPhases((prev) =>
      prev.length === phases.length ? [] : phases.map((_, index) => index)
    );
  }, []);

  const handlePhaseToggle = useCallback((phaseIndex, isOpen) => {
    setOpenPhases((prev) => {
      const has = prev.includes(phaseIndex);
      if (has === isOpen) return prev;
      return isOpen ? [...prev, phaseIndex] : prev.filter((item) => item !== phaseIndex);
    });
  }, []);

  const handleGuidedStep = useCallback(() => {
    if (exIndex + 1 < lesson.exercises.length) {
      selectExercise(exIndex + 1);
      return;
    }
    setLessonComplete(lesson.id, true);
    if (lessonIndex + 1 < allLessons.length) {
      selectLesson(allLessons[lessonIndex + 1].id);
    }
  }, [exIndex, lesson, lessonIndex, selectExercise, selectLesson, setLessonComplete]);

  // Initial URL hash normalization and acoustic sample preloading.
  useEffect(() => {
    if (!lessonFromHash()) {
      history.replaceState(null, '', `#lesson-${initialLesson.id}`);
    }
    preloadGuitarSamples(setSampleStatus);
    return () => {
      clearTimeout(pressedTimerRef.current);
      clearQuizTimers();
    };
  }, [clearQuizTimers, initialLesson.id]);

  // Browser hash navigation (back/forward or manual hash edits).
  useEffect(() => {
    const syncFromHash = () => {
      const target = lessonFromHash();
      if (target && target.id !== lessonId) {
        selectLesson(target.id, false);
      }
    };
    window.addEventListener('hashchange', syncFromHash);
    window.addEventListener('popstate', syncFromHash);
    return () => {
      window.removeEventListener('hashchange', syncFromHash);
      window.removeEventListener('popstate', syncFromHash);
    };
  }, [lessonId, selectLesson]);

  // Cross-tab localStorage completion synchronization.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === COMPLETION_STORAGE_KEY) {
        setCompletionMap(loadCompletionMap());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Invoker command events (--toggle-all on #curriculum, --toggle on #practiceContent)
  // and find-in-page beforematch sync on #practiceContent.
  useEffect(() => {
    const onCommand = (event) => {
      if (event.command === '--toggle-all' && event.target.id === 'curriculum') {
        toggleAllPhases();
      } else if (event.command === '--toggle' && event.target.id === 'practiceContent') {
        setExpandedState(!practiceExpanded);
      }
    };
    const onBeforeMatch = () => setPracticeExpanded(true);

    document.addEventListener('command', onCommand, { capture: true });
    const contentNode = practiceContentRef.current;
    contentNode?.addEventListener('beforematch', onBeforeMatch);

    return () => {
      document.removeEventListener('command', onCommand, { capture: true });
      contentNode?.removeEventListener('beforematch', onBeforeMatch);
    };
  }, [practiceExpanded, setExpandedState, toggleAllPhases]);

  // Metronome and fretboard exercise playback loop.
  useEffect(() => {
    if (!playing) return undefined;

    const runStep = () => {
      const run = transportRunRef.current;
      const nextBeat = (run.beat % 4) + 1;
      let nextLoops = run.loops;

      if (nextBeat === 1 && run.step > 0) {
        nextLoops += 1;
        if (clickMode === 'trainer' && nextLoops % 4 === 0) {
          setBpm((current) => Math.min(180, current + 2));
        }
      }

      run.beat = nextBeat;
      run.loops = nextLoops;
      setTransportPos({ bar: nextLoops + 1, beat: nextBeat });

      if (clickMode !== 'backbeat' || nextBeat === 2 || nextBeat === 4) {
        click(nextBeat === 1 || nextBeat === 2, setSampleStatus);
      }

      if (fretboardModel.playableNotes.length > 0) {
        const marker =
          fretboardModel.playableNotes[run.step % fretboardModel.playableNotes.length];
        setFlashedNoteId(marker.id);
        playNote(marker.midi);
      }

      run.step += 1;
    };

    const timer = setTimeout(runStep, transportRunRef.current.step === 0 ? 0 : 60000 / bpm);
    return () => clearTimeout(timer);
  }, [bpm, clickMode, fretboardModel.playableNotes, playNote, playing, transportPos]);

  // Global keyboard shortcuts (H for circles; 0–9, Shift+0–5, R, Space during active practice).
  useEffect(() => {
    const onKeyDown = (event) => {
      if (
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      if (quiz.active && quiz.kind === 'name' && quiz.target) {
        const fret = fretFromKeyboardEvent(event);
        if (fret !== null && fret >= 0 && fret <= 15) {
          event.preventDefault();
          handlePlayFret(quiz.target.string, fret);
          return;
        }
      }

      if (event.key.toLowerCase() === 'h') {
        event.preventDefault();
        toggleCircles();
        return;
      }

      if (!quiz.active) return;

      if (event.code === 'Space') {
        if (['BUTTON', 'SUMMARY', 'A'].includes(event.target.tagName)) return;
        event.preventDefault();
        revealOrAdvance();
      } else if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        replayCurrentNote();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePlayFret, quiz, replayCurrentNote, revealOrAdvance, toggleCircles]);

  const lastStep = exIndex === lesson.exercises.length - 1;
  const lastLesson = lessonIndex === allLessons.length - 1;
  const guidedLabel = !lastStep
    ? 'Next story step →'
    : !lastLesson
      ? 'Finish chapter →'
      : completionMap[lesson.id]
        ? 'Curriculum complete ✓'
        : 'Finish chapter ✓';

  const answerIndicator =
    quiz.active && quiz.answered && quiz.target
      ? { target: quiz.target, result: quiz.result }
      : null;

  return html`
    <${Topbar} />
    <${Hero} />

    <div class="app">
      <section class="card player">
        <div class="lesson-head">
          <div>
            <h2 id="playerLesson">${lesson.id} · ${lesson.title}</h2>
            <p id="playerPhase">
              Story step ${exIndex + 1} of ${lesson.exercises.length} · ${lesson.phase}
            </p>
          </div>
          <button type="button" class="guided" id="guided" onClick=${handleGuidedStep}>
            ${guidedLabel}
          </button>
        </div>

        <div class="exercise-tabs" id="exerciseTabs"></div>

        <div class="now">
          <div>
            <div class="now-label">Now loaded</div>
            <h3 id="nowName">${exercise.name}</h3>
            <p id="nowDescription">${exercise.description}</p>
          </div>
          <button
            type="button"
            class="play ${playing ? 'active' : ''}"
            id="play"
            aria-label=${playing ? 'Pause exercise' : 'Play exercise'}
            onClick=${() => (playing ? stopPlayback() : setPlaying(true))}
          >
            ${playing ? 'Ⅱ' : '▶'}
          </button>
        </div>

        <div class="transport" id="transport" hidden=${foundation}>
          <div class="lcd">
            <span>
              <small>BAR</small>
              <b id="bar">${transportPos.bar}</b>
            </span>
            <span>
              <small>BEAT</small>
              <b id="beat">${transportPos.beat || 1}</b>
            </span>
            <span>
              <small>DIV</small>
              <b id="division">1</b>
            </span>
            <div class="beat-dots" id="beatDots">
              ${[1, 2, 3, 4].map(
                (dot) => html`
                  <i
                    key=${dot}
                    class="beat ${playing && transportPos.beat === dot ? 'on' : ''}"
                  ></i>
                `
              )}
            </div>
          </div>

          <div class="tempo">
            <button
              type="button"
              id="tempoDown"
              aria-label="Decrease tempo"
              onClick=${() => setBpm((value) => Math.max(40, value - 1))}
            >
              −
            </button>
            <span id="tempoValue">${bpm} BPM</span>
            <button
              type="button"
              id="tempoUp"
              aria-label="Increase tempo"
              onClick=${() => setBpm((value) => Math.min(180, value + 1))}
            >
              +
            </button>
          </div>

          <button
            type="button"
            class="mode-btn ${clickMode === 'standard' ? 'active' : ''}"
            data-click="standard"
            onClick=${() => setClickMode('standard')}
          >
            Count 1·2·3·4
          </button>
          <button
            type="button"
            class="mode-btn ${clickMode === 'backbeat' ? 'active' : ''}"
            data-click="backbeat"
            hidden=${lessonIndex < KEY_START_INDEX}
            onClick=${() => setClickMode('backbeat')}
          >
            Backbeat 2 & 4
          </button>
          <button
            type="button"
            class="mode-btn ${clickMode === 'trainer' ? 'active' : ''}"
            data-click="trainer"
            hidden=${lessonIndex < TRAINER_START_INDEX}
            onClick=${() => setClickMode('trainer')}
          >
            Speed trainer
          </button>
        </div>

        <div class="toolbar" id="toolbar" hidden=${foundation}>
          <span class="toolbar-group" id="keyControls" hidden=${lessonIndex < KEY_START_INDEX}>
            <label for="key">Key</label>
            <select
              id="key"
              value=${String(keyPc)}
              onChange=${(event) => setKeyPc(Number(event.currentTarget.value))}
            >
              ${notes.map(
                (name, index) => html`<option key=${name} value=${String(index)}>${name}</option>`
              )}
            </select>
            <button
              type="button"
              class="tiny"
              id="downKey"
              onClick=${() => setKeyPc((value) => (value + 11) % 12)}
            >
              − st
            </button>
            <button
              type="button"
              class="tiny"
              id="upKey"
              onClick=${() => setKeyPc((value) => (value + 1) % 12)}
            >
              + st
            </button>
          </span>

          <span class="toolbar-group" id="cagedControls" hidden=${lessonIndex < CAGED_START_INDEX}>
            <label for="box">CAGED area</label>
            <select
              id="box"
              value=${boxValue}
              onChange=${(event) => setBoxValue(event.currentTarget.value)}
            >
              ${BOX_OPTIONS.map((opt) => html`<option key=${opt} value=${opt}>${opt}</option>`)}
            </select>
          </span>

          <span class="toolbar-group" id="labelControls" hidden=${lessonIndex < LABEL_START_INDEX}>
            <span class="toolbar-label">Circle labels</span>
            <button
              type="button"
              class="tiny"
              id="labelMode"
              onClick=${() => setLabelIndex((value) => (value + 1) % LABEL_MODES.length)}
            >
              ${LABEL_MODES[labelIndex].name}
            </button>
            <span class="muted toolbar-help" id="labelHelp">
              ${LABEL_MODES[labelIndex].help}
            </span>
          </span>

          <span class="muted sample-status ${sampleStatus.state}" id="sampleStatus">
            ${sampleStatus.text}
          </span>
          <a
            class="muted sample-credit"
            href="https://github.com/nbrosowsky/tonejs-instruments"
            target="_blank"
            rel="noreferrer"
          >
            Tone.js Instruments · CC BY 3.0
          </a>
        </div>

        <${Fretboard}
          model=${fretboardModel}
          circlesHidden=${circlesHidden}
          pressedCoord=${pressedCoord}
          flashedNoteId=${flashedNoteId}
          answerIndicator=${answerIndicator}
          onPlayFret=${handlePlayFret}
        />

        <div class="legend" id="practiceGuide">
          <strong>${foundation ? 'Your only job' : 'This step'}:</strong>
          <span>${foundation ? foundationHelp[lesson.id] : exercise.description}</span>
        </div>

        <${LessonPractice}
          expanded=${practiceExpanded}
          quiz=${quiz}
          circlesHidden=${circlesHidden}
          practiceContentRef=${practiceContentRef}
          onToggleExpandFallback=${() => setExpandedState(!practiceExpanded)}
          onTogglePractice=${togglePractice}
          onReplay=${replayCurrentNote}
          onToggleCircles=${toggleCircles}
        />
      </section>

      <aside class="side">
        <${Curriculum}
          activeLessonId=${lesson.id}
          completionMap=${completionMap}
          openPhases=${openPhases}
          onSelectLesson=${(id) => selectLesson(id, true)}
          onSetLessonComplete=${setLessonComplete}
          onPhaseToggle=${handlePhaseToggle}
          onToggleAllFallback=${toggleAllPhases}
        />

        <${LessonDoc}
          lesson=${lesson}
          exIndex=${exIndex}
          isComplete=${Boolean(completionMap[lesson.id])}
          onToggleComplete=${(done) => setLessonComplete(lesson.id, done)}
        />
      </aside>
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
