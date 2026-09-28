import { expect, test, type Page } from '@playwright/test';
import { currentDay, nextDay, primeSettings, readNumber, settle, startGame } from './helpers';

const shot = (page: Page, name: string) => page.screenshot({ path: `e2e/screenshots/desktop-${name}.png` });

async function order(page: Page, side: 'BUY' | 'SELL', ticker: string, qty: number | string) {
  await page.getByRole('combobox', { name: '종목 선택' }).selectOption(ticker.toLowerCase());
  await page.getByRole('radio', { name: side === 'BUY' ? '▲ BUY' : '▼ SELL' }).click();
  await page.getByLabel('QUANTITY').fill(String(qty));
  await page.getByRole('button', { name: new RegExp(`^${side} ${ticker}`) }).click();
}

test.beforeEach(async ({ page }) => {
  await primeSettings(page);
});

test('01–07, 11, 16: new game, trading, P&L, next day, risk, refresh/continue', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // Test 01 — ₩1,000,000
  await startGame(page);
  await shot(page, '01-market-open');
  expect(await readNumber(page, 'total-value')).toBe(1_000_000);
  expect(await readNumber(page, 'cash-value')).toBe(1_000_000);
  expect(await currentDay(page)).toBe(1);

  // Test 02 — BUY
  await order(page, 'BUY', 'NOVA', 10);
  await expect(page.getByText('ORDER EXECUTED')).toBeVisible();
  await shot(page, '02-order-executed');
  const cashAfterBuy = await readNumber(page, 'cash-value');
  expect(cashAfterBuy).toBeLessThan(1_000_000);
  await page.getByRole('tab', { name: 'HOLDINGS' }).click();
  await expect(page.getByRole('table', { name: '보유 종목' }).getByText('NOVA')).toBeVisible();

  // Test 04 — second buy averages in
  await order(page, 'BUY', 'NOVA', 10);
  const spentPerShare = (1_000_000 - (await readNumber(page, 'cash-value'))) / 20;
  const avgCell = page.getByRole('table', { name: '보유 종목' }).locator('tbody tr').first().locator('td').nth(2);
  await expect(avgCell).toContainText(Math.round(spentPerShare).toLocaleString('ko-KR'));

  // Test 15 — validation blocks
  await page.getByRole('radio', { name: '▼ SELL' }).click();
  await page.getByLabel('QUANTITY').fill('999');
  await expect(page.getByText(/BLOCKED — 보유 수량/)).toBeVisible();
  await page.getByRole('button', { name: /^SELL NOVA/ }).click();
  await expect(page.getByText('ORDER BLOCKED')).toBeVisible();
  await page.getByLabel('QUANTITY').fill('0');
  await expect(page.getByText(/BLOCKED — 1주 이상/)).toBeVisible();
  await page.getByRole('radio', { name: '▲ BUY' }).click();
  await page.getByLabel('QUANTITY').fill('99999');
  await expect(page.getByText(/BLOCKED — 현금이 부족/)).toBeVisible();
  await page.getByLabel('QUANTITY').fill('-5');
  await expect(page.getByText(/⛔ BLOCKED —/)).toBeVisible();
  await shot(page, '15-validation');

  // Test 07 — next day updates prices
  const priceBefore = await page.locator('[data-testid="total-value"]').getAttribute('data-value');
  await nextDay(page, { shot: 'e2e/screenshots/desktop-26-daily-report.png' });
  expect(await currentDay(page)).toBe(2);
  const priceAfter = await page.locator('[data-testid="total-value"]').getAttribute('data-value');
  expect(priceAfter).not.toBe(priceBefore);

  // Test 03 + 05 — SELL realizes P&L
  const cashBeforeSell = await readNumber(page, 'cash-value');
  await order(page, 'SELL', 'NOVA', 5);
  expect(await readNumber(page, 'cash-value')).toBeGreaterThan(cashBeforeSell);
  expect(await readNumber(page, 'realized-value')).not.toBe(0);
  // Test 06 — unrealized reflects remaining 15 shares
  expect(await readNumber(page, 'unrealized-value')).not.toBeNaN();

  // Test 11 — concentration + risk
  await page.getByRole('combobox', { name: '종목 선택' }).selectOption('orbt');
  await page.getByRole('radio', { name: '▲ BUY' }).click();
  await page.getByRole('button', { name: 'MAX' }).click();
  await page.getByRole('button', { name: /^BUY ORBT/ }).click();
  await expect(page.getByText('HIGH CONCENTRATION')).toBeVisible();
  await expect(page.getByText(/RISK (HIGH|EXTREME)/).first()).toBeVisible();
  await shot(page, '11-concentration');

  // Test 16 — refresh keeps progress
  const totalBefore = await readNumber(page, 'total-value');
  const dayBefore = await currentDay(page);
  await page.waitForTimeout(500); // debounce save
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await settle(page);
  expect(await currentDay(page)).toBe(dayBefore);
  expect(await readNumber(page, 'total-value')).toBe(totalBefore);

  expect(errors).toEqual([]);
});

test('08–10, 12–15: breaking news, crash, full 30 days, result screen, share', async ({ page }) => {
  test.setTimeout(300_000);
  await startGame(page);
  // Buy into NOVA before the news flow
  await order(page, 'BUY', 'NOVA', 20);

  let sawBreaking = false;
  let sawCrash = false;
  for (let d = 1; d < 30; d++) {
    await nextDay(page, {
      onBreaking: async (p) => {
        const dialog = p.getByRole('dialog');
        await expect(dialog.getByText(/BREAKING NEWS|MARKET ALERT|MARKET SURGE/).first()).toBeVisible();
        // Test 08 — affected stock % change is revealed
        await expect(dialog.locator('text=/[▲▼] [+-]?\\d+\\.\\d%/').first()).toBeVisible({ timeout: 8000 });
        if (!sawBreaking) await shot(p, '08-breaking-news');
        sawBreaking = true;
        if (await dialog.getByText('MARKET ALERT').count()) {
          sawCrash = true;
          await expect(dialog.getByText('MARKET INDEX')).toBeVisible();
          await shot(p, '10-crash');
          // Test 46 — decision options
          await expect(dialog.getByRole('button', { name: 'BUY THE DIP' })).toBeVisible();
        }
      },
    });
    if (d === 14) await order(page, 'BUY', 'GRNT', 5);
  }
  expect(sawBreaking).toBe(true);
  expect(sawCrash).toBe(true);
  expect(await currentDay(page)).toBe(30);

  // Test 14 — day 30 ends the game
  await expect(page.getByRole('button', { name: /최종 정산/ })).toBeVisible();
  await nextDay(page);
  await expect(page.getByText('GAME OVER')).toBeVisible();
  await page.waitForURL(/#\/result/);

  // Test 15 — result reveal
  await page.getByRole('button', { name: 'SHOW ALL' }).click().catch(() => {});
  await expect(page.getByText('FINAL VALUE')).toBeVisible();
  await expect(page.getByText('MAX DRAWDOWN')).toBeVisible();
  await expect(page.getByText('YOUR TRADING STYLE')).toBeVisible();
  await expect(page.getByText('TOTAL TRADES')).toBeVisible();
  await expect(page.getByText('★ NEW RECORD')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'e2e/screenshots/desktop-15-result.png', fullPage: true });

  // Test 13 — achievements
  await expect(page.getByText('ACHIEVEMENTS THIS RUN')).toBeVisible();
  await expect(page.getByLabel('Achievements this run').getByText('FIRST TRADE')).toBeVisible();

  // Share card renders
  await page.getByRole('button', { name: 'SHARE', exact: true }).click();
  await expect(page.getByAltText('결과 공유 카드 미리보기')).toBeVisible();
  await shot(page, '66-share');
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();

  // Personal best on home
  await page.getByRole('button', { name: 'HOME' }).click();
  await expect(page.getByText('1 PLAYED')).toBeVisible();
});

test('17: new game resets progress after confirmation', async ({ page }) => {
  await startGame(page);
  await order(page, 'BUY', 'AURA', 3);
  await nextDay(page);
  await page.goto('/#/');
  await page.getByRole('button', { name: /NEW GAME/ }).click();
  await expect(page.getByText('START A NEW GAME?')).toBeVisible();
  await page.getByRole('button', { name: 'RESET & START' }).click();
  await page.getByRole('button', { name: /^▸ START/ }).click();
  await settle(page);
  expect(await currentDay(page)).toBe(1);
  expect(await readNumber(page, 'cash-value')).toBe(1_000_000);
});

test('20: production build hides debug tools', async ({ page }) => {
  await page.goto('/?debug=true#/');
  await page.getByRole('button', { name: /NEW GAME/ }).click();
  await page.getByRole('button', { name: /^▸ START/ }).click();
  await settle(page);
  await expect(page.getByTestId('debug-panel')).toHaveCount(0);
  await expect(page.getByText('DEBUG PANEL')).toHaveCount(0);
});

test('55: reset all data requires double confirmation', async ({ page }) => {
  await startGame(page);
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'RESET', exact: true }).click();
  await expect(page.getByText('RESET ALL DATA?')).toBeVisible();
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await expect(page.getByText('ARE YOU ABSOLUTELY SURE?')).toBeVisible();
  await page.getByRole('button', { name: 'DELETE ALL' }).click();
  await expect(page.getByRole('button', { name: 'CONTINUE' })).toBeDisabled();
});

test('61: corrupted save falls back safely', async ({ page }) => {
  await page.goto('/#/');
  await page.evaluate(() => localStorage.setItem('market30:save:v1', '{"version":1,"cash":"oops"'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('손상');
  await expect(page.getByRole('button', { name: 'CONTINUE' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /NEW GAME/ })).toBeEnabled();
});
