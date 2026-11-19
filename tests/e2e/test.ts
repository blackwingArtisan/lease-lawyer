import { expect, test as base } from '@playwright/test';

/** Pages start as a returning visitor, so the first-visit tour does not run under the other tests. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('lease-lawyer.tour-seen', '1');
      } catch {
        // Storage blocked: the tour would run, and the tests would show it.
      }
    });
    await use(page);
  },
});

export { expect };
