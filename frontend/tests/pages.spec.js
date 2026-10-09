import { test, expect } from '@playwright/test';

test('Pages production assets, navigation, refresh and language persistence', async ({ page }) => {
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/assets/') && response.status() >= 400) failures.push(response.url());
  });
  await page.route('https://jae-quiz-2-1.onrender.com/**', route => route.fulfill({ json: { papers: [], translations: [] } }));
  await page.goto('./');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page).toHaveTitle('JAE Exam Success');
  await expect(page.locator('body')).not.toContainText(/[\u3400-\u9fff]/u);
  await page.getByRole('button', { name: 'Start practicing', exact: true }).click();
  await expect(page).toHaveURL(/\/jae-quiz\/#\/browse$/);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: '📚 Load past questions', exact: true })).toBeVisible();
  expect(failures).toEqual([]);
});
