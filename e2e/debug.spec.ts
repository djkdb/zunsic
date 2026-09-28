import { expect, test } from '@playwright/test';
import { currentDay, primeSettings, settle, startGame } from './helpers';

test('19: debug mode — inspect state and trigger events', async ({ page }) => {
  await primeSettings(page);
  await startGame(page, 12345, '/?debug=true');
  const panel = page.getByTestId('debug-panel');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: /DEBUG PANEL/ }).click();
  await expect(panel.getByText('EVENT QUEUE')).toBeVisible();

  // Trigger crash → next day in CRASH state with breaking overlay
  await panel.getByRole('button', { name: 'Trigger Crash' }).click();
  await expect(page.getByText('MARKET ALERT')).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'e2e/screenshots/debug-crash.png' });
  await expect(panel.getByTestId('debug-state')).toHaveText('CRASH');
  await settle(page);
  expect(await currentDay(page)).toBe(2);

  // Trigger bull
  await panel.getByRole('button', { name: 'Trigger Bull' }).click();
  await expect(page.getByText('MARKET SURGE')).toBeVisible({ timeout: 10_000 });
  await expect(panel.getByTestId('debug-state')).toHaveText('RALLY');
  await settle(page);

  // +₩1,000,000, set day, finish
  await panel.getByRole('button', { name: '+₩1,000,000' }).click();
  await panel.getByLabel('Set day').fill('25');
  await panel.getByRole('button', { name: 'Set Day' }).click();
  await expect(panel.getByTestId('debug-day')).toHaveText('25/30');
  await panel.getByRole('button', { name: 'Finish Game' }).click();
  await page.waitForURL(/#\/result/, { timeout: 15_000 });
  await expect(page.getByText('MARKET CLOSED').first()).toBeVisible();
});
