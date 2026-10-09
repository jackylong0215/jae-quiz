import { test, expect } from '@playwright/test';

const question = {
  question_number: '第 1 題', question_type: 'MCQ', main_category: 'Algebra', sub_topics: ['集合'],
  difficulty: 'Easy', raw_text_zh: '求 $1+1$ 的值。', raw_text_en: '',
  options_zh: { A: '$2$', B: '$3$' }, answer: 'A', solution: '相加得 $2$。',
};
const english = { '求 $1+1$ 的值。': 'Find the value of $1+1$.', '相加得 $2$。': 'Adding gives $2$.' };

async function fixture(page, { authenticated = false, failTranslation = false } = {}) {
  await page.addInitScript(({ authenticated }) => {
    if (!localStorage.getItem('jae_language')) localStorage.setItem('jae_language', 'en');
    if (authenticated) {
      localStorage.setItem('jae_token', 'test-token');
      localStorage.setItem('jae_user', JSON.stringify({ id: 1, username: 'student', full_name: 'Student', is_admin: true }));
    }
  }, { authenticated });
  await page.route('**:8000/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body = {};
    if (path === '/translate') {
      if (failTranslation) return route.fulfill({ status: 503, json: { detail: 'English translation requires JAE_API_KEY.' } });
      body = { translations: route.request().postDataJSON().texts.map(text => english[text] || 'English dynamic content') };
    } else if (path === '/prestored/papers') body = { papers: [{ id: 'p00', title: '數學正卷', year: '2026', questionCount: 1 }] };
    else if (path === '/prestored/questions') body = { total: 1, questions: [question] };
    else if (path === '/generate-quiz') body = { quiz_id: 'test-quiz', total: 1, questions: [{ ...question, answer: undefined, solution: undefined }] };
    else if (path === '/submit-quiz') body = { score_percent: 100, correct_count: 1, total_count: 1, category_breakdown: { Algebra: { correct: 1, total: 1, percent: 100 } }, results: [{ ...question, is_correct: true, user_answer: 'A', correct_answer: 'A' }] };
    else if (path === '/ai/pedagogical-feedback') body = { feedback: '## Your study plan\nPractice set operations.' };
    else if (path === '/user/favorites') body = { favorites: [{ id: 1, question, created_at: '2026-10-09' }] };
    else if (path.startsWith('/user/quiz-review/')) body = { questions: [{ ...question, user_answer: 'A', correct_answer: 'A', is_correct: true }], score_percent: 100, total_count: 1, correct_count: 1 };
    else if (path === '/user/wrong-questions') body = { grouped: { Algebra: [{ id: 1, question, user_answer: 'B', correct_answer: 'A', wrong_count: 1 }] } };
    else if (path === '/user/topic-mastery' || path === '/user/topic-diagnosis') body = { topics: [] };
    else if (path === '/user/mastery-trend') body = { trends: [] };
    else if (path === '/user/achievements') body = { achievements: [], unlocked_count: 0, total_count: 0 };
    else if (path === '/user/streak') body = { current_streak: 0 };
    else if (path === '/admin/stats') body = { '用戶總數': 1 };
    else if (path === '/admin/users') body = [{ id: 1, username: 'student', full_name: 'Student', email: 'student@example.test', is_admin: true }];
    await route.fulfill({ json: body });
  });
}

async function expectEnglish(page) {
  await expect(page.locator('body')).not.toContainText(/[\u3400-\u9fff]/u);
  const attributes = await page.locator('[title], [placeholder], [aria-label], img[alt]').evaluateAll(elements =>
    elements.flatMap(element => ['title', 'placeholder', 'aria-label', 'alt'].map(name => element.getAttribute(name) || '')).join('\n'));
  expect(attributes).not.toMatch(/[\u3400-\u9fff]/u);
}

test('switching, persistence and login dialog', async ({ page }) => {
  await fixture(page);
  await page.goto('/');
  await expect(page).toHaveTitle('JAE Exam Success');
  await expectEnglish(page);
  await page.getByRole('button', { name: /Guest mode Sign in \/ Register/ }).click();
  await expect(page.getByPlaceholder('Enter your username or email')).toBeVisible();
  await expectEnglish(page);
  await page.getByRole('button', { name: 'Chinese', exact: true }).click();
  await expect(page.getByPlaceholder('請輸入用戶名或郵箱')).toBeVisible();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expectEnglish(page);
});

test('all routes and expanded saved solutions display English', async ({ page }) => {
  await fixture(page, { authenticated: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const path of ['/browse', '/quiz', '/admin', '/favorites', '/review/test-quiz', '/wrong-book']) {
    await page.goto(path);
    await expect(page.locator('body')).not.toContainText('Loading...');
    if (path === '/browse') await page.getByRole('button', { name: '📚 Load past questions', exact: true }).click();
    await page.locator('details').evaluateAll(elements => elements.forEach(element => { element.open = true; }));
    await expectEnglish(page);
  }
  expect(errors).toEqual([]);
});

test('quiz answers survive switching and AI requests use English', async ({ page }) => {
  await fixture(page);
  await page.goto('/quiz');
  await expect(page.locator('body')).toContainText('past exam questions');
  await page.getByRole('button', { name: '🚀 Start quiz', exact: true }).click();
  await expect(page.locator('body')).toContainText('Find the value of');
  await page.locator('.option-btn').first().click();
  await page.getByRole('button', { name: 'Chinese', exact: true }).click();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('.option-btn.selected')).toHaveCount(1);
  const submission = page.waitForRequest(request => request.url().endsWith('/submit-quiz'));
  await page.getByRole('button', { name: '🎯 Submit and view results', exact: true }).click();
  expect((await submission).postDataJSON().answers).toEqual({ 0: 'A' });
  await expectEnglish(page);
  const feedback = page.waitForRequest(request => request.url().endsWith('/ai/pedagogical-feedback'));
  await page.getByRole('button', { name: 'Generate study recommendations', exact: true }).click();
  expect((await feedback).headers()['accept-language']).toBe('en');
  await expect(page.locator('body')).toContainText('Your study plan');
});

test('failed translation has English feedback and can be retried', async ({ page }) => {
  await fixture(page, { failTranslation: true });
  await page.goto('/browse');
  await page.getByRole('button', { name: '📚 Load past questions', exact: true }).click();
  await expect(page.locator('body')).toContainText('English translation unavailable.');
  await expectEnglish(page);
  await page.route('**/translate', route => route.fulfill({ json: { translations: route.request().postDataJSON().texts.map(text => english[text] || 'Translated content') } }));
  await page.getByRole('button', { name: 'Retry translation', exact: true }).click();
  await expect(page.locator('body')).toContainText('Find the value of');
});

test('malformed translations show a retry message instead of hiding content', async ({ page }) => {
  await fixture(page);
  await page.route('**/translate', route => route.fulfill({
    json: { translations: route.request().postDataJSON().texts.map(() => null) },
  }));
  await page.goto('/browse');
  await page.getByRole('button', { name: '📚 Load past questions', exact: true }).click();
  await expect(page.locator('body')).toContainText('English translation unavailable.');
  await expectEnglish(page);
});

test('a stalled provider request exits loading and can be retried', async ({ page }) => {
  await fixture(page);
  await page.addInitScript(() => {
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    AbortSignal.timeout = milliseconds => timeout(Math.min(milliseconds, 100));
  });
  await page.route('**/translate', () => {});
  await page.goto('/browse');
  await page.getByRole('button', { name: '📚 Load past questions', exact: true }).click();
  await expect(page.locator('body')).toContainText('English translation unavailable.');
  await expect(page.locator('.question-card')).not.toContainText('Translating into English');
  await page.route('**/translate', route => route.fulfill({ json: {
    translations: route.request().postDataJSON().texts.map(text => english[text] || 'Translated content'),
  } }));
  await page.getByRole('button', { name: 'Retry translation', exact: true }).click();
  await expect(page.locator('.question-card')).toContainText('Find the value of');
});
