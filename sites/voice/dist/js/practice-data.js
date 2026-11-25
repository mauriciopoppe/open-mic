export const NOTE_BEATS = {
  whole: 4,
  sevenEighths: 3.5,
  dottedHalf: 3,
  fiveEighths: 2.5,
  half: 2,
  dottedQuarter: 1.5,
  quarter: 1,
  eighth: 0.5,
  triplet: 1 / 3,
  sixteenth: 0.25,
};

export const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export function noteName(midi) {
  return NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

function rangeOffsets(from, to, step = 1) {
  const out = [];
  const dir = to >= from ? Math.abs(step) : -Math.abs(step);
  for (let v = from; dir > 0 ? v <= to : v >= to; v += dir) out.push(v);
  return out;
}

export const PRE_ROUTINE_COLUMNS = [
  {
    label: '1 · Physical, Facial & Breath Prep',
    steps: [
      {
        id: 'fold',
        title: '1. Inhale reach → exhale fold (3–4×)',
        description:
          'Inhale while lifting arms overhead; exhale while bending down and letting arms, chest, and upper body hang loose.',
      },
      {
        id: 'neck',
        title: '2. Neck & head circles (both sides)',
        description:
          'Roll your head gently a few times clockwise and counterclockwise to release neck tension.',
      },
      {
        id: 'face',
        title: '3. Face frown & lion stretch (4–5×)',
        description:
          'Scrunch and frown your face tightly, then expand your face wide with your tongue stretched out.',
      },
      {
        id: 'sssSteady',
        title: '4. Steady “sss” hiss (15–20 sec)',
        description:
          'Daily breath drill (2 min total with #5): take a silent 360° 70–80% inhale, then hiss a laser-steady “sss” with zero volume wobble. Keep your lower ribs buoyed outward as long as possible while your deep lower abs draw smoothly inward from below the belly button. At the end, completely release your abs and feel the silent reflex breath drop in.',
      },
      {
        id: 'sssPulsed',
        title: '5. Pulsed “ss – ss – ss – sssss”',
        description:
          'Three crisp, gentle pulses (deep lower abs flexing slightly inward on each pulse, ribs steady, shoulders and throat dead quiet) followed by one smooth 5-second hiss, then an instant silent belly-release catch breath.',
      },
    ],
  },
  {
    label: '2 · Diction Circuit (10× Back-to-Back Each)',
    steps: [
      {
        id: 'lips',
        title: '“The lips, the teeth, the tip of the tongue” (10×)',
        description:
          'Crisp front-of-mouth articulation; keep the jaw relaxed while the tongue tip works.',
      },
      {
        id: 'ny',
        title: '“Unique New York” (10×)',
        description:
          'Clean Y and N transitions ten times back-to-back without spreading the mouth.',
      },
      {
        id: 'leather',
        title: '“Red leather, yellow leather” (10×)',
        description:
          'R and L use tiny adjacent tongue-tip shifts—keep movements small and economical.',
      },
      {
        id: 'lagadabana',
        title: '“La-Ga-Da-Ba-Na” jaw-still sprint (10×)',
        description:
          'Hold your jaw steady (or prop a knuckle lightly between teeth) so only tongue tip, soft palate (G), and lips move—keeps vowel space and vibrato open.',
      },
      {
        id: 'toyboat',
        title: '“Toy boat” (10×)',
        description:
          'Snap cleanly from the back-tongue “oy” glide to front B and T without stiffening lips or pulling the larynx down.',
      },
    ],
  },
];

export const ALL_ROUTINE_STEP_IDS = PRE_ROUTINE_COLUMNS.flatMap((col) =>
  col.steps.map((step) => step.id)
);

export const EXERCISES = {
  mommyMms: {
    label: 'Vocal Coach · lesson 2 · diction warm-up',
    name: '“Mommy made me mash my M&Ms” scale',
    description:
      'From the October 31 lesson — sing one syllable per note: “Mom-my made me mash my M-and-Ms” on 1–2–3–4–5–4–3–2–1. Keep the jaw relaxed, use a forward American “a” in “mash,” and allow the neck to stay mobile. The full phrase cycle measures about 166–168 BPM in the recording; this exercise uses 160 BPM for a close, comfortable match. It starts at B2, climbs to C4, and returns to C3; adjust the range with the scale controls.',
    recommendedBpm: 160,
    progressionLevels: 13,
    upOffsets: rangeOffsets(-13, 0, 1),
    downOffsets: rangeOffsets(-1, -12, 1),
    note: 'Mom-my made me mash my M-and-Ms',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'quarter' },
      { notes: [62], duration: 'quarter' },
      { notes: [64], duration: 'quarter' },
      { notes: [65], duration: 'quarter' },
      { notes: [67], duration: 'quarter' },
      { notes: [65], duration: 'quarter' },
      { notes: [64], duration: 'quarter' },
      { notes: [62], duration: 'quarter' },
      { notes: [60], duration: 'quarter' },
    ],
  },
  head: {
    label: 'Vocal Coach · 01 · warm-up',
    name: 'Small, easy head voice',
    description:
      '“Let’s warm up your head voice — keep it narrow and pretty small on ‘ooh / woo,’ massage the sternocleidomastoid neck muscles, pop your jaw, and don’t push extra air.” — The recorded lesson measures about 110 BPM. Each 8-beat bar uses the previous triad (quarter), current triad (half), then 1–2–3–2–1 in quarter notes. In the lesson MIDI, Scale Up climbs F♯3 → D♯4 and Scale Down descends C4 → G♯3.',
    recommendedBpm: 110,
    progressionLevels: 8,
    upOffsets: rangeOffsets(-6, 3, 1),
    downOffsets: rangeOffsets(0, -4, 1),
    note: 'ooh / woo',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'quarter' },
      { notes: [62], duration: 'quarter' },
      { notes: [64], duration: 'quarter' },
      { notes: [62], duration: 'quarter' },
      { notes: [60], duration: 'quarter' },
    ],
  },
  chest: {
    label: 'Vocal Coach · 02 · clarity',
    name: 'Chest “gah, gah, gah” (8–5–1)',
    description:
      '“Let’s go to our chest voice: ‘gah, gah, gah.’ Release your jaw and relax there — tension is the enemy of singing.” — The recorded lesson measures about 117 BPM. Each 6-beat bar uses the previous triad (quarter), current triad (half), then descends 8–5–1 (C4–G3–C3) in three equal quarter notes. In the lesson MIDI, Scale Up climbs chromatically G♯2 → A3 (+1 st) and Scale Down steps down by whole tones G3 → B2 (-2 st).',
    recommendedBpm: 117,
    progressionLevels: 8,
    upOffsets: rangeOffsets(-4, 9, 1),
    downOffsets: rangeOffsets(7, -1, 2),
    note: 'gah, gah, gah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'quarter' },
      { notes: [55], duration: 'quarter' },
      { notes: [48], duration: 'quarter' },
    ],
  },
  agility: {
    label: 'Vocal Coach · 03 · R&B movement',
    name: 'Vocal Coach’s double agility arc',
    description:
      '“This is gonna be for agility, because that’s very important with R&B… In order to move fast, everything needs to be relaxed — don’t grip the steering wheel.” — The recorded scale measures about 117 BPM. Each 12-beat bar uses the previous triad (quarter), current triad (half), then the double 1–2–3–4–5–4–3–2–1 arc in eighth notes. Starts on G♯/B♭, climbs to G, and descends F♯ → B♭.',
    recommendedBpm: 117,
    progressionLevels: 8,
    upOffsets: [-4, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7],
    downOffsets: rangeOffsets(6, -2, 1),
    note: 'ee-yah / ee',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'quarter' },
    ],
  },
  tongueAh: {
    label: 'Vocal Coach · 04 · decompression',
    name: 'Tongue-out “ah, ah, ah” (8–5–1)',
    description:
      '“The very first exercise we’re going to give you — this will probably feel a little silly — stick your tongue out and loosen up: a relaxed, open ‘ah, ah, ah.’ We want to let the sound out of your face and decompress the vocal folds without tension coming back.” — 6-beat bar: previous triad (quarter), current triad (half), then descend 8–5–1 (C4–G3–C3) in quarter notes with your tongue relaxed out over your bottom lip.',
    recommendedBpm: 110,
    progressionLevels: 8,
    upOffsets: [-4, -2, 0, 2, 3],
    downOffsets: [2, 0, -2, -4],
    note: 'tongue-out “ah, ah, ah”',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'quarter' },
      { notes: [55], duration: 'quarter' },
      { notes: [48], duration: 'quarter' },
    ],
  },
  open: {
    label: 'Vocal Coach · 05 · open resonance',
    name: 'Open “baa ya ya ya” → tongue-out “ah” (8–5–3–1)',
    description:
      '“Let’s do ‘baa ya ya ya’ — then does that tongue go out? ‘Ah, ah, ah, ah!’ Notice how much clearer your sound is on the outside, and apply that same open-mouth, tongue-out ‘ah’ when practicing Meet Me in Amsterdam.” — 8-beat bar: previous triad (quarter), current triad (half), then descend the major triad 8–5–3–1 (C4–G3–E3–C3).',
    recommendedBpm: 110,
    progressionLevels: 8,
    upOffsets: rangeOffsets(-2, 3, 1),
    downOffsets: rangeOffsets(2, -2, 1),
    note: 'baa ya ya ya / tongue-out ah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'quarter' },
      { notes: [55], duration: 'quarter' },
      { notes: [52], duration: 'quarter' },
      { notes: [48], duration: 'half' },
    ],
  },
  resonance1: {
    label: 'Daily Singing · 01 · resonance 1',
    name: 'Resonance 1 (root – fifth – root)',
    description:
      '“All right, let’s start with an NG sound.” — 8-beat bar: previous triad (quarter), current triad (half), then upper tonic (half), fifth (half), and tonic (quarter). Climbs 12 semitones (A2 → A3) and descends back to A2.',
    progressionLevels: 12,
    upOffsets: rangeOffsets(-3, 9, 1),
    downOffsets: rangeOffsets(8, -3, 1),
    note: 'ng',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'half' },
      { notes: [67], duration: 'half' },
      { notes: [60], duration: 'quarter' },
    ],
  },
  vocalDynamics: {
    label: 'Daily Singing · 02 · vocal dynamics',
    name: 'Vocal dynamics (1–5–1)',
    description:
      '“Okay, now it’s time for an ascending and descending ‘ah’ sound.” — 8-beat bar: previous triad (quarter), current triad (half), then ascend and descend 1–5–1 (C4–G4–C4) on “ah” (half, half, quarter). Climbs 12 semitones (C3 → C4) and descends back to C3.',
    progressionLevels: 12,
    upOffsets: rangeOffsets(0, 12, 1),
    downOffsets: rangeOffsets(11, 0, 1),
    note: 'ah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'half' },
      { notes: [67], duration: 'half' },
      { notes: [60], duration: 'quarter' },
    ],
  },
  pitchAccuracy: {
    label: 'Daily Singing · 03 · pitch & flexibility',
    name: 'Pitch accuracy & flexibility',
    description:
      '“Okay, now let’s do five short ‘me’ sounds and then a long ‘me’ at the end: me, me, me…” — 12-beat bar: quarter-note 1–2–3–2–1 arc, then a double-speed eighth-note 1–2–3–2–1 arc. In the lesson MIDI, Scale Up climbs C3 → C4 and Scale Down stops at C♯3 (1 bar above C3).',
    progressionLevels: 12,
    upOffsets: rangeOffsets(0, 12, 1),
    downOffsets: rangeOffsets(11, 1, 1),
    note: 'me',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'quarter' },
      { notes: [62], duration: 'quarter' },
      { notes: [64], duration: 'quarter' },
      { notes: [62], duration: 'quarter' },
      { notes: [60], duration: 'half' },
      { notes: [60], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'quarter' },
    ],
  },
  rangeExtension: {
    label: 'Daily Singing · 04 · range extension',
    name: 'Range extension',
    description:
      '“Okay, now it’s time for lip rolls that fade into an ‘ah’.” — 16-beat bar: three connected 1–2–3–4–5–4–3–2–1 arcs in eighth notes. Climbs 20 semitones (A2 → F4) and descends back to A2.',
    progressionLevels: 20,
    upOffsets: rangeOffsets(-3, 17, 1),
    downOffsets: rangeOffsets(16, -3, 1),
    note: 'brr → ah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'quarter' },
    ],
  },
  resonance2: {
    label: 'Daily Singing · 05 · resonance 2',
    name: 'Resonance 2 (5-tone scale)',
    description:
      '“Okay, let’s do a ‘nyah’ and make sure you do it very nasally — so ‘nyah,’ kind of like that.” — 8-beat bar: previous triad (quarter), current triad (half), then a 1–2–3–4–5–4–3–2 arc in eighth notes landing on a quarter-note tonic. Climbs 22 semitones (C3 → B♭4) and descends back to C3.',
    progressionLevels: 22,
    upOffsets: rangeOffsets(0, 22, 1),
    downOffsets: rangeOffsets(21, 0, 1),
    note: 'nyah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'quarter' },
    ],
  },
  vibrato: {
    label: 'Daily Singing · 06 · vibrato',
    name: 'Vibrato (eighth + sixteenth double arc)',
    description:
      '“Okay, this next one is a pretty fast one… it doesn’t matter if you pick ‘ah’ or ‘ee,’ just pick one you like.” — 10-beat bar: eighth-note 1–2–3–4–5–4–3–2 arc, then a double-speed sixteenth-note 1–2–3–4–5–4–3–2 arc landing on a quarter-note tonic. Climbs 5 semitones (C3 → F3) and descends back to C3.',
    progressionLevels: 5,
    upOffsets: rangeOffsets(0, 5, 1),
    downOffsets: rangeOffsets(4, 0, 1),
    note: 'ah / ee',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'sixteenth' },
      { notes: [62], duration: 'sixteenth' },
      { notes: [64], duration: 'sixteenth' },
      { notes: [65], duration: 'sixteenth' },
      { notes: [67], duration: 'sixteenth' },
      { notes: [65], duration: 'sixteenth' },
      { notes: [64], duration: 'sixteenth' },
      { notes: [62], duration: 'sixteenth' },
      { notes: [60], duration: 'quarter' },
    ],
  },
  videoAgility: {
    label: 'Daily Singing · 07 · agility',
    name: 'Cascading scale agility (8 → 1)',
    description:
      '“Okay, now it’s time for the last exercise where we switch between ‘ee’ and ‘ah’.” — 12-beat bar: previous triad (quarter), current triad (half), then 7 cascading 3-note turns starting on the high octave (8–9–8, 7–8–7, 6–7–6, 5–6–5, 4–5–4, 3–4–3, 2–3–2) in triplets and landing an octave lower on the root tonic (1). In the lesson MIDI, it starts in F, climbs 17 semitones to B♭, and descends back to F.',
    progressionLevels: 17,
    upOffsets: rangeOffsets(5, 22, 1),
    downOffsets: rangeOffsets(21, 5, 1),
    note: 'ee – ah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'triplet' },
      { notes: [62], duration: 'triplet' },
      { notes: [60], duration: 'triplet' },
      { notes: [59], duration: 'triplet' },
      { notes: [60], duration: 'triplet' },
      { notes: [59], duration: 'triplet' },
      { notes: [57], duration: 'triplet' },
      { notes: [59], duration: 'triplet' },
      { notes: [57], duration: 'triplet' },
      { notes: [55], duration: 'triplet' },
      { notes: [57], duration: 'triplet' },
      { notes: [55], duration: 'triplet' },
      { notes: [53], duration: 'triplet' },
      { notes: [55], duration: 'triplet' },
      { notes: [53], duration: 'triplet' },
      { notes: [52], duration: 'triplet' },
      { notes: [53], duration: 'triplet' },
      { notes: [52], duration: 'triplet' },
      { notes: [50], duration: 'triplet' },
      { notes: [52], duration: 'triplet' },
      { notes: [50], duration: 'triplet' },
      { notes: [48], duration: 'half' },
    ],
  },
  hnLipRoll: {
    label: 'High Notes · 01 · lip roll to ah',
    name: 'Lip roll fading to “ah” (3 waves)',
    description:
      '“Alright, in the first exercise we’re gonna do a lip roll that fades to an ‘ah’.” — 16-beat bar: previous triad (quarter), current triad (half), then three connected 5-tone arcs (1–2–3–4–5–4–3–2) in eighth notes (wave 1 on lip roll, wave 2 transitioning, wave 3 on open “ah”), landing on a held tonic (1). Starts on B♭3 (offset -2), climbs 19 semitones to F5, and descends back to B♭3.',
    progressionLevels: 19,
    upOffsets: rangeOffsets(-2, 17, 1),
    downOffsets: rangeOffsets(16, -2, 1),
    note: 'lip roll → ah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'quarter' },
    ],
  },
  hnMay: {
    label: 'High Notes · 02 · octave bounce',
    name: 'Octave bounce on “may” (1–3–5–8–5–8–5–8–5–3–1)',
    description:
      '“And the next exercise is on ‘may.’ Ready? Let’s go.” — 9-beat bar: previous triad (quarter), current triad (half), then arpeggiate 1–3–5–8, bounce on the octave three times (8–5–8–5–8), and step back down 5–3–1 in eighth notes on “may” to build agility in the high register. Starts on E3 (offset -8), climbs 13 semitones to F4, and descends back to E3.',
    progressionLevels: 13,
    upOffsets: rangeOffsets(-8, 5, 1),
    downOffsets: rangeOffsets(4, -8, 1),
    note: 'may',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [72], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [72], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [72], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [60], duration: 'quarter' },
    ],
  },
  hnOctaveHold: {
    label: 'High Notes · 03 · head voice hold',
    name: 'Octave jump & hold on “ah” (1–3–5–8)',
    description:
      '“Okay, the next exercise is on ‘ah.’ Ready? Let’s go.” — 8-beat bar: previous triad (quarter), current triad (half), then ascend the major arpeggio 1–3–5 (quarter notes) and leap up to the high octave (8) holding it as a sustained half note on an open “ah.” Keeps vocal folds thin and stretched. Starts on C4 (offset 0), climbs 9 semitones to A4, and descends back to C4.',
    progressionLevels: 9,
    upOffsets: rangeOffsets(0, 9, 1),
    downOffsets: rangeOffsets(8, 0, 1),
    note: 'ah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'quarter' },
      { notes: [64], duration: 'quarter' },
      { notes: [67], duration: 'quarter' },
      { notes: [72], duration: 'half' },
    ],
  },
  hnArpDescent: {
    label: 'High Notes · 04 · melodic connection',
    name: 'Arpeggio ascent & stepwise descent (1–3–5–8–7–5–4–2–1)',
    description:
      '“And the next exercise is on ‘ah’ as well. Ready? Let’s go.” — 8-beat bar: previous triad (quarter), current triad (half), then ascend 1–3–5–8 and smoothly descend down the scale 8–7–5–4–2–1 on “ah.” Connects the top octave down through your bridge into full chest resonance. Starts on C4 (offset 0), climbs 10 semitones to B♭4, and descends back to C4.',
    progressionLevels: 10,
    upOffsets: rangeOffsets(0, 10, 1),
    downOffsets: rangeOffsets(9, 0, 1),
    note: 'ah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [72], duration: 'eighth' },
      { notes: [71], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'quarter' },
    ],
  },
  hnLeapDescent: {
    label: 'High Notes · 05 · fifth & octave leap',
    name: 'Fifth & octave leaps (1–5–8–5–4–3–2–1)',
    description:
      '“Take a relaxed breath, release your lower jaw, and let the voice leap cleanly without scooping.” — 10-beat bar: previous triad (quarter), current triad (half), then leap 1 → 5 → 8 → 5 (quarter notes), cascading down through 4–3–2–1 (eighth notes) to root tonic. Builds accurate pitch registration on high fifths and octaves. Starts on C4 (offset 0), climbs 9 semitones to A4, and descends back to C4.',
    progressionLevels: 9,
    upOffsets: rangeOffsets(0, 9, 1),
    downOffsets: rangeOffsets(8, 0, 1),
    note: 'ah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'quarter' },
      { notes: [67], duration: 'quarter' },
      { notes: [72], duration: 'quarter' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'half' },
    ],
  },
  hnCascade: {
    label: 'High Notes · 06 · 1.5 octave cascade',
    name: '1.5 octave bel canto cascade (1–3–5–8–10–8–5–3–1)',
    description:
      '“And the last exercise is also going to be on ‘ah.’ Ready? Let’s go.” — 8-beat bar: previous triad (quarter), current triad (half), then a classic 1.5 octave bel canto arpeggio ascending 1–3–5–8 to the 10th (high third in pure head voice) and cascading down 8–5–3–1 in eighth notes. Reaches into full extension while maintaining effortless vocal ring. Starts on C4 (offset 0), climbs 11 semitones to B4, and descends back to C4.',
    progressionLevels: 11,
    upOffsets: rangeOffsets(0, 11, 1),
    downOffsets: rangeOffsets(10, 0, 1),
    note: 'ah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [72], duration: 'eighth' },
      { notes: [76], duration: 'eighth' },
      { notes: [72], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [60], duration: 'quarter' },
    ],
  },
  vibSemitone: {
    label: 'Daily Vibrato · 01 · semitone pulse',
    name: 'Slow-to-fast semitone oscillation on “ah”',
    description:
      '“Okay, on the first one we are going back and forth between two notes on an ‘ah.’ Ready? Let’s go.” — Oscillate back and forth between tonic (1) and minor second (♭2) on an open “ah,” systematically accelerating from quarter notes to eighth notes and sixteenth-note trills, then holding the root tonic with relaxed natural vibrato. Calibrates fine laryngeal muscle coordination.',
    progressionLevels: 5,
    upOffsets: rangeOffsets(0, 5, 1),
    downOffsets: rangeOffsets(4, 0, 1),
    note: 'ah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'quarter' },
      { notes: [61], duration: 'quarter' },
      { notes: [60], duration: 'quarter' },
      { notes: [61], duration: 'quarter' },
      { notes: [60], duration: 'eighth' },
      { notes: [61], duration: 'eighth' },
      { notes: [60], duration: 'eighth' },
      { notes: [61], duration: 'eighth' },
      { notes: [60], duration: 'sixteenth' },
      { notes: [61], duration: 'sixteenth' },
      { notes: [60], duration: 'sixteenth' },
      { notes: [61], duration: 'sixteenth' },
      { notes: [60], duration: 'sixteenth' },
      { notes: [61], duration: 'sixteenth' },
      { notes: [60], duration: 'sixteenth' },
      { notes: [61], duration: 'sixteenth' },
      { notes: [60], duration: 'half' },
    ],
  },
  vibTriplets: {
    label: 'Daily Vibrato · 02 · triplet flow',
    name: 'Arpeggio triplet flow on “ah” (1–3–5–8–5–3–1)',
    description:
      '“And the next exercise is on an ‘ah’ again. Ready? Let’s go.” — Flows through a major triad arpeggio 1–3–5–8–5–3–1 in fluid triplet pulses on “ah.” The steady oscillation trains breath flow and abdominal engagement without gripping the throat.',
    progressionLevels: 5,
    upOffsets: rangeOffsets(0, 5, 1),
    downOffsets: rangeOffsets(4, 0, 1),
    note: 'ah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'triplet' },
      { notes: [64], duration: 'triplet' },
      { notes: [67], duration: 'triplet' },
      { notes: [72], duration: 'triplet' },
      { notes: [67], duration: 'triplet' },
      { notes: [64], duration: 'triplet' },
      { notes: [60], duration: 'triplet' },
      { notes: [64], duration: 'triplet' },
      { notes: [67], duration: 'triplet' },
      { notes: [72], duration: 'triplet' },
      { notes: [67], duration: 'triplet' },
      { notes: [64], duration: 'triplet' },
      { notes: [60], duration: 'half' },
    ],
  },
  vibOctaveArp: {
    label: 'Daily Vibrato · 03 · octave leap',
    name: 'Octave arpeggio leap & descent on “ah” (1–3–5–8–5–3–1)',
    description:
      '“And the next exercise is on an ‘ah’ again.” — Ascends the major arpeggio 1–3–5 (quarter notes), leaps to the top octave (8) holding it as a sustained half note with natural vibrato, and cascades down 5–3–1 to root tonic.',
    progressionLevels: 5,
    upOffsets: rangeOffsets(0, 5, 1),
    downOffsets: rangeOffsets(4, 0, 1),
    note: 'ah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'quarter' },
      { notes: [64], duration: 'quarter' },
      { notes: [67], duration: 'quarter' },
      { notes: [72], duration: 'half' },
      { notes: [67], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [60], duration: 'half' },
    ],
  },
  vibViSol: {
    label: 'Daily Vibrato · 04 · 5-tone bounce',
    name: 'Five-tone pulse on “vi-so” (5–5–4–4–3–3–2–2–1)',
    description:
      '“In the next exercise we’re going to sing ‘vi-so.’ Ready? Let’s go.” — Descending 5-tone scale alternating bright forward consonant “vi” and rounded open vowel “so” (5–5–4–4–3–3–2–2–1). Switching articulators releases jaw tension and frees your natural vocal wave.',
    progressionLevels: 5,
    upOffsets: rangeOffsets(0, 5, 1),
    downOffsets: rangeOffsets(4, 0, 1),
    note: 'vi-so',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [67], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'half' },
    ],
  },
  vibArpDescent: {
    label: 'Daily Vibrato · 05 · arpeggio release',
    name: 'Arpeggio ascent & stepwise descent (1–3–5–8–7–5–4–2–1)',
    description:
      '“And the next exercise is on an ‘ah’ again. Ready? Let’s go.” — Ascends 1–3–5–8 in eighth notes, rings on the high octave (8), then gracefully steps down 7–5–4–2–1 on “ah,” sustaining the final tonic note with full vibrato release.',
    progressionLevels: 5,
    upOffsets: rangeOffsets(0, 5, 1),
    downOffsets: rangeOffsets(4, 0, 1),
    note: 'ah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [72], duration: 'quarter' },
      { notes: [71], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'half' },
    ],
  },
  vibScaleFlow: {
    label: 'Daily Vibrato · 06 · 9-tone scale',
    name: 'Double 5-tone scale flow on “ah / ooh”',
    description:
      '“In the next exercise it’s pretty much up to you what kind of vowel you want to use (ah or ooh). Ready? Let’s go.” — Smooth legato double 5-tone arc (1–2–3–4–5–4–3–2–1) in eighth notes on your preferred open vowel, resolving into a sustained, effortless tonic tone.',
    progressionLevels: 5,
    upOffsets: rangeOffsets(0, 5, 1),
    downOffsets: rangeOffsets(4, 0, 1),
    note: 'ah / ooh',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'half' },
    ],
  },
  vibTriadPulse: {
    label: 'Daily Vibrato · 07 · triad pulse',
    name: 'Arpeggio pulse & sustained tonic (1–3–5–8–5–3–1)',
    description:
      '“Okay, in the next one, it’s also up to you what kind of vowel you want to use. Ready? Let’s go.” — 12-beat bar: previous triad (quarter), current triad (half), then ascend and descend the octave arpeggio 1–3–5–8–5–3 in steady quarter notes, holding the tonic as a 3-beat sustained note with steady, unforced vibrato.',
    progressionLevels: 5,
    upOffsets: rangeOffsets(0, 5, 1),
    downOffsets: rangeOffsets(4, 0, 1),
    note: 'ah / ooh',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'quarter' },
      { notes: [64], duration: 'quarter' },
      { notes: [67], duration: 'quarter' },
      { notes: [72], duration: 'quarter' },
      { notes: [67], duration: 'quarter' },
      { notes: [64], duration: 'quarter' },
      { notes: [60], duration: 'dottedHalf' },
    ],
  },
  vibMahHold: {
    label: 'Daily Vibrato · 08 · mah onset hold',
    name: 'Staccato octave onset to sustained vibrato on “mah”',
    description:
      '“And the last exercise is on a ‘mah.’ Ready? Let’s go.” — 10-beat bar: previous triad (quarter), current triad (half), then a clean bilabial ‘m’ onset leaping directly to the upper octave (1 → 8), pulsing three staccato quarter notes, and flowering into a 3-beat sustained vowel with rich acoustic vibrato. Expands vocal endurance across your full range: starts on C4, ascends 11 semitones to B4, and descends to D♯4.',
    progressionLevels: 11,
    upOffsets: rangeOffsets(0, 11, 1),
    downOffsets: rangeOffsets(10, 3, 1),
    note: 'mah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'quarter' },
      { notes: [72], duration: 'quarter' },
      { notes: [72], duration: 'quarter' },
      { notes: [72], duration: 'quarter' },
      { notes: [72], duration: 'dottedHalf' },
    ],
  },
  agTwoVowel: {
    label: 'Daily Agility · 01 · two-vowel cascade',
    name: 'Cascading scale agility (8 → 1 on “ee – ah”)',
    videoUrl: 'https://www.youtube.com/watch?v=ftfrxhYD1os',
    description:
      '“Alright, in the first exercise we’re gonna sing ‘ee’ and ‘ah.’ Let’s go.” — 12-beat bar: previous triad (quarter), current triad (half), then 7 cascading 3-note turns starting on the high octave (8–9–8, 7–8–7, 6–7–6, 5–6–5, 4–5–4, 3–4–3, 2–3–2) in triplets on alternating “ee” and “ah,” landing on the held lower root tonic (1). Starts on F (offset 5), climbs 17 semitones to B♭, and descends back to F.',
    progressionLevels: 17,
    upOffsets: rangeOffsets(5, 22, 1),
    downOffsets: rangeOffsets(21, 5, 1),
    note: 'ee – ah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'triplet' },
      { notes: [62], duration: 'triplet' },
      { notes: [60], duration: 'triplet' },
      { notes: [59], duration: 'triplet' },
      { notes: [60], duration: 'triplet' },
      { notes: [59], duration: 'triplet' },
      { notes: [57], duration: 'triplet' },
      { notes: [59], duration: 'triplet' },
      { notes: [57], duration: 'triplet' },
      { notes: [55], duration: 'triplet' },
      { notes: [57], duration: 'triplet' },
      { notes: [55], duration: 'triplet' },
      { notes: [53], duration: 'triplet' },
      { notes: [55], duration: 'triplet' },
      { notes: [53], duration: 'triplet' },
      { notes: [52], duration: 'triplet' },
      { notes: [53], duration: 'triplet' },
      { notes: [52], duration: 'triplet' },
      { notes: [50], duration: 'triplet' },
      { notes: [52], duration: 'triplet' },
      { notes: [50], duration: 'triplet' },
      { notes: [48], duration: 'half' },
    ],
  },
  agWeBounce: {
    label: 'Daily Agility · 02 · “we” bounce',
    name: 'Arpeggio bounce on “we” (1–3–2–4–3–5–4–2–1)',
    videoUrl: 'https://www.youtube.com/watch?v=ftfrxhYD1os',
    description:
      '“In the next exercise we’re going to sing ‘we.’ Let’s go.” — 8-beat bar: previous triad (quarter), current triad (half), then an agility arpeggio bounce 1–3–2–4–3–5–4–2–1 in eighth notes on “we” landing on the held tonic root, focusing forward vowel placement and laryngeal freedom. Starts on C (offset 0), climbs 12 semitones to C5, and descends back to C.',
    progressionLevels: 12,
    upOffsets: rangeOffsets(0, 12, 1),
    downOffsets: rangeOffsets(11, 0, 1),
    note: 'we',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [48], duration: 'eighth' },
      { notes: [52], duration: 'eighth' },
      { notes: [50], duration: 'eighth' },
      { notes: [53], duration: 'eighth' },
      { notes: [52], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [53], duration: 'eighth' },
      { notes: [50], duration: 'eighth' },
      { notes: [48], duration: 'quarter' },
    ],
  },
  agMultiVowel: {
    label: 'Daily Agility · 03 · 3-vowel turn',
    name: 'Minor pentatonic turn (8–♭10–8–♭7–8–♭7–5–4–5–4–♭3–1)',
    videoUrl: 'https://www.youtube.com/watch?v=ftfrxhYD1os',
    description:
      '“Okay, and in this one we’re going to sing ‘ee,’ ‘ay,’ and ‘ah.’ Let’s go.” — 11-beat bar: previous minor triad (quarter), current minor triad (half), then a 12-note R&B minor pentatonic run 8–♭10–8–♭7–8–♭7–5–4–5–4–♭3–1 shifting vowels across the line. Starts on B♭ (offset -2), climbs 12 semitones to B♭4, and descends back to B♭.',
    progressionLevels: 12,
    upOffsets: rangeOffsets(-2, 10, 1),
    downOffsets: rangeOffsets(9, -2, 1),
    note: 'ee – ay – ah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 51, 55, 60], duration: 'half' },
      { notes: [60], duration: 'quarter' },
      { notes: [63], duration: 'eighth' },
      { notes: [60], duration: 'eighth' },
      { notes: [58], duration: 'eighth' },
      { notes: [60], duration: 'eighth' },
      { notes: [58], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [53], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [53], duration: 'eighth' },
      { notes: [51], duration: 'eighth' },
      { notes: [48], duration: 'half' },
    ],
  },
  agFiveToneTurn: {
    label: 'Daily Agility · 04 · 5-tone turn',
    name: '5-tone agility turn (4–3–4–5–4–3–2–1)',
    videoUrl: 'https://www.youtube.com/watch?v=ftfrxhYD1os',
    description:
      '“Pick a vowel and let’s go.” — 9-beat bar: previous triad (quarter), current triad (half), then a 5-tone agility turnaround 4–3–4–5–4–3–2–1 in eighth notes on your vowel of choice, landing on the sustained root tonic (1). Starts on C (offset 0), climbs 12 semitones to C5, and descends back to C.',
    progressionLevels: 12,
    upOffsets: rangeOffsets(0, 12, 1),
    downOffsets: rangeOffsets(11, 0, 1),
    note: 'open vowel',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [53], duration: 'eighth' },
      { notes: [52], duration: 'eighth' },
      { notes: [53], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [53], duration: 'eighth' },
      { notes: [52], duration: 'eighth' },
      { notes: [50], duration: 'eighth' },
      { notes: [48], duration: 'eighth' },
      { notes: [48, 52, 55, 60], duration: 'half' },
    ],
  },
  agSixToneTrill: {
    label: 'Daily Agility · 05 · trill flutter',
    name: '6-tone climb & 5–6 vocal trill (1 → 6 trill → 1)',
    videoUrl: 'https://www.youtube.com/watch?v=ftfrxhYD1os',
    description:
      '“Pick a vowel you want to sing again, and let’s go.” — 12-beat bar: previous triad (quarter), current triad (half), then climb 1–2–3–4–5–6, trill between 5 and 6 four times (5–6–5–6–5–6–5), and descend 4–3–2–1 in eighth notes on your chosen vowel, landing on the tonic root. Starts on A (offset -3), climbs 12 semitones to A4, and descends back to A.',
    progressionLevels: 12,
    upOffsets: rangeOffsets(-3, 9, 1),
    downOffsets: rangeOffsets(8, -3, 1),
    note: 'open vowel',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [48], duration: 'eighth' },
      { notes: [50], duration: 'eighth' },
      { notes: [52], duration: 'eighth' },
      { notes: [53], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [57], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [57], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [57], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [57], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [53], duration: 'eighth' },
      { notes: [52], duration: 'eighth' },
      { notes: [50], duration: 'eighth' },
      { notes: [48], duration: 'quarter' },
    ],
  },
  agLadder: {
    label: 'Daily Agility · 06 · agility ladder',
    name: 'Progressive agility ladder (3rd → 5th → 6th trill)',
    videoUrl: 'https://www.youtube.com/watch?v=ftfrxhYD1os',
    description:
      '“Pick a vowel you want to sing again, and let’s go.” — 19-beat bar: previous triad (quarter), current triad (half), then a 3-tier progressive agility ladder in eighth notes: Tier 1 to the 3rd (1–2–3–2–1), Tier 2 to the 5th (2–3–4–5–4–3–2–1), and Tier 3 to the 6th with trill (2–3–4–5–6–5–6–5–6–5–6–5–4–3–2–1). Starts on A (offset -3), climbs 10 semitones to G4, and descends back to A.',
    progressionLevels: 10,
    upOffsets: rangeOffsets(-3, 7, 1),
    downOffsets: rangeOffsets(6, -3, 1),
    note: 'open vowel',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [48], duration: 'eighth' },
      { notes: [50], duration: 'eighth' },
      { notes: [52], duration: 'eighth' },
      { notes: [50], duration: 'eighth' },
      { notes: [48], duration: 'quarter' },
      { notes: [50], duration: 'eighth' },
      { notes: [52], duration: 'eighth' },
      { notes: [53], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [53], duration: 'eighth' },
      { notes: [52], duration: 'eighth' },
      { notes: [50], duration: 'eighth' },
      { notes: [48], duration: 'quarter' },
      { notes: [50], duration: 'eighth' },
      { notes: [52], duration: 'eighth' },
      { notes: [53], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [57], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [57], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [57], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [57], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [53], duration: 'eighth' },
      { notes: [52], duration: 'eighth' },
      { notes: [50], duration: 'eighth' },
      { notes: [48], duration: 'quarter' },
    ],
  },
  agNineToneRun: {
    label: 'Daily Agility · 07 · 9-tone run',
    name: 'Rapid 9-tone agility run (1 → 9 → 1)',
    videoUrl: 'https://www.youtube.com/watch?v=ftfrxhYD1os',
    description:
      '“Pick a vowel you want to sing again, and let’s go.” — 12-beat bar: previous triad (quarter), current triad (half), then sprint up the full 9-tone scale 1–2–3–4–5–6–7–8–9 and cascade back down 8–7–6–5–4–3–2–1 in eighth notes, landing on the held tonic root (1). Starts on C (offset 0), climbs 12 semitones to C5, and descends back to C.',
    progressionLevels: 12,
    upOffsets: rangeOffsets(0, 12, 1),
    downOffsets: rangeOffsets(11, 0, 1),
    note: 'open vowel',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [48], duration: 'eighth' },
      { notes: [50], duration: 'eighth' },
      { notes: [52], duration: 'eighth' },
      { notes: [53], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [57], duration: 'eighth' },
      { notes: [59], duration: 'eighth' },
      { notes: [60], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'eighth' },
      { notes: [59], duration: 'eighth' },
      { notes: [57], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [53], duration: 'eighth' },
      { notes: [52], duration: 'eighth' },
      { notes: [50], duration: 'eighth' },
      { notes: [48], duration: 'quarter' },
    ],
  },
  agMinorCascade: {
    label: 'Daily Agility · 08 · minor cascade',
    name: 'Virtuoso minor agility cascade (1 → 8 → 1)',
    videoUrl: 'https://www.youtube.com/watch?v=ftfrxhYD1os',
    description:
      '“Now it’s time for the last exercise and once again it’s up to you what vowel you want to sing, so let’s go.” — 16-beat bar: previous minor triad (quarter), current minor triad (half), then a virtuoso natural minor cascade: alternating step launch (1–1–2–1–2–♭3–4–♭3–4–5–♭6–5–♭6–♭7–8) followed by a seamless 8-note descent (♭7–♭6–5–4–♭3–2–1) on your chosen vowel. Starts on D (offset 2), climbs 12 semitones to D5, and descends back to D.',
    progressionLevels: 12,
    upOffsets: rangeOffsets(2, 14, 1),
    downOffsets: rangeOffsets(13, 2, 1),
    note: 'open vowel',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 51, 55, 60], duration: 'half' },
      { notes: [48], duration: 'eighth' },
      { notes: [48], duration: 'eighth' },
      { notes: [50], duration: 'eighth' },
      { notes: [48], duration: 'eighth' },
      { notes: [50], duration: 'eighth' },
      { notes: [51], duration: 'eighth' },
      { notes: [53], duration: 'eighth' },
      { notes: [51], duration: 'eighth' },
      { notes: [53], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [56], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [56], duration: 'eighth' },
      { notes: [58], duration: 'eighth' },
      { notes: [60], duration: 'eighth' },
      { notes: [58], duration: 'eighth' },
      { notes: [56], duration: 'eighth' },
      { notes: [55], duration: 'eighth' },
      { notes: [53], duration: 'eighth' },
      { notes: [51], duration: 'eighth' },
      { notes: [50], duration: 'eighth' },
      { notes: [48], duration: 'eighth' },
      { notes: [48, 51, 55, 60], duration: 'half' },
    ],
  },
  rrStaircase: {
    label: 'Riffs & Runs · 01 · 3-note staircase',
    name: 'Sequential 3-note staircase ladder (A3 → C♯5 → A3)',
    videoUrl: 'https://www.youtube.com/watch?v=5wcZ9KOatSk',
    description:
      '“It’s up to you what kind of vowel you wanna use, so you can sing ‘ah,’ you can sing ‘ee,’ or whatever you like.” — Measured at 69 BPM (triplet subdivisions at ~290 ms/note). Climb A major in 7 sequential 3-note cells (1–2–3, 2–3–4, 3–4–5, 4–5–6, 5–6–7, 6–7–8, 7–8–9) to a held A4, then descend from the 10th (10–9–8 down to 4–3–2) to A3. Repeats 4× in A major; use Key Shift to transpose.',
    recommendedBpm: 69,
    groundMidi: 57,
    progressionLevels: 4,
    upOffsets: [0, 0, 0, 0],
    downOffsets: [],
    note: 'ah / ee',
    steps: [
      { notes: [57], duration: 'triplet' },
      { notes: [59], duration: 'triplet' },
      { notes: [61], duration: 'triplet' },
      { notes: [59], duration: 'triplet' },
      { notes: [61], duration: 'triplet' },
      { notes: [62], duration: 'triplet' },
      { notes: [61], duration: 'triplet' },
      { notes: [62], duration: 'triplet' },
      { notes: [64], duration: 'triplet' },
      { notes: [62], duration: 'triplet' },
      { notes: [64], duration: 'triplet' },
      { notes: [66], duration: 'triplet' },
      { notes: [64], duration: 'triplet' },
      { notes: [66], duration: 'triplet' },
      { notes: [68], duration: 'triplet' },
      { notes: [66], duration: 'triplet' },
      { notes: [68], duration: 'triplet' },
      { notes: [69], duration: 'triplet' },
      { notes: [68], duration: 'triplet' },
      { notes: [69], duration: 'triplet' },
      { notes: [71], duration: 'triplet' },
      { notes: [69], duration: 'quarter' },
      { notes: [73], duration: 'triplet' },
      { notes: [71], duration: 'triplet' },
      { notes: [69], duration: 'triplet' },
      { notes: [71], duration: 'triplet' },
      { notes: [69], duration: 'triplet' },
      { notes: [68], duration: 'triplet' },
      { notes: [69], duration: 'triplet' },
      { notes: [68], duration: 'triplet' },
      { notes: [66], duration: 'triplet' },
      { notes: [68], duration: 'triplet' },
      { notes: [66], duration: 'triplet' },
      { notes: [64], duration: 'triplet' },
      { notes: [66], duration: 'triplet' },
      { notes: [64], duration: 'triplet' },
      { notes: [62], duration: 'triplet' },
      { notes: [64], duration: 'triplet' },
      { notes: [62], duration: 'triplet' },
      { notes: [61], duration: 'triplet' },
      { notes: [62], duration: 'triplet' },
      { notes: [61], duration: 'triplet' },
      { notes: [59], duration: 'triplet' },
      { notes: [45, 57], duration: 'quarter' },
    ],
  },
  rrMinorCascade: {
    label: 'Riffs & Runs · 02 · minor pentatonic',
    name: 'C minor pentatonic cascade (8–♭7–5 → 1)',
    videoUrl: 'https://www.youtube.com/watch?v=5wcZ9KOatSk',
    description:
      '“Once again, it’s up to you what kind of vowel you wanna use, so pick one, and let’s get started.” — Measured at 95 BPM (8-beat phrase = 5.05s). Descend C minor pentatonic in four eighth + two-sixteenth R&B cells (C5–B♭4–G4, B♭4–G4–F4, G4–F4–E♭4, F4–E♭4–C4), step E♭4 → C4, and sustain/breathe for 3.5 beats. Repeats 13× in C minor; use Key Shift to transpose.',
    recommendedBpm: 95,
    groundMidi: 60,
    progressionLevels: 13,
    upOffsets: Array(13).fill(0),
    downOffsets: [],
    note: 'open vowel',
    steps: [
      { notes: [72], duration: 'eighth' },
      { notes: [70], duration: 'sixteenth' },
      { notes: [67], duration: 'sixteenth' },
      { notes: [70], duration: 'eighth' },
      { notes: [67], duration: 'sixteenth' },
      { notes: [65], duration: 'sixteenth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'sixteenth' },
      { notes: [63], duration: 'sixteenth' },
      { notes: [65], duration: 'eighth' },
      { notes: [63], duration: 'sixteenth' },
      { notes: [60], duration: 'sixteenth' },
      { notes: [63], duration: 'eighth' },
      { notes: [60], duration: 'sevenEighths' },
    ],
  },
  rrSprintWaves: {
    label: 'Riffs & Runs · 03 · sprint waves',
    name: '3× sixteenth-note sprint waves (1 → 5 → 1)',
    videoUrl: 'https://www.youtube.com/watch?v=5wcZ9KOatSk',
    description:
      '“All right, in this one, we are gonna switch it up a little bit, so we are gonna ascend and descend in pitch every few times.” — Measured at 105 BPM (16-beat bar = 9.14s). Previous triad (quarter), current triad (half), then 3 waves alternating quarter-note anchors (1 and 5) with rapid sixteenth-note bursts (1–2–3–4 and 5–4–3–2), landing on tonic (1). Climbs chromatically C3 → F♯4 and descends F4 → C3.',
    recommendedBpm: 105,
    groundMidi: 48,
    progressionLevels: 18,
    upOffsets: rangeOffsets(0, 18, 1),
    downOffsets: rangeOffsets(17, 0, 1),
    note: 'ah / ee',
    steps: [
      { notes: [48, 52, 55], duration: 'quarter', scale: 'previous' },
      { notes: [48, 52, 55], duration: 'half' },
      { notes: [48], duration: 'quarter' },
      { notes: [48], duration: 'sixteenth' },
      { notes: [50], duration: 'sixteenth' },
      { notes: [52], duration: 'sixteenth' },
      { notes: [53], duration: 'sixteenth' },
      { notes: [55], duration: 'quarter' },
      { notes: [55], duration: 'sixteenth' },
      { notes: [53], duration: 'sixteenth' },
      { notes: [52], duration: 'sixteenth' },
      { notes: [50], duration: 'sixteenth' },
      { notes: [48], duration: 'quarter' },
      { notes: [48], duration: 'sixteenth' },
      { notes: [50], duration: 'sixteenth' },
      { notes: [52], duration: 'sixteenth' },
      { notes: [53], duration: 'sixteenth' },
      { notes: [55], duration: 'quarter' },
      { notes: [55], duration: 'sixteenth' },
      { notes: [53], duration: 'sixteenth' },
      { notes: [52], duration: 'sixteenth' },
      { notes: [50], duration: 'sixteenth' },
      { notes: [48], duration: 'quarter' },
      { notes: [48], duration: 'sixteenth' },
      { notes: [50], duration: 'sixteenth' },
      { notes: [52], duration: 'sixteenth' },
      { notes: [53], duration: 'sixteenth' },
      { notes: [55], duration: 'quarter' },
      { notes: [55], duration: 'sixteenth' },
      { notes: [53], duration: 'sixteenth' },
      { notes: [52], duration: 'sixteenth' },
      { notes: [50], duration: 'sixteenth' },
      { notes: [48], duration: 'quarter' },
    ],
  },
  rrSyncopated: {
    label: 'Riffs & Runs · 04 · syncopated soul',
    name: 'Syncopated B minor pentatonic soul riff (F♯3 → E4 → B2)',
    videoUrl: 'https://www.youtube.com/watch?v=5wcZ9KOatSk',
    description:
      '“All right, catch your breath, breathe, and let’s get started with the next one.” — Measured at 95 BPM (8-beat phrase = 5.05s). Walk up B minor pentatonic in eighth notes (F♯3–A3–B3–D4–E4), then weave back down with offbeat syncopated eighth/sixteenth rebounds (D4–B3–A3–F♯3–A3–F♯3–E3–D3) into a 2.5-beat B2 root hold. Repeats 24× in B minor; use Key Shift to transpose.',
    recommendedBpm: 95,
    groundMidi: 47,
    progressionLevels: 24,
    upOffsets: Array(24).fill(0),
    downOffsets: [],
    note: 'open vowel',
    steps: [
      { notes: [54], duration: 'eighth' },
      { notes: [57], duration: 'eighth' },
      { notes: [59], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'sixteenth' },
      { notes: [59], duration: 'eighth' },
      { notes: [57], duration: 'sixteenth' },
      { notes: [54], duration: 'eighth' },
      { notes: [57], duration: 'eighth' },
      { notes: [54], duration: 'sixteenth' },
      { notes: [52], duration: 'eighth' },
      { notes: [50], duration: 'sixteenth' },
      { notes: [47], duration: 'fiveEighths' },
    ],
  },
  rrPentatonicClimb: {
    label: 'Riffs & Runs · 05 · pentatonic climb',
    name: '3-over-4 B minor pentatonic climb (A3 → B4)',
    videoUrl: 'https://www.youtube.com/watch?v=5wcZ9KOatSk',
    description:
      '“All right, catch your breath, breathe, and let’s get started with the next one.” — Measured at 70 BPM (4-beat bar = 3.43s). Ascend B minor pentatonic in four 3-note sixteenth cells creating an R&B 3-over-4 cross-rhythm (A3–B3–D4, B3–D4–E4, D4–E4–F♯4, E4–F♯4–A4), resolving on high B4 for 1 full beat. Repeats 13× in B minor; use Key Shift to transpose.',
    recommendedBpm: 70,
    groundMidi: 59,
    progressionLevels: 13,
    upOffsets: Array(13).fill(0),
    downOffsets: [],
    note: 'ah / ee',
    steps: [
      { notes: [57], duration: 'sixteenth' },
      { notes: [59], duration: 'sixteenth' },
      { notes: [62], duration: 'sixteenth' },
      { notes: [59], duration: 'sixteenth' },
      { notes: [62], duration: 'sixteenth' },
      { notes: [64], duration: 'sixteenth' },
      { notes: [62], duration: 'sixteenth' },
      { notes: [64], duration: 'sixteenth' },
      { notes: [66], duration: 'sixteenth' },
      { notes: [64], duration: 'sixteenth' },
      { notes: [66], duration: 'sixteenth' },
      { notes: [69], duration: 'sixteenth' },
      { notes: [71], duration: 'quarter' },
    ],
  },
  falShoSlide: {
    label: 'Daily Falsetto · 01 · “shoo” octave slide',
    name: 'Octave downward glide on “shoo” (8 → 1)',
    videoUrl: 'https://www.youtube.com/watch?v=ViPa99REARk',
    description:
      '“Alright, let’s start with the ‘shoo’ sound.” — 9-beat bar at 99 BPM: previous triad (quarter), current triad (whole), then start softly in falsetto on the upper octave (8, half note) and glide smoothly down to the tonic root (1, half note) on a rounded “shoo.” Warms down from B4→B3 to G4→G3, climbs to C♯5→C♯4, and descends back to G4→G3.',
    recommendedBpm: 99,
    progressionLevels: 11,
    upOffsets: [11, 10, 9, 8, 7, 8, 9, 10, 11, 12, 13],
    downOffsets: [12, 11, 10, 9, 8, 7],
    groundMidi: 48,
    note: 'shoo',
    steps: [
      { notes: [48, 52, 55], duration: 'quarter', scale: 'previous' },
      { notes: [48, 52, 55, 60], duration: 'whole' },
      { notes: [60], duration: 'half' },
      { notes: [48], duration: 'half' },
    ],
  },
  falShoArc: {
    label: 'Daily Falsetto · 02 · “shoo” inverted arc',
    name: 'Inverted 5-tone legato arc on “shoo” (5–4–3–2–1–2–3–4–5)',
    videoUrl: 'https://www.youtube.com/watch?v=ViPa99REARk',
    description:
      '“The next exercise is also a ‘shoo’ sound, but a different pattern. Let’s go.” — 8-beat bar at 99 BPM: previous 5th cue (quarter), current 5th cue (half), then float down and back up 5–4–3–2–1–2–3–4–5 in eighth notes on a narrow, gentle “shoo” to keep falsetto connected across your upper bridge. Starts in A major (E4 → A3 → E4), climbs 6 semitones to E♭ major (B♭4 → E♭4 → B♭4), and descends back to A major.',
    recommendedBpm: 99,
    progressionLevels: 7,
    upOffsets: rangeOffsets(-3, 3, 1),
    downOffsets: rangeOffsets(2, -3, 1),
    groundMidi: 60,
    note: 'shoo',
    steps: [
      { notes: [67], duration: 'quarter', scale: 'previous' },
      { notes: [67], duration: 'half' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [67], duration: 'quarter' },
    ],
  },
  falHeeLaugh: {
    label: 'Daily Falsetto · 03 · “hee” laughing pulse',
    name: 'Descending laughing pulses on “hee” (5–5–4–4–3–3–2–2–1)',
    videoUrl: 'https://www.youtube.com/watch?v=ViPa99REARk',
    description:
      '“The next exercise is a laughing sound on ‘hee.’” — 8-beat bar at 120 BPM: previous triad (quarter), current triad (half), then descend 5–5–4–4–3–3–2–2 in bouncy eighth notes landing on a quarter-note tonic (1). Light, chuckle-like “hee” pulses encourage clean vocal-fold edge closure so your falsetto rings clearly instead of leaking air. Starts on C4 (G4 → C4), climbs to G4 (D5 → G4), and descends back to C4.',
    recommendedBpm: 120,
    progressionLevels: 8,
    upOffsets: rangeOffsets(0, 7, 1),
    downOffsets: rangeOffsets(6, 0, 1),
    note: 'hee',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [67], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'quarter' },
    ],
  },
  falAahLeap: {
    label: 'Daily Falsetto · 04 · “aah” 3rd leaps',
    name: 'Zigzagging third leaps on “aah” (1–3–2–4–3–5–4–2–1)',
    videoUrl: 'https://www.youtube.com/watch?v=ViPa99REARk',
    description:
      '“Alright, next up, leaps on ‘ah.’” — 8-beat bar at 120 BPM: previous triad (quarter), current triad (half), then step-and-leap through diatonic thirds 1–3–2–4–3–5–4–2–1 in eighth notes on a light, lifted “aah.” Trains pitch agility in falsetto without jaw bounce or throat gripping. Starts on C4, climbs 7 semitones to G4 (peaking at D5), and descends back to C4.',
    recommendedBpm: 120,
    progressionLevels: 8,
    upOffsets: rangeOffsets(0, 7, 1),
    downOffsets: rangeOffsets(6, 0, 1),
    note: 'aah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'half' },
      { notes: [60], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'quarter' },
    ],
  },
  falWhooArp: {
    label: 'Daily Falsetto · 05 · “whoo” triad hold',
    name: 'Hooty major triad ascent & 5th sustain on “whoo” (1–3–5)',
    videoUrl: 'https://www.youtube.com/watch?v=ViPa99REARk',
    description:
      '“Alright, the next one is on ‘whoo,’ let’s go.” — 8-beat bar at 80 BPM: previous triad (half), current triad (half), then ascend 1–3 in quarter notes and float on the 5th as a sustained half note on a hooty, spacious “whoo.” Builds pure, effortless upper-extension falsetto across a full octave of keys: starts on C4 (C4–E4–G4), climbs 12 semitones to C5 (C5–E5–G5), and descends back to C4.',
    recommendedBpm: 80,
    progressionLevels: 13,
    upOffsets: rangeOffsets(0, 12, 1),
    downOffsets: rangeOffsets(11, 0, 1),
    groundMidi: 60,
    note: 'whoo',
    steps: [
      { notes: [48, 52, 55, 60], duration: 'half', scale: 'previous' },
      { notes: [48, 52, 55, 60], duration: 'half' },
      { notes: [60], duration: 'quarter' },
      { notes: [64], duration: 'quarter' },
      { notes: [67], duration: 'half' },
    ],
  },
  falOohAah: {
    label: 'Daily Falsetto · 06 · “ooh–aah” burst',
    name: 'Fifth leaps into sixteenth sprint on “ooh & aah” (1–5–1–5 → 1–2–3–4–5–4–3–2–1)',
    videoUrl: 'https://www.youtube.com/watch?v=ViPa99REARk',
    description:
      '“The next one is on ‘ooh’ and ‘ah.’” — 9-beat bar at 90 BPM: previous triad (quarter), current triad (quarter), leap 1–5–1–5 in quarter notes (anchoring narrow “ooh” on 1 and opening to “aah” on 5), then sprint a 1–2–3–4–5–4–3–2 sixteenth-note run into a quarter-note tonic (1). Keeps open “aah” runs anchored in focused head resonance. Starts on C4, climbs 7 semitones to G4 (peaking at D5), and descends back to C4.',
    recommendedBpm: 90,
    progressionLevels: 8,
    upOffsets: rangeOffsets(0, 7, 1),
    downOffsets: rangeOffsets(6, 0, 1),
    note: 'ooh – aah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'quarter' },
      { notes: [60], duration: 'quarter' },
      { notes: [67], duration: 'quarter' },
      { notes: [60], duration: 'quarter' },
      { notes: [67], duration: 'quarter' },
      { notes: [60], duration: 'sixteenth' },
      { notes: [62], duration: 'sixteenth' },
      { notes: [64], duration: 'sixteenth' },
      { notes: [65], duration: 'sixteenth' },
      { notes: [67], duration: 'sixteenth' },
      { notes: [65], duration: 'sixteenth' },
      { notes: [64], duration: 'sixteenth' },
      { notes: [62], duration: 'sixteenth' },
      { notes: [60], duration: 'quarter' },
    ],
  },
  falLipRoll: {
    label: 'Daily Falsetto · 07 · lip roll 6th leap',
    name: 'Major 6th leap & leading-tone turn on lip rolls (1–6–5–4–3–2–1–7–1)',
    videoUrl: 'https://www.youtube.com/watch?v=ViPa99REARk',
    description:
      '“Now, lip rolls. Let’s go.” — 7-beat bar at 100 BPM: previous triad (quarter), current triad (quarter), then leap up a major sixth (1 → 6) and cascade down 5–4–3–2–1–7 in eighth notes before resolving to 1 (quarter) on steady lip trills. Decompresses subglottic pressure after open-vowel work. Starts on C4 (leap to A4), climbs 7 semitones to G4 (leap to E5), and descends back to C4.',
    recommendedBpm: 100,
    progressionLevels: 8,
    upOffsets: rangeOffsets(0, 7, 1),
    downOffsets: rangeOffsets(6, 0, 1),
    note: 'lip roll',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'quarter' },
      { notes: [60], duration: 'eighth' },
      { notes: [69], duration: 'eighth' },
      { notes: [67], duration: 'eighth' },
      { notes: [65], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [62], duration: 'eighth' },
      { notes: [60], duration: 'eighth' },
      { notes: [59], duration: 'eighth' },
      { notes: [60], duration: 'quarter' },
    ],
  },
  falFinalAh: {
    label: 'Daily Falsetto · 08 · final “ah” ♯4 leap',
    name: 'Lydian ♯4 leap & triad release on “ah” (1–♯4–5–3–1)',
    videoUrl: 'https://www.youtube.com/watch?v=ViPa99REARk',
    description:
      '“And the last exercise is on ‘ah.’” — 6-beat bar at 100 BPM: previous triad (quarter), current triad (quarter), sing tonic 1 (quarter), leap cleanly to the raised fourth ♯4 (quarter), resolve up to 5 and step down 3 in eighth notes, landing on 1 (quarter). Sharpens ear-to-larynx pitch accuracy in pure falsetto. Starts on C4, climbs 10 semitones to B♭4 (peaking at F5), and descends back to C4.',
    recommendedBpm: 100,
    progressionLevels: 11,
    upOffsets: rangeOffsets(0, 10, 1),
    downOffsets: rangeOffsets(9, 0, 1),
    note: 'ah',
    steps: [
      { notes: [48, 55, 60], duration: 'quarter', scale: 'previous' },
      { notes: [48, 55, 60], duration: 'quarter' },
      { notes: [60], duration: 'quarter' },
      { notes: [66], duration: 'quarter' },
      { notes: [67], duration: 'eighth' },
      { notes: [64], duration: 'eighth' },
      { notes: [60], duration: 'quarter' },
    ],
  },
};

export const LANES = [
  {
    id: 'coach',
    radioLabel: 'Vocal Coach',
    groupLabel: 'Vocal Coach · lesson warmups',
    videoUrl: null,
    defaultExercise: 'head',
    session: null,
    tabs: [
      { id: 'mommyMms', label: '“Mommy made me mash”' },
      { id: 'head', label: 'Head voice' },
      { id: 'chest', label: 'Chest “gah”' },
      { id: 'agility', label: 'R&B agility' },
      { id: 'tongueAh', label: 'Tongue-out “ah”' },
      { id: 'open', label: 'Open “baa ya ya ya”' },
    ],
    cuesHeading: 'Teacher cues',
    cuesMeta: 'practical application',
    cues: [
      {
        title: '“Mommy made me mash”: forward, loose, and moving',
        body: 'Place one syllable on each note of 1–2–3–4–5–4–3–2–1: “Mom-my made me mash my M-and-Ms.”',
        apply:
          'Release the jaw, keep the American “a” in “mash” forward rather than swallowed, and let the scale travel without gripping your neck.',
      },
      {
        title: 'Stretch thin — never push extra air',
        body: 'Keep head voice light and narrow on “ooh / woo”. High notes come from vocal folds stretching thin like rubber bands.',
        apply:
          'If you push more air or volume, the cords grip and lock up. Ease off breath pressure and let the tone float effortlessly.',
      },
      {
        title: 'Decompress back-pressure: release face & neck',
        body: 'Sound traps when the mouth stays tight and facial muscles clamp down.',
        apply:
          'Gently massage the sternocleidomastoid muscles on the sides of your neck, pop your jaw loose like a sleepy yawn, and allow room for the sound to exit freely.',
      },
      {
        title: 'Tongue-out “ah”: stop the tongue root from jamming',
        body: 'Tension at the base of the tongue pushes the larynx down and strangles your tone.',
        apply:
          'Rest your tongue comfortably out over your bottom lip and sing a relaxed “ah” (8–5–1). This physically prevents the tongue root from clenching.',
      },
      {
        title: '“Baa ya ya ya”: drop the jaw on descending lines',
        body: 'Opening the mouth releases trapped resonance and frees your vocal track.',
        apply:
          'Drop your chin open on the 8–5–3–1 major triad (“baa ya ya ya”). Keep that wide, relaxed mouth opening so resonance projects outside your face.',
      },
      {
        title: 'Song transfer: calibrate riffs with tongue-out “ah”',
        body: 'Apply the same release to song passages like ',
        emphasis: 'Meet Me in Amsterdam',
        bodyAfterEmphasis: ' (“Won’t you come closer…”).',
        apply:
          'Sing the melodic phrase with tongue out on “ah” first. Once the run feels completely weightless, add lyrics back while keeping that same open jaw feeling.',
      },
      {
        title: 'Clean riff separation: isolate notes on “mah” or “mee”',
        body: 'Just like clean pronunciation, fast riffs need every note to be separate and well-defined rather than sliding together.',
        apply:
          'Sing the riff slowly on a single syllable (“mah” or “mee”) to hear each discrete step, trace the stair-steps in the air with your hand, then restore the lyric.',
      },
      {
        title: 'The voice moves the way the body moves',
        body: 'The difference between singing a song and performing a song is physical freedom.',
        apply:
          'Unlock your hands and posture even when practicing alone—trace high notes in the air and let your body move with the groove.',
      },
    ],
  },
  {
    id: 'daily',
    radioLabel: 'Daily Singing',
    groupLabel: 'Daily Singing Exercises (Jacobs Vocal Academy)',
    videoUrl: 'https://www.youtube.com/watch?v=ZAx0UF_k2hM',
    defaultExercise: 'resonance1',
    session: {
      key: 'youtube',
      tabKey: 'youtubeSession',
      tabLabel: '▶ Session (1 → 7)',
      title: 'Daily Singing Session',
      sequence: [
        'resonance1',
        'vocalDynamics',
        'pitchAccuracy',
        'rangeExtension',
        'resonance2',
        'vibrato',
        'videoAgility',
      ],
    },
    tabs: [
      { id: 'resonance1', label: 'Resonance 1' },
      { id: 'vocalDynamics', label: 'Vocal dynamics' },
      { id: 'pitchAccuracy', label: 'Pitch accuracy & flexibility' },
      { id: 'rangeExtension', label: 'Range extension' },
      { id: 'resonance2', label: 'Resonance 2' },
      { id: 'vibrato', label: 'Vibrato' },
      { id: 'videoAgility', label: 'Agility' },
    ],
    cuesHeading: 'Daily singing cues',
    cuesLinkText: 'Jacobs Vocal Academy ↗',
    cues: [
      {
        title: 'Start with the NG buzz',
        body: 'Let the opening “ng” settle into a light forward resonance before adding the rest of the exercise.',
      },
      {
        title: 'Keep the ascending and descending line even',
        body: 'Match each pitch cleanly and let the scale move without pushing harder at the top.',
      },
      {
        title: 'Short “me” notes, then one connected “me”',
        body: 'Keep the five short attacks buoyant, then make the final long note feel like the same easy coordination.',
      },
      {
        title: 'Lip roll into an open vowel',
        body: 'Use the lip roll to find steady airflow, then open into “ah” without changing the pressure or pitch center.',
      },
      {
        title: 'Follow the sequence before adding intensity',
        body: 'Move through Session 1 → 7 first; keep the sound relaxed and let range and flexibility build gradually.',
      },
    ],
  },
  {
    id: 'highNotes',
    radioLabel: 'High Notes',
    groupLabel: 'Daily High Notes (Jacobs Vocal Academy)',
    videoUrl: 'https://www.youtube.com/watch?v=nKhdKJmAIWI',
    defaultExercise: 'hnLipRoll',
    session: {
      key: 'highNotes',
      tabKey: 'highNotesSession',
      tabLabel: '▶ Session (1 → 6)',
      title: 'High Notes Session',
      sequence: ['hnLipRoll', 'hnMay', 'hnOctaveHold', 'hnArpDescent', 'hnLeapDescent', 'hnCascade'],
    },
    tabs: [
      { id: 'hnLipRoll', label: 'Lip roll to “ah”' },
      { id: 'hnMay', label: '“May” octave bounce' },
      { id: 'hnOctaveHold', label: '“Ah” octave hold' },
      { id: 'hnArpDescent', label: '“Ah” arpeggio descent' },
      { id: 'hnLeapDescent', label: '“Ah” 1–5–8–5 descent' },
      { id: 'hnCascade', label: '“Ah” 1.5 octave cascade' },
    ],
    cuesHeading: 'High notes cues',
    cuesLinkText: 'Jacobs Vocal Academy ↗',
    cues: [
      {
        title: 'Lip roll fading to open vowel',
        body: 'Maintains steady subglottic air pressure before vowels open.',
        apply:
          'Begin on a smooth lip roll to balance breath support, then gently part lips into “ah” without changing your airflow speed.',
      },
      {
        title: '“May” octave agility bounce',
        body: 'The bright front vowel (“ay”) naturally thins vocal fold mass.',
        apply:
          'Lift the soft palate and bounce lightly on the high octave without digging into the throat; feel the ring in your cheekbones.',
      },
      {
        title: 'Octave leap & sustained hold',
        body: 'Trains vocal fold endurance in upper register.',
        apply:
          'Arpeggiate cleanly up and hold the top note with active abdominal support; land directly on center pitch without scooping from below.',
      },
      {
        title: 'Downward connection across the bridge',
        body: 'Connects head voice back into chest resonance smoothly.',
        apply:
          'As you descend 8–7–5–4–2–1, keep the throat light and open like a sigh; don’t pull heavy chest weight back into the notes.',
      },
      {
        title: '1.5 octave bel canto cascade',
        body: 'Builds effortless high range past the octave up to the 10th.',
        apply:
          'Keep generous vertical jaw space at the peak high third, allowing gravity and momentum to cascade effortlessly back to root tonic.',
      },
    ],
  },
  {
    id: 'vibrato',
    radioLabel: 'Vibrato',
    groupLabel: 'Daily Vibrato (Jacobs Vocal Academy)',
    videoUrl: 'https://www.youtube.com/watch?v=4q6A8bLDIe8',
    defaultExercise: 'vibSemitone',
    session: {
      key: 'vibrato',
      tabKey: 'vibratoSession',
      tabLabel: '▶ Session (1 → 8)',
      title: 'Daily Vibrato Session',
      sequence: [
        'vibSemitone',
        'vibTriplets',
        'vibOctaveArp',
        'vibViSol',
        'vibArpDescent',
        'vibScaleFlow',
        'vibTriadPulse',
        'vibMahHold',
      ],
    },
    tabs: [
      { id: 'vibSemitone', label: '01 · Semitone pulse' },
      { id: 'vibTriplets', label: '02 · Triplet flow' },
      { id: 'vibOctaveArp', label: '03 · Octave leap' },
      { id: 'vibViSol', label: '04 · “Vi-so” pulse' },
      { id: 'vibArpDescent', label: '05 · Arp release' },
      { id: 'vibScaleFlow', label: '06 · 9-tone scale' },
      { id: 'vibTriadPulse', label: '07 · Triad pulse' },
      { id: 'vibMahHold', label: '08 · “Mah” onset' },
    ],
    cuesHeading: 'Vibrato cues',
    cuesLinkText: 'Jacobs Vocal Academy ↗',
    cues: [
      {
        title: 'Laryngeal oscillation without tension',
        body: 'Vibrato is an acoustic oscillation (5–7 Hz) created by balanced antagonistic laryngeal muscles.',
        apply:
          'Begin on slow quarter-note semitone pulses (1 → ♭2), double to eighths, then trill sixteenths. Never wobble your jaw or pulse your stomach to force it; keep the throat completely loose.',
      },
      {
        title: 'Continuous breath flow on triplet runs',
        body: 'Fluency and speed require steady, uninterrupted subglottic air momentum.',
        apply:
          'On the 1–3–5–8–5–3–1 triplet arpeggio, think of spinning an even thread of air like blowing gently through a straw across all note steps.',
      },
      {
        title: 'Consonant onset release (“vi-so” & “mah”)',
        body: 'Changing consonants and vowels naturally releases jaw and tongue constriction.',
        apply:
          'Let the teeth/lip contact on “vi” and the bilabial release on “mah” focus the sound forward in the mask, freeing the vocal folds to vibrate unhindered.',
      },
      {
        title: 'Sustained note vibrato bloom',
        body: 'Endurance builds when you hold the final tonic note and allow natural vibrato to bloom.',
        apply:
          'Land on the sustained root with straight tone for half a second, then consciously relax your pharynx and neck to invite the vibrato waves to release freely.',
      },
    ],
  },
  {
    id: 'agility',
    radioLabel: 'Agility',
    groupLabel: 'Daily Agility (Jacobs Vocal Academy)',
    videoUrl: 'https://www.youtube.com/watch?v=ftfrxhYD1os',
    defaultExercise: 'agTwoVowel',
    session: {
      key: 'agility',
      tabKey: 'agilitySession',
      tabLabel: '▶ Session (1 → 8)',
      title: 'Daily Agility Session',
      sequence: [
        'agTwoVowel',
        'agWeBounce',
        'agMultiVowel',
        'agFiveToneTurn',
        'agSixToneTrill',
        'agLadder',
        'agNineToneRun',
        'agMinorCascade',
      ],
    },
    tabs: [
      { id: 'agTwoVowel', label: '01 · Two-vowel' },
      { id: 'agWeBounce', label: '02 · “We” bounce' },
      { id: 'agMultiVowel', label: '03 · 3-vowel turn' },
      { id: 'agFiveToneTurn', label: '04 · 5-tone turn' },
      { id: 'agSixToneTrill', label: '05 · 6-tone trill' },
      { id: 'agLadder', label: '06 · Agility ladder' },
      { id: 'agNineToneRun', label: '07 · 9-tone run' },
      { id: 'agMinorCascade', label: '08 · Minor cascade' },
    ],
    cuesHeading: 'Agility cues',
    cuesLinkText: 'Jacobs Vocal Academy ↗',
    cues: [
      {
        title: 'Light laryngeal agility & narrow vowels',
        body: 'Speed in vocal runs requires minimum vocal fold mass and relaxed extrinsic laryngeal muscles.',
        apply:
          'On rapid alternating runs like the two-vowel cascade (8 → 1) or “we” bounce, keep vowels narrow and focused behind the front teeth; never push heavier chest weight or squeeze the throat.',
      },
      {
        title: 'Steering wheel relaxation on rapid turns',
        body: 'Tension in the neck or jaw immediately destroys pitch accuracy during fast ornaments.',
        apply:
          'Keep your hands and jaw limp; imagine spinning a light, steady stream of air like a dancer gliding across floorboards rather than stomping on each individual note step.',
      },
      {
        title: 'Vowel shift flexibility (“ee – ay – ah”)',
        body: 'Switching phonetic vowel shapes at speed trains the tongue and soft palate to decouple from pitch movement.',
        apply:
          'On the minor pentatonic turn, let the tongue shape the vowel shift smoothly without pulling the larynx up or clamping the pharynx shut.',
      },
      {
        title: 'Trill oscillation & pitch center precision',
        body: 'Rapid interval oscillations (5–6 trill and 9-tone sprint) build fine neuromuscular coordination.',
        apply:
          'Strike the pitch center cleanly without sliding from underneath; let abdominal engagement stay elastic while the larynx flutters weightlessly.',
      },
    ],
  },
  {
    id: 'riffsRuns',
    radioLabel: 'Riffs & Runs',
    groupLabel: 'Daily Riffs & Runs · Normal (Jacobs Vocal Academy)',
    videoUrl: 'https://www.youtube.com/watch?v=5wcZ9KOatSk',
    defaultExercise: 'rrStaircase',
    session: {
      key: 'riffsRuns',
      tabKey: 'riffsRunsSession',
      tabLabel: '▶ Session (1 → 5)',
      title: 'Daily Riffs & Runs Session',
      sequence: [
        'rrStaircase',
        'rrMinorCascade',
        'rrSprintWaves',
        'rrSyncopated',
        'rrPentatonicClimb',
      ],
    },
    tabs: [
      { id: 'rrStaircase', label: '01 · 3-note staircase' },
      { id: 'rrMinorCascade', label: '02 · Minor pentatonic' },
      { id: 'rrSprintWaves', label: '03 · Sprint waves' },
      { id: 'rrSyncopated', label: '04 · Syncopated soul' },
      { id: 'rrPentatonicClimb', label: '05 · Pentatonic climb' },
    ],
    cuesHeading: 'Riffs & runs cues',
    cuesLinkText: 'Jacobs Vocal Academy ↗',
    cues: [
      {
        title: 'Discrete stair-steps, never a blurry slide',
        body: 'R&B runs sound crisp when every pitch center is distinct rather than smeared together.',
        apply:
          'On the 3-note staircase ladder (01 · 69 BPM), feel a micro-pulse on the first note of each 3-note cell (1–2–3, 2–3–4…) while keeping one continuous ribbon of breath.',
      },
      {
        title: 'Eighth + two-sixteenth minor pentatonic pocket',
        body: 'The C minor pentatonic cascade (02 · 95 BPM) pairs a held eighth note with two quick sixteenth-note steps (8–♭7–5, ♭7–5–4, 5–4–♭3, 4–♭3–1).',
        apply:
          'Sit slightly into the downbeat eighth note, let the two sixteenths rebound lightly without jaw movement, and use the 3.5-beat tonic sustain to release tension and breathe.',
      },
      {
        title: 'Anchor-and-sprint across the passaggio',
        body: 'Exercise 03 (105 BPM) is the only chromatic range-builder in the set (C3 → F♯4 → C3), alternating quarter-note anchors on 1 and 5 with rapid sixteenth bursts (1–2–3–4 and 5–4–3–2).',
        apply:
          'Reset laryngeal calm on every quarter-note anchor and thin into head-mix as the scale climbs above E4.',
      },
      {
        title: 'Syncopated R&B groove & 3-over-4 cross-rhythm',
        body: 'Exercises 04 (95 BPM) and 05 (70 BPM) stay in B minor pentatonic so you can build muscle memory without chasing key changes.',
        apply:
          'Lock into the metronome click on the offbeat syncopations in 04, and feel the four 3-note sixteenth cells (3+3+3+3) in 05 float effortlessly up into the held high B4.',
      },
    ],
  },
  {
    id: 'falsetto',
    radioLabel: 'Falsetto',
    groupLabel: 'Daily Falsetto Workout (Jacobs Vocal Academy)',
    videoUrl: 'https://www.youtube.com/watch?v=ViPa99REARk',
    defaultExercise: 'falShoSlide',
    session: {
      key: 'falsetto',
      tabKey: 'falsettoSession',
      tabLabel: '▶ Session (1 → 8)',
      title: 'Daily Falsetto Session',
      sequence: [
        'falShoSlide',
        'falShoArc',
        'falHeeLaugh',
        'falAahLeap',
        'falWhooArp',
        'falOohAah',
        'falLipRoll',
        'falFinalAh',
      ],
    },
    tabs: [
      { id: 'falShoSlide', label: '01 · “Shoo” slide' },
      { id: 'falShoArc', label: '02 · “Shoo” arc' },
      { id: 'falHeeLaugh', label: '03 · “Hee” laugh' },
      { id: 'falAahLeap', label: '04 · “Aah” leaps' },
      { id: 'falWhooArp', label: '05 · “Whoo” triad' },
      { id: 'falOohAah', label: '06 · “Ooh–aah” burst' },
      { id: 'falLipRoll', label: '07 · Lip roll 6th' },
      { id: 'falFinalAh', label: '08 · Final “ah” ♯4' },
    ],
    cuesHeading: 'Falsetto cues',
    cuesLinkText: 'Jacobs Vocal Academy ↗',
    cues: [
      {
        title: '“Shoo” & “whoo” acoustic back-pressure',
        body: 'Rounded closed vowels (“shoo” in 01–02 at 99 BPM and “whoo” in 05 at 80 BPM) reflect acoustic inertance back to the vocal folds so thin edges vibrate without leaking excess air.',
        apply:
          'Purse the lips gently like blowing cool air over hot tea; slide 8 → 1 and sustain the 5th in 05 with zero neck grip.',
      },
      {
        title: 'Bouncy “hee” laughing closure (non-breathy R&B tone)',
        body: 'Airy falsetto dries out the cords if overused; the laughing “hee-hee” descent (03 · 120 BPM) trains light, crisp vocal-fold adduction for clean R&B head-falsetto.',
        apply:
          'Feel a tiny, silent chuckle in your lower ribs on each paired eighth note (5–5–4–4–3–3–2–2–1) rather than squeezing at the throat.',
      },
      {
        title: '“Ooh → aah” vowel opening without losing placement',
        body: 'Falsetto often cracks or spreads when opening to “ah” too wide (04 at 120 BPM and 06 at 90 BPM).',
        apply:
          'In 06, lock high palatal resonance on the narrow “ooh” (1) before releasing into “aah” on the 5th and sixteenth-note burst (1–2–3–4–5–4–3–2–1), keeping the upper lip relaxed and cheeks lifted.',
      },
      {
        title: 'Lip-roll decompression & ♯4 intonation',
        body: 'Exercise 07 (100 BPM) uses a 1 → 6 lip-roll cascade to clear any residual laryngeal tension before Exercise 08 (100 BPM) tests precision on a Lydian 1 → ♯4 → 5–3–1 “ah” leap.',
        apply:
          'Hear the ♯4 leading-tone pull up into the 5th mentally before singing so you land dead-center without scooping.',
      },
    ],
  },
];

const SESSIONS_BY_KEY = Object.fromEntries(
  LANES.filter((lane) => lane.session).map((lane) => [lane.session.key, lane.session])
);

const SESSIONS_BY_TAB = Object.fromEntries(
  LANES.filter((lane) => lane.session).map((lane) => [lane.session.tabKey, lane.session])
);

const LANE_BY_EXERCISE = Object.fromEntries(
  LANES.flatMap((lane) => lane.tabs.map((tab) => [tab.id, lane]))
);

export function laneForExercise(exerciseId) {
  return LANE_BY_EXERCISE[exerciseId] || LANES[1];
}

export function sessionForKey(sessionKey) {
  return SESSIONS_BY_KEY[sessionKey] || SESSIONS_BY_KEY.youtube;
}

export function sessionForTabKey(tabKey) {
  return SESSIONS_BY_TAB[tabKey] || null;
}

export function videoUrlForExercise(exerciseId) {
  const ex = EXERCISES[exerciseId];
  if (!ex) return null;
  if (ex.videoUrl) return ex.videoUrl;
  const lane = laneForExercise(exerciseId);
  return lane?.videoUrl || null;
}

export const KEYBOARD_KEYS = (() => {
  const minMidi = 40;
  const maxMidi = 86;
  const blackPitchClasses = [1, 3, 6, 8, 10];
  const whiteCount = Array.from({ length: maxMidi - minMidi + 1 }, (_, i) => minMidi + i).filter(
    (midi) => !blackPitchClasses.includes(midi % 12)
  ).length;
  const whiteWidth = 100 / whiteCount;
  let whiteIndex = 0;
  const keys = [];
  for (let midi = minMidi; midi <= maxMidi; midi++) {
    const isBlack = blackPitchClasses.includes(midi % 12);
    keys.push({
      midi,
      note: noteName(midi),
      isBlack,
      widthPct: isBlack ? whiteWidth * 0.62 : whiteWidth,
      leftPct: whiteIndex * whiteWidth,
    });
    if (!isBlack) whiteIndex += 1;
  }
  return keys;
})();

export function computeScalePlan(ex, keyShift = 0, peakPush = 0) {
  let up = [...ex.upOffsets];
  let down = [...ex.downOffsets];

  if (peakPush !== 0 && up.length > 0) {
    const lastUp = up[up.length - 1];
    const prevUp = up.length > 1 ? up[up.length - 2] : lastUp - 1;
    const stepDir = lastUp >= prevUp ? 1 : -1;
    const stepSize = Math.max(1, Math.abs(lastUp - prevUp));

    if (peakPush > 0) {
      for (let i = 1; i <= peakPush; i++) {
        up.push(lastUp + i * stepDir * stepSize);
      }
      const newPeak = up[up.length - 1];
      const downStart = down.length > 0 ? down[0] : lastUp;
      const downStep = down.length > 1 ? Math.abs(down[0] - down[1]) : stepSize;
      const extraDown = [];
      for (let v = newPeak - downStep; v > downStart; v -= downStep) {
        extraDown.push(v);
      }
      down = down.length > 0 ? [...extraDown, ...down] : [...extraDown, lastUp];
    } else if (peakPush < 0) {
      const removeCount = Math.min(Math.abs(peakPush), Math.max(0, up.length - 2));
      if (removeCount > 0) {
        up = up.slice(0, up.length - removeCount);
        const newPeak = up[up.length - 1];
        if (down.length > 0) {
          const firstValidIdx = down.findIndex((v) => v < newPeak);
          down = firstValidIdx !== -1 ? down.slice(firstValidIdx) : [];
        }
      }
    }
  }

  if (keyShift !== 0) {
    up = up.map((v) => v + keyShift);
    down = down.map((v) => v + keyShift);
  }

  return { up, down, all: [...up, ...down] };
}

export function isStaticLoopPlan(plan) {
  return plan.down.length === 0 && plan.up.length > 0 && plan.up[0] === plan.up[plan.up.length - 1];
}

export function totalBarBeats(ex) {
  return ex.steps.reduce((sum, s) => sum + (NOTE_BEATS[s.duration] || 1), 0);
}

export function stepBeatOffset(ex, stepIndex) {
  return ex.steps.slice(0, stepIndex).reduce((sum, s) => sum + (NOTE_BEATS[s.duration] || 1), 0);
}

export function exerciseTotalDurationSec(ex, plan, bpm) {
  if (!ex || !plan) return 0;
  const bars = plan.all.length;
  const beats = totalBarBeats(ex);
  return bars * beats * (60 / bpm);
}

export function exerciseElapsedDurationSec(ex, cycle, stepIdx, bpm) {
  if (!ex) return 0;
  const barBeats = totalBarBeats(ex);
  const offsetInBar = stepBeatOffset(ex, stepIdx);
  const totalBeats = cycle * barBeats + offsetInBar;
  return totalBeats * (60 / bpm);
}

export function formatTime(sec) {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
