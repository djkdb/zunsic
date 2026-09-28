import { EVENT_TEMPLATE_MAP } from '@/data/events';
import type { GameState, ScheduledEvent, StockDefinition } from '@/domain/types';
import { fillTemplate } from '@/lib/format';

export interface CalendarItem {
  event: ScheduledEvent;
  label: string;
  stockIds: string[];
}

/**
 * Publicly scheduled events in the next `horizon` days (earnings, trial readouts, rate
 * decisions, launch events). Only the date and subject are public — never the direction.
 */
export function upcomingCalendarEvents(
  state: Pick<GameState, 'schedule' | 'day'>,
  stocks: readonly StockDefinition[],
  horizon = 3,
): CalendarItem[] {
  const out: CalendarItem[] = [];
  const seen = new Set<string>();
  for (const ev of [...state.schedule].sort((a, b) => a.day - b.day)) {
    if (ev.day <= state.day || ev.day > state.day + horizon) continue;
    const template = EVENT_TEMPLATE_MAP.get(ev.templateId);
    if (!template?.calendar) continue;
    const stock = ev.scope === 'COMPANY' ? stocks.find((s) => s.id === ev.targets[0]) : undefined;
    const label = fillTemplate(template.calendar, { ticker: stock?.ticker ?? '', name: stock?.name ?? '' });
    const key = `${ev.day}-${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ event: ev, label, stockIds: stock ? [stock.id] : [] });
  }
  return out;
}
