import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import katex from 'katex';

const path = fileURLToPath(new URL('../../papers/source/questions.json', import.meta.url));
const questions = JSON.parse(fs.readFileSync(path, 'utf8'));
let count = 0;
const errors = [];
for (const question of questions) {
  const fields = {
    question: question.question, english: question.english,
    answer: question.answer, explanation: question.explanation,
    answer_en: question.answer_en, explanation_en: question.explanation_en,
    ...Object.fromEntries(question.options.flatMap(option => [
      [`option-${option.id}`, option.text], [`option-en-${option.id}`, option.text_en],
    ])),
  };
  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    for (const match of value.matchAll(/\$\$([\s\S]*?)\$\$|(?<!\$)\$(?!\$)([^$]*?)\$(?!\$)/g)) {
      count++;
      try {
        katex.renderToString(match[1] ?? match[2], { throwOnError: true, strict: 'ignore' });
      } catch (error) {
        errors.push({ id: question.id, field, formula: match[0], error: error.message });
      }
    }
  }
}
console.log(JSON.stringify({ questions: questions.length, formulasRendered: count, errors }, null, 2));
if (errors.length) process.exitCode = 1;
