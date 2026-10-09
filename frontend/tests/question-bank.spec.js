import fs from 'node:fs';
import { test, expect } from '@playwright/test';

const questions = JSON.parse(fs.readFileSync(new URL('../../papers/source/questions.json', import.meta.url), 'utf8'));
const papers = JSON.parse(fs.readFileSync(new URL('../../papers/source/papers.json', import.meta.url), 'utf8'));

test('persisted English stems/options and restored equation systems render locally', async ({ page }) => {
  const translatedTexts = [];
  await page.addInitScript(() => localStorage.setItem('jae_language', 'en'));
  await page.route('**:8000/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/translate') {
      const texts = route.request().postDataJSON().texts;
      translatedTexts.push(...texts);
      return route.fulfill({ json: { translations: texts.map(() => 'English dynamic content') } });
    }
    if (url.pathname === '/prestored/papers') return route.fulfill({ json: { papers } });
    if (url.pathname === '/prestored/questions') {
      const selected = questions.filter(q => q.paperId === url.searchParams.get('paper_id'));
      return route.fulfill({ json: { total: selected.length, questions: selected.map(q => ({
        id: q.id, question_number: `Question ${q.number}`, question_type: q.questionType === 'multiple_choice' ? 'MCQ' : 'Long',
        raw_text_zh: q.question, raw_text_en: q.english,
        options_zh: Object.fromEntries(q.options.map(o => [o.id,o.text])),
        options_en: Object.fromEntries(q.options.map(o => [o.id,o.text_en])),
        answer: q.answer, solution: q.explanation, main_category: 'Algebra', sub_topics: [], difficulty: 'Medium', score: q.points,
      })) } });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto('/browse');
  await expect(page.locator('.prestored-tag')).toContainText('19 papers · 245 questions');
  await page.getByRole('button', { name: '📚 Load past questions', exact: true }).click();
  await expect(page.locator('.question-card')).toHaveCount(20);
  await expect(page.locator('.question-card').first()).toContainText('Let');
  await expect(page.locator('.question-card').first()).toContainText('None of the above');
  await page.locator('.paper-select-dropdown').selectOption('p13s');
  await page.getByRole('button', { name: '📚 Load past questions', exact: true }).click();
  await expect(page.locator('.question-card')).toHaveCount(5);
  const matrixQuestion = page.locator('.question-card').last();
  await expect(matrixQuestion).toContainText('Find the maximum value');
  await expect(matrixQuestion.locator('.katex')).not.toHaveCount(0);
  await expect(matrixQuestion.locator('.katex-error')).toHaveCount(0);
  await page.getByRole('button', { name: 'Chinese', exact: true }).click();
  await expect(matrixQuestion).toContainText('求');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(matrixQuestion).toContainText('Find the maximum value');
  const sourceContent = new Set(questions.flatMap(q => [q.question,...q.options.map(o=>o.text)]));
  expect(translatedTexts.filter(text => sourceContent.has(text))).toEqual([]);
});
