import { expect, test } from '@playwright/test';
import { currentDay, nextDay, primeSettings, readNumber, startGame } from './helpers';

for (const width of [375, 390, 414, 430]) {
  test(`18: mobile play at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await primeSettings(page);
    await startGame(page);
    // No horizontal scroll
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `e2e/screenshots/mobile-${width}-dashboard.png` });

    // Open a stock from the watchlist, trade via bottom sheet
    await page.getByRole('list', { name: '관심 종목' }).getByRole('button', { name: /^NOVA TECH/ }).click();
    await expect(page).toHaveURL(/#\/play\/stock\/NOVA/);
    await page.getByRole('button', { name: '▲ 매수' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel('수량', { exact: true }).fill('5');
    await page.screenshot({ path: `e2e/screenshots/mobile-${width}-order.png` });
    await sheet.getByRole('button', { name: /^NOVA 매수/ }).click();
    await expect(page.getByText('주문 체결', { exact: true })).toBeVisible();
    // Touch target size of trade buttons
    const box = await page.getByRole('button', { name: '▲ 매수' }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `e2e/screenshots/mobile-${width}-stock.png` });

    await nextDay(page, { shot: `e2e/screenshots/mobile-${width}-report.png` });
    expect(await currentDay(page)).toBe(2);
    await page.getByRole('link', { name: /포트폴리오/ }).click();
    expect(await readNumber(page, 'total-value')).toBeGreaterThan(0);
    await page.getByRole('link', { name: /거래내역/ }).click();
    await expect(page.getByText('NOVA').first()).toBeVisible();
    await page.getByRole('link', { name: /^◉?\s*뉴스$/ }).click();
    await expect(page.getByRole('tablist', { name: '뉴스 필터' })).toBeVisible();
    const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow2).toBeLessThanOrEqual(0);
  });
}
