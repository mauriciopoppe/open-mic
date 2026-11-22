const GUITAR_BASE = 'https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-acoustic/';
const GUITAR_SAMPLES = [
  [40, 'E2'],
  [45, 'A2'],
  [50, 'D3'],
  [55, 'G3'],
  [59, 'B3'],
  [64, 'E4'],
  [69, 'A4'],
  [74, 'D5'],
];

let audioContext = null;
const guitarBuffers = new Map();
const guitarRaw = new Map();

export async function preloadGuitarSamples(onStatus) {
  try {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const decoder = Offline ? new Offline(2, 44100, 44100) : null;

    await Promise.all(
      GUITAR_SAMPLES.map(async ([midi, name]) => {
        const response = await fetch(`${GUITAR_BASE}${name}.mp3`, {
          mode: 'cors',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const raw = await response.arrayBuffer();
        guitarRaw.set(midi, raw);
        if (decoder) {
          guitarBuffers.set(midi, await decoder.decodeAudioData(raw.slice(0)));
        }
      })
    );

    onStatus?.({ text: '● sampled acoustic guitar ready', state: 'ready' });
  } catch {
    onStatus?.({ text: 'sample host unavailable · using synth', state: 'fallback' });
  }
}

function ensureAudio(onStatus) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  audioContext ||= new AudioCtx();

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  if (!guitarBuffers.size && guitarRaw.size) {
    Promise.all(
      [...guitarRaw].map(async ([midi, raw]) =>
        guitarBuffers.set(midi, await audioContext.decodeAudioData(raw.slice(0)))
      )
    )
      .then(() => onStatus?.({ text: '● sampled acoustic guitar ready', state: 'ready' }))
      .catch(() => {});
  }
}

function nearestGuitarSample(midi) {
  let best = null;
  let minDistance = Infinity;
  for (const [anchor, buffer] of guitarBuffers) {
    const distance = Math.abs(midi - anchor);
    if (distance < minDistance) {
      best = { anchor, buffer };
      minDistance = distance;
    }
  }
  return best;
}

function synthPluck(midi, duration = 1.35) {
  const rate = audioContext.sampleRate;
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const period = Math.max(2, Math.round(rate / freq));
  const length = Math.round(rate * duration);
  const buffer = audioContext.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < period; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.72;
  }
  for (let i = period; i < length; i++) {
    data[i] = 0.498 * (data[i - period] + data[i - period + 1]);
  }

  const now = audioContext.currentTime;
  const src = audioContext.createBufferSource();
  const body = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  src.buffer = buffer;
  body.type = 'lowpass';
  body.frequency.value = Math.min(5200, 1100 + freq * 8);

  gain.gain.setValueAtTime(0.28, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  src.connect(body);
  body.connect(gain);
  gain.connect(audioContext.destination);
  src.start(now);
}

export function pluck(midi, duration = 2.2, onStatus = null) {
  ensureAudio(onStatus);
  const sample = nearestGuitarSample(midi);
  if (!sample) {
    synthPluck(midi, 1.35);
    return;
  }

  const now = audioContext.currentTime;
  const src = audioContext.createBufferSource();
  const body = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  src.buffer = sample.buffer;
  src.playbackRate.value = Math.pow(2, (midi - sample.anchor) / 12);
  body.type = 'lowpass';
  body.frequency.value = 6200;
  body.Q.value = 0.35;

  const playDuration = Math.min(duration, sample.buffer.duration / src.playbackRate.value);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.48, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + playDuration);

  src.connect(body);
  body.connect(gain);
  gain.connect(audioContext.destination);
  src.start(now);
  src.stop(now + Math.min(duration + 0.05, sample.buffer.duration / src.playbackRate.value));
}

export function click(accent, onStatus = null) {
  ensureAudio(onStatus);
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  osc.frequency.value = accent ? 1450 : 950;
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + 0.03);
}
