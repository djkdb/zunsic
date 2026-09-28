/**
 * Synthesized sound effects (Web Audio API) — no audio files, no licensing, ~0 KB.
 *
 * Browsers only allow audio after a user gesture, so the AudioContext is created lazily
 * and unlocked on the first pointer/key press. Every call is a safe no-op when audio is
 * unavailable (tests, old browsers) or muted.
 */

type Wave = OscillatorType;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let volume = 0.6;

export function configureSfx(opts: { enabled: boolean; volume: number }) {
  enabled = opts.enabled;
  volume = Math.min(1, Math.max(0, opts.volume));
  if (master && ctx) master.gain.setTargetAtTime(volume * 0.9, ctx.currentTime, 0.02);
}

function audio(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = volume * 0.9;
    // Gentle limiter so stacked sounds never clip.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 6;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

/** Call from a user gesture to allow later sounds. */
export function unlockSfx() {
  audio();
}

interface ToneOpts {
  freq: number;
  to?: number;
  type?: Wave;
  at?: number;
  dur: number;
  gain?: number;
  attack?: number;
}

function tone(ac: AudioContext, { freq, to, type = 'sine', at = 0, dur, gain = 0.25, attack = 0.005 }: ToneOpts) {
  if (!master) return;
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

let noiseBuffer: AudioBuffer | null = null;
function noise(ac: AudioContext, { at = 0, dur, gain = 0.2, freq = 1200, filter = 'bandpass' as BiquadFilterType, sweepTo }: { at?: number; dur: number; gain?: number; freq?: number; filter?: BiquadFilterType; sweepTo?: number }) {
  if (!master) return;
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t0 = ac.currentTime + at;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const bq = ac.createBiquadFilter();
  bq.type = filter;
  bq.frequency.setValueAtTime(freq, t0);
  if (sweepTo) bq.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bq).connect(env).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

/** Bell with inharmonic partials (market open / close). */
function bell(ac: AudioContext, base: number, at = 0, dur = 1.6, gain = 0.18) {
  [1, 2.01, 2.76, 4.07].forEach((m, i) => tone(ac, { freq: base * m, at, dur: dur / (1 + i * 0.5), gain: gain / (1 + i), type: 'sine', attack: 0.003 }));
}

const NOTE = (semitonesFromA4: number) => 440 * 2 ** (semitonesFromA4 / 12);

export type SfxName =
  | 'buy'
  | 'sell'
  | 'blocked'
  | 'marketOpen'
  | 'firstOpen'
  | 'marketClose'
  | 'breaking'
  | 'crash'
  | 'rally'
  | 'reveal-up'
  | 'reveal-down'
  | 'rumor'
  | 'achievement'
  | 'tick'
  | 'count'
  | 'win'
  | 'lose'
  | 'record';

const SOUNDS: Record<SfxName, (ac: AudioContext) => void> = {
  // Order filled: bright rising blip + cash click
  buy: (ac) => {
    tone(ac, { freq: NOTE(3), dur: 0.09, type: 'triangle', gain: 0.22 });
    tone(ac, { freq: NOTE(10), at: 0.07, dur: 0.18, type: 'triangle', gain: 0.22 });
    noise(ac, { at: 0.0, dur: 0.05, gain: 0.08, freq: 4000, filter: 'highpass' });
  },
  // Sale: "ka-ching" coin
  sell: (ac) => {
    tone(ac, { freq: 1318, dur: 0.12, type: 'square', gain: 0.06 });
    tone(ac, { freq: 1976, at: 0.06, dur: 0.35, type: 'sine', gain: 0.2 });
    tone(ac, { freq: 2637, at: 0.06, dur: 0.25, type: 'sine', gain: 0.08 });
  },
  blocked: (ac) => {
    tone(ac, { freq: 150, dur: 0.11, type: 'sawtooth', gain: 0.12 });
    tone(ac, { freq: 140, at: 0.14, dur: 0.14, type: 'sawtooth', gain: 0.12 });
  },
  marketOpen: (ac) => bell(ac, NOTE(3), 0, 1.4, 0.16),
  firstOpen: (ac) => {
    bell(ac, NOTE(3), 0, 1.6, 0.16);
    bell(ac, NOTE(10), 0.35, 1.8, 0.14);
    bell(ac, NOTE(15), 0.7, 2.2, 0.14);
  },
  marketClose: (ac) => {
    bell(ac, NOTE(-2), 0, 1.5, 0.15);
    bell(ac, NOTE(-9), 0.28, 1.8, 0.12);
  },
  // News sting: three urgent beeps + low hit
  breaking: (ac) => {
    [0, 0.12, 0.24].forEach((t, i) => tone(ac, { freq: [880, 988, 1175][i]!, at: t, dur: 0.1, type: 'square', gain: 0.07 }));
    tone(ac, { freq: 110, at: 0.38, dur: 0.5, type: 'sine', gain: 0.3, to: 70 });
    noise(ac, { at: 0.38, dur: 0.25, gain: 0.08, freq: 600 });
  },
  // Crash: alarm, falling sweep, boom
  crash: (ac) => {
    [0, 0.18].forEach((t) => tone(ac, { freq: 740, to: 520, at: t, dur: 0.16, type: 'sawtooth', gain: 0.08 }));
    tone(ac, { freq: 520, to: 55, at: 0.38, dur: 0.9, type: 'sawtooth', gain: 0.1 });
    tone(ac, { freq: 70, to: 35, at: 0.4, dur: 1.1, type: 'sine', gain: 0.4 });
    noise(ac, { at: 0.38, dur: 0.9, gain: 0.14, freq: 1800, sweepTo: 120, filter: 'lowpass' });
  },
  // Rally: rising major arpeggio + shimmer
  rally: (ac) => {
    [0, 4, 7, 12, 16].forEach((s, i) => tone(ac, { freq: NOTE(3 + s), at: i * 0.07, dur: 0.35, type: 'triangle', gain: 0.14 }));
    noise(ac, { at: 0.3, dur: 0.6, gain: 0.05, freq: 6000, filter: 'highpass' });
  },
  'reveal-up': (ac) => {
    tone(ac, { freq: NOTE(7), to: NOTE(14), dur: 0.16, type: 'triangle', gain: 0.18 });
  },
  'reveal-down': (ac) => {
    tone(ac, { freq: NOTE(-5), to: NOTE(-17), dur: 0.22, type: 'triangle', gain: 0.2 });
  },
  rumor: (ac) => {
    tone(ac, { freq: 1600, dur: 0.05, type: 'sine', gain: 0.08 });
    tone(ac, { freq: 1200, at: 0.08, dur: 0.07, type: 'sine', gain: 0.08 });
    noise(ac, { dur: 0.15, gain: 0.03, freq: 3000 });
  },
  achievement: (ac) => {
    [12, 16, 19, 24].forEach((s, i) => tone(ac, { freq: NOTE(3 + s), at: i * 0.06, dur: 0.4, type: 'sine', gain: 0.12 }));
  },
  tick: (ac) => tone(ac, { freq: 2200, dur: 0.025, type: 'square', gain: 0.03 }),
  count: (ac) => {
    for (let i = 0; i < 10; i++) tone(ac, { freq: 1800 + i * 60, at: i * 0.1, dur: 0.03, type: 'square', gain: 0.03 });
  },
  win: (ac) => {
    [[0, 4, 7], [5, 9, 12], [7, 11, 14], [12, 16, 19]].forEach((chord, i) =>
      chord.forEach((s) => tone(ac, { freq: NOTE(3 + s), at: i * 0.14, dur: i === 3 ? 1.1 : 0.22, type: 'triangle', gain: 0.1 })),
    );
  },
  lose: (ac) => {
    [0, -1, -2].forEach((s, i) => tone(ac, { freq: NOTE(-2 + s), at: i * 0.28, dur: 0.3, type: 'triangle', gain: 0.14 }));
    tone(ac, { freq: NOTE(-6), to: NOTE(-8), at: 0.84, dur: 0.9, type: 'triangle', gain: 0.14 });
  },
  record: (ac) => {
    [19, 24, 28, 31].forEach((s, i) => tone(ac, { freq: NOTE(3 + s), at: i * 0.05, dur: 0.6, type: 'sine', gain: 0.09 }));
    noise(ac, { dur: 0.8, gain: 0.04, freq: 7000, filter: 'highpass' });
  },
};

export function playSfx(name: SfxName) {
  const ac = audio();
  if (!ac || !master) return;
  try {
    SOUNDS[name](ac);
  } catch {
    /* never let audio break the game */
  }
}
