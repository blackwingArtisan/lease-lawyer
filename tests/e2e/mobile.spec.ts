import { expect, test } from './test';

test('works at phone width without horizontal scrolling', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('fact-count')).toContainText('facts extracted');
  await page.getByRole('button', { name: 'Subletting', exact: true }).click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'yes');
  // The suture needs the two-column layout; on a phone the lease sits above the answer.
  await expect(page.getByTestId('suture')).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
