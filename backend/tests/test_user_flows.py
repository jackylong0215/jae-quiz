import json
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import main
from database import Base
from models import QuizRecord, User
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from test_question_bank import LocalClient


class UserFlowFixture(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db=Session(self.engine)
        self.original_overrides=dict(main.app.dependency_overrides)
        main.app.dependency_overrides[main.get_db]=lambda:self.db

    def tearDown(self):
        main.app.dependency_overrides.clear()
        main.app.dependency_overrides.update(self.original_overrides)
        self.db.close();self.engine.dispose()

    async def login(self,client):
        registration=await client.post('/auth/register',{'username':'test-student','email':'student@example.test','password':'test-only-password'})
        self.assertEqual(registration.status_code,200)
        self.assertFalse(registration.json()['user']['is_admin'])
        login=await client.post('/auth/login',{'username':'student@example.test','password':'test-only-password'})
        self.assertEqual(login.status_code,200)
        return {'Authorization':'Bearer '+login.json()['access_token']}


class UserFlowTests(UserFlowFixture):
    async def test_registration_login_and_protected_profile(self):
        async with LocalClient() as client:
            self.assertEqual((await client.get('/auth/me')).status_code,401)
            headers=await self.login(client)
            profile=await client.get('/auth/me',headers=headers)
            self.assertEqual(profile.status_code,200)
            self.assertEqual(profile.json()['username'],'test-student')
            self.assertNotIn('hashed_password',profile.json())
            denied=await client.post('/auth/login',{'username':'test-student','password':'wrong-password'})
            self.assertEqual(denied.status_code,400)
            self.assertEqual(self.db.query(User).count(),1)

    async def test_quiz_hides_bilingual_answers_grades_and_persists_across_restart(self):
        create=AsyncMock(side_effect=AssertionError('AI must not be called for a past-paper quiz'))
        with patch.object(main.async_client.chat.completions,'create',create):
            async with LocalClient() as client:
                headers=await self.login(client)
                bank=(await client.get('/prestored/questions',params={'paper_id':'p00'})).json()['questions']
                source=next(q for q in bank if q['question_type']=='MCQ')
                generated=await client.post('/generate-quiz',{'questions':[source],'count':1},headers=headers)
                self.assertEqual(generated.status_code,200)
                quiz=generated.json();quiz_id=quiz['quiz_id']
                presented=quiz['questions'][0]
                for key in ['answer','answer_en','solution','solution_zh','solution_en','explanation','explanation_en']:
                    self.assertNotIn(key,presented)
                self.assertTrue(presented['raw_text_en'])
                self.assertEqual(presented['options_en'],source['options_en'])
                # Exercise recovery from the database rather than the process cache.
                main.question_bank.pop(quiz_id)
                graded=await client.post('/submit-quiz',{'quiz_id':quiz_id,'answers':{'0':source['answer']}},headers=headers)
                self.assertEqual(graded.status_code,200)
                self.assertEqual(graded.json()['score_percent'],100)
                self.assertTrue(graded.json()['results'][0]['is_correct'])
                saved=self.db.query(QuizRecord).filter(QuizRecord.id==quiz_id).one()
                self.assertEqual(saved.score_percent,100)
                self.assertEqual(json.loads(saved.user_answers_json),{'0':source['answer']})
                history=await client.get('/user/quiz-history',headers=headers)
                self.assertEqual(history.status_code,200)
                self.assertIn(quiz_id,json.dumps(history.json()))
                main.question_bank.pop(quiz_id,None)
                create.assert_not_awaited()


if __name__=='__main__':unittest.main()
