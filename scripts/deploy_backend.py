"""Trigger the configured Render deploy hook and verify the exact bank/revision.

Run from the repository root. No exam contents or credentials are logged.
Requires RENDER_DEPLOY_HOOK, BACKEND_URL and EXPECTED_COMMIT environment settings.
"""
import hashlib
import json
import os
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]


def expected_bank():
    raw = (ROOT / 'papers/source/questions.json').read_bytes()
    questions = json.loads(raw)
    papers = json.loads((ROOT / 'papers/source/papers.json').read_text(encoding='utf-8'))
    return {'bank_sha256': hashlib.sha256(raw).hexdigest(), 'questions': len(questions),
            'papers': len(papers), 'english_questions': sum(bool(q.get('english')) for q in questions)}


def matches_health(payload, expected, commit):
    return (isinstance(payload, dict) and payload.get('status') == 'ok'
            and payload.get('commit') == commit
            and all(payload.get(key) == value for key, value in expected.items()))


def main():
    hook = os.getenv('RENDER_DEPLOY_HOOK', '')
    base_url = os.getenv('BACKEND_URL', '').rstrip('/')
    commit = os.getenv('EXPECTED_COMMIT', '')
    if not hook:
        print('Backend deployment blocked: set the RENDER_DEPLOY_HOOK Actions secret from your Render service Settings > Deploy Hook.', file=sys.stderr)
        return 1
    parsed = urlsplit(hook)
    if parsed.scheme != 'https' or parsed.hostname != 'api.render.com' or not parsed.path.startswith('/deploy/'):
        print('RENDER_DEPLOY_HOOK must be a Render HTTPS deploy hook.', file=sys.stderr)
        return 1
    if urlsplit(base_url).scheme != 'https' or not commit:
        print('BACKEND_URL (HTTPS) and EXPECTED_COMMIT are required.', file=sys.stderr)
        return 1
    expected_service = os.getenv('EXPECTED_RENDER_SERVICE_ID', '')
    if expected_service and parsed.path.rstrip('/').split('/')[-1] != expected_service:
        print('The configured Deploy Hook belongs to a different Render service. Replace RENDER_DEPLOY_HOOK with the hook for the current backend.', file=sys.stderr)
        return 1
    # Pin the tested revision instead of relying on the service branch or an old ref.
    query = [(key, value) for key, value in parse_qsl(parsed.query, keep_blank_values=True) if key != 'ref']
    query.append(('ref', commit))
    hook = urlunsplit(parsed._replace(query=urlencode(query)))
    expected = expected_bank()
    try:
        with urlopen(Request(hook, data=b'', method='POST'), timeout=30) as response:
            if not 200 <= response.status < 300:
                raise RuntimeError('deploy hook was rejected')
    except HTTPError as error:
        print(f'Render rejected the deploy request (HTTP {error.code}). Check the service repository, commit availability, and hook validity.', file=sys.stderr)
        return 1
    except (URLError, TimeoutError, OSError, RuntimeError):
        # urllib errors can embed URLs containing the hook credential.
        print('Render rejected the deploy request or could not be reached. Check the configured hook in Render.', file=sys.stderr)
        return 1
    print('Render deployment requested. Waiting for the expected backend revision.', flush=True)
    deadline = time.monotonic() + 600
    last_status = 'unreachable'
    while time.monotonic() < deadline:
        try:
            request = Request(base_url + '/health', headers={'Accept':'application/json','Cache-Control':'no-cache'})
            with urlopen(request, timeout=30) as response:
                payload = json.load(response)
            if matches_health(payload, expected, commit):
                print(json.dumps({'deployment':'verified','commit':commit,**expected}))
                return 0
            last_status = 'backend is reachable but still has an older revision or bank'
        except (HTTPError, URLError, TimeoutError, OSError, ValueError, TypeError):
            last_status = 'backend /health is not ready'
        time.sleep(10)
    print(f'Backend deployment did not become ready: {last_status}. Check Render build logs, branch main, and the repository-root start command.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
