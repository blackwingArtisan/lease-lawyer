import { expect, test } from '@playwright/test';

test('works at phone width without horizontal scrolling', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('fact-count')).toContainText('facts extracted');
  await page.getByRole('button', { name: 'Subletting', exact: true }).click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'yes');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
