import asyncio
import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main
from localization import CJK, EnglishTranslator, LanguageMiddleware, get_language


def response(content):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


def client_with(create):
    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))


async def request(path, body, language='en'):
    sent = []
    encoded = json.dumps(body).encode()
    supplied = False

    async def receive():
        nonlocal supplied
        if not supplied:
            supplied = True
            return {'type': 'http.request', 'body': encoded, 'more_body': False}
        await asyncio.Event().wait()

    async def send(message):
        sent.append(message)

    await main.app({
        'type': 'http', 'asgi': {'version': '3.0', 'spec_version': '2.4'},
        'http_version': '1.1', 'scheme': 'http', 'method': 'POST', 'path': path,
        'raw_path': path.encode(), 'query_string': b'',
        'headers': [(b'content-type', b'application/json'), (b'accept-language', language.encode())],
        'server': ('test', 80), 'client': ('test', 1000),
    }, receive, send)
    status = next(message['status'] for message in sent if message['type'] == 'http.response.start')
    payload = b''.join(message.get('body', b'') for message in sent if message['type'] == 'http.response.body')
    return status, json.loads(payload)


class LocalizationTests(unittest.IsolatedAsyncioTestCase):
    async def test_translation_preserves_math_order_and_caches(self):
        create = AsyncMock(return_value=response(json.dumps({'translations': ['Find $x^2=4$.', 'The answer is $2$.']})))
        translator = EnglishTranslator(client_with(create), 'test-model', True)
        texts = ['求 $x^2=4$。', '答案是 $2$。', '$3$', '求 $x^2=4$。']
        expected = ['Find $x^2=4$.', 'The answer is $2$.', '$3$', 'Find $x^2=4$.']
        self.assertEqual(await translator.translate(texts), expected)
        self.assertEqual(await translator.translate(texts), expected)
        self.assertEqual(create.await_count, 1)

    async def test_bad_translation_is_rejected(self):
        create = AsyncMock(return_value=response(json.dumps({'translations': ['仍是中文']})))
        translator = EnglishTranslator(client_with(create), 'test-model', True)
        with self.assertRaises(main.HTTPException) as raised:
            await translator.translate(['題目'])
        self.assertEqual(raised.exception.status_code, 502)
        self.assertEqual(translator.cache, {})

    async def test_missing_credentials_and_size_validation(self):
        translator = EnglishTranslator(client_with(AsyncMock()), 'test-model', False)
        with patch.object(main, 'translator', translator):
            status, payload = await request('/translate', {'texts': ['中文題目']})
            self.assertEqual(status, 503)
            self.assertIn('JAE_API_KEY', payload['detail'])
            status, payload = await request('/translate', {'texts': ['$x+1$']})
            self.assertEqual((status, payload), (200, {'translations': ['$x+1$']}))
            self.assertEqual((await request('/translate', {'texts': ['x'] * 13}))[0], 422)
            self.assertEqual((await request('/translate', {'texts': ['x' * 12001]}))[0], 413)

    async def test_feedback_language_is_request_scoped(self):
        create = AsyncMock(return_value=response('## Study plan\nPractice sets and inequalities.'))
        with patch.object(main, 'API_KEY', 'test-only'), patch.object(main, 'async_client', client_with(create)):
            status, payload = await request('/ai/pedagogical-feedback', {'score_percent': 50, 'category_breakdown': {}}, 'en-GB')
            self.assertEqual(status, 200)
            self.assertFalse(CJK.search(payload['feedback']))
            self.assertEqual(create.call_args.kwargs['messages'][0]['role'], 'system')
            self.assertIn('exclusively in English', create.call_args.kwargs['messages'][0]['content'])
            create.return_value = response('請練習集合與不等式。')
            _, payload = await request('/ai/pedagogical-feedback', {'score_percent': 50, 'category_breakdown': {}}, 'zh-Hant')
            self.assertEqual(payload['feedback'], '請練習集合與不等式。')
            self.assertEqual(create.call_args.kwargs['messages'][0]['role'], 'user')

    async def test_feedback_failure_stays_english(self):
        with patch.object(main, 'API_KEY', 'test-only'), patch.object(main, 'async_client', client_with(AsyncMock(side_effect=RuntimeError('中文錯誤')))):
            _, payload = await request('/ai/pedagogical-feedback', {'score_percent': 50, 'category_breakdown': {}})
            self.assertFalse(payload['available'])
            self.assertFalse(CJK.search(payload['feedback']))

    async def test_revision_notes_language_and_failure(self):
        create = AsyncMock(return_value=response('## Core formulas\n$x^2$'))
        main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=1, is_admin=False)
        try:
            with patch.object(main, 'API_KEY', 'test-only'), patch.object(main, 'async_client', client_with(create)):
                status, payload = await request('/ai/generate-review-note', {'topic': '集合', 'diagnosis_type': 'concept_gap'})
                self.assertEqual(status, 200)
                self.assertEqual(payload['note'], '## Core formulas\n$x^2$')
                self.assertIn('exclusively in English', create.call_args.kwargs['messages'][0]['content'])
                create.side_effect = RuntimeError('中文錯誤')
                _, payload = await request('/ai/generate-review-note', {'topic': '集合', 'diagnosis_type': 'concept_gap'})
                self.assertFalse(CJK.search(payload['note']))
                self.assertFalse(payload['available'])
        finally:
            main.app.dependency_overrides.clear()

    async def test_pdf_extraction_and_question_generation_are_english(self):
        question = {'question_number': 'Question 1', 'question_type': 'MCQ', 'raw_text_en': 'Find $1+1$.', 'solution': 'Adding gives $2$.', 'answer': 'A', 'sub_topics': ['Sets']}
        create = AsyncMock(return_value=response(json.dumps({'questions': [question]})))

        async def endpoint(scope, receive, send):
            with patch.object(main, 'API_KEY', 'test-only'), patch.object(main, 'async_client', client_with(create)):
                qs = await main.call_model_async(['test-image'], 0, self_solve=True)
                self.assertEqual(qs, [question])
                self.assertIn('exclusively in English', create.call_args.kwargs['messages'][0]['content'])
                generated = await main.generate_similar_questions([], 1)
                self.assertEqual(generated, [question])
                self.assertIn('exclusively in English', create.call_args.kwargs['messages'][0]['content'])
                self.assertEqual(main.clean_and_align_question(dict(question))['sub_topics'], ['Sets'])

        await LanguageMiddleware(endpoint)({'type': 'http', 'headers': [(b'accept-language', b'en')]}, None, None)

    async def test_chinese_ai_reply_is_translated_before_return(self):
        create = AsyncMock(side_effect=[
            response('請練習 $x^2$。'),
            response(json.dumps({'translations': ['Practice $x^2$.']})),
        ])
        fake_client = client_with(create)
        translator = EnglishTranslator(fake_client, 'test-model', True)
        with patch.object(main, 'API_KEY', 'test-only'), patch.object(main, 'async_client', fake_client), patch.object(main, 'translator', translator):
            status, payload = await request('/ai/pedagogical-feedback', {'score_percent': 50, 'category_breakdown': {}})
            self.assertEqual(status, 200)
            self.assertEqual(payload['feedback'], 'Practice $x^2$.')
            self.assertEqual(create.await_count, 2)

    async def test_streamed_analysis_progress_and_results_are_english(self):
        from io import BytesIO
        from starlette.datastructures import UploadFile
        question = {'question_number': 'Question 1', 'question_type': 'MCQ', 'raw_text_en': 'Find $1+1$.', 'solution': 'Adding gives $2$.', 'answer': 'A', 'sub_topics': ['Sets']}
        create = AsyncMock(return_value=response(json.dumps({'questions': [question]})))
        document = main.fitz.open()
        document.new_page()
        pdf = document.tobytes()
        document.close()
        config = {'key_images': [], 'exam_batch': ['test-image'], 'slice_indices': [0]}

        async def endpoint(scope, receive, send):
            with patch.object(main, 'API_KEY', 'test-only'), patch.object(main, 'async_client', client_with(create)), patch.object(main, 'classify_pdf_pages', return_value=(['EXAM'], ['zh'])), patch.object(main, 'prepare_parallel_batches', return_value=([config], {})):
                streamed = await main.analyze_exam_stream(UploadFile(filename='中文試卷.pdf', file=BytesIO(pdf)), SimpleNamespace(is_admin=True))
                chunks = [json.loads(chunk) async for chunk in streamed.body_iterator]
                self.assertFalse(CJK.search(json.dumps(chunks, ensure_ascii=False)))
                self.assertEqual(chunks[-1]['type'], 'result')
                self.assertEqual(chunks[-1]['questions'][0]['raw_text_en'], 'Find $1+1$.')
                self.assertEqual(chunks[-1]['stats']['total_questions'], 1)

        await LanguageMiddleware(endpoint)({'type': 'http', 'headers': [(b'accept-language', b'en')]}, None, None)

    async def test_concurrent_locale_isolation(self):
        results = {}

        async def endpoint(scope, receive, send):
            await asyncio.sleep(0.01)
            results[scope['name']] = get_language()

        middleware = LanguageMiddleware(endpoint)
        await asyncio.gather(
            middleware({'type': 'http', 'name': 'english', 'headers': [(b'accept-language', b'en-US')]}, None, None),
            middleware({'type': 'http', 'name': 'chinese', 'headers': [(b'accept-language', b'zh-Hant')]}, None, None),
        )
        self.assertEqual(results, {'english': 'en', 'chinese': 'zh'})
        self.assertEqual(get_language(), 'zh')


if __name__ == '__main__':
    unittest.main()
