import { expect, test, type Page } from '@playwright/test';
import { currentDay, nextDay, primeSettings, readNumber, settle, startGame } from './helpers';

const shot = (page: Page, name: string) => page.screenshot({ path: `e2e/screenshots/desktop-${name}.png` });

async function order(page: Page, side: 'BUY' | 'SELL', ticker: string, qty: number | string) {
  await page.getByRole('combobox', { name: '종목 선택' }).selectOption(ticker.toLowerCase());
  await page.getByRole('radio', { name: side === 'BUY' ? '▲ 매수' : '▼ 매도' }).click();
  await page.getByLabel('수량', { exact: true }).fill(String(qty));
  await page.getByRole('button', { name: new RegExp(`^${ticker} ${side === 'BUY' ? '매수' : '매도'}`) }).click();
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
  await expect(page.getByText('주문 체결', { exact: true })).toBeVisible();
  await shot(page, '02-order-executed');
  const cashAfterBuy = await readNumber(page, 'cash-value');
  expect(cashAfterBuy).toBeLessThan(1_000_000);
  await page.getByRole('tab', { name: '보유 종목' }).click();
  await expect(page.getByRole('table', { name: '보유 종목' }).getByText('NOVA')).toBeVisible();

  // Test 04 — second buy averages in
  await order(page, 'BUY', 'NOVA', 10);
  const spentPerShare = (1_000_000 - (await readNumber(page, 'cash-value'))) / 20;
  const avgCell = page.getByRole('table', { name: '보유 종목' }).locator('tbody tr').first().locator('td').nth(2);
  await expect(avgCell).toContainText(Math.round(spentPerShare).toLocaleString('ko-KR'));

  // Test 15 — validation blocks
  await page.getByRole('radio', { name: '▼ 매도' }).click();
  await page.getByLabel('수량', { exact: true }).fill('999');
  await expect(page.getByText(/주문 불가 — 보유 수량/)).toBeVisible();
  await page.getByRole('button', { name: /^NOVA 매도/ }).click();
  await expect(page.getByText('주문 불가', { exact: true })).toBeVisible();
  await page.getByLabel('수량', { exact: true }).fill('0');
  await expect(page.getByText(/주문 불가 — 1주 이상/)).toBeVisible();
  await page.getByRole('radio', { name: '▲ 매수' }).click();
  await page.getByLabel('수량', { exact: true }).fill('99999');
  await expect(page.getByText(/주문 불가 — 현금이 부족/)).toBeVisible();
  await page.getByLabel('수량', { exact: true }).fill('-5');
  await expect(page.getByText(/⛔ 주문 불가 —/)).toBeVisible();
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
  await page.getByRole('radio', { name: '▲ 매수' }).click();
  await page.getByRole('button', { name: '최대', exact: true }).click();
  await page.getByRole('button', { name: /^ORBT 매수/ }).click();
  await expect(page.getByText('집중 투자 경고')).toBeVisible();
  await expect(page.getByText(/위험 (높음|매우 높음)/).first()).toBeVisible();
  await shot(page, '11-concentration');

  // Test 16 — refresh keeps progress
  const totalBefore = await readNumber(page, 'total-value');
  const dayBefore = await currentDay(page);
  await page.waitForTimeout(500); // debounce save
  await page.reload();
  await page.getByRole('button', { name: '이어하기' }).click();
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
        await expect(dialog.getByText(/속보|시장 경보|시장 급등/).first()).toBeVisible();
        // Test 08 — affected stock % change is revealed
        await expect(dialog.locator('text=/[▲▼] [+-]?\\d+\\.\\d%/').first()).toBeVisible({ timeout: 8000 });
        if (!sawBreaking) await shot(p, '08-breaking-news');
        sawBreaking = true;
        if (await dialog.getByText('시장 경보', { exact: true }).count()) {
          sawCrash = true;
          await expect(dialog.getByText('시장 지수')).toBeVisible();
          await shot(p, '10-crash');
          // Test 46 — decision options
          await expect(dialog.getByRole('button', { name: '저점 매수' })).toBeVisible();
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
  await expect(page.getByText('게임 종료', { exact: true })).toBeVisible();
  await page.waitForURL(/#\/result/);

  // Test 15 — result reveal
  await page.getByRole('button', { name: '전체 보기' }).click().catch(() => {});
  await expect(page.getByText('최종 자산', { exact: true })).toBeVisible();
  await expect(page.getByText('최대 낙폭 (MDD)')).toBeVisible();
  await expect(page.getByText('나의 투자 스타일')).toBeVisible();
  await expect(page.getByText('총 거래 횟수')).toBeVisible();
  await expect(page.getByText('첫 완주 기록 등록')).toBeVisible();
  await expect(page.getByText('★ 신기록')).toHaveCount(0);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'e2e/screenshots/desktop-15-result.png', fullPage: true });

  // Test 13 — achievements
  await expect(page.getByText('이번 게임에서 달성한 업적')).toBeVisible();
  await expect(page.getByLabel('이번 게임 업적').getByText('첫 거래')).toBeVisible();

  // Share card renders
  await page.getByRole('button', { name: '결과 공유', exact: true }).click();
  await expect(page.getByAltText('결과 공유 카드 미리보기')).toBeVisible();
  await shot(page, '66-share');
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();

  // Personal best on home
  await page.getByRole('button', { name: '홈', exact: true }).click();
  await expect(page.getByText('1회 플레이')).toBeVisible();
});

test('17: new game resets progress after confirmation', async ({ page }) => {
  await startGame(page);
  await order(page, 'BUY', 'AURA', 3);
  await nextDay(page);
  await page.goto('/#/');
  await page.getByRole('button', { name: /새 게임/ }).click();
  await expect(page.getByText('새 게임을 시작할까요?')).toBeVisible();
  await page.getByRole('button', { name: '초기화하고 시작' }).click();
  await page.getByRole('button', { name: /^▸ 게임 시작/ }).click();
  await settle(page);
  expect(await currentDay(page)).toBe(1);
  expect(await readNumber(page, 'cash-value')).toBe(1_000_000);
});

test('20: production build hides debug tools', async ({ page }) => {
  await page.goto('/?debug=true#/');
  await page.getByRole('button', { name: /새 게임/ }).click();
  await page.getByRole('button', { name: /^▸ 게임 시작/ }).click();
  await settle(page);
  await expect(page.getByTestId('debug-panel')).toHaveCount(0);
  await expect(page.getByText('DEBUG PANEL')).toHaveCount(0);
});

test('55: reset all data requires double confirmation', async ({ page }) => {
  await startGame(page);
  await page.goto('/#/settings');
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await expect(page.getByText('모든 데이터를 초기화할까요?')).toBeVisible();
  await page.getByRole('button', { name: '계속', exact: true }).click();
  await expect(page.getByText('정말로 삭제하시겠습니까?')).toBeVisible();
  await page.getByRole('button', { name: '전부 삭제' }).click();
  await expect(page.getByRole('button', { name: '이어하기' })).toBeDisabled();
});

test('61: corrupted save falls back safely', async ({ page }) => {
  await page.goto('/#/');
  await page.evaluate(() => localStorage.setItem('market30:save:v1', '{"version":1,"cash":"oops"'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('손상');
  await expect(page.getByRole('button', { name: '이어하기' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /새 게임/ })).toBeEnabled();
});

test('first-time guide, keyboard flow and upcoming calendar', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('primed2')) return;
    sessionStorage.setItem('primed2', '1');
    localStorage.clear();
    localStorage.setItem('market30:meta:v1', JSON.stringify({ version: 1, settings: { reducedMotion: 'on', fastMode: true } }));
  });
  await page.goto('/#/');
  await page.getByRole('button', { name: /새 게임/ }).click();
  await page.getByText('고급 · 시장 시드').click();
  await page.getByPlaceholder('랜덤').fill('20260928');
  await page.getByRole('button', { name: /^▸ 게임 시작/ }).click();
  // Guide appears once for a new player
  await expect(page.getByRole('heading', { name: /30일 버티기/ })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /시작하기/ }).click();
  await expect(page.getByRole('heading', { name: /30일 버티기/ })).toHaveCount(0);
  await expect(page.getByLabel('다가오는 일정')).toBeVisible();

  // Keyboard-only day loop: N → Enter (report) → Enter (breaking news, if any)
  for (let d = 1; d <= 3; d++) {
    await page.keyboard.press('n');
    await expect(page.getByRole('dialog').filter({ hasText: 'DAILY REPORT' })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => {
        if (await page.locator('#breaking-title').count()) {
          const btn = page.getByRole('button', { name: /거래 계속하기|^보유 유지$/ });
          if (await btn.count()) await page.keyboard.press('Enter');
        }
        return page.locator('[role=dialog]').count();
      }, { timeout: 15_000 })
      .toBe(0);
    await expect.poll(() => currentDay(page)).toBe(d + 1);
  }

  // Guide stays dismissed after reload; "?" reopens it
  await page.reload();
  await page.getByRole('button', { name: '이어하기' }).click();
  await settle(page);
  await expect(page.getByRole('heading', { name: /30일 버티기/ })).toHaveCount(0);
  await page.getByRole('button', { name: '게임 방법' }).click();
  await expect(page.getByRole('heading', { name: /30일 버티기/ })).toBeVisible();
});

test('sound effects play on trades and respect the mute toggle', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __osc: number };
    w.__osc = 0;
    const orig = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      w.__osc++;
      return orig.call(this);
    };
  });
  await primeSettings(page);
  await startGame(page);
  const osc = () => page.evaluate(() => (window as unknown as { __osc: number }).__osc);
  const buyOne = async () => {
    await page.getByRole('radio', { name: '▲ 매수' }).click();
    await page.getByLabel('수량', { exact: true }).fill('1');
    await page.getByRole('button', { name: /^NOVA 매수/ }).click();
    await page.waitForTimeout(150);
  };
  let before = await osc();
  await buyOne();
  expect(await osc()).toBeGreaterThan(before);

  await page.getByRole('button', { name: '효과음 끄기' }).click();
  before = await osc();
  await buyOne();
  expect(await osc()).toBe(before);
  await expect(page.getByRole('button', { name: '효과음 켜기' })).toBeVisible();
});
