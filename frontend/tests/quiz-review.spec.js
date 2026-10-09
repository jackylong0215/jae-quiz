import fs from 'node:fs';
import { test, expect } from '@playwright/test';

const bank = JSON.parse(fs.readFileSync(new URL('../../papers/source/questions.json', import.meta.url), 'utf8'));
const selected = bank.filter(q => q.paperId === 'p00');
const questions = selected.map(q => ({
  id: q.id, question_number: `Question ${q.number}`, question_type: q.questionType === 'written' ? 'Long' : 'MCQ',
  main_category: 'Geometry', raw_text_zh: q.question, raw_text_en: q.english,
  options_zh: Object.fromEntries(q.options.map(o => [o.id, o.text])),
  options_en: Object.fromEntries(q.options.map(o => [o.id, o.text_en])),
  answer: q.answer, answer_en: q.answer_en, solution: q.explanation,
  solution_zh: q.explanation, solution_en: q.explanation_en,
  diagram_image: q.diagram,
}));

test('a complete submitted paper shows English geometry, reference answers and all solutions without AI', async ({ page }) => {
  const sentForTranslation = [];
  await page.addInitScript(questions => {
    localStorage.setItem('jae_language', 'en');
    sessionStorage.setItem('jae_practice_quiz', JSON.stringify({ quiz_id: 'review-regression', questions }));
  }, questions.map(({ answer, answer_en, solution, solution_zh, solution_en, ...question }) => question));
  await page.route('**:8000/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/translate') {
      sentForTranslation.push(...route.request().postDataJSON().texts);
      return route.fulfill({ status: 503, json: { detail: 'Provider unavailable during review regression.' } });
    }
    if (url.pathname === '/prestored/questions') return route.fulfill({ json: { total: 20, questions } });
    if (url.pathname === '/submit-quiz') return route.fulfill({ json: {
      total_count: 20, correct_count: 0, score_percent: 0, category_breakdown: {},
      results: questions.map(q => ({ ...q, user_answer: '', correct_answer: q.answer, is_correct: q.question_type === 'Long' ? null : false })),
    } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/quiz?source=practice');
  await page.getByRole('button', { name: '20', exact: true }).click();
  await page.getByRole('button', { name: '🎯 Submit and view results', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm submission', exact: true }).click();
  await expect(page.locator('.review-card')).toHaveCount(20);
  await page.locator('.solution-details').evaluateAll(elements => elements.forEach(element => { element.open = true; }));
  const content = page.locator('.reviews-list');
  await expect(content).not.toContainText('Translating into English');
  await expect(content).not.toContainText('English translation unavailable');
  await expect(content).not.toContainText(/[\u3400-\u9fff]/u);
  await expect(page.locator('.solution-text')).toHaveCount(20);
  for (let index = 0; index < selected.length; index++) {
    expect(selected[index].explanation_en).toBeTruthy();
    const prefix = selected[index].explanation_en.split('$')[0].trim().slice(0, 35);
    if (prefix) await expect(page.locator('.solution-text').nth(index)).toContainText(prefix);
  }
  await expect(page.locator('.katex-error')).toHaveCount(0);
  await page.getByRole('button', { name: 'Chinese', exact: true }).click();
  await expect(page.locator('.review-card').first()).toContainText('設');
  await expect(page.locator('.solution-text').first()).toContainText('已知條件');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('.review-card').first()).toContainText('Let');
  await expect(content).not.toContainText('Translating into English');
  const sourceText = new Set(bank.flatMap(q => [q.question, q.answer, q.explanation, ...q.options.map(o => o.text)]));
  expect(sentForTranslation.filter(text => sourceText.has(text))).toEqual([]);
});
