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
