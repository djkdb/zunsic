import { memo, useState } from 'react';
import { getStock } from '@/data/stocks';
import type { NewsItem, NewsKind } from '@/domain/types';
import { directionSymbol, formatDay, formatPct, trendClass } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';
import { getVisibleNews } from '@/store/selectors';

const KIND_STYLE: Record<NewsKind, { label: string; cls: string }> = {
  BREAKING: { label: 'BREAKING', cls: 'bg-[var(--color-amber)] text-[#1b1203]' },
  MARKET: { label: 'MARKET', cls: 'bg-[var(--color-down)] text-[#1a0505]' },
  NEWS: { label: 'NEWS', cls: 'bg-[var(--color-panel-3)] text-[var(--color-muted)]' },
  RUMOR: { label: 'RUMOR', cls: 'border border-dashed border-[var(--color-line-strong)] text-[var(--color-muted)]' },
  ANALYST: { label: 'ANALYST NOTE', cls: 'border border-[var(--color-info)]/50 text-[var(--color-info)]' },
};

export function KindBadge({ item }: { item: NewsItem }) {
  const style = item.kind === 'MARKET' && item.direction === 1 ? { label: 'MARKET', cls: 'bg-[var(--color-up)] text-[#04140b]' } : KIND_STYLE[item.kind];
  return <span className={`inline-flex shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider ${style.cls}`}>{style.label}</span>;
}

export const NewsItemRow = memo(function NewsItemRow({
  item,
  focusStock,
  compact,
}: {
  item: NewsItem;
  focusStock?: string;
  compact?: boolean;
}) {
  const unconfirmed = item.kind === 'RUMOR' || item.kind === 'ANALYST';
  return (
    <li className={compact ? 'py-2.5' : 'px-4 py-3'}>
      <div className="flex items-center gap-2">
        <KindBadge item={item} />
        <span className="font-mono text-[10px] text-[var(--color-dim)]">{formatDay(item.day)}</span>
        {unconfirmed && <span className="font-mono text-[9px] text-[var(--color-dim)]">· UNCONFIRMED</span>}
      </div>
      <p className={`mt-1 font-mono font-semibold leading-snug text-[var(--color-ink)] ${compact ? 'text-[12px]' : 'text-[13px]'}`}>{item.title}</p>
      {!compact && item.summary && <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-muted)]">{item.summary}</p>}
      {item.impacts && Object.keys(item.impacts).length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {Object.entries(item.impacts)
            .filter(([id]) => !focusStock || id === focusStock || !compact)
            .slice(0, 6)
            .map(([id, change]) => (
              <span key={id} className={`num rounded bg-[var(--color-panel-2)] px-1.5 py-0.5 text-[10px] ${trendClass(change)}`}>
                {getStock(id)?.ticker ?? id} {directionSymbol(change)} {formatPct(change, { digits: 1 })}
              </span>
            ))}
        </div>
      )}
      {!item.impacts && item.marketChange !== undefined && (
        <span className={`num mt-1 inline-block text-[10px] ${trendClass(item.marketChange)}`}>
          INDEX {directionSymbol(item.marketChange)} {formatPct(item.marketChange)}
        </span>
      )}
    </li>
  );
});

type Filter = 'ALL' | 'BREAKING' | 'RUMOR';

export function NewsFeed({ limit }: { limit?: number }) {
  const game = useGameStore((s) => s.game);
  const [filter, setFilter] = useState<Filter>('ALL');
  if (!game) return null;
  const all = getVisibleNews(game);
  const items = all
    .filter((n) =>
      filter === 'ALL' ? true : filter === 'BREAKING' ? n.kind === 'BREAKING' || n.kind === 'MARKET' : n.kind === 'RUMOR' || n.kind === 'ANALYST',
    )
    .slice(0, limit ?? 200);

  return (
    <div>
      <div role="tablist" aria-label="뉴스 필터" className="flex gap-1 border-b border-[var(--color-line)] px-3 py-2">
        {(['ALL', 'BREAKING', 'RUMOR'] as Filter[]).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`h-8 rounded-md px-3 font-mono text-[11px] font-bold tracking-wider ${
              filter === f ? 'bg-[var(--color-panel-3)] text-[var(--color-ink)]' : 'text-[var(--color-dim)] hover:text-[var(--color-muted)]'
            }`}
          >
            {f === 'RUMOR' ? 'RUMORS / NOTES' : f}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--color-dim)]">아직 뉴스가 없습니다. 시장은 조용하다… 지금은.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-line)]">
          {items.map((n) => (
            <NewsItemRow key={n.id} item={n} />
          ))}
        </ul>
      )}
      <p className="px-4 py-3 text-[11px] text-[var(--color-dim)]">
        RUMOR / ANALYST NOTE는 확인되지 않은 정보입니다. 일부는 다음 날 현실이 되고, 일부는 헛소문으로 끝납니다.
      </p>
    </div>
  );
}

/** Dashboard card with the most recent breaking headline. */
export function BreakingCard() {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const news = getVisibleNews(game);
  const latest = news.find((n) => n.kind === 'BREAKING' || n.kind === 'MARKET');
  const hint = news.find((n) => n.day === game.day && (n.kind === 'RUMOR' || n.kind === 'ANALYST'));
  return (
    <section className="panel overflow-hidden" aria-label="Breaking news">
      <div className="flex items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-amber-soft)] px-3 py-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-amber)]" aria-hidden="true" />
        <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-[var(--color-amber)]">BREAKING NEWS</span>
      </div>
      <ul>
        {latest ? <NewsItemRow item={latest} /> : <li className="px-4 py-4 text-sm text-[var(--color-dim)]">조용한 장입니다. 첫 뉴스를 기다리는 중…</li>}
        {hint && (
          <li className="border-t border-dashed border-[var(--color-line)]">
            <ul>
              <NewsItemRow item={hint} />
            </ul>
          </li>
        )}
      </ul>
    </section>
  );
}
