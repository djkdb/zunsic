import { useEffect, useRef, useState } from 'react';
import { playSfx } from '@/audio/sfx';
import { useGameStore } from '@/store/gameStore';

/** Top-bar sound menu: effects + music toggles and volumes. */
export function SoundMenu({ className = 'relative' }: { className?: string }) {
  const settings = useGameStore((s) => s.meta.settings);
  const update = useGameStore((s) => s.updateSettings);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const anyOn = settings.sound || settings.music;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--color-line-strong)] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        aria-label="사운드 설정"
        aria-expanded={open}
        title="사운드"
      >
        {anyOn ? '🔊' : '🔇'}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-64 animate-fade-in rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-panel-2)] p-3 shadow-2xl" role="group" aria-label="사운드">
          <Row
            label="효과음"
            on={settings.sound}
            onToggle={() => update({ sound: !settings.sound })}
            volume={settings.volume}
            onVolume={(v) => update({ volume: v })}
            onRelease={() => playSfx('sell')}
          />
          <Row
            label="배경음악"
            on={settings.music}
            onToggle={() => update({ music: !settings.music })}
            volume={settings.musicVolume}
            onVolume={(v) => update({ musicVolume: v })}
          />
          <p className="mt-2 text-[10px] text-[var(--color-dim)]">배경음악은 시장 분위기(강세·약세·폭락·급등)에 따라 바뀝니다.</p>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  on,
  onToggle,
  volume,
  onVolume,
  onRelease,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  volume: number;
  onVolume: (v: number) => void;
  onRelease?: () => void;
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`${label} ${on ? '끄기' : '켜기'}`}
          onClick={onToggle}
          className={`h-6 w-11 rounded-full p-0.5 transition-colors ${on ? 'bg-[var(--color-up)]' : 'bg-[var(--color-panel-3)]'}`}
        >
          <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(volume * 100)}
        disabled={!on}
        aria-label={`${label} 볼륨`}
        onChange={(e) => onVolume(Number(e.target.value) / 100)}
        onPointerUp={onRelease}
        className="mt-1 w-full accent-[var(--color-ink)] disabled:opacity-40"
      />
    </div>
  );
}
