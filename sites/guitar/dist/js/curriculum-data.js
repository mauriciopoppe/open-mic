function createLesson(id, title, ref, mental, blueprint, cue, mastery, exercises) {
  return { id, title, ref, mental, blueprint, cue, mastery, exercises };
}

function createExercise(name, bpm, description, degrees, tab, frets, strings = [0, 1, 2, 3, 4, 5]) {
  return { name, bpm, description, degrees, tab, frets, strings };
}

export const phases = [
  {
    title: 'Phase 1 · Fretboard GPS',
    goal: 'Strings 6 & 5, octaves, intervals',
    lessons: [
      createLesson(
        '1.1',
        'Meet the Six Open Strings',
        'Your starting point · No theory required',
        [
          'A guitar has six strings. The thickest string makes the lowest sound; the thinnest makes the highest.',
          'Their names, from thickest to thinnest, are E–A–D–G–B–E.',
          'The two E strings share a name, but the thin E sounds two octaves higher.',
        ],
        'THICKEST / LOWEST\nE — A — D — G — B — E\n                    THINNEST / HIGHEST',
        'Click each white circle from top to bottom. Listen before moving on, and say the letter aloud.',
        'Name all six open strings from memory, then name them backward.',
        [
          createExercise(
            'Meet E–A–D–G–B–E',
            60,
            'Click each white open-string circle slowly. Listen, then say its name.',
            'E A D G B E',
            'open strings',
            [],
            [0, 1, 2, 3, 4, 5]
          ),
        ]
      ),
      createLesson(
        '1.2',
        'Walk the Low E String',
        'The first road across the neck',
        [
          'The thickest string starts on E. Each fret moves the sound one small step higher.',
          'The natural notes are E–F–G–A–B–C–D–E.',
          'Notice the close pairs: E–F and B–C sit on neighboring frets.',
        ],
        'LOW E STRING\nNote: E  F   G   A   B C   D   E\nFret: 0  1   3   5   7 8  10  12',
        'Use one finger for now. Click each coral note, listen, and say its name before continuing.',
        'Travel from open E to the 12th-fret E without looking at the note labels twice.',
        [
          createExercise(
            'E to E, one note at a time',
            60,
            'Follow the coral circles from left to right on the thickest string.',
            'E F G A B C D E',
            '0-1-3-5-7-8-10-12',
            [1, 3, 5, 7, 8, 10, 12],
            [0]
          ),
        ]
      ),
      createLesson(
        '1.3',
        'Walk the A String',
        'A second road with the same rule',
        [
          'The next string starts on A, but frets still move one small step at a time.',
          'Its natural notes are A–B–C–D–E–F–G–A.',
          'The close pairs have not changed: B–C and E–F are still neighbors.',
        ],
        'A STRING\nNote: A   B C   D   E F   G   A\nFret: 0   2 3   5   7 8  10  12',
        'Compare this string with the low E string. The spacing rule stays the same even though the starting note changes.',
        'Travel from open A to the 12th-fret A and say every note correctly.',
        [
          createExercise(
            'A to A, one note at a time',
            60,
            'Follow the coral circles from left to right on the A string.',
            'A B C D E F G A',
            '0-2-3-5-7-8-10-12',
            [2, 3, 5, 7, 8, 10, 12],
            [1]
          ),
        ]
      ),
      createLesson(
        '1.4',
        'Join the Two-String Map',
        'Your first useful fretboard map',
        [
          'You now know two separate roads: low E and A. Together they locate the root of most common guitar shapes.',
          'The same note can appear on both strings at different frets. For example, A is open on the A string and fret 5 on low E.',
          'Use the fret dots at 3, 5, 7, 9, and 12 as visual landmarks—not as notes to memorize by themselves.',
        ],
        'LOW E: E F G A B C D E\nA:     A B C D E F G A\nShared landmarks: A, B, C, D, E',
        'Move slowly between the two strings. Say the note before clicking it; use the sound to check your answer.',
        'Find A, C, D, E, and G once on each of the two thickest strings.',
        [
          createExercise(
            'Find the same note twice',
            60,
            'Find each named note on low E, then on A.',
            'A C D E G',
            'two-string map',
            [0, 3, 5, 7, 8, 10, 12],
            [0, 1]
          ),
        ]
      ),
      createLesson(
        '1.5',
        'Octave Shapes — Cloning Notes',
        'Ch 2 · Tracking notes with octaves',
        [
          'An octave is the same note name, twelve semitones higher.',
          '6→4 and 5→3 move two strings and two frets.',
          'Crossing to string 2 widens the shape by one fret.',
        ],
        '6 → 4 : +2 frets\n5 → 3 : +2 frets\n4 → 2 : +3 frets  ← B-string shift\n3 → 1 : +3 frets  ← B-string shift',
        'Flatten the index into a blanket mute so only the octave pair rings.',
        'Play clean G octaves in four locations, then repeat without looking.',
        [
          createExercise('Four-tier octave cascade', 72, 'Find each root across the neck in four beats.', 'G G G G', '3---5---8---3', [3, 5, 8]),
          createExercise('Strummed octave mute', 80, 'Strum all six strings; allow only the octave pair to sound.', 'G octave', '3-x-5-x-x-x', [3, 5]),
          createExercise('Octave slide hook', 92, 'Slide C–D–E–G with dead-string chucks.', 'C D E G', '3-x-5-x-7-x-10', [3, 5, 7, 10]),
          createExercise('Neo-soul octave lead', 78, 'Answer short octave phrases over Am7–D9.', 'A C D E G', '5-8-10-12-15', [5, 8, 10, 12, 15]),
        ]
      ),
      createLesson(
        '1.6',
        'Intervals You Can See & Hear',
        'Ch 2 · Measuring distance from the root',
        [
          'Intervals describe distance from root, not absolute letters.',
          'The major scale is W–W–H–W–W–W–H.',
          'A 5th is the power-chord shape; major and minor 3rds differ by one fret.',
        ],
        'From root on string 6:\n♭3 = string 5, −2 frets\n 3 = string 5, −1 fret\n 4 = string 5, same fret\n 5 = string 5, +2 frets',
        'Palm-mute exactly at the bridge saddle for a tight note that still has pitch.',
        'Hear and play major 3, minor 3, 4 and 5 from three random roots.',
        [
          createExercise('Major-scale ear calibration', 72, 'Sing degrees 1–8 through G major.', '1 2 3 4 5 6 7 8', '0-2-4-5-7-9-11-12', [0, 2, 4, 5, 7, 9, 11, 12]),
          createExercise('Major vs minor third', 66, 'Toggle the one-fret emotional switch from A.', '1 3 · 1 ♭3', '5-4---5-3', [3, 4, 5]),
          createExercise('Power-chord groove', 86, 'Palm-mute E5–D5–A5; release the mute on accents.', 'E5 D5 A5', '0-10-5', [0, 5, 10]),
          createExercise('Brown Eyed Girl thirds', 92, 'Move parallel thirds in G with clean separation.', '3rds in G', '4/3-5/4-7/5', [3, 4, 5, 7]),
        ]
      ),
    ],
  },
  {
    title: 'Phase 2 · Chords from the Ground Up',
    goal: 'Triads, CAGED, lush extensions',
    lessons: [
      createLesson(
        '2.1',
        'The 7 Diatonic Triads',
        'Ch 3 · Harmonizing the major scale',
        [
          'Stack every other scale note to build triads.',
          'Every major key yields I IV V major; ii iii vi minor; vii° diminished.',
          'Compact triads stay clear above bass and keys.',
        ],
        'G major family\nI  ii  iii IV  V  vi  vii°\nG  Am  Bm  C   D  Em  F♯°',
        'Mute adjacent strings with the fretting fingertips so only the three-note voicing speaks.',
        'Play the G family ascending and descending while naming number and quality.',
        [
          createExercise('G-major chord family', 72, 'Strum all seven chords and name their numbers.', 'I ii iii IV V vi vii°', '3-5-7-8-10-12-14', [3, 5, 7, 8, 10, 12, 14]),
          createExercise('Triad ladder', 78, 'Climb strings 4–3–2 with close triads.', 'G Am Bm C D Em', '3-5-7-8-10-12', [3, 5, 7, 8, 10, 12]),
          createExercise('Arpeggio etude', 85, 'Alternate 4–3–2–3 through each voicing.', 'D D U U', '3-5-7-8', [3, 5, 7, 8]),
          createExercise('Upper-structure song jam', 76, 'Place triads above the Slchld-style keys and bass.', 'I vi IV V', '3-12-8-10', [3, 8, 10, 12]),
        ]
      ),
      createLesson(
        '2.2',
        'CAGED I — Five Major Forms',
        'Ch 4 · Major CAGED forms',
        [
          'C–A–G–E–D shapes tile the neck in that order.',
          'Your index barre becomes a movable nut.',
          'Partial shapes deliver the sound without full-barre fatigue.',
        ],
        'One C major, five zones\nC form 0–3 → A form 3–5 → G form 5–8\n→ E form 8–10 → D form 10–12',
        'Roll the index 15° toward the nut and use elbow weight instead of a hard thumb squeeze.',
        'Play C in five zones and name the form before every strum.',
        [
          createExercise('Five-position C chain', 70, 'Find C major in all CAGED forms.', 'C A G E D forms', '3-5-8-10-12', [3, 5, 8, 10, 12]),
          createExercise('Partial CAGED voicings', 80, 'Use only the top four strings.', 'C fragments', '3-5-8-10', [3, 5, 8, 10]),
          createExercise('G–C–D one-zone moves', 84, 'Keep every chord inside frets 2–5.', 'I IV V', '3-3-5', [2, 3, 5]),
          createExercise('Cory Wong pocket', 96, 'Scratch 16ths around top-string I–IV–V fragments.', 'I x IV x V', '3-3-5', [3, 5]),
        ]
      ),
      createLesson(
        '2.3',
        'CAGED II — Minor & Hendrix Double-Stops',
        'Ch 4 · Minor CAGED forms',
        [
          'Lower the major 3rd one fret to create minor.',
          'Em, Am, and Dm forms are the everyday workhorses.',
          'Minor CAGED shapes overlap minor pentatonic boxes.',
        ],
        'Am zones\nAm form: open\nGm form: fret 2\nEm form: fret 5\nDm form: fret 7\nCm form: fret 9',
        'Release pressure without lifting after an accent for the tight R&B staccato bounce.',
        'Embellish Am with two clean hammer-ons, then stop it dead on beat 4.',
        [
          createExercise('Am across the neck', 68, 'Walk one minor chord through five forms.', 'Am · Am · Am · Am', '0-2-5-7-9', [0, 2, 5, 7, 9]),
          createExercise('Hendrix hammer-ons', 76, 'Hold Am at fret 5 and hammer chord tones.', 'Am fills', '5h7-5h7', [5, 7]),
          createExercise('Am–Dm–E in two zones', 82, 'Voice-lead the cadence, then repeat higher.', 'i iv V', '5-5-7---8-10-9', [5, 7, 8, 9, 10]),
          createExercise('RINI-style minor slides', 78, 'Slide between minor triads with grace notes.', 'i ♭VII ♭VI', '5-3-1', [1, 3, 5]),
        ]
      ),
      createLesson(
        '2.4',
        'Lush Chords — 7ths, 9ths & Sus',
        'Ch 5 · Extensions and chord color',
        [
          'Adding 7 creates maj7, m7, dominant 7, and half-diminished colors.',
          'Sus2 and sus4 replace the 3rd, making melody inside a chord.',
          'Hybrid plucking separates the bass root from upper harmony.',
        ],
        'Gmaj7  3-x-4-4-3-x\nAm7    5-x-5-5-5-x\nCmaj7  x-3-5-4-5-3\nD9     x-5-4-5-5-5',
        'Use pick/thumb for the bass and fingers for the upper chord—one piano-like attack.',
        'Play Imaj7–iim7–V9 in three keys without string noise.',
        [
          createExercise('Harmonized 7th walk', 72, 'Climb G major using four-note harmony.', 'G∆ Am7 Bm7 C∆ D7 Em7 F♯ø', '3-5-7-8-10-12-14', [3, 5, 7, 8, 10, 12, 14]),
          createExercise('Sus melodic strummer', 82, 'Move sus2→major→sus4 inside D, A and E.', '2 3 4 3', '0-2-3-2', [0, 2, 3]),
          createExercise('Pedal-point arpeggio', 76, 'Drone A while upper voicings move.', 'A pedal', '0-5-7-9', [0, 5, 7, 9]),
          createExercise('R&B turnaround', 78, 'Pocket Imaj7–iii7–vi7–ii7–V9.', 'I∆ iii7 vi7 ii7 V9', '3-7-12-5-10', [3, 5, 7, 10, 12]),
        ]
      ),
    ],
  },
  {
    title: 'Phase 3 · Keys, Numbers & Voice Leading',
    goal: 'Transpose, hear modes, connect chords',
    lessons: [
      createLesson(
        '3.1',
        'Nashville Numbers & Transposition',
        'Ch 6 · Progressions by numbers',
        [
          'Songs keep their number pattern when the key changes.',
          'With I on string 6, IV is directly below and V is two frets higher.',
          'Move the entire geometry to fit a singer instantly.',
        ],
        'I root: string 6, fret X\nIV: string 5, fret X\nV:  string 5, fret X+2\nvi: string 5, fret X+4',
        'Keep a continuous 16th-note down-up wrist; choose which swings touch the strings.',
        'Move I–V–vi–IV through G, A, and C without pausing.',
        [
          createExercise('Number compass', 76, 'Shift the I–IV–V–vi box through three keys.', 'I IV V vi', '3-3-5-7', [3, 5, 7]),
          createExercise('Pop loop in three keys', 84, 'Play I–V–vi–IV, then transpose.', 'I V vi IV', '3-5-7-3', [3, 5, 7]),
          createExercise('R&B ii–V–I–vi', 78, 'Backbeat-chuck the turnaround.', 'ii7 V7 I∆ vi7', '5-10-3-12', [3, 5, 10, 12]),
          createExercise('Minus-one open-mic drill', 80, 'Move every chord down one fret without renaming it.', 'I V vi IV', '2-4-6-2', [2, 4, 6]),
        ]
      ),
      createLesson(
        '3.2',
        'Tonics, Relative Minor & Modes',
        'Ch 7 · Tonics, keys, and modes',
        [
          'Modes can share notes; the home chord changes their gravity.',
          'Relative minor sits three frets below its major root.',
          'Dorian has a major 6; Mixolydian has ♭7. Those are identity notes.',
        ],
        'A Ionian:     A∆—D∆\nA Mixolydian: A7—G—D\nA Dorian:     Am7—D9\nA Aeolian:    Am7—F∆—G',
        'Accent the modal color tone when the chord changes so the ear hears the mode.',
        'Identify Ionian, Dorian, Mixolydian, or Aeolian from a two-chord vamp.',
        [
          createExercise('Relative major/minor shift', 70, 'Toggle pinky major root and index minor root.', 'G ↔ Em · C ↔ Am', '3-0---8-5', [0, 3, 5, 8]),
          createExercise('Ionian vamp', 80, 'Hear bright I–IV.', 'A∆ D∆', '5-5', [5]),
          createExercise('Dorian vamp', 88, 'Target F♯ over D9.', 'Am7 D9', '5-7', [5, 7]),
          createExercise('Mixolydian / Aeolian contrast', 84, 'Compare A7–G–D with Am–F–G.', 'I ♭VII IV · i ♭VI ♭VII', '5-3-5---5-1-3', [1, 3, 5]),
        ]
      ),
      createLesson(
        '3.3',
        'Borrowed Chords & Passing Motion',
        'Ch 8–10 · Key changes and voice leading',
        [
          'A secondary dominant turns a minor chord major to pull into its target.',
          'Borrow iv minor in a major key for the heartbreak resolution.',
          'A diminished chord can bridge roots one whole step apart.',
        ],
        'Secondary: C → E7 → Am\nBorrowed iv: C → F → Fm → C\nPassing °7: C∆ → C♯°7 → Dm7',
        'Guide fingers hover within 2 mm of the strings; let individual voices move one fret.',
        'Play G–B7–C–Cm–G and make the inner descending voice audible.',
        [
          createExercise('Secondary dominant chain', 72, 'Feel each V7 pull to its target.', 'C E7 Am D7 G7 C', '3-7-5-10-3', [3, 5, 7, 10]),
          createExercise('Heartbreak minor iv', 68, 'Turn C major into C minor before G.', 'G B7 C Cm G', '3-7-8-8-3', [3, 7, 8]),
          createExercise('Diminished walk-up', 76, 'Connect C∆ to Dm7 to Em7 chromatically.', 'C∆ C♯° Dm7 D♯° Em7', '3-4-5-6-7', [3, 4, 5, 6, 7]),
          createExercise('Neo-soul passing jam', 82, 'Use dominant and diminished tension sparingly.', 'I∆ ♯I° ii7 V7', '3-4-5-10', [3, 4, 5, 10]),
        ]
      ),
    ],
  },
  {
    title: 'Phase 4 · Scales That Sing',
    goal: 'Connect boxes, target tones, phrase',
    lessons: [
      createLesson(
        '4.1',
        'Five Pentatonic Patterns',
        'Ch 11 · Pentatonic riffs and solos',
        [
          'Pentatonic removes two tense notes, leaving five reliable colors.',
          'Pattern 1 index on root is minor; pinky on root is relative major.',
          'Diagonal slides connect boxes into one fretboard highway.',
        ],
        'A minor Box 1 (frets 5–8)\n6: 5—8   5: 5—7   4: 5—7\n3: 5—7   2: 5—8   1: 5—8',
        'Support bends with fingers 1+2+3 and rotate the wrist like a doorknob.',
        'Improvise four bars and use at least two boxes, one bend, and one full bar of space.',
        [
          createExercise('Five-box circuit', 90, 'Alternate-pick all positions in A minor.', '1 ♭3 4 5 ♭7', '5-8-5-7', [5, 7, 8, 10, 12]),
          createExercise('Groups of three', 86, 'Sequence 1-2-3, 2-3-4 through the box.', '123 234 345', '5-7-8-7-8-10', [5, 7, 8, 10]),
          createExercise('Diagonal soul highway', 82, 'Slide from fret 3 to fret 10 across the strings.', 'G A C D E', '3-5/7-9-10', [3, 5, 7, 9, 10]),
          createExercise('Major/minor switch', 78, 'Answer bright major with dark minor.', 'A major → A minor', '2-5---5-8', [2, 5, 8]),
        ]
      ),
      createLesson(
        '4.2',
        'Major Patterns, 3NPS & Targeting',
        'Ch 12 · The major scale',
        [
          'Major scale boxes add 4 and 7 to the pentatonic skeleton.',
          'Three notes per string makes legato mechanically even.',
          'Land on chord tones on beat 1; connecting notes can be loose.',
        ],
        'G major 3NPS\n6: 3-5-7 | 5: 3-5-7 | 4: 4-5-7\n3: 4-5-7 | 2: 5-7-8 | 1: 5-7-8',
        'Pull off with a slight downward flick so the unpicked note matches the picked volume.',
        'Over G–C–D, land on a note from each new chord exactly on beat 1.',
        [
          createExercise('Pentatonic plus color', 76, 'Add C and F♯ to the G pentatonic skeleton.', '1 2 3 4 5 6 7', '3-5-7-8-10-12-14', [3, 5, 7, 8, 10, 12, 14]),
          createExercise('Diatonic thirds', 80, 'Walk the scale in paired thirds.', '1/3 2/4 3/5', '3/7-5/8-7/10', [3, 5, 7, 8, 10]),
          createExercise('3NPS legato flow', 88, 'Pick-hammer-hammer once per string.', 'P H H', '3-5-7', [3, 5, 7]),
          createExercise('Chord-tone landing', 84, 'Resolve a phrase to G, C, then D tones.', 'G → C → D', '3-8-10', [3, 8, 10]),
        ]
      ),
      createLesson(
        '4.3',
        'Modal Lead, Harmonic Minor & Blues',
        'Ch 13–15 · Modes, harmonic minor, blues',
        [
          'Dorian is minor pentatonic plus 2 and major 6.',
          'Over V7 in minor, raise ♭7 to 7 to outline the dominant.',
          'Blues blends minor pentatonic, ♭5, and a curled major 3.',
        ],
        'A Dorian: Am pent + B + F♯\nA harmonic minor: G → G♯ over E7\nA blues: C → curl toward C♯',
        'Phrase like a singer: two beats of sound, two beats of breath.',
        'Solo one chorus using Dorian 6, harmonic-minor 7, and a blues curl—each in context.',
        [
          createExercise('Santana Dorian lick', 82, 'Resolve to F♯ when D9 arrives.', 'Am7 → D9', '5-7-5-7', [5, 7]),
          createExercise('Harmonic minor switch', 76, 'Change G to G♯ exactly on E7.', 'Am G F E7', '5-3-1-0', [0, 1, 3, 5]),
          createExercise('Major-minor blues curl', 72, 'Micro-bend C toward C♯, resolve to A.', '♭3↗3 → 1', '5b6-7', [5, 6, 7]),
          createExercise('Call and response', 80, 'Play two beats; breathe two beats.', 'call · · response · ·', '5-7---8-5', [5, 7, 8]),
        ]
      ),
    ],
  },
  {
    title: 'Phase 5 · Open-Mic Mastery',
    goal: 'Deconstruct, arrange, replace stems',
    lessons: [
      createLesson(
        '5.1',
        'Song Deconstruction & Play-Along Workflow',
        'Ch 16–18 · Putting theory into practice',
        [
          'Find tonic and mode, number the progression, choose two CAGED zones, then match a lead scale.',
          'Build arrangements in layers: pocket, upper-triad sparkle, vocal lead.',
          'A muted guitar stem turns a favorite recording into your personal band.',
        ],
        'SONG X-RAY\n1. Tonic + mode\n2. Number progression\n3. Two adjacent CAGED zones\n4. Lead scale + target tones',
        'Record the pocket first. Fills must answer the vocal, never compete with it.',
        'Take one separated track from analysis to a clean full-song replacement pass.',
        [
          createExercise('Three-layer looper', 78, 'Layer 7th chords, upper triads, then vocal lead.', 'Pocket → sparkle → lead', '5-7-10', [5, 7, 10]),
          createExercise('Progression speed-run', 84, 'Match six archetypes to a scale in real time.', 'I vi IV V · I ♭VII IV · i ♭VI V', '3-12-8-10', [3, 8, 10, 12]),
          createExercise('Backing-track rehearsal', 76, 'Play a complete rhythm pass with the guitar stem muted.', 'count-in · full song', '3-5-7-10', [3, 5, 7, 10]),
          createExercise('Performance simulation', 80, 'Count in, recover from one mistake, and finish without stopping.', '1 2 3 4 · perform', '3-5-7-8-10-12', [3, 5, 7, 8, 10, 12]),
        ]
      ),
    ],
  },
];

export const allLessons = phases.flatMap((phase, phaseIndex) =>
  phase.lessons.map((lesson) => ({
    ...lesson,
    phaseIndex,
    phase: phase.title,
    goal: phase.goal,
  }))
);

export const notes = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

// Standard tuning MIDI numbers, strings 6 → 1: E2 A2 D3 G3 B3 E4
export const tuning = [40, 45, 50, 55, 59, 64];

export const degreeMap = {
  0: '1',
  1: '♭2',
  2: '2',
  3: '♭3',
  4: '3',
  5: '4',
  6: '♭5',
  7: '5',
  8: '♭6',
  9: '6',
  10: '♭7',
  11: '7',
};

export const stringNames = [
  'low E (6th)',
  'A (5th)',
  'D (4th)',
  'G (3rd)',
  'B (2nd)',
  'high e (1st)',
];

export const foundationHelp = {
  '1.1': 'Click the six white circles from the thickest string to the thinnest: E, A, D, G, B, E.',
  '1.2': 'Stay on the thickest string. Follow the coral notes from open E to fret 12.',
  '1.3': 'Move to the A string. The same spacing rule creates a new sequence of letters.',
  '1.4': 'Now use both thick strings. Find the same letter in two different places.',
};

export const lessonQuestionBanks = {
  '1.6': [
    ['interval', 'What is the fret pattern of a major scale?', 'Whole, whole, half, whole, whole, whole, half.'],
    ['interval', 'From a root, which interval makes the classic power-chord shape?', 'The perfect 5th.'],
    ['interval', 'How much separates a major 3rd from a minor 3rd?', 'One fret.'],
  ],
  '2.1': [
    ['chord family', 'Which three chord numbers are major in every major key?', 'I, IV, and V.'],
    ['chord family', 'Which three chord numbers are minor in a major key?', 'ii, iii, and vi.'],
    ['chord family', 'What quality belongs to vii?', 'Diminished: vii°.'],
  ],
  '2.2': [
    ['CAGED', 'Name the five forms in their repeating order.', 'C, A, G, E, D.'],
    ['CAGED', 'What acts as the movable nut in a barre chord?', 'Your index-finger barre.'],
    ['CAGED', 'Why use a partial CAGED shape?', 'It keeps the useful chord tones while reducing fatigue and muddiness.'],
  ],
  '2.3': [
    ['minor CAGED', 'How do you turn a major shape into minor?', 'Lower its major 3rd by one fret.'],
    ['minor CAGED', 'Which three minor forms are the main workhorses?', 'Em, Am, and Dm forms.'],
    ['minor CAGED', 'What scale overlaps a minor CAGED chord?', 'The minor pentatonic scale.'],
  ],
  '2.4': [
    ['chord color', 'What four notes spell a major-7 chord?', '1, 3, 5, 7.'],
    ['chord color', 'What changes when a chord becomes sus2 or sus4?', 'The 3rd is replaced by the 2nd or 4th.'],
    ['chord color', 'Which chord creates dominant tension?', 'V7: 1, 3, 5, ♭7.'],
  ],
  '3.1': [
    ['numbers', 'Transpose I–V–vi–IV from G to C.', 'C–G–Am–F.'],
    ['numbers', 'With I on string 6, where is IV?', 'Directly below it on string 5 at the same fret.'],
    ['numbers', 'What stays unchanged when a progression is transposed?', 'The chord-number pattern and relationships.'],
  ],
  '3.2': [
    ['modes', 'Which tone gives Dorian its characteristic lift?', 'The major 6.'],
    ['modes', 'Which tone distinguishes Mixolydian from major?', 'The flat 7.'],
    ['modes', 'How are a major key and its relative minor positioned?', 'The relative-minor root is three frets below the major root.'],
  ],
  '3.3': [
    ['harmonic motion', 'What does a secondary dominant do?', 'It acts as V7 of the next chord and pulls strongly toward it.'],
    ['harmonic motion', 'What is the borrowed-minor-IV move in C?', 'C–F–Fm–C.'],
    ['harmonic motion', 'What can connect two chord roots a whole step apart?', 'A diminished-7 chord on the fret between them.'],
  ],
  '4.1': [
    ['pentatonic', 'With Pattern 1, index finger on A gives which scale?', 'A minor pentatonic.'],
    ['pentatonic', 'With Pattern 1, pinky on A gives which scale?', 'A major pentatonic.'],
    ['pentatonic', 'What lets a solo escape one box?', 'Connecting adjacent boxes with slides and diagonal movement.'],
  ],
  '4.2': [
    ['major scale', 'Which two notes are added to major pentatonic to make the full major scale?', 'Scale degrees 4 and 7.'],
    ['targeting', 'Where should a melodic phrase land on beat 1?', 'On a chord tone of the chord that just arrived.'],
    ['technique', 'Why use three notes per string?', 'It creates a consistent layout for fast alternate picking and legato.'],
  ],
  '4.3': [
    ['modal lead', 'What two notes are added to minor pentatonic for Dorian?', 'The 2 and major 6.'],
    ['harmonic minor', 'In A minor, which note changes over E7?', 'G rises to G♯, the major 3rd of E7.'],
    ['blues', 'What is the blues curl?', 'A slight bend of ♭3 toward the major 3rd.'],
  ],
  '5.1': [
    ['song workflow', 'What is the first step when deconstructing a song?', 'Find the tonic and mode.'],
    ['song workflow', 'What comes after numbering the progression?', 'Choose two adjacent CAGED zones for the rhythm part.'],
    ['arrangement', 'Put the three looper layers in order.', 'Pocket chords, upper-triad sparkle, then vocal-style lead.'],
  ],
};

export function defaultKey(lessonId) {
  return lessonId === '2.4' || lessonId === '3.2' || lessonId.startsWith('4.') ? 9 : 7;
}

export function isFoundationLesson(lessonId) {
  return ['1.1', '1.2', '1.3', '1.4'].includes(lessonId);
}
