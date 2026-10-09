import { test, expect } from '@playwright/test';

test('published site loads the updated bilingual bank from the real API', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('jae_language', 'en'));
  // Do not send exam text to an AI provider during deployment verification.
  await page.route('**/translate', route => route.fulfill({ status: 503, json: { detail: 'AI translation is disabled during deployment verification.' } }));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('./#/browse');
  expect(response.status()).toBe(200);
  await expect(page).toHaveTitle('JAE Exam Success');
  await expect(page.locator('.paper-select-dropdown option')).toHaveCount(20, { timeout: 60000 });
  await expect(page.locator('.prestored-tag')).toContainText('19 papers · 245 questions');
  const apiResponse = page.waitForResponse(response => response.url().includes('/prestored/questions?paper_id=p00'));
  await page.getByRole('button', { name: '📚 Load past questions', exact: true }).click();
  const loaded = await apiResponse;
  expect(loaded.status()).toBe(200);
  const bank = await loaded.json();
  expect(bank.total).toBe(20);
  expect(bank.questions.every(q => q.raw_text_en)).toBeTruthy();
  expect(bank.questions[0].options_en.E).toBe('None of the above');
  await expect(page.locator('.question-card')).toHaveCount(20);
  await expect(page.locator('.question-card').first()).toContainText('None of the above');
  await expect(page.locator('.katex-error')).toHaveCount(0);
  await page.getByRole('button', { name: 'Chinese', exact: true }).click();
  await expect(page.locator('.question-card').first()).toContainText('設');
  expect(errors).toEqual([]);
});
