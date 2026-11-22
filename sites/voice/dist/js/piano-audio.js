const SALAMANDER_BASE = 'https://tonejs.github.io/audio/salamander/';
const SALAMANDER_ANCHORS = [
  [36, 'C2'],
  [39, 'Ds2'],
  [42, 'Fs2'],
  [45, 'A2'],
  [48, 'C3'],
  [51, 'Ds3'],
  [54, 'Fs3'],
  [57, 'A3'],
  [60, 'C4'],
  [63, 'Ds4'],
  [66, 'Fs4'],
  [69, 'A4'],
  [72, 'C5'],
  [75, 'Ds5'],
  [78, 'Fs5'],
  [81, 'A5'],
  [84, 'C6'],
];

const PARTIALS = [
  [1, 'triangle', 0.64, 0, 1.0],
  [1, 'sine', 0.28, 1.3, 1.0],
  [2, 'sine', 0.28, -1.1, 0.78],
  [3, 'sine', 0.14, 0.8, 0.58],
  [4, 'sine', 0.075, -0.6, 0.44],
  [5, 'sine', 0.04, 1.1, 0.34],
  [6, 'sine', 0.022, 0, 0.26],
  [7, 'sine', 0.011, 0, 0.2],
];

let audioContext = null;
let master = null;
let pianoBus = null;
let hammerNoiseBuffer = null;
let samplesDecoded = false;
const sampleRawBuffers = new Map();
const sampleAudioBuffers = new Map();

function createPianoRoomImpulse(ctx) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * 1.35);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      const env = Math.exp(-t * 4.2) * (1 - 0.35 * Math.exp(-t * 32));
      const white = Math.random() * 2 - 1;
      const damp = Math.max(0.08, 0.45 * Math.exp(-t * 2.4));
      lp = lp + damp * (white - lp);
      data[i] = lp * env * 0.55;
    }
  }
  return impulse;
}

function createHammerNoise(ctx) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * 0.045);
  const buf = ctx.createBuffer(1, length, rate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const env = Math.sin((i / length) * Math.PI) * Math.exp(-(i / length) * 3.5);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  return buf;
}

export async function preloadPianoSamples(onStatus) {
  try {
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const decoderCtx = OfflineCtx ? new OfflineCtx(2, 44100, 44100) : null;

    await Promise.all(
      SALAMANDER_ANCHORS.map(async ([midi, name]) => {
        const res = await fetch(`${SALAMANDER_BASE}${name}.mp3`, {
          mode: 'cors',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuf = await res.arrayBuffer();
        sampleRawBuffers.set(midi, arrayBuf);
        if (decoderCtx) {
          const audioBuf = await decoderCtx.decodeAudioData(arrayBuf.slice(0));
          sampleAudioBuffers.set(midi, audioBuf);
        }
      })
    );

    if (sampleAudioBuffers.size === SALAMANDER_ANCHORS.length) {
      samplesDecoded = true;
    }
    onStatus?.('grand piano ready');
  } catch {
    onStatus?.('acoustic synth ready');
  }
}

function ensureAudio(onStatus) {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioCtx();
    master = audioContext.createGain();
    master.gain.value = 0.95;

    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -15;
    compressor.knee.value = 18;
    compressor.ratio.value = 3.2;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.18;

    pianoBus = audioContext.createGain();
    pianoBus.gain.value = 1.0;

    const dryGain = audioContext.createGain();
    dryGain.gain.value = 0.9;

    const wetGain = audioContext.createGain();
    wetGain.gain.value = 0.16;

    const convolver = audioContext.createConvolver();
    convolver.buffer = createPianoRoomImpulse(audioContext);

    pianoBus.connect(dryGain);
    pianoBus.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(compressor);
    wetGain.connect(compressor);
    compressor.connect(master);
    master.connect(audioContext.destination);

    hammerNoiseBuffer = createHammerNoise(audioContext);

    if (!samplesDecoded && sampleRawBuffers.size > 0) {
      Promise.all(
        Array.from(sampleRawBuffers.entries()).map(async ([midi, buf]) => {
          const decoded = await audioContext.decodeAudioData(buf.slice(0));
          sampleAudioBuffers.set(midi, decoded);
        })
      )
        .then(() => {
          samplesDecoded = true;
          onStatus?.('grand piano ready');
        })
        .catch(() => {});
    }
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

function nearestSample(midi) {
  let bestMidi = null;
  let bestDist = Infinity;
  for (const [anchorMidi] of sampleAudioBuffers) {
    const dist = Math.abs(midi - anchorMidi);
    if (dist < bestDist) {
      bestDist = dist;
      bestMidi = anchorMidi;
    }
  }
  return bestMidi !== null
    ? { anchorMidi: bestMidi, buffer: sampleAudioBuffers.get(bestMidi) }
    : null;
}

export function playTone(midi, duration, voiceCount = 1, onStatus = null) {
  ensureAudio(onStatus);
  const now = audioContext.currentTime;
  const polyScale = 1 / Math.pow(Math.max(1, voiceCount), 0.38);

  let voiceOut = pianoBus;
  if (typeof audioContext.createStereoPanner === 'function') {
    const panner = audioContext.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-0.32, Math.min(0.32, (midi - 62) / 38)), now);
    panner.connect(pianoBus);
    voiceOut = panner;
  }

  const sample = nearestSample(midi);
  if (sample && sample.buffer) {
    const src = audioContext.createBufferSource();
    src.buffer = sample.buffer;
    src.playbackRate.setValueAtTime(Math.pow(2, (midi - sample.anchorMidi) / 12), now);

    const toneFilter = audioContext.createBiquadFilter();
    toneFilter.type = 'lowpass';
    const baseCutoff = Math.min(12000, 3400 * Math.pow(2, (midi - 48) / 24));
    toneFilter.frequency.setValueAtTime(baseCutoff * 1.45, now);
    toneFilter.frequency.exponentialRampToValueAtTime(
      baseCutoff * 0.72,
      now + Math.max(0.25, duration * 0.9)
    );

    const env = audioContext.createGain();
    const peakGain = 0.62 * polyScale;
    const holdEnd = now + Math.max(0.12, duration * 0.92);
    const releaseEnd = holdEnd + 0.24;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peakGain, now + 0.004);
    env.gain.setValueAtTime(peakGain, holdEnd);
    env.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);

    src.connect(toneFilter);
    toneFilter.connect(env);
    env.connect(voiceOut);
    src.start(now);
    src.stop(releaseEnd + 0.03);
    return;
  }

  const frequency = 440 * Math.pow(2, (midi - 69) / 12);
  const inharmonicity = 0.00012 * Math.pow(2, (midi - 60) / 24);
  const noteFilter = audioContext.createBiquadFilter();
  noteFilter.type = 'lowpass';
  noteFilter.Q.value = 0.7;
  const startCutoff = Math.min(9500, frequency * 9.5);
  const endCutoff = Math.max(frequency * 1.8, frequency * 3.2);
  noteFilter.frequency.setValueAtTime(startCutoff, now);
  noteFilter.frequency.exponentialRampToValueAtTime(
    endCutoff,
    now + Math.max(0.18, duration * 0.75)
  );

  const masterEnv = audioContext.createGain();
  const peak = 0.26 * polyScale;
  const releaseTime = 0.22;
  masterEnv.gain.setValueAtTime(0.0001, now);
  masterEnv.gain.linearRampToValueAtTime(peak, now + 0.005);
  masterEnv.gain.exponentialRampToValueAtTime(
    peak * 0.52,
    now + Math.min(0.22, Math.max(0.08, duration * 0.4))
  );
  masterEnv.gain.exponentialRampToValueAtTime(0.0001, now + duration + releaseTime);
  noteFilter.connect(masterEnv);
  masterEnv.connect(voiceOut);

  if (hammerNoiseBuffer) {
    const noiseSrc = audioContext.createBufferSource();
    noiseSrc.buffer = hammerNoiseBuffer;
    const hammerFilter = audioContext.createBiquadFilter();
    hammerFilter.type = 'bandpass';
    hammerFilter.frequency.value = Math.min(4200, Math.max(600, frequency * 3.2));
    hammerFilter.Q.value = 1.4;
    const hammerGain = audioContext.createGain();
    hammerGain.gain.setValueAtTime(0.08 * polyScale, now);
    hammerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
    noiseSrc.connect(hammerFilter);
    hammerFilter.connect(hammerGain);
    hammerGain.connect(voiceOut);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.035);
  }

  const stopAt = now + duration + releaseTime + 0.04;
  PARTIALS.forEach(([n, type, amp, detuneCents, decayRatio]) => {
    const stretchedFreq = frequency * n * Math.sqrt(1 + inharmonicity * n * n);
    if (stretchedFreq > 14000) return;
    const osc = audioContext.createOscillator();
    const pGain = audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(stretchedFreq, now);
    osc.detune.setValueAtTime(detuneCents, now);
    const partialDur = Math.max(0.08, (duration + releaseTime) * decayRatio);
    pGain.gain.setValueAtTime(amp, now);
    pGain.gain.exponentialRampToValueAtTime(0.0008, now + partialDur);
    osc.connect(pGain);
    pGain.connect(noteFilter);
    osc.start(now);
    osc.stop(stopAt);
  });
}

export function playMetronomeClick(isDownbeat = false, onStatus = null) {
  ensureAudio(onStatus);
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  // Fixed frequency without pitch sweeps to eliminate the "piu" laser dive artifact
  const freq = isDownbeat ? 1600 : 1000;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  const peakGain = isDownbeat ? 0.16 : 0.11;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peakGain, now + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.024);
  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + 0.026);
}
