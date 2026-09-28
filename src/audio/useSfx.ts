import { useEffect } from 'react';
import { configureSfx, playSfx, unlockSfx, type SfxName } from './sfx';
import { useGameStore } from '@/store/gameStore';

/** Keep the audio engine in sync with settings and unlock it on the first gesture. */
export function useSfxSetup() {
  const sound = useGameStore((s) => s.meta.settings.sound);
  const volume = useGameStore((s) => s.meta.settings.volume);
  useEffect(() => {
    configureSfx({ enabled: sound, volume });
  }, [sound, volume]);
  useEffect(() => {
    const unlock = () => unlockSfx();
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, []);
}

/** Play a sound when the component mounts (deferred so StrictMode's test mount stays silent). */
export function useSfxOnMount(name: SfxName | null) {
  useEffect(() => {
    if (!name) return;
    const t = setTimeout(() => playSfx(name), 0);
    return () => clearTimeout(t);
  }, [name]);
}
