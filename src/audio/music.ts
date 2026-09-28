import { getMusicGraph } from './sfx';

/**
 * Adaptive background music — a tiny generative sequencer on Web Audio (no audio files).
 *
 * Each mood is a 4-bar loop (drums, bass, pad chords, arpeggio). The market regime picks
 * the mood; changes land on the next bar so the music never jumps mid-phrase.
 */

export type Mood = 'calm' | 'bull' | 'bear' | 'volatile' | 'crash' | 'rally' | 'victory';

interface MoodDef {
  bpm: number;
  /** Four chords (MIDI notes), one per bar. */
  chords: number[][];
  /** Bass root per bar (MIDI). */
  bass: number[];
  /** 16-step patterns: 'x' = hit. Bass: 'x' root, 'o' octave up. */
  kick: string;
  snare: string;
  hat: string;
  bassPat: string;
  arp?: { pattern: string; octave: number; type: OscillatorType; gain: number };
  padType: OscillatorType;
  cutoff: number;
  padGain: number;
  hatGain: number;
}

const MOODS: Record<Mood, MoodDef> = {
  calm: {
    bpm: 86,
    chords: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 60], [55, 59, 62, 65]],
    bass: [45, 41, 48, 43],
    kick: 'x.........x.....',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    bassPat: 'x.....x.x.......',
    arp: { pattern: 'x...x...x..x.x..', octave: 12, type: 'triangle', gain: 0.05 },
    padType: 'triangle',
    cutoff: 1300,
    padGain: 0.05,
    hatGain: 0.035,
  },
  bull: {
    bpm: 104,
    chords: [[60, 64, 67, 71], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]],
    bass: [48, 43, 45, 41],
    kick: 'x.......x.x.....',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.x.',
    bassPat: 'x..x..x.x..o..x.',
    arp: { pattern: 'x.xxx.x.x.xxx.x.', octave: 12, type: 'square', gain: 0.022 },
    padType: 'sawtooth',
    cutoff: 2200,
    padGain: 0.028,
    hatGain: 0.04,
  },
  bear: {
    bpm: 80,
    chords: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]],
    bass: [45, 38, 40, 45],
    kick: 'x.........x.....',
    snare: '............x...',
    hat: '....x.......x...',
    bassPat: 'x.......x.......',
    arp: { pattern: 'x.......x.......', octave: 12, type: 'sine', gain: 0.045 },
    padType: 'sawtooth',
    cutoff: 750,
    padGain: 0.04,
    hatGain: 0.03,
  },
  volatile: {
    bpm: 116,
    chords: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]],
    bass: [38, 34, 43, 45],
    kick: 'x..x....x..x....',
    snare: '....x.......x..x',
    hat: 'xxxxxxxxxxxxxxxx',
    bassPat: 'x.xo.x.xx.xo.x.x',
    arp: { pattern: 'x.x.x.x.x.x.x.x.', octave: 12, type: 'sawtooth', gain: 0.016 },
    padType: 'sawtooth',
    cutoff: 1500,
    padGain: 0.03,
    hatGain: 0.03,
  },
  crash: {
    bpm: 126,
    chords: [[50, 53, 56], [49, 52, 55], [50, 53, 56], [48, 51, 54]],
    bass: [38, 37, 38, 36],
    kick: 'x.x.....x.x.....',
    snare: '....x.......x...',
    hat: 'xxxxxxxxxxxxxxxx',
    bassPat: 'xxxxxxxxxxxxxxxx',
    padType: 'sawtooth',
    cutoff: 650,
    padGain: 0.05,
    hatGain: 0.035,
  },
  rally: {
    bpm: 124,
    chords: [[53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67], [57, 60, 64, 69]],
    bass: [41, 48, 43, 45],
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    bassPat: '.x.x.x.x.x.x.x.x',
    arp: { pattern: 'xxxxxxxxxxxxxxxx', octave: 12, type: 'square', gain: 0.02 },
    padType: 'sawtooth',
    cutoff: 3000,
    padGain: 0.026,
    hatGain: 0.045,
  },
  victory: {
    bpm: 112,
    chords: [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]],
    bass: [48, 45, 41, 43],
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.x.',
    bassPat: 'x.x.x.x.x.x.x.x.',
    arp: { pattern: 'x.x.x.xxx.x.x.xx', octave: 12, type: 'triangle', gain: 0.04 },
    padType: 'triangle',
    cutoff: 2600,
    padGain: 0.05,
    hatGain: 0.035,
  },
};

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

let pending: Mood | null = null;
let current: Mood | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextTime = 0;
let step = 0;
let bar = 0;
let echo: { input: GainNode; ctx: AudioContext } | null = null;
let noise: AudioBuffer | null = null;

/** Set the mood (null stops the music after the current notes ring out). */
export function setMusicMood(mood: Mood | null) {
  pending = mood;
  if (mood && !timer) timer = setInterval(tick, 25);
  if (!mood) {
    if (timer) clearInterval(timer);
    timer = null;
    current = null;
  }
}

export function currentMood(): Mood | null {
  return current;
}

function tick() {
  const graph = getMusicGraph();
  if (!graph) return; // not unlocked yet
  const { ctx } = graph;
  if (ctx.state !== 'running') return;
  if (!current) {
    current = pending;
    step = 0;
    bar = 0;
    nextTime = ctx.currentTime + 0.08;
  }
  if (!current) return;
  while (nextTime < ctx.currentTime + 0.15) {
    const def = MOODS[current];
    scheduleStep(graph.ctx, graph.bus, def, step, bar, nextTime);
    nextTime += 60 / def.bpm / 4;
    step++;
    if (step === 16) {
      step = 0;
      bar = (bar + 1) % 4;
      if (pending && pending !== current) {
        current = pending;
        bar = 0;
      }
    }
  }
}

function echoInput(ctx: AudioContext, bus: GainNode): GainNode {
  if (echo?.ctx === ctx) return echo.input;
  const input = ctx.createGain();
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.33;
  const fb = ctx.createGain();
  fb.gain.value = 0.28;
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  input.connect(bus);
  input.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(wet).connect(bus);
  echo = { input, ctx };
  return input;
}

function note(ctx: AudioContext, out: AudioNode, freq: number, t: number, dur: number, type: OscillatorType, gain: number, cutoff?: number, attack = 0.005) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let last: AudioNode = osc;
  if (cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    osc.connect(f);
    last = f;
  }
  last.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function hit(ctx: AudioContext, out: AudioNode, t: number, dur: number, gain: number, freq: number, type: BiquadFilterType) {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const env = ctx.createGain();
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(env).connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function kick(ctx: AudioContext, out: AudioNode, t: number) {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.5, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  osc.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + 0.3);
}

function scheduleStep(ctx: AudioContext, bus: GainNode, def: MoodDef, s: number, b: number, t: number) {
  const beat = 60 / def.bpm;
  const chord = def.chords[b % def.chords.length]!;
  const root = def.bass[b % def.bass.length]!;

  if (def.kick[s] === 'x') kick(ctx, bus, t);
  if (def.snare[s] === 'x') hit(ctx, bus, t, 0.14, 0.12, 1800, 'bandpass');
  if (def.hat[s] === 'x') hit(ctx, bus, t, s % 4 === 2 ? 0.08 : 0.04, def.hatGain, 8000, 'highpass');

  const bp = def.bassPat[s];
  if (bp === 'x' || bp === 'o') note(ctx, bus, midi(root + (bp === 'o' ? 12 : 0) - 12), t, beat * 0.45, 'sawtooth', 0.09, 420);

  // Pad: whole-bar chord, slightly detuned pair per note.
  if (s === 0) {
    for (const n of chord) {
      note(ctx, bus, midi(n) * 0.998, t, beat * 4, def.padType, def.padGain, def.cutoff, 0.25);
      note(ctx, bus, midi(n) * 1.002, t, beat * 4, def.padType, def.padGain * 0.7, def.cutoff, 0.3);
    }
  }

  if (def.arp && def.arp.pattern[s] === 'x') {
    const idx = (s + b * 3) % chord.length;
    note(ctx, echoInput(ctx, bus), midi(chord[idx]! + def.arp.octave), t, beat * 0.3, def.arp.type, def.arp.gain, 5000);
  }
}
