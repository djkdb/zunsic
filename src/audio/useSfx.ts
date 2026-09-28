import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { configureMusicBus, configureSfx, playSfx, setAudioSuspended, unlockSfx, type SfxName } from './sfx';
import { setMusicMood, type Mood } from './music';
import type { MarketStateId } from '@/domain/types';
import { useGameStore } from '@/store/gameStore';
import { isPreReveal } from '@/store/selectors';

/** Keep the audio engine in sync with settings and unlock it on the first gesture. */
export function useSfxSetup() {
  const sound = useGameStore((s) => s.meta.settings.sound);
  const volume = useGameStore((s) => s.meta.settings.volume);
  const music = useGameStore((s) => s.meta.settings.music);
  const musicVolume = useGameStore((s) => s.meta.settings.musicVolume);
  useEffect(() => {
    configureSfx({ enabled: sound, volume });
  }, [sound, volume]);
  useEffect(() => {
    configureMusicBus({ enabled: music, volume: musicVolume });
  }, [music, musicVolume]);
  useEffect(() => {
    const unlock = () => unlockSfx();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    const onVisibility = () => setAudioSuspended(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}

const MOOD_BY_STATE: Record<MarketStateId, Mood> = {
  BULL: 'bull',
  NEUTRAL: 'calm',
  BEAR: 'bear',
  VOLATILE: 'volatile',
  CRASH: 'crash',
  RALLY: 'rally',
};

/** Picks the background-music mood from the screen and the (displayed) market regime. */
export function useMusicDirector() {
  const { pathname } = useLocation();
  const music = useGameStore((s) => s.meta.settings.music);
  const mood = useGameStore((s): Mood => {
    const g = s.game;
    if (pathname.startsWith('/result')) return (s.finished?.stats.returnPct ?? 0) >= 0 ? 'victory' : 'calm';
    if (!pathname.startsWith('/play') || !g) return 'calm';
    if (g.phase === 'GAME_COMPLETE' || g.phase === 'RESULT') return 'calm';
    // Before the breaking news lands, keep yesterday's mood — the switch is part of the reveal.
    const state = isPreReveal(g) ? (g.marketStateHistory[g.marketStateHistory.length - 2] ?? 'NEUTRAL') : g.marketState;
    return MOOD_BY_STATE[state];
  });
  useEffect(() => {
    setMusicMood(music ? mood : null);
  }, [music, mood]);
  useEffect(() => () => setMusicMood(null), []);
}

/** Play a sound when the component mounts (deferred so StrictMode's test mount stays silent). */
export function useSfxOnMount(name: SfxName | null) {
  useEffect(() => {
    if (!name) return;
    const t = setTimeout(() => playSfx(name), 0);
    return () => clearTimeout(t);
  }, [name]);
}
