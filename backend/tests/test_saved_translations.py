import json
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
import main
from import_exam_pdfs import read_json
from localize_bank_answers import validate_bank
from question_bank import bilingual_fields, translation_lookup, with_bank_translations
import test_user_flows
from test_question_bank import LocalClient
from models import QuizRecord


class BankTranslationTests(unittest.TestCase):
    def test_entire_bank_has_bilingual_solutions_answers_and_unchanged_mathematics(self):
        validate_bank(read_json('questions.json'))

    def test_ambiguous_stem_does_not_attach_another_question_answer(self):
        first={'id':'first','question':'Same stem','english':'First English stem'}
        second={'id':'second','question':'Same stem','english':'Second English stem'}
        saved={'raw_text_zh':'Same stem'}
        self.assertEqual(with_bank_translations(saved,translation_lookup([first,second])),saved)

    def test_custom_generated_question_is_not_replaced_by_bank_content(self):
        source=read_json('questions.json')[0]
        question={'raw_text_zh':source['question'],'ai_generated':True,'solution':'Custom solution'}
        self.assertEqual(with_bank_translations(question,translation_lookup([source])),question)


class SavedTranslationTests(test_user_flows.UserFlowFixture):
    async def test_practice_quiz_does_not_expose_stored_english_answers(self):
        create=AsyncMock(side_effect=AssertionError('Past-paper practice must not call AI'))
        with patch.object(main.async_client.chat.completions,'create',create):
            async with LocalClient() as client:
                headers=await self.login(client)
                response=await client.post('/user/practice-by-topic',{'topic':'集合與不等式','source':'past','count':2},headers=headers)
                self.assertEqual(response.status_code,200)
                for question in response.json()['questions']:
                    self.assertTrue(question['raw_text_en'])
                    for field in ['answer','answer_en','correct_answer','correct_answer_en','solution','solution_zh','solution_en','explanation','explanation_en']:
                        self.assertNotIn(field,question)
                main.question_bank.pop(response.json()['quiz_id'],None)
                create.assert_not_awaited()

    async def test_old_saved_quiz_receives_english_fields_without_regrading_or_ai(self):
        create=AsyncMock(side_effect=AssertionError('Saved review must not call AI'))
        with patch.object(main.async_client.chat.completions,'create',create):
            async with LocalClient() as client:
                headers=await self.login(client)
                source=read_json('questions.json')[0]
                old={**bilingual_fields(source),'id':source['id'],'answer':source['answer'],
                     'solution':source['explanation'],'question_type':'MCQ','main_category':'Algebra'}
                for field in ['raw_text_en','options_en','answer_en','solution_en']:
                    old.pop(field,None)
                user=self.db.query(main.User).one()
                self.db.add(QuizRecord(id='old-saved-review',user_id=user.id,score_percent=100,
                    correct_count=1,total_count=1,time_taken_seconds=0,category_breakdown_json='{}',
                    questions_json=json.dumps([old]),user_answers_json=json.dumps({'0':source['answer']})))
                self.db.commit()
                response=await client.get('/user/quiz-review/old-saved-review',headers=headers)
                self.assertEqual(response.status_code,200)
                question=response.json()['questions'][0]
                self.assertEqual(question['raw_text_en'],source['english'])
                self.assertEqual(question['solution_en'],source['explanation_en'])
                self.assertEqual(question['answer_en'],source['answer_en'])
                self.assertEqual(question['solution_zh'],source['explanation'])
                self.assertTrue(question['is_correct'])
                self.assertEqual(question['user_answer'],source['answer'])
                record=self.db.query(QuizRecord).filter(QuizRecord.id=='old-saved-review').one()
                self.assertEqual(json.loads(record.questions_json),[old])
                create.assert_not_awaited()
