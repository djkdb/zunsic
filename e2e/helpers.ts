import { expect, type Page } from '@playwright/test';

export const SEED = 20260928;

/** Fast presentation for tests: reduced motion + fast transitions. */
export async function primeSettings(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('primed')) return;
    sessionStorage.setItem('primed', '1');
    localStorage.clear();
    localStorage.setItem(
      'market30:meta:v1',
      JSON.stringify({ version: 1, achievements: {}, personalBest: {}, settings: { reducedMotion: 'on', fastMode: true, difficulty: 'NORMAL' } }),
    );
  });
}

export async function startGame(page: Page, seed = SEED, path = '/') {
  await page.goto(`${path}#/`);
  await page.getByRole('button', { name: /새 게임/ }).click();
  await page.getByText('고급 · 시장 시드').click();
  await page.getByPlaceholder('랜덤').fill(String(seed));
  await page.getByRole('button', { name: /^▸ 게임 시작/ }).click();
  await settle(page);
}

export async function readNumber(page: Page, testId: string): Promise<number> {
  const el = page.getByTestId(testId).first();
  return Number(await el.getAttribute('data-value'));
}

export async function currentDay(page: Page): Promise<number> {
  return Number(await page.getByTestId('day-indicator').getAttribute('data-day'));
}

/** Click through splashes / breaking news / report until the market is open for trading. */
export async function settle(page: Page, opts: { onBreaking?: (page: Page) => Promise<void> } = {}) {
  for (let i = 0; i < 60; i++) {
    const nextDay = page.getByRole('button', { name: /장 마감|최종 정산/ });
    if ((await nextDay.count()) && (await nextDay.isEnabled())) return;
    const breaking = page.getByRole('dialog').filter({ has: page.locator('#breaking-title') });
    if (await breaking.count()) {
      if (opts.onBreaking) {
        await opts.onBreaking(page);
        opts = {};
      }
      const cont = page.getByRole('button', { name: /거래 계속하기|^보유 유지$/ });
      if (await cont.count()) {
        await cont.first().click();
        continue;
      }
    }
    const skip = page.getByRole('button', { name: '건너뛰기' });
    if (await skip.count()) {
      await skip.first().click({ timeout: 2000 }).catch(() => {});
      continue;
    }
    await page.waitForTimeout(150);
  }
  throw new Error('Market never opened');
}

/** Close the day, walk through the report, and open the next day. */
export async function nextDay(page: Page, opts: { onBreaking?: (page: Page) => Promise<void>; shot?: string } = {}) {
  const day = await currentDay(page);
  await page.getByRole('button', { name: /장 마감|최종 정산/ }).click();
  const report = page.getByRole('dialog').filter({ hasText: 'DAILY REPORT' });
  await expect(report).toBeVisible();
  if (opts.shot) await page.screenshot({ path: opts.shot });
  await report.getByRole('button', { name: /장 시작|최종 정산/ }).click();
  if (day >= 30) return;
  await settle(page, opts);
  await expect.poll(() => currentDay(page)).toBe(day + 1);
}
