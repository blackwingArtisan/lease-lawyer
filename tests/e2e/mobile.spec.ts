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

test('on a phone: swipe the case files, open the lease from a proof step, and come back to the answer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('fact-count')).toContainText('facts extracted');

  // The case files scroll sideways inside their own row, not the page.
  const row = page.locator('.case-grid');
  expect(await row.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await page.getByTestId('lease-gaslight-row').scrollIntoViewIfNeeded();
  await page.getByTestId('lease-gaslight-row').click();

  // The lease starts folded, with its fact count on the button.
  const toggle = page.getByTestId('lease-toggle');
  await expect(toggle).toHaveText('Read the lease (13 facts)');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('lease')).toHaveCount(0);

  await page.getByRole('button', { name: 'Deposit and wear and tear', exact: true }).click();
  await expect(page.getByTestId('stamp')).toHaveText('No');
  await expect(page.locator('.stamp')).toBeInViewport();

  // "Show" opens the lease at the cited clause.
  await page.getByTestId('show-clause').first().click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const cited = page.locator('mark.cited').first();
  await expect(cited).toBeFocused();
  await expect(cited).toBeInViewport();

  // A floating button leads back.
  await page.getByTestId('back-to-answer').click();
  await expect(page.getByTestId('result')).toBeFocused();
  await expect(page.locator('.stamp')).toBeInViewport();
  await expect(page.getByTestId('back-to-answer')).toHaveCount(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
