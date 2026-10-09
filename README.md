# JAE Quiz

React/Vite mathematics practice app with a FastAPI/SQLite backend.

## Run locally

Use Python 3.12 and Node.js 24 (or versions supported by the pinned dependencies).

```sh
python -m venv /workspace/jae-quiz-env
/workspace/jae-quiz-env/bin/pip install -r backend/requirements.txt
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

In a separate terminal, from `backend`:

```sh
/workspace/jae-quiz-env/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

## Page language and AI translation

Choose **English** in the toolbar to switch the whole interface. The preference persists across reloads and routes. Switching language during a quiz preserves answers and progress. Chinese remains available.

Interface translations are bundled with the frontend and work without an AI key. Existing English question text and options are preferred. Chinese-only questions, worked solutions, historical notes and other dynamic display text are translated through the backend `/translate` endpoint. Original question IDs, filter values, submitted answers and stored source data are preserved. Markdown and LaTeX are retained. Text embedded in original diagram images is preserved as part of the source image.

Configure these backend variables using secure environment settings or an existing local `.env` file:

- `JAE_API_KEY`: required for AI translation, analysis and question generation. Never commit a key.
- `JAE_BASE_URL`: optional, defaults to `https://api.smai.ai/v1`.
- `JAE_MODEL`: optional, defaults to `gemini-3.1-pro-preview`.

Allow HTTPS access to the host in `JAE_BASE_URL`, and restart the backend after changing variables. The frontend can use `VITE_API_BASE_URL` to select a different backend.

Frontend API requests send `Accept-Language: en` or `zh`. PDF analysis, study feedback, revision notes and generated quizzes use that request language. English AI results are checked for Chinese text before being returned; content that still needs translation is translated. Translation requests are batched, deduplicated and cached in memory. Failed translation displays an English status; **Retry translation** retries without losing quiz progress. Missing credentials return an English configuration error instead of displaying Chinese content as an English translation.

## GitHub Pages deployment

Pushes to `main` run `.github/workflows/pages.yml`: backend tests, frontend lint,
browser language tests, a Vite production build, and GitHub Pages deployment.
In repository Settings → Pages, select **GitHub Actions** as the source.
The frontend is served at `https://jackylong0215.github.io/jae-quiz/`.
Pages builds use `/jae-quiz/` as the asset base and hash routing so direct links
and browser refreshes work on static hosting. Local development and Vercel keep
browser routing.

GitHub Pages hosts only the frontend. The configured API is
`https://jae-quiz-api.onrender.com`; override it with the repository Actions
variable `VITE_API_BASE_URL` if necessary. Deploy the backend from the same
`main` revision on Render, with `JAE_API_KEY` and `JAE_JWT_SECRET` configured
in Render's environment settings. API keys must never be put in frontend
variables or committed to GitHub.

The workflow now also deploys the backend and checks `/health` against the exact
Git commit and question-bank SHA-256 before running the live browser test.
Configure the existing Render service to deploy this repository's **main** branch
with no Root Directory (it must include both `backend/` and `papers/`). Use:

```text
Build: pip install -r backend/requirements.txt
Start: python -m uvicorn main:app --app-dir backend --host 0.0.0.0 --port $PORT
Health check: /health
```

In GitHub Settings → Secrets and variables → Actions, add the repository secret
`RENDER_DEPLOY_HOOK` from Render Settings → Deploy Hook. Do not paste its value into
source code or chat. Set the Actions variable `VITE_API_BASE_URL` to the real service
URL if it differs from the current default. The hook deploys the Render service's
configured branch; the workflow rejects any revision or bank mismatch.

For a new service, `render.yaml` supplies the same commands and secure initial
environment settings. Apply it within the user's Render account. `JAE_API_KEY`
must be entered in Render's environment settings; it is never a frontend variable.
The initial administrator is created only when `JAE_ADMIN_PASSWORD` is configured,
and its value is never logged. Existing accounts are not modified by startup.
Use `JAE_ADMIN_USERNAME`/`JAE_ADMIN_EMAIL` to customise that initial account.

If account and quiz history must survive restarts, configure a persistent disk
and set `JAE_DATABASE_PATH` to its SQLite path. The provided free-plan blueprint
has ephemeral storage; persistent disks require a supported Render plan.
Do not put the writable user database in the Git repository.

Missing deployment credentials fail the backend deployment step explicitly;
successful Pages publication alone does not mean the backend has been updated.

## Validation

```sh
# From the repository root:
/workspace/jae-quiz-env/bin/python -m unittest discover -s backend/tests -v

# From frontend:
npm run build
npm run lint
npm run test:e2e
```

Browser tests use system Chromium when available. Otherwise run `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to your Chromium executable. Tests mock AI responses and API data; a real provider check additionally requires the configured key and service access.

## Locally imported bilingual exam bank

The 18 supplied PDFs contain 225 distinct questions and 675 multiple-choice
options. Their Chinese stems and curated English stems/options are persisted
in `papers/source/questions.json`, with the same LaTeX expressions in both
languages. The existing 20 questions from the 2026 standard paper are retained,
giving 245 questions across 19 papers. The import performs no external AI calls.

`papers/source/pdf_import_manifest.json` records the original filenames, hashes
and Chinese/English page locations. The complete local PDF text is retained in
`papers/source/pdf_text`; font extraction can contain scrambled mathematical
glyphs and must not replace the curated display text. Original PDFs are served
at `/papers/<paper-id>.pdf`, and required source diagrams at `/diagrams`.

The 2017 and 2018 supplementary papers now have the correct questions; the 2019
supplementary paper is listed separately. Duplicate mock supplementary questions
are removed, with their old IDs retained in `question_id_aliases.json` and the
SQLite `question_aliases` table. Existing IDs and quiz sessions are preserved.

English **question stems and options** are complete for the uploaded corpus.
Existing detailed explanations are retained, with specific corrections recorded
in `papers/source/import_report.json`; they have not all been revalidated or
translated. The original PDFs include official English worked solutions.

To regenerate the local text audit, validate the bank, or synchronise SQLite:

```sh
python backend/import_exam_pdfs.py --extract
python backend/import_exam_pdfs.py --validate
python backend/import_exam_pdfs.py --sync-db
cd frontend
node scripts/validate-question-math.mjs
```

Synchronisation validates source hashes, bilingual formula/option parity,
all 135 official MCQ answers and all 90 written questions' subpart marks before
updating SQLite. It checks database integrity and preserves quiz session rows.
