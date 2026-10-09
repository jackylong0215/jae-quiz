import contextlib
from hashlib import sha256
from io import StringIO
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
import main
from admin_bootstrap import bootstrap_admin
from auth import hash_password, verify_password
from database import Base
import deploy_backend
from models import User
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from test_question_bank import LocalClient


class DeploymentHealthTests(unittest.IsolatedAsyncioTestCase):
    async def test_health_identifies_the_exact_revision_and_bilingual_bank(self):
        with patch.dict(os.environ,{'RENDER_GIT_COMMIT':'test-commit','JAE_API_KEY':'never-return-this-key'}):
            async with LocalClient() as client:
                response = await client.get('/health')
        self.assertEqual(response.status_code,200)
        health = response.json()
        self.assertEqual(health['commit'],'test-commit')
        self.assertEqual((health['papers'],health['questions'],health['english_questions']),(19,245,245))
        self.assertEqual((health['english_solutions'],health['english_answers']),(245,245))
        self.assertEqual(health['bank_sha256'],sha256((deploy_backend.ROOT/'papers/source/questions.json').read_bytes()).hexdigest())
        self.assertNotIn('never-return-this-key',json.dumps(health))
        self.assertEqual(response.headers['cache-control'],'no-store')
        self.assertTrue(deploy_backend.matches_health(health,deploy_backend.expected_bank(),'test-commit'))
        self.assertFalse(deploy_backend.matches_health(health,deploy_backend.expected_bank(),'older-commit'))
        self.assertFalse(deploy_backend.matches_health({**health,'bank_sha256':'old'},deploy_backend.expected_bank(),'test-commit'))

    async def test_missing_bank_is_not_reported_as_ready(self):
        with patch.object(main,'find_data_file',return_value='/no-such-bank-for-test'):
            async with LocalClient() as client:
                response=await client.get('/health')
        self.assertEqual(response.status_code,503)
        self.assertEqual(response.json(),{'status':'unavailable'})


class AdminProvisioningTests(unittest.TestCase):
    def setUp(self):
        self.engine=create_engine('sqlite://')
        Base.metadata.create_all(self.engine)
        self.db=Session(self.engine)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_no_shared_default_administrator_is_created(self):
        with patch.dict(os.environ,{'JAE_ADMIN_PASSWORD':''}):
            self.assertFalse(bootstrap_admin(self.db))
        self.assertEqual(self.db.query(User).count(),0)

    def test_configured_administrator_is_created_with_a_hashed_password(self):
        with patch.dict(os.environ,{'JAE_ADMIN_PASSWORD':'test-only-password','JAE_ADMIN_USERNAME':'operator'}):
            self.assertTrue(bootstrap_admin(self.db))
        user=self.db.query(User).one()
        self.assertTrue(user.is_admin)
        self.assertEqual(user.username,'operator')
        self.assertNotEqual(user.hashed_password,'test-only-password')
        self.assertTrue(verify_password('test-only-password',user.hashed_password))

    def test_existing_account_is_not_changed_or_promoted(self):
        user=User(username='admin',email='existing@example.test',hashed_password=hash_password('existing-test-password'),is_admin=False)
        self.db.add(user);self.db.commit()
        original=user.hashed_password
        with patch.dict(os.environ,{'JAE_ADMIN_PASSWORD':'new-configured-test-password','JAE_ADMIN_USERNAME':'admin'}):
            self.assertFalse(bootstrap_admin(self.db))
        self.assertFalse(user.is_admin)
        self.assertEqual(user.hashed_password,original)


class DeployScriptTests(unittest.TestCase):
    def test_missing_hook_fails_before_any_remote_request(self):
        stream=StringIO()
        with patch.dict(os.environ,{'RENDER_DEPLOY_HOOK':''}),patch.object(deploy_backend,'urlopen') as request,contextlib.redirect_stderr(stream):
            self.assertEqual(deploy_backend.main(),1)
        request.assert_not_called()
        self.assertIn('RENDER_DEPLOY_HOOK',stream.getvalue())

    def test_hook_failures_do_not_disclose_credentials(self):
        secret='test-hook-key-do-not-log'
        hook='https://api.render.com/deploy/srv-test?key='+secret
        error=HTTPError(hook,401,'Unauthorized',{},None)
        with patch.dict(os.environ,{'RENDER_DEPLOY_HOOK':hook,'BACKEND_URL':'https://backend.example.test','EXPECTED_COMMIT':'expected'}),patch.object(deploy_backend,'urlopen',side_effect=error),contextlib.redirect_stderr(StringIO()) as stderr:
            self.assertEqual(deploy_backend.main(),1)
        self.assertNotIn(secret,stderr.getvalue())
        self.assertIn('HTTP 401',stderr.getvalue())

    def test_wrong_service_hook_is_rejected_before_deployment(self):
        with patch.dict(os.environ,{'RENDER_DEPLOY_HOOK':'https://api.render.com/deploy/srv-other?key=test','BACKEND_URL':'https://backend.example.test','EXPECTED_COMMIT':'expected','EXPECTED_RENDER_SERVICE_ID':'srv-current'}),patch.object(deploy_backend,'urlopen') as request,contextlib.redirect_stderr(StringIO()):
            self.assertEqual(deploy_backend.main(),1)
            request.assert_not_called()

    def test_verified_deployment_requires_matching_revision_and_bank(self):
        health={'status':'ok','commit':'expected',**deploy_backend.expected_bank()}
        class Reply:
            status=200
            def __enter__(self):return self
            def __exit__(self,*args):return False
            def read(self,*args):return json.dumps(health).encode()
        with patch.dict(os.environ,{'RENDER_DEPLOY_HOOK':'https://api.render.com/deploy/srv-test?key=test','BACKEND_URL':'https://backend.example.test','EXPECTED_COMMIT':'expected'}),patch.object(deploy_backend,'urlopen',side_effect=[Reply(),Reply()]) as request,contextlib.redirect_stdout(StringIO()):
            self.assertEqual(deploy_backend.main(),0)
        self.assertEqual(request.call_args_list[0].args[0].data,b'')
        self.assertEqual(request.call_args_list[0].args[0].full_url,'https://api.render.com/deploy/srv-test?key=test&ref=expected')
        self.assertEqual(request.call_args_list[1].args[0].full_url,'https://backend.example.test/health')


if __name__=='__main__':unittest.main()
