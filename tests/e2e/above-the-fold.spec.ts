import { expect, test } from './test';

// The demo path: open the page, pick the greedy lease, tap one topic. The topic chips must be
// reachable without scrolling, and the verdict stamp must land in view without the visitor scrolling.
for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
]) {
  test(`brings the verdict into view at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByTestId('fact-count')).toContainText('facts extracted');

    const chip = page.getByRole('button', { name: 'Deposit and wear and tear', exact: true });
    await expect(chip).toBeInViewport();
    await expect(page.getByTestId('lease-gaslight-row')).toBeInViewport();

    await page.getByTestId('lease-gaslight-row').click();
    await expect(page.getByTestId('fact-count')).toHaveText('13 facts extracted');
    await chip.click();

    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'no');
    await expect(page.locator('.stamp')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('headline')).toBeInViewport();
    await expect(page.getByTestId('result')).toBeFocused();
  });
}
