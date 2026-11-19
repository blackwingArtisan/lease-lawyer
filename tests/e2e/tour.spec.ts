import { expect, test } from '@playwright/test';

test.describe('the 30-second tour', () => {
  test('runs once on a first visit: a proved No, then a Can\'t tell on the trick lease', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    const tour = page.getByTestId('tour');
    await expect(tour).toContainText('Tour 1 of 5', { timeout: 10_000 });
    await expect(page.getByTestId('lease-gaslight-row')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('stamp')).toHaveText('No', { timeout: 15_000 });
    await expect(tour).toContainText('Tour 3 of 5', { timeout: 15_000 });
    await expect(page.locator('#clause-s6 mark.cited').first()).toBeVisible();
    await expect(tour).toContainText('Tour 5 of 5', { timeout: 20_000 });
    await expect(page.getByTestId('lease-hollowmere-flats')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('stamp')).toHaveText("?Can't tell");
    await expect(tour).toHaveCount(0, { timeout: 15_000 });

    // A returning visitor is not toured again, but can replay it.
    await page.reload();
    await expect(page.getByTestId('fact-count')).toContainText('facts extracted');
    await page.waitForTimeout(1500);
    await expect(tour).toHaveCount(0);
    await expect(page.getByTestId('tour-start')).toHaveText(/Replay the 30-second tour/);
  });

  test('stops as soon as the visitor clicks elsewhere', async ({ page }) => {
    await page.goto('/');
    const tour = page.getByTestId('tour');
    await expect(tour).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('lease-cobweb-court').click();
    await expect(tour).toHaveCount(0);
    await page.waitForTimeout(2500);
    await expect(page.getByTestId('lease-cobweb-court')).toHaveAttribute('aria-pressed', 'true');
  });

  test('can be skipped from its caption', async ({ page }) => {
    await page.goto('/');
    const tour = page.getByTestId('tour');
    await expect(tour).toBeVisible({ timeout: 10_000 });
    await tour.getByRole('button', { name: 'Skip tour' }).click();
    await expect(tour).toHaveCount(0);
  });

  test.describe('under reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('does not start by itself, and starts from the button', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('fact-count')).toContainText('facts extracted');
      await page.waitForTimeout(1500);
      await expect(page.getByTestId('tour')).toHaveCount(0);
      await expect(page.getByTestId('tour-start')).toHaveText(/Take the 30-second tour/);
      await page.getByTestId('tour-start').click();
      await expect(page.getByTestId('tour')).toContainText('Tour 1 of 5');
    });
  });
});
