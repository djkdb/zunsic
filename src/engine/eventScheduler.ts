import { EVENT_TEMPLATES, FALSE_RUMORS } from '@/data/events';
import { SEVERITY_RANGE, SEVERITY_RANK } from '@/domain/constants';
import type {
  DifficultyConfig,
  EventTemplate,
  NewsItem,
  RumorEntry,
  ScheduledEvent,
  Severity,
  StockDefinition,
} from '@/domain/types';
import { fillTemplate } from '@/lib/format';
import { createRng, mixSeed, STREAM, type Rng } from '@/lib/rng';
import { stocksWithTags } from '@/data/stocks';

/**
 * Event scheduler.
 *
 * The full 30-day event calendar is generated up-front from the game seed. This lets the
 * game publish hints the day *before* an event and guarantees a dramatic arc:
 *  - calm-ish early days, more frequent / heavier events later
 *  - at least one market-wide crash and one market-wide boom
 *  - at least one major company-level positive and negative shock
 *  - (often) a "hero to zero" arc: a stock rallies on big news, then gets hit
 */

type Phase = 'EARLY' | 'MID' | 'LATE';

const PHASE_CONFIG: Record<Phase, { eventChance: number; secondChance: number; severity: Record<Severity, number> }> = {
  EARLY: { eventChance: 0.55, secondChance: 0.05, severity: { MINOR: 0.55, MODERATE: 0.4, MAJOR: 0.05, EXTREME: 0 } },
  MID: { eventChance: 0.8, secondChance: 0.2, severity: { MINOR: 0.3, MODERATE: 0.45, MAJOR: 0.22, EXTREME: 0.03 } },
  LATE: { eventChance: 0.85, secondChance: 0.3, severity: { MINOR: 0.25, MODERATE: 0.4, MAJOR: 0.28, EXTREME: 0.07 } },
};

function phaseOf(day: number): Phase {
  if (day <= 9) return 'EARLY';
  if (day <= 20) return 'MID';
  return 'LATE';
}

/** Market-scope events use one severity level lower for their targeted component. */
function targetSeverity(template: EventTemplate, severity: Severity): Severity {
  if (template.scope !== 'MARKET') return severity;
  const order: Severity[] = ['MINOR', 'MODERATE', 'MAJOR', 'EXTREME'];
  const drop = template.mega ? 2 : 1;
  return order[Math.max(0, SEVERITY_RANK[severity] - drop)] ?? 'MINOR';
}

function inDayRange(template: EventTemplate, day: number): boolean {
  if (!template.dayRange) return true;
  return day >= template.dayRange[0] && day <= template.dayRange[1];
}

/** Titles shared by opposite-direction templates are ambiguous (e.g. "earnings tomorrow"). */
function isAmbiguousHint(template: EventTemplate): boolean {
  if (!template.hint) return false;
  return EVENT_TEMPLATES.some(
    (other) => other.id !== template.id && other.hint?.title === template.hint?.title && other.direction !== template.direction,
  );
}

export interface ScheduleContext {
  seed: number;
  totalDays: number;
  difficulty: DifficultyConfig;
  stocks: readonly StockDefinition[];
}

export interface ScheduleResult {
  events: ScheduledEvent[];
  rumors: RumorEntry[];
  /** Hint + rumor news items for future days (visible when day <= current day). */
  news: NewsItem[];
}

function makeUid(prefix: string, day: number, rng: Rng): string {
  return `${prefix}-${day}-${Math.floor(rng.next() * 1e9).toString(36)}`;
}

/** Resolve a template into a concrete scheduled event (targets chosen, magnitude rolled). */
export function instantiateEvent(
  template: EventTemplate,
  day: number,
  ctx: Pick<ScheduleContext, 'stocks' | 'difficulty'>,
  rng: Rng,
  opts: { forcedTarget?: string; severity?: Severity } = {},
): ScheduledEvent | null {
  const severity = opts.severity ?? template.severity;
  let targets: string[] = [];

  if (template.scope === 'COMPANY') {
    if (opts.forcedTarget) {
      targets = [opts.forcedTarget];
    } else {
      const pool = stocksWithTags(template.eligibleTags ?? [], ctx.stocks);
      if (pool.length === 0) return null;
      targets = [rng.pick(pool).id];
    }
  } else {
    targets = (template.targetTags?.length ? stocksWithTags(template.targetTags, ctx.stocks) : []).map((s) => s.id);
    if (template.scope === 'SECTOR' && targets.length === 0) return null;
  }

  const spillTargets = template.spill
    ? stocksWithTags(template.spill.tags, ctx.stocks)
        .map((s) => s.id)
        .filter((id) => !targets.includes(id))
    : [];

  const [min, max] = SEVERITY_RANGE[targetSeverity(template, severity)];
  const magnitude = rng.range(min, max) * ctx.difficulty.eventSeverityMultiplier;

  const primary = targets.length === 1 ? ctx.stocks.find((s) => s.id === targets[0]) : undefined;
  const vars = { name: primary?.name ?? '', ticker: primary?.ticker ?? '' };

  return {
    uid: makeUid('ev', day, rng),
    templateId: template.id,
    day,
    scope: template.scope,
    category: template.category,
    title: fillTemplate(template.title, vars),
    summary: fillTemplate(template.summary, vars),
    severity,
    direction: template.direction,
    targets,
    spillTargets,
    spillFactor: template.spill?.factor ?? 0,
    magnitude,
    marketImpact: (template.marketImpact ?? 0) * ctx.difficulty.eventSeverityMultiplier,
    marketShift: template.marketShift,
    followThrough: template.followThrough,
    hinted: false,
  };
}

export function createHintNews(event: ScheduledEvent, template: EventTemplate, stocks: readonly StockDefinition[]): NewsItem | null {
  if (!template.hint || event.day < 2) return null;
  const primary = event.targets.length === 1 ? stocks.find((s) => s.id === event.targets[0]) : undefined;
  const vars = { name: primary?.name ?? '', ticker: primary?.ticker ?? '' };
  return {
    id: `hint-${event.uid}`,
    day: event.day - 1,
    kind: event.scope === 'COMPANY' ? 'RUMOR' : 'ANALYST',
    title: fillTemplate(template.hint.title, vars),
    summary: fillTemplate(template.hint.summary, vars),
    severity: 'MINOR',
    affected: event.scope === 'COMPANY' ? event.targets : [],
    eventUid: event.uid,
  };
}

export function generateSchedule(ctx: ScheduleContext): ScheduleResult {
  const rng = createRng(mixSeed(ctx.seed, STREAM.SCHEDULE));
  const { totalDays, difficulty, stocks } = ctx;
  const events: ScheduledEvent[] = [];
  const reservedDays = new Set<number>();
  const regular = EVENT_TEMPLATES.filter((t) => !t.mega && t.probability > 0);
  const scale = totalDays / 30;
  const d = (n: number) => Math.max(2, Math.min(totalDays, Math.round(n * scale)));

  const add = (ev: ScheduledEvent | null) => {
    if (ev) events.push(ev);
    return ev;
  };

  // 1) Mega events: one crash, one boom, at least 4 days apart.
  const crashTemplates = EVENT_TEMPLATES.filter((t) => t.mega && t.direction === -1);
  const boomTemplates = EVENT_TEMPLATES.filter((t) => t.mega && t.direction === 1);
  let crashDay = rng.int(d(13), d(24));
  let boomDay = rng.int(d(15), d(28));
  for (let i = 0; i < 20 && Math.abs(crashDay - boomDay) < 4; i++) {
    crashDay = rng.int(d(13), d(24));
    boomDay = rng.int(d(15), d(28));
  }
  if (Math.abs(crashDay - boomDay) < 4) {
    crashDay = d(16);
    boomDay = d(24);
  }
  if (crashTemplates.length) add(instantiateEvent(rng.pick(crashTemplates), crashDay, ctx, rng));
  if (boomTemplates.length) add(instantiateEvent(rng.pick(boomTemplates), boomDay, ctx, rng));
  reservedDays.add(crashDay).add(boomDay);

  // 2) Drama arc: a stock soars on big news, then gets hit shortly after.
  if (rng.chance(0.7)) {
    const heroPool = stocks.filter((s) => s.riskLevel === 'HIGH' || s.riskLevel === 'EXTREME');
    if (heroPool.length) {
      const hero = rng.pick(heroPool);
      const upTemplates = regular.filter(
        (t) => t.scope === 'COMPANY' && t.direction === 1 && eligibleFor(t, hero) && SEVERITY_RANK[t.severity] >= 1,
      );
      const downTemplates = regular.filter(
        (t) => t.scope === 'COMPANY' && t.direction === -1 && eligibleFor(t, hero) && SEVERITY_RANK[t.severity] >= 1,
      );
      const upDay = pickFreeDay(rng, d(6), d(19), reservedDays);
      if (upTemplates.length && downTemplates.length && upDay !== null) {
        const downDay = pickFreeDay(rng, upDay + 1, Math.min(totalDays, upDay + 3), reservedDays);
        if (downDay !== null) {
          add(instantiateEvent(rng.pick(upTemplates), upDay, ctx, rng, { forcedTarget: hero.id, severity: 'MAJOR' }));
          add(instantiateEvent(rng.pick(downTemplates), downDay, ctx, rng, { forcedTarget: hero.id, severity: 'MAJOR' }));
          reservedDays.add(upDay).add(downDay);
        }
      }
    }
  }

  // 3) Random fill, ramping up over time. The same headline never repeats within a week
  // and at most twice per game, so the news feed stays varied.
  const lastUsed = new Map<string, number>();
  const useCount = new Map<string, number>();
  for (const ev of events) {
    lastUsed.set(ev.templateId, ev.day);
    useCount.set(ev.templateId, (useCount.get(ev.templateId) ?? 0) + 1);
  }
  const available = (t: EventTemplate, day: number) =>
    inDayRange(t, day) && (useCount.get(t.id) ?? 0) < 2 && Math.abs(day - (lastUsed.get(t.id) ?? -99)) > 6;
  for (let day = 2; day <= totalDays; day++) {
    if (reservedDays.has(day)) continue;
    const cfg = PHASE_CONFIG[phaseOf(Math.round(day / scale))];
    const count = rng.chance(cfg.eventChance) ? (rng.chance(cfg.secondChance) ? 2 : 1) : 0;
    const usedTargets = new Set<string>();
    for (let i = 0; i < count; i++) {
      const template = rng.weighted(
        regular.filter((t) => available(t, day)),
        (t) => t.probability * cfg.severity[t.severity],
      );
      if (!template) continue;
      lastUsed.set(template.id, day);
      useCount.set(template.id, (useCount.get(template.id) ?? 0) + 1);
      // Avoid hitting the same stock twice on one day.
      let ev: ScheduledEvent | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        ev = instantiateEvent(template, day, ctx, rng);
        if (!ev || template.scope !== 'COMPANY' || !usedTargets.has(ev.targets[0] ?? '')) break;
        ev = null;
      }
      if (ev) {
        ev.targets.forEach((t) => usedTargets.add(t));
        add(ev);
      }
    }
  }

  // 4) Guarantee at least one major company-level shock in each direction.
  for (const direction of [1, -1] as const) {
    const has = events.some(
      (e) => e.scope === 'COMPANY' && e.direction === direction && SEVERITY_RANK[e.severity] >= SEVERITY_RANK.MAJOR,
    );
    if (has) continue;
    const pool = regular.filter(
      (t) => t.scope === 'COMPANY' && t.direction === direction && SEVERITY_RANK[t.severity] >= SEVERITY_RANK.MODERATE,
    );
    const day = pickFreeDay(rng, d(8), totalDays, reservedDays, events);
    if (pool.length && day !== null) {
      add(instantiateEvent(rng.pick(pool), day, ctx, rng, { severity: 'MAJOR' }));
      reservedDays.add(day);
    }
  }

  events.sort((a, b) => a.day - b.day);

  // 5) Hints: published the day before for a subset of events.
  const news: NewsItem[] = [];
  for (const ev of events) {
    const template = EVENT_TEMPLATES.find((t) => t.id === ev.templateId);
    if (!template?.hint || ev.day < 3) continue;
    const rate = template.mega ? Math.min(0.85, difficulty.hintRate + 0.25) : difficulty.hintRate;
    if (!rng.chance(rate)) continue;
    const item = createHintNews(ev, template, stocks);
    if (!item) continue;
    ev.hinted = true;
    ev.hintDay = ev.day - 1;
    ev.hintAmbiguous = isAmbiguousHint(template);
    news.push(item);
  }

  // 6) False rumors — noise the player has to learn to discount.
  const rumors: RumorEntry[] = [];
  const rumorCount = rng.int(2, 4);
  for (let i = 0; i < rumorCount; i++) {
    const rumor = rng.pick(FALSE_RUMORS);
    const pool = stocksWithTags(rumor.eligibleTags, stocks);
    if (!pool.length) continue;
    const stock = rng.pick(pool);
    const day = rng.int(3, totalDays - 1);
    const entry: RumorEntry = {
      uid: makeUid('rm', day, rng),
      day,
      stockId: stock.id,
      direction: rumor.direction,
      magnitude: rng.range(0.008, 0.025),
    };
    rumors.push(entry);
    news.push({
      id: `rumor-${entry.uid}`,
      day,
      kind: 'RUMOR',
      title: fillTemplate(rumor.title, { name: stock.name, ticker: stock.ticker }),
      summary: fillTemplate(rumor.summary, { name: stock.name, ticker: stock.ticker }),
      severity: 'MINOR',
      affected: [stock.id],
    });
  }

  news.sort((a, b) => a.day - b.day);
  return { events, rumors, news };
}

function eligibleFor(template: EventTemplate, stock: StockDefinition): boolean {
  const tags = template.eligibleTags ?? [];
  return tags.length === 0 || stock.tags.some((t) => tags.includes(t));
}

function pickFreeDay(
  rng: Rng,
  min: number,
  max: number,
  reserved: Set<number>,
  events: readonly ScheduledEvent[] = [],
): number | null {
  const candidates: number[] = [];
  for (let day = Math.max(2, min); day <= max; day++) {
    if (!reserved.has(day) && !events.some((e) => e.day === day && SEVERITY_RANK[e.severity] >= 2)) candidates.push(day);
  }
  return candidates.length ? rng.pick(candidates) : null;
}
