import os
import asyncio
import base64
import json
import re
import time
import uuid
import random
from typing import AsyncGenerator, Optional, List, Any, Dict
from fastapi import Depends
from sqlalchemy.orm import Session
from database import get_db, init_db
from models import User, QuizRecord
from auth import hash_password, get_current_user
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_optional_user,
)

from pydantic import BaseModel
from fastapi import FastAPI, File, HTTPException, UploadFile, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
import pymupdf as fitz
import json_repair


# === Auto-load .env ===
def _load_env() -> None:
    for env_path in [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"),
    ]:
        if os.path.isfile(env_path):
            with open(env_path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

_load_env()

# === Config & Tunables ===
API_KEY = os.getenv("JAE_API_KEY", "")
BASE_URL = os.getenv("JAE_BASE_URL", "https://api.smai.ai/v1")
MODEL = os.getenv("JAE_MODEL", "gemini-3.1-pro-preview")
DPI = 96
BATCH_SIZE = 6
MAX_RETRIES = 2
# =========================

async_client = AsyncOpenAI(api_key=API_KEY or "dummy_offline_key", base_url=BASE_URL, timeout=180.0)

app = FastAPI(title="Macau JAE Exam Analyzer API")

from auth import get_current_user

def require_admin(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理員權限")
    return current_user

@app.get("/admin/stats")
def admin_stats(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return {
        "用戶總數": db.query(User).count(),
        "管理員數": db.query(User).filter(User.is_admin == True).count(),
        "題庫總數": 175,
        "試卷總數": 11,
    }

@app.get("/admin/users")
def admin_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
            "is_admin": u.is_admin,
        }
        for u in users
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def find_data_file(subpath: str) -> str:
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "papers", subpath)),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "prestored-2.0", subpath)),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "papers", subpath)),
        os.path.abspath(os.path.join(os.path.dirname(__file__), subpath)),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return candidates[0]

def get_diagrams_dir() -> str:
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "papers", "diagrams")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "prestored-2.0", "diagrams")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "papers", "diagrams")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "diagrams")),
    ]
    for c in candidates:
        if os.path.isdir(c):
            return c
    return candidates[0]

DIAGRAMS_DIR = get_diagrams_dir()
if os.path.isdir(DIAGRAMS_DIR):
    app.mount("/diagrams", StaticFiles(directory=DIAGRAMS_DIR), name="diagrams")

@app.on_event("startup")
def on_startup():
    init_db()
    print("[OK] Database initialized (SQLite: jae_app.db)")


# =====================================================
# 中文科目 → 英文 main_category 對照表
# =====================================================
ZH_TO_EN_CATEGORY = {
    "三角學": "Trigonometry",
    "三角函數": "Trigonometry",
    "幾何": "Geometry",
    "平面幾何": "Geometry",
    "解析幾何": "Geometry",
    "立體幾何": "Geometry",
    "代數": "Algebra",
    "代數運算": "Algebra",
    "函數": "Functions",
    "函數與對數": "Functions",
    "概率": "Probability",
    "排列與概率": "Probability",
    "數列": "Sequences",
    "數列與級數": "Sequences",
    "統計": "Statistics",
    "微積分": "Calculus",
}

# 中文科目 → 題庫 topic 對照表（AI 模式使用）
CATEGORY_TOPIC_ALIASES = {
    "代數": ["代數運算", "集合與不等式", "二項式定理", "比例與應用"],
    "幾何": ["平面幾何", "解析幾何", "百分率與立體幾何"],
    "三角學": ["三角函數"],
    "三角函數": ["三角函數"],
    "函數": ["函數與對數"],
    "概率": ["排列與概率"],
    "數列": ["數列與級數"],
    "統計": ["統計"],
    "微積分": ["微積分"],
    "解析幾何": ["解析幾何"],
}


def safe_json_parse(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()

    text = re.sub(r'(?<!\\)\\(?=[ftbr][a-zA-Z])', r'\\\\', text)
    text = re.sub(r'(?<!\\)\\n(?=(?:eq|otin|abla|atural|earrow|warrow|subseteq|exists|ot)\b)', r'\\\\n', text)
    text = re.sub(r'(?<!\\)\\(?=[{}[\]])', r'\\\\', text)
    text = re.sub(r'(?<!\\)\\(?!(?:n|r|t|b|f|u[0-9a-fA-F]{4}|["\\/]))(?=[a-zA-Z]{2,})', r'\\\\', text)

    try:
        parsed = json_repair.loads(text)
        if isinstance(parsed, dict):
            return parsed
        if isinstance(parsed, list):
            return {"questions": parsed}
    except Exception:
        pass

    try:
        return json.loads(text)
    except Exception:
        pass

    depth, in_str, escaped, end = 0, False, False, None
    for i, ch in enumerate(text):
        if escaped:
            escaped = False
            continue
        if ch == '\\':
            escaped = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch in '{[':
            depth += 1
        elif ch in '}]':
            depth -= 1
            if depth == 0:
                end = i + 1
    if end is not None:
        try:
            return json_repair.loads(text[:end])
        except Exception:
            pass

    raise json.JSONDecodeError("Could not repair JSON", text, 0)


def classify_pdf_pages(doc: fitz.Document) -> tuple[list[str], list[str]]:
    page_types = []
    page_langs = []
    in_answer_section = False
    current_lang = 'zh'

    answer_start_patterns = [
        '暨參考答案', '參考答案', '参考答案', '建議答案', '評卷參考',
        '詳細解答', '解答及評分', '解答與評分',
        'suggested solutions', 'suggested solution',
        'suggested answers', 'marking scheme', 'answer key'
    ]

    for i, page in enumerate(doc):
        text = page.get_text()
        text_lower = text.lower()

        cjk_count = len(re.findall(r'[\u4e00-\u9fa5]', text))
        eng_words = len(re.findall(r'[a-zA-Z]{3,}', text))

        if cjk_count >= 15:
            current_lang = 'zh'
        elif cjk_count <= 5 and eng_words >= 15:
            current_lang = 'en'
        page_langs.append(current_lang)

        if i > 0 and any(k in text_lower for k in answer_start_patterns):
            in_answer_section = True
        elif in_answer_section:
            is_new_exam = (
                ('mock questions' in text_lower or '模擬試題' in text or 'joint admission' in text_lower)
                and not any(k in text_lower for k in answer_start_patterns)
            )
            if is_new_exam and i < len(doc) - 3:
                in_answer_section = False

        page_types.append('ANSWER' if in_answer_section else 'EXAM')

    return page_types, page_langs


def extract_page_diagrams(page: fitz.Page) -> list[dict]:
    page_h = page.rect.height
    page_w = page.rect.width
    header_margin = 135
    footer_margin = 50

    candidates = []
    for d in page.get_drawings():
        r = fitz.Rect(d['rect'])
        if r.y0 < header_margin or r.y1 > page_h - footer_margin:
            continue
        if r.width >= page_w - 20:
            continue
        if max(r.width, r.height) > 4:
            candidates.append(r)

    for img_info in page.get_images():
        for r in page.get_image_rects(img_info[0]):
            if r.y0 >= header_margin and r.y1 <= page_h - footer_margin and r.width > 20 and r.height > 20:
                candidates.append(fitz.Rect(r))

    if not candidates:
        return []

    clusters = list(candidates)
    changed = True
    while changed:
        changed = False
        new_c = []
        while clusters:
            cur = clusters.pop(0)
            merged = False
            for i, other in enumerate(clusters):
                exp = fitz.Rect(cur.x0 - 35, cur.y0 - 35, cur.x1 + 35, cur.y1 + 35)
                if exp.intersects(other):
                    clusters[i] = other | cur
                    merged = True
                    changed = True
                    break
            if not merged:
                new_c.append(cur)
        clusters = new_c

    valid_clusters = [c for c in clusters if c.width >= 30 and c.height >= 30]
    if not valid_clusters:
        return []

    changed = True
    while changed:
        changed = False
        for i in range(len(valid_clusters)):
            for j in range(i + 1, len(valid_clusters)):
                c1, c2 = valid_clusters[i], valid_clusters[j]
                exp = fitz.Rect(c1.x0 - 25, c1.y0 - 25, c1.x1 + 25, c1.y1 + 25)
                if exp.intersects(c2):
                    valid_clusters[i] = c1 | c2
                    valid_clusters.pop(j)
                    changed = True
                    break
            if changed:
                break

    blocks = page.get_text('blocks')
    paragraphs = [b for b in blocks if len(b[4].strip()) > 8 or (b[2] - b[0] > 120)]
    words = page.get_text('words')

    diagrams = []
    for r0 in valid_clusters:
        upper_paras = [b for b in paragraphs if b[3] <= r0.y0 + 8]
        y_min_bound = max([b[3] for b in upper_paras]) if upper_paras else header_margin

        lower_paras = [b for b in paragraphs if b[1] >= r0.y1 - 8]
        y_max_bound = min([b[1] for b in lower_paras]) if lower_paras else (page_h - footer_margin)

        box_with_labels = fitz.Rect(r0)
        for w in words:
            w_rect = fitz.Rect(w[0], w[1], w[2], w[3])
            if (w_rect.y0 >= y_min_bound - 2 and w_rect.y1 <= y_max_bound + 2 and len(w[4].strip()) <= 4):
                if (r0.x0 - 20 <= w_rect.x0 and w_rect.x1 <= r0.x1 + 20 and
                    r0.y0 - 20 <= w_rect.y0 and w_rect.y1 <= r0.y1 + 20):
                    box_with_labels = box_with_labels | w_rect

        clip_rect = fitz.Rect(
            max(0, box_with_labels.x0 - 8),
            max(y_min_bound + 1.0, box_with_labels.y0 - 4),
            min(page_w, box_with_labels.x1 + 8),
            min(y_max_bound - 1.0, box_with_labels.y1 + 4)
        )

        if clip_rect.width > 20 and clip_rect.height > 20:
            pix = page.get_pixmap(clip=clip_rect, dpi=200)
            img_bytes = pix.tobytes("png")
            diagrams.append({
                'rect': clip_rect,
                'center_y': (clip_rect.y0 + clip_rect.y1) / 2.0,
                'image_base64': f"data:image/png;base64,{base64.b64encode(img_bytes).decode('utf-8')}"
            })

    diagrams.sort(key=lambda x: x['center_y'])
    return diagrams


PROMPT = (
    "You are analyzing a Macau JAE exam paper. You will receive a set of images.\n"
    "LAYOUT: The FIRST N images are ANSWER KEY / SOLUTION pages. "
    "The REMAINING images are EXAM pages containing questions.\n"
    "IMPORTANT CONTEXT: The paper may appear in Chinese or English. "
    "If a question has both versions in the images, merge them into the same question entry.\n\n"
    "Your job:\n"
    "1. From the ANSWER KEY pages, learn the correct answer and worked solution for each question. "
    "Do NOT extract questions from the answer-key pages themselves.\n"
    "2. From the EXAM pages, extract EVERY unique exam question. Skip cover pages, instructions, "
    "formula sheets, and blank pages.\n"
    "3. For each question, extract:\n"
    "   - 'raw_text_zh': ONLY the question stem in Chinese (without options)\n"
    "   - 'raw_text_en': ONLY the question stem in English (without options)\n"
    "   - 'options_zh': object with keys A, B, C, D, E containing Chinese option text\n"
    "   - 'options_en': object with keys A, B, C, D, E containing English option text\n"
    "4. CRITICAL MATH RULE: Every math expression MUST be wrapped in single dollar signs for inline "
    "($...$) or double dollar signs for block ($$...$$). Write $A \\\\cap B$ not A \\\\cap B, "
    "and $\\\\frac{3}{4}$ not 3/4.\n"
    "5. CRITICAL MCQ OPTIONS RULE: For multiple-choice questions, you MUST extract ALL options (A, B, C, D, E) "
    "separately. Put them in the 'options_zh' or 'options_en' object, NOT in raw_text. "
    "NEVER skip options! NEVER write 'cannot see clearly'! If you cannot read an option clearly, "
    "write what you CAN see and mark it with [unclear]. Extract EVERY visible letter and number.\n"
    "6. 'question_type': 'MCQ' or 'Long'.\n"
    "7. 'main_category': Algebra, Calculus, Geometry, Trigonometry, "
    "Probability, Statistics, Sequences, Functions, Number Theory, Other.\n"
    "8. 'sub_topics': 1-4 specific topics.\n"
    "9. 'difficulty': MUST be strictly evaluated into one of three buckets:\n"
    "   - 'Easy': Direct single-formula application, basic arithmetic/algebraic simplification, or standard set operations.\n"
    "   - 'Medium': Requires 2-3 algebraic steps or combining two concepts.\n"
    "   - 'Hard': Multi-step proofs, long calculus derivations, or complex geometric constructions.\n"
    "10. 'page': the 1-based page number within the EXAM pages (do not count the answer-key pages).\n"
    "11. 'answer': the correct option letter or final value from the answer key. "
    "LANGUAGE CONSISTENCY: If the question has Chinese, write the answer in Traditional Chinese (繁體中文). Do NOT write English words like 'For', 'general solution', 'or' for Chinese questions.\n"
    "12. 'solution': step-by-step worked solution from the answer key. "
    "CRITICAL LANGUAGE RULE: For Chinese questions, the solution MUST be in Traditional Chinese (繁體中文). "
    "Do NOT translate into English or insert English transition phrases (such as 'Therefore', 'When', 'For unique solution', 'Determinant of coefficient matrix is'). "
    "Preserve the Chinese wording from the Chinese answer key (e.g. '由題可知...', '方程有唯一解當且僅當...', '此時通解為...').\n"
    "Do NOT include your thinking process, confusion, or guesses (like '等待...', '抱歉...', '圖實在太糊...', '假設題目是...'). "
    "Write ONLY the final clean solution.\n"
    "13. 'has_diagram': set to true ONLY IF this specific question contains a geometry diagram, "
    "figure, graph, or plot. Set to false if it is a pure text/equation question.\n\n"
    "CRITICAL JSON RULE: Inside JSON strings, every LaTeX backslash must be a DOUBLE backslash. "
    "Use \\\\n for line breaks.\n\n"
    "Respond ONLY with raw JSON:\n"
    "{\n"
    '  "questions": [\n'
    "    {\n"
    '      "question_number": "Part I Q1",\n'
    '      "question_type": "MCQ",\n'
    '      "raw_text_zh": "設集合 $A=\\\\{x: x^2-x-2 \\\\le 0\\\\}$， $B=\\\\{x: |x-1| \\\\ge 1\\\\}$。求 $A \\\\cap B=$ ()",\n'
    '      "raw_text_en": "",\n'
    '      "options_zh": {\n'
    '        "A": "$[-1, 0]$",\n'
    '        "B": "$\\\\{2\\\\}$",\n'
    '        "C": "$[-1, 0) \\\\cup \\\\{2\\\\}$",\n'
    '        "D": "$[-1, 0] \\\\cup \\\\{2\\\\}$",\n'
    '        "E": "$[0, 2]$"\n'
    '      },\n'
    '      "options_en": {},\n'
    '      "main_category": "Algebra",\n'
    '      "sub_topics": ["集合", "不等式"],\n'
    '      "difficulty": "Easy",\n'
    '      "page": 1,\n'
    '      "answer": "D",\n'
    '      "solution": "由 $A$ 集合的不等式 $x^2-x-2 \\\\le 0$，因式分解得 $(x-2)(x+1) \\\\le 0$，解得 $-1 \\\\le x \\\\le 2$。\\n由 $B$ 集合的不等式 $|x-1| \\\\ge 1$，解得 $x-1 \\\\ge 1$ 或 $x-1 \\\\le -1$，即 $x \\\\ge 2$ 或 $x \\\\le 0$。\\n求 $A \\\\cap B$，即取兩集合的交集：$[-1,2] \\\\cap ((-\\\\infty,0] \\\\cup [2,\\\\infty)) = [-1,0] \\\\cup \\\\{2\\\\}$。\\n故選 D。",\n'
    '      "has_diagram": false\n'
    "    }\n"
    "  ]\n"
    "}"
)


PROMPT_NO_ANSWER = (
    "You are an expert Macau JAE mathematics exam analyzer AND solver.\n"
    "You will receive images of exam pages ONLY — there is NO answer key provided.\n"
    "IMPORTANT CONTEXT: The paper may appear in Chinese (Traditional) or English.\n\n"
    "Your job:\n"
    "1. Extract EVERY unique exam question from the images. Do not stop after 1 question; extract all questions (e.g. Q1 to Q8).\n"
    "2. 'question_number': REQUIRED. E.g. '第 1 題', '第 2 題', ..., '第 8 題' or 'Part I Q1'. Extract the exact question number printed on the exam. DO NOT OMIT THIS FIELD.\n"
    "3. For each question, extract:\n"
    "   - 'raw_text_zh': ONLY the question stem in Chinese (without options)\n"
    "   - 'raw_text_en': ONLY the question stem in English (without options)\n"
    "   - 'options_zh': object with keys A, B, C, D, E containing Chinese option text\n"
    "   - 'options_en': object with keys A, B, C, D, E containing English option text\n"
    "4. CRITICAL MATH RULE: Every math expression MUST be wrapped in dollar signs. "
    "Use $...$ for inline and $$...$$ for block math. "
    "Write $\\\\frac{3}{4}$ not 3/4, $\\\\sqrt{x}$ not sqrt(x).\n"
    "5. CRITICAL MCQ OPTIONS RULE: For multiple-choice questions, you MUST extract ALL options (A, B, C, D, E) "
    "separately into options_zh or options_en object. NEVER put options in raw_text. "
    "NEVER skip options! Extract EVERY visible option.\n"
    "6. 'question_type': 'MCQ' or 'Long'.\n"
    "7. 'main_category': Algebra, Calculus, Geometry, Trigonometry, "
    "Probability, Statistics, Sequences, Functions, Number Theory, Other.\n"
    "8. 'sub_topics': 1-4 specific mathematical topics. CRITICAL: If the question is in Chinese, write sub_topics in Traditional Chinese (繁體中文), e.g. ['三角恆等式'] NOT ['Trigonometric Identities'], ['集合與不等式'] NOT ['Sets'].\n"
    "9. 'difficulty': Easy, Medium, or Hard.\n"
    "10. 'page': 1-based page number within the exam images.\n"
    "11. SELF-SOLVE 'solution' (COMPUTE FIRST): Work through the complete mathematical solution step-by-step. "
    "LANGUAGE: If the question is in Chinese, the entire solution MUST be in Traditional Chinese (繁體中文). "
    "Use proper LaTeX notation. Example style: '由題意... 計算得... 故選 A。'.\n"
    "   NEGATIVE CONSTRAINT: Absolutely NEVER include self-talk, apologies, or scratchpad hesitations (NEVER write '等待', '抱歉', '重看', 'sorry'). Write ONLY formal textbook-grade solutions.\n"
    "12. SELF-SOLVE 'answer' (MATCH SOLUTION): The final result. For MCQ, write ONLY the option letter (A/B/C/D/E) that matches the conclusion of your solution. CRITICAL: The 'answer' MUST 100% strictly match the final derived choice in 'solution'.\n"
    "13. 'has_diagram': true ONLY if the question contains a geometry figure, graph, or plot.\n\n"
    "CRITICAL JSON RULE: Every LaTeX backslash inside a JSON string must be DOUBLE backslash (\\\\). "
    "Use \\\\n for line breaks within solution text.\n\n"
    "Respond ONLY with raw JSON:\n"
    "{\n"
    '  "questions": [\n'
    "    {\n"
    '      "question_number": "第 1 題",\n'
    '      "question_type": "MCQ",\n'
    '      "raw_text_zh": "設集合 $A=\\\\{x: x^2-x-2 \\\\le 0\\\\}$， $B=\\\\{x: |x-1| \\\\ge 1\\\\}$。求 $A \\\\cap B=$ ()",\n'
    '      "raw_text_en": "",\n'
    '      "options_zh": {\n'
    '        "A": "$[-1, 0]$",\n'
    '        "B": "$\\\\{2\\\\}$",\n'
    '        "C": "$[-1, 0) \\\\cup \\\\{2\\\\}$",\n'
    '        "D": "$[-1, 0] \\\\cup \\\\{2\\\\}$",\n'
    '        "E": "$[0, 2]$"\n'
    '      },\n'
    '      "options_en": {},\n'
    '      "main_category": "Algebra",\n'
    '      "sub_topics": ["集合", "不等式"],\n'
    '      "difficulty": "Medium",\n'
    '      "page": 1,\n'
    '      "solution": "集合 $A$ 中：$x^2-x-2 \\\\le 0 \\\\implies -1 \\\\le x \\\\le 2$... 計算得出最終結果為 $[-1, 0] \\\\cup \\\\{2\\\\}$，對照各選項，故選 D。",\n'
    '      "answer": "D",\n'
    '      "has_diagram": false\n'
    "    }\n"
    "  ]\n"
    "}"
)

async def call_model_async(images: list[str], n_key_pages: int, self_solve: bool = False) -> list[dict]:
    active_prompt = PROMPT_NO_ANSWER if self_solve else PROMPT
    if self_solve:
        user_text = (
            f"There are {len(images)} exam page image(s). No answer key is included. "
            "Extract every question and SOLVE each one — provide complete worked solutions "
            "and correct answers using your own mathematical knowledge."
        )
    else:
        user_text = (
            f"The first {n_key_pages} images are answer-key pages. "
            f"The remaining {len(images) - n_key_pages} images are exam pages. "
            "Extract all exam questions and attach their answers from the key."
        )
    user_content = [{"type": "text", "text": user_text}]
    for img in images:
        user_content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{img}"},
        })

    last_err = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            req_params = {
                "model": MODEL,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": active_prompt},
                    {"role": "user", "content": user_content},
                ],
                "reasoning_effort": "low",
            }
            try:
                response = await async_client.chat.completions.create(**req_params)
            except Exception as re_err:
                if "reasoning_effort" in str(re_err).lower():
                    req_params.pop("reasoning_effort", None)
                    response = await async_client.chat.completions.create(**req_params)
                else:
                    raise re_err

            raw = response.choices[0].message.content
            if raw.lstrip().lower().startswith("<html") or "<title>" in raw[:200].lower():
                raise RuntimeError("Proxy returned HTML (likely 504 Gateway Timeout).")

            parsed = safe_json_parse(raw)
            return parsed.get("questions", []) if isinstance(parsed, dict) else []

        except Exception as e:
            last_err = e
            if attempt < MAX_RETRIES:
                await asyncio.sleep(2 * (attempt + 1))
                continue
            raise

    raise last_err


SUB_TOPIC_TRANSLATIONS = {
    'Trigonometric Identities': '三角恆等式',
    'Trigonometric Functions': '三角函數',
    'Trigonometric Equations': '三角方程',
    'Trigonometry': '三角學',
    'Solid Geometry': '立體幾何',
    'Pyramid': '棱錐',
    'Dihedral Angle': '二面角',
    'Coordinate Geometry': '解析幾何',
    'Analytical Geometry': '解析幾何',
    'Conic Sections': '圓錐曲線',
    'Ellipse': '橢圓',
    'Hyperbola': '雙曲線',
    'Parabola': '拋物線',
    'Differentiation': '微分導數',
    'Integration': '積分面積',
    'Curve Sketching': '曲線作圖',
    'Complex Numbers': '複數',
    'Geometric Progression': '等比數列',
    'Arithmetic Progression': '等差數列',
    'Matrices': '矩陣',
    'System of Linear Equations': '線性方程組',
    'Determinants': '行列式',
    'Vectors': '向量',
    'Polynomials': '多項式',
    'Inequalities': '不等式',
    'Permutations': '排列組合',
    'Combinations': '組合',
    'Binomial Theorem': '二項式定理',
    'Triangles': '三角形',
    'Logarithms': '對數',
    'Exponentials': '指數',
    'Sets': '集合',
    'Set Theory': '集合論',
    'Quadratic Equations': '一元二次方程',
    'Circle': '圓',
    'Circles': '圓的方程',
    'Tangent': '切線方程',
    'Remainder Theorem': '餘數定理',
    'Factor Theorem': '因式定理',
    'Probability': '概率',
    'Statistics': '統計',
    'Functions': '函數',
    'Sequences': '數列',
    'Series': '級數',
}

def clean_and_align_question(q: dict) -> dict:
    if q.get('sub_topics'):
        q['sub_topics'] = [SUB_TOPIC_TRANSLATIONS.get(t, t) for t in q['sub_topics']]

    sol = q.get('solution', '') or ''
    ans = str(q.get('answer', '')).strip().upper()
    q_type = q.get('question_type', 'Long')

    if q_type == 'MCQ' or '選擇' in str(q.get('question_number', '')):
        conclusions = re.findall(r'(?:故選|因此選|答案為|答案是|應選|選|故答案為)\s*[:：]?\s*([A-E])\b', sol)
        if conclusions:
            final_opt = conclusions[-1].upper()
            if ans != final_opt and ans in ['A', 'B', 'C', 'D', 'E']:
                print(f"Alignment: question {q.get('question_number')} answer corrected from {ans} -> {final_opt} to match solution conclusion.")
                q['answer'] = final_opt

    sol = re.sub(r'(?:等待|等等|抱歉|對不起|不好意思)[，,、\s][\s\S]*?(?:故選|因此選|答案是|答案為|選)\s*([A-E])', r'故選 \1', sol)
    sol = re.sub(r'(?:等待|等等|抱歉|對不起|看錯了|重算|重新看)[，,、\s][^。！？\n]*[。！？\n]?', '', sol)

    q['solution'] = sol.strip()
    return q


def get_canonical_key(q: dict, fallback_idx: int = 0) -> str:
    raw_num = str(q.get("question_number") or "").strip()
    q_type = q.get("question_type", "Long")

    if not raw_num or raw_num.lower() == "none":
        text = str(q.get("raw_text_zh") or q.get("raw_text_en") or "").strip()
        m = re.match(r'^\s*(?:第\s*)?(\d+)\s*(?:題|[\.\、\s]|\))', text)
        if m:
            raw_num = m.group(1)
        else:
            raw_num = str(fallback_idx + 1)
        q["question_number"] = f"第 {raw_num} 題"

    is_mcq = (q_type == "MCQ") or any(k in raw_num.lower() for k in ["mcq", "part i", "part 1", "第一", "選擇"])
    if any(k in raw_num.lower() for k in ["part ii", "part 2", "第二", "解答", "大題"]):
        is_mcq = False

    clean_num = re.sub(r'(?:part|第)\s*(?:i{1,3}|1|2)\s*(?:部分|組)?', '', raw_num, flags=re.I)

    m = re.search(r'(?:第\s*(\d+)\s*題|[Qq](?:uestion)?\s*(\d+))', raw_num)
    if m:
        n = m.group(1) or m.group(2)
    else:
        nums = re.findall(r'\d+', clean_num)
        if nums:
            n = nums[0]
        else:
            all_nums = re.findall(r'\d+', raw_num)
            n = all_nums[-1] if all_nums else str(fallback_idx + 1)

    prefix = "mcq" if is_mcq else "long"
    return f"{prefix}_{n}"


def merge_questions(all_qs: list[dict]) -> list[dict]:
    all_qs = [clean_and_align_question(q) for q in all_qs]
    q_map = {}
    for i, q in enumerate(all_qs):
        key = get_canonical_key(q, i)
        if key not in q_map:
            q_map[key] = q
        else:
            cur = q_map[key]
            if not cur.get("raw_text_en") and q.get("raw_text_en"):
                cur["raw_text_en"] = q["raw_text_en"]
            if not cur.get("raw_text_zh") and q.get("raw_text_zh"):
                cur["raw_text_zh"] = q["raw_text_zh"]
            if q.get("answer"):
                if not cur.get("answer") or (re.search(r'[\u4e00-\u9fa5]', str(q["answer"])) and not re.search(r'[\u4e00-\u9fa5]', str(cur.get("answer", "")))):
                    cur["answer"] = q["answer"]
            if q.get("solution"):
                if not cur.get("solution") or (re.search(r'[\u4e00-\u9fa5]', str(q["solution"])) and not re.search(r'[\u4e00-\u9fa5]', str(cur.get("solution", "")))):
                    cur["solution"] = q["solution"]
            if not cur.get("diagram_image") and q.get("diagram_image"):
                cur["diagram_image"] = q["diagram_image"]

    return list(q_map.values())


def parse_page_num(p_val) -> int | None:
    if isinstance(p_val, int):
        return p_val
    if isinstance(p_val, str):
        nums = re.findall(r'\d+', p_val)
        if nums:
            return int(nums[0])
    return None


def find_matching_diagram(target_exam_idx: int, exam_page_diagrams: dict, used_diag_keys: set) -> tuple[str | None, int | None]:
    candidate_indices = [target_exam_idx, target_exam_idx - 1, target_exam_idx + 1, target_exam_idx - 2, target_exam_idx + 2]
    for p_idx in exam_page_diagrams.keys():
        if p_idx not in candidate_indices:
            candidate_indices.append(p_idx)

    for p_idx in candidate_indices:
        if p_idx in exam_page_diagrams:
            for d_idx, diag in enumerate(exam_page_diagrams[p_idx]):
                key = (p_idx, d_idx)
                if key not in used_diag_keys:
                    used_diag_keys.add(key)
                    return diag['image_base64'], p_idx

    return None, None


def prepare_parallel_batches(pdf_doc, exam_page_indices, answer_page_indices, page_langs, dpi=DPI, batch_size=BATCH_SIZE):
    exam_images_map = {}
    exam_page_diagrams = {}
    for idx in exam_page_indices:
        p = pdf_doc[idx]
        actual_dpi = dpi
        if p.rect.width < 500 or p.rect.height < 500:
            actual_dpi = max(150, min(250, int(72 * 1200 / max(p.rect.width, 1))))
        pix = p.get_pixmap(dpi=actual_dpi)
        exam_images_map[idx] = base64.b64encode(pix.tobytes("jpeg")).decode("utf-8")
        diags = extract_page_diagrams(p)
        if diags:
            exam_page_diagrams[idx] = diags

    zh_exam_indices = [idx for idx in exam_page_indices if page_langs[idx] != 'en']
    en_exam_indices = [idx for idx in exam_page_indices if page_langs[idx] == 'en']

    zh_ans_images = []
    en_ans_images = []
    all_ans_images = []
    for idx in answer_page_indices:
        p = pdf_doc[idx]
        pix = p.get_pixmap(dpi=dpi)
        b64 = base64.b64encode(pix.tobytes("jpeg")).decode("utf-8")
        all_ans_images.append(b64)
        if page_langs[idx] == 'en':
            en_ans_images.append(b64)
        else:
            zh_ans_images.append(b64)

    batch_configs = []
    def add_language_batches(page_indices, ans_images, lang_name):
        if not page_indices:
            return
        keys = ans_images if ans_images else all_ans_images
        n_b = max(1, (len(page_indices) + batch_size - 1) // batch_size)
        for b_idx in range(n_b):
            s = b_idx * batch_size
            e = min(len(page_indices), (b_idx + 1) * batch_size)
            slice_indices = page_indices[s:e]
            exam_b = [exam_images_map[idx] for idx in slice_indices]
            batch_configs.append({
                "lang": lang_name,
                "b_idx": b_idx,
                "total_b": n_b,
                "slice_indices": slice_indices,
                "key_images": keys,
                "exam_batch": exam_b,
                "self_solve": len(keys) == 0,
            })

    add_language_batches(zh_exam_indices, zh_ans_images, "中文")
    add_language_batches(en_exam_indices, en_ans_images, "英文")

    if not batch_configs and exam_page_indices:
        n_b = max(1, (len(exam_page_indices) + batch_size - 1) // batch_size)
        for b_idx in range(n_b):
            s = b_idx * batch_size
            e = min(len(exam_page_indices), (b_idx + 1) * batch_size)
            slice_indices = exam_page_indices[s:e]
            exam_b = [exam_images_map[idx] for idx in slice_indices]
            no_ans = len(all_ans_images) == 0
            batch_configs.append({
                "lang": "通用",
                "b_idx": b_idx,
                "total_b": n_b,
                "slice_indices": slice_indices,
                "key_images": [] if no_ans else all_ans_images,
                "exam_batch": exam_b,
                "self_solve": no_ans,
            })

    return batch_configs, exam_page_diagrams


@app.post("/analyze-exam-stream")
async def analyze_exam_stream(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="只有管理員可以上傳試卷")
    contents = await file.read()

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            yield json.dumps({
                "type": "progress", "percent": 5,
                "message": f"正在讀取文件 {file.filename}..."
            }) + "\n"

            pdf_doc = fitz.open(stream=contents, filetype="pdf")
            total_doc_pages = len(pdf_doc)

            yield json.dumps({
                "type": "progress", "percent": 15,
                "message": f"正在識別試題與解答頁面 (共 {total_doc_pages} 頁)..."
            }) + "\n"

            page_types, page_langs = classify_pdf_pages(pdf_doc)
            exam_page_indices = [i for i, t in enumerate(page_types) if t == 'EXAM']
            answer_page_indices = [i for i, t in enumerate(page_types) if t == 'ANSWER']

            yield json.dumps({
                "type": "progress", "percent": 25,
                "message": f"頁面識別完成：試題 {len(exam_page_indices)} 頁，解答 {len(answer_page_indices)} 頁"
            }) + "\n"

            batch_configs, exam_page_diagrams = prepare_parallel_batches(
                pdf_doc, exam_page_indices, answer_page_indices, page_langs, dpi=DPI, batch_size=BATCH_SIZE
            )

            yield json.dumps({
                "type": "progress", "percent": 30,
                "message": "正在提取題目與解答內容..."
            }) + "\n"

            async def process_batch(cfg):
                combined = cfg["key_images"] + cfg["exam_batch"]
                qs = await call_model_async(combined, n_key_pages=len(cfg["key_images"]), self_solve=cfg.get("self_solve", False))
                return cfg, qs

            results = await asyncio.gather(*[process_batch(cfg) for cfg in batch_configs])

            all_questions = []
            used_diag_keys = set()
            for cfg, qs in results:
                slice_indices = cfg["slice_indices"]
                for q in qs:
                    raw_p = parse_page_num(q.get("page"))
                    if raw_p is not None and 1 <= raw_p <= len(slice_indices):
                        abs_exam_idx = slice_indices[raw_p - 1]
                    else:
                        abs_exam_idx = slice_indices[0] if slice_indices else 0

                    q["page"] = abs_exam_idx + 1

                    has_diag = q.get("has_diagram") is True or any(
                        k in (str(q.get("raw_text_zh", "")) + " " + str(q.get("raw_text_en", "")))
                        for k in ["下圖", "圖中", "如圖", "見圖", "figure", "Figure", "diagram", "Diagram"]
                    )
                    if has_diag:
                        matched_img, matched_pidx = find_matching_diagram(abs_exam_idx, exam_page_diagrams, used_diag_keys)
                        if matched_img:
                            q["diagram_image"] = matched_img
                            if matched_pidx is not None:
                                q["page"] = matched_pidx + 1

                    all_questions.append(q)

            yield json.dumps({
                "type": "progress", "percent": 90,
                "message": "正在整理試題數據與排版格式..."
            }) + "\n"

            unique_questions = merge_questions(all_questions)

            yield json.dumps({
                "type": "progress", "percent": 100,
                "message": f"完成，共提取 {len(unique_questions)} 道題目"
            }) + "\n"

            yield json.dumps({
                "type": "result",
                "questions": unique_questions,
                "stats": {
                    "total_pages": total_doc_pages,
                    "exam_pages": len(exam_page_indices),
                    "answer_pages": len(answer_page_indices),
                    "total_questions": len(unique_questions)
                }
            }) + "\n"

        except Exception as e:
            yield json.dumps({
                "type": "error",
                "message": f"分析過程出錯: {str(e)}"
            }) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")


@app.post("/analyze-exam")
async def analyze_exam(file: UploadFile = File(...)):
    contents = await file.read()
    pdf_doc = fitz.open(stream=contents, filetype="pdf")

    page_types, page_langs = classify_pdf_pages(pdf_doc)
    exam_page_indices = [i for i, t in enumerate(page_types) if t == 'EXAM']
    answer_page_indices = [i for i, t in enumerate(page_types) if t == 'ANSWER']

    batch_configs, exam_page_diagrams = prepare_parallel_batches(
        pdf_doc, exam_page_indices, answer_page_indices, page_langs, dpi=DPI, batch_size=BATCH_SIZE
    )

    async def process_batch(cfg):
        combined = cfg["key_images"] + cfg["exam_batch"]
        qs = await call_model_async(combined, n_key_pages=len(cfg["key_images"]), self_solve=cfg.get("self_solve", False))
        return cfg, qs

    results = await asyncio.gather(*[process_batch(cfg) for cfg in batch_configs])

    all_questions = []
    used_diag_keys = set()
    for cfg, qs in results:
        slice_indices = cfg["slice_indices"]
        for q in qs:
            raw_p = parse_page_num(q.get("page"))
            if raw_p is not None and 1 <= raw_p <= len(slice_indices):
                abs_exam_idx = slice_indices[raw_p - 1]
            else:
                abs_exam_idx = slice_indices[0] if slice_indices else 0

            q["page"] = abs_exam_idx + 1

            has_diag = q.get("has_diagram") is True or any(
                k in (str(q.get("raw_text_zh", "")) + " " + str(q.get("raw_text_en", "")))
                for k in ["下圖", "圖中", "如圖", "見圖", "figure", "Figure", "diagram", "Diagram"]
            )
            if has_diag:
                matched_img, matched_pidx = find_matching_diagram(abs_exam_idx, exam_page_diagrams, used_diag_keys)
                if matched_img:
                    q["diagram_image"] = matched_img
                    if matched_pidx is not None:
                        q["page"] = matched_pidx + 1

            all_questions.append(q)

    unique_questions = merge_questions(all_questions)
    return {"questions": unique_questions}


# ==========================================
# Quiz API Endpoints
# ==========================================

question_bank: dict[str, list[dict]] = {}

class QuizRequest(BaseModel):
    questions: Optional[List[Any]] = None
    count: Optional[int] = 10
    categories: Optional[List[str]] = None
    difficulties: Optional[List[str]] = None
    types: Optional[List[str]] = None

class QuizSubmission(BaseModel):
    quiz_id: str
    answers: Optional[Dict[str, Any]] = None


@app.post("/generate-quiz")
async def generate_quiz(
    req: QuizRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    raw_qs = req.questions if req.questions is not None else []
    if not raw_qs:
        try:
            prestored = get_prestored_questions()
            raw_qs = prestored.get("questions", [])
        except Exception:
            raw_qs = []

    filtered = [q for q in raw_qs if isinstance(q, dict)]
    print(f"[DEBUG] /generate-quiz received {len(filtered)} questions from client")

    cats = req.categories or []
    diffs = req.difficulties or []
    types_list = req.types or []
    count = req.count if (req.count and req.count > 0) else 10

    # 把中文科目轉成英文 main_category
    if cats:
        expanded_cats = set()
        for cat in cats:
            expanded_cats.add(cat)
            if cat in ZH_TO_EN_CATEGORY:
                expanded_cats.add(ZH_TO_EN_CATEGORY[cat])
        print(f"[DEBUG] Filtering by categories: {cats} → expanded: {expanded_cats}")
        filtered = [q for q in filtered if q.get("main_category") in expanded_cats]
        print(f"[DEBUG] After category filter: {len(filtered)} remaining")

    if diffs:
        filtered = [q for q in filtered if q.get("difficulty") in diffs]
    if types_list:
        filtered = [q for q in filtered if q.get("question_type") in types_list]

    print(f"[DEBUG] Final filtered: {len(filtered)} questions")

    if len(filtered) > count:
        sampled = random.sample(filtered, count)
    else:
        sampled = filtered

    quiz_id = str(uuid.uuid4())
    question_bank[quiz_id] = sampled

    # 若有登入，提前存一份到 DB
    if current_user:
        try:
            early_record = QuizRecord(
                id=quiz_id,
                user_id=current_user.id,
                score_percent=0,
                correct_count=0,
                total_count=len(sampled),
                time_taken_seconds=0,
                category_breakdown_json="{}",
                questions_json=json.dumps(sampled, ensure_ascii=False),
                user_answers_json="{}",
            )
            db.add(early_record)
            db.commit()
            print(f"[OK] Quiz {quiz_id} pre-saved for user {current_user.username}")
        except Exception as e:
            print(f"[WARN] Early save failed: {e}")
            db.rollback()

    stripped_questions = []
    for i, q in enumerate(sampled):
        stripped = q.copy()
        stripped["index"] = i
        stripped["id"] = f"{quiz_id}-{i}"
        stripped.pop("answer", None)
        stripped.pop("solution", None)
        stripped_questions.append(stripped)

    print(f"[DEBUG] Returning {len(stripped_questions)} questions to client")

    return {
        "quiz_id": quiz_id,
        "total": len(stripped_questions),
        "questions": stripped_questions
    }


@app.post("/submit-quiz")
async def submit_quiz(sub: QuizSubmission, current_user: Optional[User] = Depends(get_optional_user), db: Session = Depends(get_db)):
    print(f"========== SUBMIT QUIZ ==========")
    print(f"[DEBUG] quiz_id received: {sub.quiz_id}")
    print(f"[DEBUG] in memory: {sub.quiz_id in question_bank}")

    # 1) 從記憶體找題目
    original_questions = question_bank.get(sub.quiz_id)

    # 2) 記憶體沒有 → 從資料庫找
    if not original_questions:
        record = db.query(QuizRecord).filter(QuizRecord.id == sub.quiz_id).first()
        print(f"[DEBUG] DB record found: {record is not None}")
        if record and record.questions_json:
            try:
                original_questions = json.loads(record.questions_json)
                question_bank[sub.quiz_id] = original_questions
                print(f"[DEBUG] Loaded from DB: {len(original_questions)} questions")
            except Exception as e:
                print(f"[WARN] Failed to parse questions_json: {e}")

    # 3) 還是找不到 → 404
    if not original_questions:
        print(f"[ERROR] Quiz {sub.quiz_id} not found anywhere")
        raise HTTPException(status_code=404, detail="Quiz not found or expired")

    user_answers = sub.answers or {}
    print(f"[DEBUG] Answers: {user_answers}")

    results = []
    correct_count = 0
    category_breakdown = {}

    for i, q in enumerate(original_questions):
        idx_str = str(i)
        user_answer = str(user_answers.get(idx_str, "") or "").strip()
        correct_answer = str(q.get("answer", "") or "").strip()
        is_long = q.get("question_type") == "Long"

        if is_long:
            is_correct = None
        else:
            is_correct = bool(user_answer and (user_answer.upper() == correct_answer.upper()))
            if is_correct:
                correct_count += 1

        category = q.get("main_category", "Uncategorized")
        if category not in category_breakdown:
            category_breakdown[category] = {"total": 0, "correct": 0, "percent": 0}

        if not is_long:
            category_breakdown[category]["total"] += 1
            if is_correct:
                category_breakdown[category]["correct"] += 1

        res_q = q.copy()
        res_q["index"] = i
        res_q["user_answer"] = user_answer
        res_q["correct_answer"] = correct_answer
        res_q["is_correct"] = is_correct
        results.append(res_q)

    for cat, stats in category_breakdown.items():
        if stats["total"] > 0:
            stats["percent"] = round((stats["correct"] / stats["total"]) * 100)

    mcq_questions = [q for q in original_questions if q.get("question_type") != "Long"]
    score_percent = round((correct_count / len(mcq_questions)) * 100) if mcq_questions else 0

    if current_user:
        try:
            normalized_user_answers = {str(k): str(v) for k, v in user_answers.items()}
            user_answers_json = json.dumps(normalized_user_answers, ensure_ascii=False)

            existing = db.query(QuizRecord).filter(QuizRecord.id == sub.quiz_id).first()
            if existing:
                existing.score_percent = score_percent
                existing.correct_count = correct_count
                existing.total_count = len(original_questions)
                existing.category_breakdown_json = json.dumps(category_breakdown, ensure_ascii=False)
                existing.questions_json = json.dumps(original_questions, ensure_ascii=False)
                existing.user_answers_json = user_answers_json
            else:
                record = QuizRecord(
                    id=sub.quiz_id,
                    user_id=current_user.id,
                    score_percent=score_percent,
                    correct_count=correct_count,
                    total_count=len(original_questions),
                    time_taken_seconds=0,
                    category_breakdown_json=json.dumps(category_breakdown, ensure_ascii=False),
                    questions_json=json.dumps(original_questions, ensure_ascii=False),
                    user_answers_json=user_answers_json,
                )
                db.add(record)
            db.commit()
            print(f"[OK] Quiz {sub.quiz_id} saved for user {current_user.username}")
        except Exception as db_err:
            print("Failed to persist quiz record:", db_err)
            db.rollback()

    return {
        "total": len(original_questions),
        "correct": correct_count,
        "score_percent": score_percent,
        "results": results,
        "category_breakdown": category_breakdown
    }


# ==========================================
# Authentication & User Account Endpoints
# ==========================================

class UserRegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    full_name: Optional[str] = None

class UserLoginRequest(BaseModel):
    username: str
    password: str

class FeedbackRequest(BaseModel):
    score_percent: int
    category_breakdown: dict
    weak_categories: list[str] = []
    wrong_questions: list[dict] = []


@app.post("/auth/register")
def register(req: UserRegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == req.username.strip()).first():
        raise HTTPException(status_code=400, detail="該用戶名已被註冊，請更換")
    if db.query(User).filter(User.email == req.email.strip()).first():
        raise HTTPException(status_code=400, detail="該郵箱已被註冊，請更換")

    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="密碼長度至少需要 6 個字元")

    user = User(
        username=req.username.strip(),
        email=req.email.strip(),
        hashed_password=hash_password(req.password),
        full_name=req.full_name.strip() if req.full_name else req.username.strip()
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "username": user.username})
    return {
        "status": "success",
        "message": "註冊成功！",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_admin": user.is_admin,
        }
    }


@app.post("/auth/login")
def login(req: UserLoginRequest, db: Session = Depends(get_db)):
    login_id = req.username.strip()
    user = db.query(User).filter(
        (User.username == login_id) | (User.email == login_id)
    ).first()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="用戶名或密碼不正確")

    token = create_access_token({"sub": str(user.id), "username": user.username})
    return {
        "status": "success",
        "message": "登入成功！",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_admin": user.is_admin,
        }
    }


@app.get("/auth/me")
def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "created_at": user.created_at.isoformat() if user.created_at else None
    }


@app.get("/user/quiz-history")
def get_quiz_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.query(QuizRecord).filter(QuizRecord.user_id == user.id).order_by(QuizRecord.created_at.desc()).all()
    history = []
    for r in records:
        breakdown = {}
        if r.category_breakdown_json:
            try:
                breakdown = json.loads(r.category_breakdown_json)
            except Exception:
                pass
        history.append({
            "quiz_id": r.id,
            "score_percent": r.score_percent,
            "correct_count": r.correct_count,
            "total_count": r.total_count,
            "time_taken_seconds": r.time_taken_seconds,
            "category_breakdown": breakdown,
            "feedback": r.pedagogical_feedback,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else ""
        })
    return {"total": len(history), "history": history}


@app.get("/user/quiz-review/{quiz_id}")
def get_quiz_review(
    quiz_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """取得某次測驗的完整錯題回顧"""
    record = db.query(QuizRecord).filter(
        QuizRecord.id == quiz_id,
        QuizRecord.user_id == user.id,
    ).first()

    if not record:
        raise HTTPException(404, "找不到該測驗記錄")

    # 讀題目
    original_questions = []
    if record.questions_json:
        try:
            original_questions = json.loads(record.questions_json)
        except Exception as e:
            print(f"[WARN] Failed to parse questions_json: {e}")

    if not original_questions:
        original_questions = question_bank.get(quiz_id, [])

    # 讀使用者作答
    user_answers = {}
    if record.user_answers_json:
        try:
            user_answers = json.loads(record.user_answers_json)
        except Exception as e:
            print(f"[WARN] Failed to parse user_answers_json: {e}")

    # 把每題加上 user_answer / correct_answer / is_correct
    merged = []
    for i, q in enumerate(original_questions):
        user_ans = str(user_answers.get(str(i), "") or "").strip()
        correct_ans = str(q.get("answer", "") or "").strip()
        is_long = q.get("question_type") == "Long"

        if is_long:
            is_correct = None
        else:
            is_correct = bool(user_ans and user_ans.upper() == correct_ans.upper())

        merged_q = q.copy()
        merged_q["index"] = i
        merged_q["user_answer"] = user_ans
        merged_q["correct_answer"] = correct_ans
        merged_q["is_correct"] = is_correct
        merged.append(merged_q)

    breakdown = {}
    if record.category_breakdown_json:
        try:
            breakdown = json.loads(record.category_breakdown_json)
        except Exception:
            pass

    return {
        "quiz_id": quiz_id,
        "score_percent": record.score_percent,
        "correct_count": record.correct_count,
        "total_count": record.total_count,
        "created_at": record.created_at.strftime("%Y-%m-%d %H:%M") if record.created_at else "",
        "category_breakdown": breakdown,
        "questions": merged,
    }


@app.post("/ai/pedagogical-feedback")
async def generate_pedagogical_feedback(req: FeedbackRequest):
    weak_detail_lines = []
    for cat, stats in req.category_breakdown.items():
        pct = stats.get('percent', 0)
        correct = stats.get('correct', 0)
        total = stats.get('total', 0)
        weak_detail_lines.append(
            f"- {cat}：{correct}/{total} 正确，得分率 {pct}%"
        )
    breakdown_text = "\n".join(weak_detail_lines)

    prompt = (
        "你是一位澳門四校聯考（JAE）數學科的資深閱卷老師與補習名師。\n"
        "學生剛完成一次模擬測驗，以下是他的成績數據：\n\n"
        f"【總得分率】：{req.score_percent}%\n"
        f"【各科明細】：\n{breakdown_text}\n\n"
        "請給出一份**具體可執行**的提分建議書。嚴格遵守以下規則：\n\n"
        "🚫 禁止事項（非常嚴格）：\n"
        "- 禁止寫「鞏固基礎」「多做練習」「加強理解」「提升能力」這種空泛廢話\n"
        "- 禁止寫「根據布魯姆認知層次」「近側發展區」這類純理論名詞當裝飾\n"
        "- 禁止寫「建議複習相關知識點」這種沒有具體指向的句子\n"
        "- 禁止寫開場白、總結語、鼓勵語（如「相信你一定能進步」）\n\n"
        "✅ 必須包含的內容：\n"
        "1. **逐科診斷**：對每個得分率低於 70% 的科目，寫出：\n"
        "   - 這個科目在 JAE 中常考的 2-3 個具體題型（例如「三角學：解三角形、和差化積、三角方程通解」）\n"
        "   - 學生在這些題型上最常見的失分原因（例如「忽略角度範圍限制」「符號判斷錯誤」）\n"
        "   - 一個**具體的練習處方**：例如「每天做 3 題『已知兩邊及夾角求第三邊』的餘弦定理題，限時 5 分鐘」\n\n"
        "2. **一個高頻考點公式清單**：針對最弱的 1-2 科，列出 3-5 個必須背熟的具體公式或定理，"
        "用 LaTeX 寫出（例如 $\\sin^2\\theta + \\cos^2\\theta = 1$）。\n\n"
        "3. **一週行動計畫**：用 3 條 bullet point 給出具體任務，每條要有：\n"
        "   - 做什麼（具體題型或公式）\n"
        "   - 做多少（數量、時間）\n"
        "   - 達到什麼標準（例如「10 題中至少對 8 題」）\n\n"
        "格式要求：\n"
        "- 使用繁體中文\n"
        "- 使用 Markdown（## 標題、- bullet point、**粗體**重點）\n"
        "- 數學公式用 LaTeX：行內 $...$，獨立 $$...$$\n"
        "- 總字數 400-600 字\n"
        "- 語氣像一位嚴格但實用的補習老師，直接給方法，不要廢話"
    )
    if req.wrong_questions:
        wrong_lines = "\n".join([
            f"- [{w.get('category')}] {w.get('number')}：{w.get('stem')}..."
            for w in req.wrong_questions[:8]
        ])
        prompt += f"\n\n【具體錯題】:\n{wrong_lines}\n請針對這些題目的知識點給出針對性建議。"

    try:
        res = await async_client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        feedback_text = res.choices[0].message.content.strip()
    except Exception as e:
        feedback_text = (
            f"**【AI 學習診斷與提分建議】**\n\n"
            f"本次測驗總得分率為 **{req.score_percent}%**。\n"
            f"請針對弱項模組加強練習。"
        )

    return {"feedback": feedback_text}


# =====================================================================
# 澳門四校聯考 · 歷屆 SQL 預存題庫端點
# =====================================================================

@app.get("/prestored/papers")
def get_prestored_papers():
    papers_path = find_data_file(os.path.join("source", "papers.json"))
    if not os.path.exists(papers_path):
        return {"papers": []}
    with open(papers_path, "r", encoding="utf-8") as f:
        return {"papers": json.load(f)}


@app.get("/prestored/questions")
def get_prestored_questions(paper_id: Optional[str] = None):
    q_path = find_data_file(os.path.join("source", "questions.json"))
    if not os.path.exists(q_path):
        return {"questions": []}
    with open(q_path, "r", encoding="utf-8") as f:
        raw_questions = json.load(f)

    topic_cat_map = {
        "三角函數": "Trigonometry",
        "二項式定理": "Algebra",
        "代數運算": "Algebra",
        "函數與對數": "Functions",
        "平面幾何": "Geometry",
        "排列與概率": "Probability",
        "數列與級數": "Sequences",
        "比例與應用": "Algebra",
        "百分率與立體幾何": "Geometry",
        "統計": "Statistics",
        "解析幾何": "Geometry",
        "集合與不等式": "Algebra",
    }

    papers_map = {}
    p_path = find_data_file(os.path.join("source", "papers.json"))
    if os.path.exists(p_path):
        try:
            with open(p_path, "r", encoding="utf-8") as pf:
                for p in json.load(pf):
                    papers_map[p["id"]] = p.get("title", p.get("year", ""))
        except Exception:
            pass

    mapped = []
    for q in raw_questions:
        if paper_id and q.get("paperId") != paper_id:
            continue
        opts_zh = {}
        if "options" in q and isinstance(q["options"], list):
            for opt in q["options"]:
                opts_zh[opt.get("id", "")] = opt.get("text", "")

        diff_val = q.get("difficulty")
        points = q.get("points", 0)
        q_type = q.get("questionType", "").lower()

        if diff_val in [1, 2, 3]:
            diff_map = {1: "Easy", 2: "Medium", 3: "Hard"}
            diff_str = diff_map[diff_val]
        else:
            if points > 0 and points <= 3 and "long" not in q_type:
                diff_str = "Easy"
            elif points >= 8 or "long" in q_type:
                diff_str = "Hard"
            else:
                diff_str = "Medium"
        cat = topic_cat_map.get(q.get("topic"), "Algebra")

        paper_title = papers_map.get(q.get("paperId", ""), q.get("paperId", ""))
        real_en = q.get("english") or q.get("question_en") or ""

        mapped.append({
            "question_number": f"第 {q.get('number', 1)} 題",
            "question_type": "MCQ" if q.get("questionType") == "multiple_choice" else "Long",
            "raw_text_zh": q.get("question", ""),
            "raw_text_en": real_en,
            "answer": q.get("answer", ""),
            "solution": q.get("explanation", "") or (f"答案為 {q.get('answer')}" if q.get('answer') else ""),
            "options": opts_zh,
            "options_zh": opts_zh,
            "options_en": opts_zh,
            "main_category": cat,
            "sub_topics": [t for t in [q.get("topic"), q.get("subtopic")] if t],
            "difficulty": diff_str,
            "score": q.get("points", 4),
            "has_diagram": bool(q.get("diagram")),
            "diagram_image": (
                f"http://127.0.0.1:8000/diagrams/{os.path.basename(q['diagram'])}"
            ) if q.get("diagram") else None,
            "source_paper": paper_title
        })

    # ===== 用题目内容去重 =====
    seen_texts = set()
    deduped = []
    for q in mapped:
        text_key = (q.get("raw_text_zh") or q.get("raw_text_en") or "")
        text_key = "".join(text_key.split())[:100]

        if text_key and text_key in seen_texts:
            print(f"[DEDUP] Skipped duplicate: {q.get('question_number')} | {q.get('source_paper')}")
            continue
        if text_key:
            seen_texts.add(text_key)
        deduped.append(q)

    print(f"[DEDUP] {len(mapped)} → {len(deduped)} after dedup")
    return {"total": len(deduped), "questions": deduped}


# =====================================================================
# Admin User Management
# =====================================================================

class UserUpdateRequest(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    is_admin: Optional[bool] = None


class PasswordResetRequest(BaseModel):
    new_password: str


@app.patch("/admin/users/{user_id}")
def admin_update_user(
    user_id: int,
    payload: UserUpdateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "找不到該用戶")
    if payload.email is not None:
        user.email = payload.email
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.is_admin is not None:
        if user.id == admin.id and payload.is_admin is False:
            raise HTTPException(400, "不能取消自己的管理員權限")
        user.is_admin = payload.is_admin
    db.commit()
    return {"ok": True}


@app.post("/admin/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: int,
    payload: PasswordResetRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "找不到該用戶")
    if len(payload.new_password) < 6:
        raise HTTPException(400, "密碼至少 6 位")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"ok": True}


@app.delete("/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "找不到該用戶")
    if user.id == admin.id:
        raise HTTPException(400, "不能刪除自己的帳號")
    db.delete(user)
    db.commit()
    return {"ok": True}


# =====================================================================
# AI 相似題生成端點
# =====================================================================

class AIQuizRequest(BaseModel):
    count: int = 5
    categories: Optional[List[str]] = None
    difficulties: Optional[List[str]] = None
    types: Optional[List[str]] = None


def load_question_bank() -> List[dict]:
    q_path = find_data_file(os.path.join("source", "questions.json"))
    if not os.path.exists(q_path):
        return []
    with open(q_path, "r", encoding="utf-8") as f:
        return json.load(f)


async def generate_similar_questions(samples: List[dict], count: int) -> List[dict]:
    samples_text = "\n\n".join([
        f"【範例 {i+1}】\n"
        f"題型：{s.get('questionType', 'multiple_choice')}\n"
        f"科目：{s.get('topic', '數學')}\n"
        f"難度：{s.get('difficulty', 'Medium')}\n"
        f"題目：{s.get('question', '')}\n"
        f"答案：{s.get('answer', '')}"
        for i, s in enumerate(samples[:5])
    ])

    prompt = f"""你是澳門四校聯考數學科的資深出題老師。以下是幾道歷屆範例題：

{samples_text}

請根據這些範例題的**題型、知識點、難度**，生成 {count} 道「相似但不同」的全新題目。

嚴格要求：
1. 題型必須相同（MCQ 選擇題 / Long 解答題）
2. 知識點相同（例如都是二次函數、三角函數等）
3. 難度相近
4. **數字、情境、選項必須完全不同**（禁止直接照抄範例題）
5. MCQ 必須有 A、B、C、D、E 五個選項
6. 每題必須提供正確答案與步驟解析
7. 所有數學式用 LaTeX 表示（$...$ 行內、$$...$$ 獨立）

請以 JSON 回傳，格式如下：
{{
  "questions": [
    {{
      "question_number": "AI-1",
      "question_type": "MCQ",
      "main_category": "Algebra",
      "sub_topics": ["集合", "不等式"],
      "difficulty": "Medium",
      "raw_text_zh": "題目文字（LaTeX）",
      "raw_text_en": "",
      "options_zh": {{"A": "...", "B": "...", "C": "...", "D": "...", "E": "..."}},
      "options_en": {{}},
      "answer": "B",
      "solution": "完整解題步驟",
      "has_diagram": false
    }}
  ]
}}

只回傳 JSON，不要有其他文字。"""

    last_err = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await async_client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.8,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content
            parsed = safe_json_parse(raw)
            if isinstance(parsed, dict) and "questions" in parsed:
                return parsed["questions"]
            if isinstance(parsed, list):
                return parsed
            return []
        except Exception as e:
            last_err = e
            if attempt < MAX_RETRIES:
                await asyncio.sleep(2 * (attempt + 1))
                continue
            raise last_err

    raise last_err or RuntimeError("AI generation failed")


@app.post("/generate-ai-quiz")
async def generate_ai_quiz(
    payload: AIQuizRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    all_questions = load_question_bank()
    if not all_questions:
        raise HTTPException(404, "題庫為空，無法生成 AI 題目")

    filtered = all_questions
    if payload.categories:
        expanded = set()
        for cat in payload.categories:
            expanded.add(cat)
            expanded.update(CATEGORY_TOPIC_ALIASES.get(cat, [cat]))
        # 英文别名
        EN_ALIASES = {
            "三角學": ["Trigonometry", "Trigonometric Functions", "Trigonometric Identities", "Trigonometric Equations"],
            "幾何": ["Geometry", "Coordinate Geometry", "Analytical Geometry", "Conic Sections", "Solid Geometry"],
            "代數": ["Algebra", "Sets", "Set Theory", "Inequalities", "Polynomials", "Binomial Theorem"],
            "函數": ["Functions", "Logarithms", "Exponentials"],
            "概率": ["Probability", "Permutations", "Combinations"],
            "數列": ["Sequences", "Series", "Geometric Progression", "Arithmetic Progression"],
            "統計": ["Statistics"],
            "微積分": ["Calculus", "Differentiation", "Integration", "Curve Sketching"],
            "解析幾何": ["Analytical Geometry", "Coordinate Geometry", "Conic Sections"],
        }
        for cat in payload.categories:
            expanded.update(EN_ALIASES.get(cat, []))

        print(f"[DEBUG AI] Categories: {payload.categories}")
        print(f"[DEBUG AI] Expanded set: {expanded}")

        filtered = [q for q in filtered if (
            q.get("topic") in expanded or
            q.get("subtopic") in expanded or
            q.get("main_category") in expanded or
            any(t in expanded for t in (q.get("sub_topics") or []))
        )]
        print(f"[DEBUG AI] After filter: {len(filtered)}")

        if payload.difficulties:
            filtered = [q for q in filtered if q.get("difficulty") in payload.difficulties]
        if payload.types:
            type_map = {"MCQ": "multiple_choice", "Long": "written"}
            wanted = [type_map.get(t, t) for t in payload.types]
            filtered = [q for q in filtered if q.get("questionType") in wanted]

        print(f"[DEBUG AI] Filtered: {len(filtered)} questions")

    if not filtered:
        raise HTTPException(404, "找不到符合條件的範例題")

    sample_size = min(5, len(filtered))
    samples = random.sample(filtered, sample_size)

    ai_questions = await generate_similar_questions(samples, payload.count)

    for i, q in enumerate(ai_questions):
        raw_opts = q.get("options_zh") or q.get("options") or q.get("choices") or {}
        normalized = {}
        if isinstance(raw_opts, dict):
            for k, v in raw_opts.items():
                normalized[k.upper()] = v if isinstance(v, str) else (v.get("text") if isinstance(v, dict) else str(v))
        elif isinstance(raw_opts, list):
            for idx, item in enumerate(raw_opts):
                key = (item.get("id") or item.get("letter") or chr(65 + idx)).upper()
                normalized[key] = item.get("text") or item.get("content") or str(item)

        q["options_zh"] = normalized
        q["options_en"] = q.get("options_en") or normalized

        q.setdefault("question_number", f"AI-{i + 1}")
        q.setdefault("question_type", "MCQ")
        q.setdefault("main_category", "Algebra")
        q.setdefault("sub_topics", [])
        q.setdefault("difficulty", "Medium")
        q.setdefault("raw_text_zh", "")
        q.setdefault("raw_text_en", "")
        q.setdefault("answer", "")
        q.setdefault("solution", "")
        q.setdefault("has_diagram", False)
        q["source"] = "ai"
        q["index"] = i

    quiz_id = f"ai-{int(time.time())}"
    question_bank[quiz_id] = ai_questions

    try:
        early_record = QuizRecord(
            id=quiz_id,
            user_id=current_user.id,
            score_percent=0,
            correct_count=0,
            total_count=len(ai_questions),
            time_taken_seconds=0,
            category_breakdown_json="{}",
            questions_json=json.dumps(ai_questions, ensure_ascii=False),
            user_answers_json="{}",
        )
        db.add(early_record)
        db.commit()
        print(f"[OK] AI Quiz {quiz_id} pre-saved for user {current_user.username}")
    except Exception as e:
        print(f"[WARN] AI early save failed: {e}")
        db.rollback()

    stripped = []
    for i, q in enumerate(ai_questions):
        s = q.copy()
        s.pop("answer", None)
        s.pop("solution", None)
        s["index"] = i
        s["id"] = f"{quiz_id}-{i}"
        stripped.append(s)

    return {
        "quiz_id": quiz_id,
        "total": len(stripped),
        "source": "ai",
        "questions": stripped,
    }


# =====================================================================
# 收藏題目 API（FavoriteQuestion）
# =====================================================================

from models import FavoriteQuestion


class FavoriteRequest(BaseModel):
    question_id: str
    question_json: dict
    note: Optional[str] = None


@app.post("/user/favorites")
def add_favorite(
    payload: FavoriteRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """新增收藏題目"""
    existing = db.query(FavoriteQuestion).filter(
        FavoriteQuestion.user_id == user.id,
        FavoriteQuestion.question_id == payload.question_id,
    ).first()

    if existing:
        return {"ok": True, "message": "已收藏", "already": True}

    fav = FavoriteQuestion(
        user_id=user.id,
        question_id=payload.question_id,
        question_json=json.dumps(payload.question_json, ensure_ascii=False),
        note=payload.note,
    )
    db.add(fav)
    db.commit()
    return {"ok": True, "message": "收藏成功"}


@app.delete("/user/favorites")
def remove_favorite(
    question_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """取消收藏（使用 query 參數，避免中文/特殊字元在路徑中出錯）"""
    fav = db.query(FavoriteQuestion).filter(
        FavoriteQuestion.user_id == user.id,
        FavoriteQuestion.question_id == question_id,
    ).first()

    if not fav:
        return {"ok": True, "message": "未收藏"}

    db.delete(fav)
    db.commit()
    return {"ok": True, "message": "已取消收藏"}


@app.get("/user/favorites")
def list_favorites(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """列出收藏題目"""
    favs = db.query(FavoriteQuestion).filter(
        FavoriteQuestion.user_id == user.id
    ).order_by(FavoriteQuestion.created_at.desc()).all()

    result = []
    for f in favs:
        try:
            qjson = json.loads(f.question_json) if f.question_json else {}
        except Exception:
            qjson = {}
        result.append({
            "id": f.id,
            "question_id": f.question_id,
            "question": qjson,
            "note": f.note,
            "created_at": f.created_at.strftime("%Y-%m-%d %H:%M") if f.created_at else "",
        })
    return {"total": len(result), "favorites": result}