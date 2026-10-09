import { test, expect } from '@playwright/test';

test('published site loads the updated bilingual bank from the real API', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('jae_language', 'en'));
  // Do not send exam text to an AI provider during deployment verification.
  await page.route('**/translate', route => route.fulfill({ status: 503, json: { detail: 'AI translation is disabled during deployment verification.' } }));
  const errors = [];
  const papersResponse = page.waitForResponse(response => response.url().includes('/prestored/papers'));
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('./#/browse');
  expect(response.status()).toBe(200);
  await expect(page).toHaveTitle('JAE Exam Success');
  const paperList = await papersResponse;
  expect(paperList.status()).toBe(200);
  if (process.env.LIVE_API_URL) expect(new URL(paperList.url()).origin).toBe(new URL(process.env.LIVE_API_URL).origin);
  const catalog = await paperList.json();
  expect(catalog.papers).toHaveLength(19);
  console.log(`Live bank verified: ${catalog.papers.length} papers from ${new URL(paperList.url()).origin}`);
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


// These inputs are authored solely for verification, not extracted from exams.
test('live translation returns English text and preserves mathematical notation', async ({ request }) => {
  test.setTimeout(240000);
  const response = await request.post(`${process.env.LIVE_API_URL}/translate`, {
    headers: { 'Accept-Language': 'en' },
    data: { texts: ['開始練習', '請稍後再試', '顯示公式 $x^2 + 1$。'] },
    timeout: 210000,
  });
  expect(response.status(), await response.text()).toBe(200);
  const { translations } = await response.json();
  expect(translations).toHaveLength(3);
  for (const value of translations) {
    expect(typeof value).toBe('string');
    expect(value.trim().length).toBeGreaterThan(0);
    expect(value).not.toMatch(/[\u3400-\u9fff]/u);
  }
  expect(translations[0]).toMatch(/practi[cs]/i);
  expect(translations[1]).toMatch(/retry|try.*again/i);
  expect(translations[2]).toContain('$x^2 + 1$');
  console.log('Live AI translation verified: English output and unchanged LaTeX.');
});

test('live AI feedback returns usable English content', async ({ request }) => {
  test.setTimeout(240000);
  const response = await request.post(`${process.env.LIVE_API_URL}/ai/pedagogical-feedback`, {
    headers: { 'Accept-Language': 'en' },
    data: { score_percent: 50, category_breakdown: { Algebra: { correct: 1, total: 2, percent: 50 } }, wrong_questions: [] },
    timeout: 210000,
  });
  expect(response.status(), await response.text()).toBe(200);
  const result = await response.json();
  expect(result.available).not.toBe(false);
  expect(typeof result.feedback).toBe('string');
  expect(result.feedback.length).toBeGreaterThan(40);
  expect(result.feedback).not.toMatch(/[\u3400-\u9fff]/u);
  expect(result.feedback).toMatch(/algebra|equation|solve|practice/i);
  console.log('Live AI generation verified: nonempty English study feedback.');
});

// Reproduce the reported post-submission screen with the actual stored bank.
test('live submitted quiz shows saved English geometry answers and worked solutions', async ({ page, request }) => {
  const translations = [];
  await page.route('**/translate', route => {
    translations.push(...route.request().postDataJSON().texts);
    return route.fulfill({ status: 503, json: { detail: 'Stored exam content must not need live translation.' } });
  });
  const standard = await request.get(`${process.env.LIVE_API_URL}/prestored/questions?paper_id=p17`, { headers: { 'Accept-Language': 'en' } });
  expect(standard.status()).toBe(200);
  const source = (await standard.json()).questions;
  expect(source).toHaveLength(20);
  const supplementary = await request.get(`${process.env.LIVE_API_URL}/prestored/questions?paper_id=p02s`, { headers: { 'Accept-Language': 'en' } });
  expect(supplementary.status()).toBe(200);
  const geometry = (await supplementary.json()).questions.find(q => q.question_type === 'Long' && q.diagram_image);
  expect(geometry).toBeTruthy();
  const selected = [...source, geometry];
  for (const question of selected) {
    expect(question.raw_text_en).toBeTruthy();
    expect(question.solution_en).toBeTruthy();
    expect(question.answer_en).toBeTruthy();
    expect([question.raw_text_en, question.solution_en, question.answer_en].join('\n')).not.toMatch(/[\u3400-\u9fff]/u);
  }
  const generated = await request.post(`${process.env.LIVE_API_URL}/generate-quiz`, {
    headers: { 'Accept-Language': 'en' }, data: { questions: selected, count: selected.length },
  });
  expect(generated.status()).toBe(200);
  const quiz = await generated.json();
  await page.addInitScript(quiz => {
    localStorage.setItem('jae_language', 'en');
    sessionStorage.setItem('jae_practice_quiz', JSON.stringify(quiz));
  }, quiz);
  await page.goto('./#/quiz?source=practice');
  await page.getByRole('button', { name: '21', exact: true }).click();
  await page.getByRole('button', { name: '🎯 Submit and view results', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm submission', exact: true }).click();
  await expect(page.locator('.review-card')).toHaveCount(21);
  await expect(page.locator('.review-card').last().locator('.diagram-img')).toBeVisible();
  await page.locator('.solution-details').evaluateAll(elements => elements.forEach(element => { element.open = true; }));
  await expect(page.locator('.solution-text')).toHaveCount(21);
  const review = page.locator('.reviews-list');
  await expect(review).not.toContainText('Translating into English');
  await expect(review).not.toContainText('English translation unavailable');
  await expect(review).not.toContainText(/[\u3400-\u9fff]/u);
  await expect(page.locator('.katex-error')).toHaveCount(0);
  await page.getByRole('button', { name: 'Chinese', exact: true }).click();
  await expect(review).toContainText(/[\u3400-\u9fff]/u);
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(review).not.toContainText(/[\u3400-\u9fff]/u);
  expect(translations).toEqual([]);
  console.log('Live post-submission review verified: 21 English stems, answers and solutions, including a geometry diagram, without provider translation.');
});
