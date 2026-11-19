import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const customLease = fileURLToPath(new URL('./fixtures/maple-terrace.txt', import.meta.url));

test.describe('Lease Lawyer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('fact-count')).toContainText('facts extracted');
  });

  test('picks a lease, asks a question, and shows a proof chain citing the right clause', async ({ page }) => {
    await page.getByTestId('lease-wychwood-arms').click();
    await expect(page.getByTestId('fact-count')).toHaveText('10 facts extracted');

    await page.getByTestId('question').fill("Can I break the lease early if I'm transferred?");
    await page.getByTestId('ask').click();

    const verdict = page.getByTestId('verdict');
    await expect(verdict).toHaveAttribute('data-verdict', 'yes');
    await expect(page.getByTestId('headline')).toContainText('job relocation clause');

    const steps = page.getByTestId('proof-step');
    await expect(steps.last()).toHaveAttribute('data-kind', 'verdict');
    const leaseStep = steps.filter({ hasText: 'job relocation' }).first();
    await expect(leaseStep).toContainText('Lease §12');
    await expect(leaseStep).toContainText('sixty (60) days’ written notice'.replace('’', "'"));
    await expect(steps.filter({ hasText: 'Your employer is transferring you' })).toHaveCount(1);

    // The cited clause lights up in the lease, and the link jumps to it.
    const cited = page.getByTestId('cited-span');
    await expect(cited).toHaveCount(1);
    await expect(cited).toContainText('Tenant may terminate this Lease early');
    await leaseStep.getByTestId('show-clause').click();
    await expect(cited).toBeFocused();
    await expect(page.locator('#clause-s12 mark.cited')).toBeVisible();
  });

  test('voids a wear-and-tear clause and cites both the clause and the rule', async ({ page }) => {
    await page.getByTestId('lease-gaslight-row').click();
    await expect(page.getByTestId('fact-count')).toHaveText('13 facts extracted');
    await page.getByTestId('question').fill('Can my landlord keep my deposit for normal wear and tear?');
    await page.getByTestId('question').press('Enter');

    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'no');
    const seam = page.getByTestId('seam');
    await expect(seam).toContainText('Rule-based reader (local)');
    await expect(seam).toContainText('13 kept word for word');
    await expect(seam).toContainText('0 struck from the record');
    await expect(seam).toContainText('Proved No');
    await expect(seam).toContainText('6 cited steps');
    const chain = page.getByTestId('proof-chain');
    await expect(chain).toContainText('including charges for normal wear and tear');
    await expect(chain).toContainText('MJ §1.6');
    await expect(chain).toContainText('No waiving tenant protections');
    await expect(page.locator('#clause-s6 mark.cited')).toHaveCount(2);
  });

  test('says what is missing when it cannot prove either way, then finishes the proof', async ({ page }) => {
    await page.getByTestId('lease-cobweb-court').click();
    await expect(page.getByTestId('fact-count')).toHaveText('5 facts extracted');
    await page.getByTestId('question').fill("Can I break the lease early if I'm transferred?");
    await page.getByTestId('ask').click();

    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'unknown');
    const followups = page.getByTestId('followups');
    await expect(followups).toContainText('active-duty military orders');
    await expect(page.getByTestId('proof-chain')).toHaveCount(0);

    await followups.getByRole('button', { name: 'No' }).click();
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'no');
    const chain = page.getByTestId('proof-chain');
    await expect(chain).toContainText('The lease says nothing about an early termination option');
    await expect(chain).toContainText('You are not on military orders');
    await expect(chain).toContainText('MJ §6.4');
  });

  test('refuses to guess on a question outside the rule base', async ({ page }) => {
    await page.getByTestId('question').fill('Who won the 1927 World Series?');
    await page.getByTestId('ask').click();
    await expect(page.getByTestId('out-of-scope')).toContainText('outside this rule base');
  });

  test('reads an uploaded lease and cites its clauses', async ({ page }) => {
    await page.getByTestId('upload').setInputFiles(customLease);
    await expect(page.getByTestId('lease')).toContainText('Maple Terrace');
    await expect(page.getByTestId('fact-count')).toContainText('facts extracted');
    await page.getByRole('button', { name: 'Late fees', exact: true }).click();
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'no');
    await expect(page.getByTestId('proof-chain')).toContainText('Late fee over the cap');
    await expect(page.getByTestId('cited-span').filter({ hasText: 'late fee of $95.00' })).toHaveCount(1);
  });

  test('shows the generated Prolog facts and the rule base', async ({ page }) => {
    await page.getByTestId('lease-wychwood-arms').click();
    await expect(page.getByTestId('prolog-facts')).toContainText('lease_fact(early_termination_option(job_relocation, 60, 1), f10).');
    await page.getByRole('tab', { name: 'Rule book' }).click();
    await expect(page.getByTestId('rulebase')).toContainText('rule(mj_3_4, wear_not_deductible, true).');
  });

  test('says "can\'t tell" when a pets clause cannot be read, instead of calling the lease silent', async ({ page }) => {
    await page.getByRole('button', { name: 'Paste text' }).click();
    await page.locator('#paste-text').fill(
      [
        'RESIDENTIAL LEASE',
        'Brackenridge Row',
        '',
        '1. PARTIES. This Lease is between Thistledown Rentals LLC, the Owner, and Alex Marlow, the Resident.',
        '',
        '2. RENT. Rent is $1,300.00 monthly.',
        '',
        '3. ANIMALS. Regarding animals, see Rider B attached to this Lease.',
      ].join('\n'),
    );
    await page.getByRole('button', { name: 'Read this lease' }).click();
    await expect(page.getByTestId('lease')).toContainText('Brackenridge Row');
    await expect(page.getByTestId('fact-count')).toHaveText('1 facts extracted');

    await page.getByTestId('question').fill('Can I keep a cat?');
    await page.getByTestId('ask').click();

    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'unknown');
    await expect(page.getByTestId('stamp')).toHaveText("?Can't tell");
    await expect(page.getByTestId('headline')).toContainText("Can't tell. Section 3 (ANIMALS) mentions pets");

    // The unreadable clause is outlined in the lease and says why.
    await expect(page.locator('#clause-s3')).toHaveClass(/clause-unread/);
    await expect(page.locator('#clause-s3')).toHaveClass(/is-blocking/);
    await expect(page.locator('#clause-s3').getByTestId('unread-tag')).toHaveText(
      'Unreadable: pets. The engine will not treat the lease as silent here.',
    );
    await expect(page.getByTestId('result')).not.toContainText('says nothing about pets');

    await expect(page.getByTestId('prolog-facts')).toContainText('unread(pet_policy, s3).');

    // The unread section is listed and the button moves focus to the clause.
    await page.getByTestId('show-unread').click();
    await expect(page.locator('#clause-s3')).toBeFocused();
  });

  test('shows an unlit proof chain before the first question, and "Unproven" when nothing was unreadable', async ({ page }) => {
    await expect(page.getByTestId('idle')).toContainText('Ask, and the circuit will charge.');
    await page.getByTestId('lease-cobweb-court').click();
    await page.getByRole('button', { name: 'Leaving early', exact: true }).click();
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'unknown');
    await expect(page.getByTestId('stamp')).toHaveText('Unproven');
    await expect(page.getByTestId('idle')).toHaveCount(0);
  });

  test('keeps the hidden file input out of the tab order and resets the lease scroll on a new lease', async ({ page }) => {
    await expect(page.getByTestId('upload')).toHaveAttribute('tabindex', '-1');
    const parchment = page.getByTestId('lease');
    await parchment.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect.poll(() => parchment.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await page.getByTestId('lease-gaslight-row').click();
    await expect(page.getByTestId('fact-count')).toHaveText('13 facts extracted');
    await expect.poll(() => parchment.evaluate((el) => el.scrollTop)).toBe(0);
  });

  test('keeps the "Your own" card readable once an uploaded lease is selected', async ({ page }) => {
    await page.getByTestId('upload').setInputFiles(customLease);
    await expect(page.getByTestId('lease')).toContainText('Maple Terrace');
    const card = page.locator('.case-own');
    await expect(card).toHaveClass(/is-on/);
    // The card stays dark with light text, as it is when not selected.
    const bg = await card.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain('repeating-linear-gradient');
    await expect(card.locator('.case-name')).toHaveCSS('color', 'rgb(241, 230, 207)');
  });

  test('will not be talked into a pets answer by the trick lease', async ({ page }) => {
    await page.getByTestId('lease-hollowmere-flats').click();
    await expect(page.getByTestId('fact-count')).toHaveText('6 facts extracted');
    await page.getByRole('button', { name: 'Pets and assistance animals', exact: true }).click();
    await expect(page.getByTestId('stamp')).toHaveText("?Can't tell");
    await expect(page.getByTestId('headline')).toContainText('Section 5 (ANIMALS) mentions pets');
    await expect(page.locator('#clause-s5')).toHaveClass(/is-blocking/);
    await expect(page.locator('#clause-s5')).toBeInViewport();
  });

  test('stamps each new answer afresh', async ({ page }) => {
    await page.getByTestId('lease-gaslight-row').click();
    await page.getByRole('button', { name: 'Deposit and wear and tear', exact: true }).click();
    await expect(page.getByTestId('stamp')).toHaveText('No');
    const first = await page.getByTestId('stamp').elementHandle();
    await page.getByRole('button', { name: 'Pets and assistance animals', exact: true }).click();
    await expect(page.getByTestId('stamp')).toHaveText('Yes');
    // A new element, so the stamp animation and the lightning play again.
    expect(await page.getByTestId('stamp').evaluate((el, old) => el !== old, first)).toBe(true);
  });
});
