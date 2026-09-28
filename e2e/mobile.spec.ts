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
    await page.getByRole('list', { name: 'Watchlist' }).getByRole('button', { name: /^NOVA TECH/ }).click();
    await expect(page).toHaveURL(/#\/play\/stock\/NOVA/);
    await page.getByRole('button', { name: '▲ BUY' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel('QUANTITY').fill('5');
    await page.screenshot({ path: `e2e/screenshots/mobile-${width}-order.png` });
    await sheet.getByRole('button', { name: /^BUY NOVA/ }).click();
    await expect(page.getByText('ORDER EXECUTED')).toBeVisible();
    // Touch target size of trade buttons
    const box = await page.getByRole('button', { name: '▲ BUY' }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `e2e/screenshots/mobile-${width}-stock.png` });

    await nextDay(page, { shot: `e2e/screenshots/mobile-${width}-report.png` });
    expect(await currentDay(page)).toBe(2);
    await page.getByRole('link', { name: /PORTFOLIO/ }).click();
    expect(await readNumber(page, 'total-value')).toBeGreaterThan(0);
    await page.getByRole('link', { name: /HISTORY/ }).click();
    await expect(page.getByText('NOVA').first()).toBeVisible();
    await page.getByRole('link', { name: /NEWS/ }).click();
    await expect(page.getByRole('tablist', { name: '뉴스 필터' })).toBeVisible();
    const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow2).toBeLessThanOrEqual(0);
  });
}
