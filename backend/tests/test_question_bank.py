from pathlib import Path
import shutil
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

import asyncio
import json
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main
from import_exam_pdfs import ROOT, read_json, sync_database, validate
from localization import CJK
from question_bank import bilingual_fields


class LocalClient:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def get(self, path, params=None, headers=None):
        return await self.request('GET', path, params=params, headers=headers)

    async def post(self, path, payload, headers=None):
        return await self.request('POST', path, payload=payload, headers=headers)

    async def request(self, method, path, payload=None, params=None, headers=None):
        from urllib.parse import urlencode
        sent = []
        supplied = False
        async def receive():
            nonlocal supplied
            if not supplied:
                supplied = True
                return {'type':'http.request','body':json.dumps(payload).encode() if payload is not None else b'','more_body':False}
            await asyncio.Event().wait()
        async def send(message):
            sent.append(message)
        request_headers = {'Content-Type':'application/json', **(headers or {})}
        await main.app({'type':'http','asgi':{'version':'3.0','spec_version':'2.4'},'http_version':'1.1','scheme':'http','method':method,'path':path,'raw_path':path.encode(),'query_string':urlencode(params or {}).encode(),'headers':[(key.lower().encode(),value.encode()) for key,value in request_headers.items()],'server':('test',80),'client':('test',1000)}, receive, send)
        start = next(item for item in sent if item['type']=='http.response.start')
        body = b''.join(item.get('body',b'') for item in sent if item['type']=='http.response.body')
        return SimpleNamespace(status_code=start['status'],headers={key.decode():value.decode() for key,value in start['headers']},json=lambda:json.loads(body))


class QuestionBankTests(unittest.IsolatedAsyncioTestCase):
    async def test_all_uploaded_papers_serve_persisted_english_without_ai(self):
        create = AsyncMock(side_effect=AssertionError('No external model calls allowed'))
        async with LocalClient() as client:
            with patch.object(main.async_client.chat.completions, 'create', create):
                seen = set()
                for paper in read_json('pdf_import_manifest.json'):
                    response = await client.get('/prestored/questions', params={'paper_id':paper['id']}, headers={'Accept-Language':'en'})
                    self.assertEqual(response.status_code, 200)
                    result = response.json()
                    self.assertEqual(result['total'], paper['questionCount'])
                    for q in result['questions']:
                        self.assertNotIn(q['id'], seen)
                        seen.add(q['id'])
                        self.assertTrue(q['raw_text_en'])
                        self.assertFalse(CJK.search(q['raw_text_en']))
                        self.assertEqual(set(q['options_en']), set(q['options_zh']))
                        self.assertFalse(CJK.search(' '.join(q['options_en'].values())))
                        self.assertEqual(q['source']['pdf'], paper['pdf'])
                self.assertEqual(len(seen), 225)
                create.assert_not_awaited()
                original = await client.get('/prestored/questions', params={'paper_id':'p17'})
                self.assertEqual(original.json()['total'], 20)

    async def test_restored_paper_geometry_and_source_files_are_available(self):
        async with LocalClient() as client:
            for path, content_type in [('/papers/p01.pdf','application/pdf'), ('/diagrams/p01-2017-w1.webp','image/webp'), ('/diagrams/p16s-w1.webp','image/webp')]:
                response = await client.get(path)
                self.assertEqual(response.status_code, 200, path)
                self.assertTrue(response.headers['content-type'].startswith(content_type))

    def test_complete_source_audit_and_official_answer_tables(self):
        report = validate()
        self.assertEqual((report['pdfs'], report['pages'], report['importedQuestions']), (18,268,225))
        self.assertEqual(report['officialMcqAnswersVerified'], 135)
        self.assertEqual(report['translatedOptions'], 675)

    def test_sync_preserves_sessions_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / 'bank.db'
            shutil.copyfile(ROOT / 'papers/db/prestored.db', destination)
            with sqlite3.connect(destination) as db:
                before = db.execute('SELECT * FROM quiz_sessions ORDER BY id').fetchall()
            for _ in range(2):
                sync_database(destination)
            with sqlite3.connect(destination) as db:
                self.assertEqual(before, db.execute('SELECT * FROM quiz_sessions ORDER BY id').fetchall())
                self.assertEqual(db.execute('SELECT COUNT(*) FROM questions').fetchone()[0],245)
                self.assertEqual(db.execute('SELECT COUNT(*) FROM questions WHERE english IS NOT NULL').fetchone()[0],225)
                self.assertEqual(db.execute('SELECT COUNT(*) FROM options WHERE text_en IS NOT NULL').fetchone()[0],675)
                self.assertEqual(db.execute('SELECT COUNT(*) FROM question_aliases').fetchone()[0],5)
                self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(),[])

    def test_bilingual_adapter_never_labels_chinese_options_as_english(self):
        partial = {'question':'題目','english':'Question','options':[{'id':'A','text':'甲','text_en':'First'},{'id':'B','text':'乙'}]}
        self.assertEqual(bilingual_fields(partial)['options_en'],{})
        self.assertEqual(bilingual_fields(partial)['options_zh'],{'A':'甲','B':'乙'})
        complete = {**partial,'options':[{'id':'A','text':'甲','text_en':'First'},{'id':'B','text':'乙','text_en':'Second'}]}
        self.assertEqual(bilingual_fields(complete)['options_en'],{'A':'First','B':'Second'})

    def test_missing_parameter_equations_are_restored_in_both_languages(self):
        questions = {q['id']:q for q in read_json('questions.json')}
        for field in ('question','english'):
            self.assertIn('kx+y-z=p', questions['p07-w10'][field])
            self.assertIn(r'(\sin2\theta)x', questions['p11-w10'][field])
            self.assertIn('3x+5y+z=3', questions['p13-w10'][field])
            self.assertIn('px-y-z=q', questions['p01-w5'][field])
        self.assertEqual(questions['p01-w1']['paperId'],'p02s')
        self.assertEqual(questions['p02-w6']['paperId'],'p03s')
        self.assertNotIn('p16-w6',questions)
        # The 2026 paper is outside the uploaded corpus and is preserved.
        current_2026 = [q for q in questions.values() if q['paperId']=='p17']
        self.assertEqual({q['id'] for q in current_2026},{f'p17-m{i}' for i in range(1,16)}|{f'p17-w{i}' for i in range(1,6)})


if __name__ == '__main__':
    unittest.main()
