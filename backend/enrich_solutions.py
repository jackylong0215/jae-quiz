import os
import json
import asyncio
import sys
from openai import AsyncOpenAI

# === 载入 .env ===
def _load_env():
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

API_KEY = os.getenv("JAE_API_KEY", "")
BASE_URL = os.getenv("JAE_BASE_URL", "https://api.smai.ai/v1")
MODEL = os.getenv("JAE_MODEL", "gemini-3.1-pro-preview")

async_client = AsyncOpenAI(api_key=API_KEY or "dummy", base_url=BASE_URL, timeout=120.0)

# === 找到 questions.json ===
def find_questions_json():
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "papers", "source", "questions.json")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "prestored-2.0", "source", "questions.json")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "papers", "source", "questions.json")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "source", "questions.json")),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    raise FileNotFoundError("找不到 questions.json")


async def solve_question(q: dict) -> str:
    """用 AI 生成完整解题过程"""
    opts = q.get("options", [])
    opts_text = ""
    if isinstance(opts, list):
        opts_text = "\n".join([f"  {o.get('id', '')}. {o.get('text', '')}" for o in opts])
    elif isinstance(opts, dict):
        opts_text = "\n".join([f"  {k}. {v}" for k, v in opts.items()])

    prompt = f"""請為以下澳門四校聯考數學題撰寫**完整解題過程**，不要只給答案。

【題目】
{q.get('question', '')}

【選項】
{opts_text}

【正確答案】
{q.get('answer', '')}

要求：
1. 逐步推導，每一步都要說明理由（用了什麼定理、公式、性質）
2. 數學式用 LaTeX（$...$ 行內，$$...$$ 獨立）
3. 繁體中文
4. 不要廢話，不要開場白，直接進入推導
5. 結尾寫「故選 X」
6. 只輸出解題過程純文字，不要 JSON，不要 markdown 代碼塊包裹

開始："""

    last_err = None
    for attempt in range(3):
        try:
            res = await async_client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
            )
            text = res.choices[0].message.content.strip()
            # 去掉可能被包裹的 ``` 标记
            if text.startswith("```"):
                text = text.strip("`")
                if text.lower().startswith("markdown"):
                    text = text[8:]
                text = text.strip()
            return text
        except Exception as e:
            last_err = e
            await asyncio.sleep(2 * (attempt + 1))
    raise last_err


async def main():
    path = find_questions_json()
    print(f"[INFO] questions.json 路徑: {path}")

    with open(path, "r", encoding="utf-8") as f:
        questions = json.load(f)

    print(f"[INFO] 共 {len(questions)} 題")

    # 备份
    backup_path = path + ".backup"
    if not os.path.exists(backup_path):
        with open(backup_path, "w", encoding="utf-8") as f:
            json.dump(questions, f, ensure_ascii=False, indent=2)
        print(f"[INFO] 已備份至 {backup_path}")

    # 只处理缺解析的
    to_fix = []
    for i, q in enumerate(questions):
        existing = q.get("explanation") or q.get("solution") or ""
        if not existing or len(str(existing).strip()) < 30:
            to_fix.append(i)

    print(f"[INFO] 需要補解析: {len(to_fix)} 題")

    if not to_fix:
        print("[DONE] 全部已有解析，無需處理")
        return

    # 逐题处理（并行容易触发 API 限流，串行更稳）
    success = 0
    failed = 0
    for n, idx in enumerate(to_fix):
        q = questions[idx]
        stem = (q.get("question") or "")[:40].replace("\n", " ")
        print(f"[{n+1}/{len(to_fix)}] 題號 {q.get('number', idx+1)}: {stem}...")

        try:
            solution = await solve_question(q)
            q["explanation"] = solution
            success += 1
            # 每 5 题存一次，避免中途失败全丢
            if (n + 1) % 5 == 0:
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(questions, f, ensure_ascii=False, indent=2)
                print(f"  [SAVE] 已保存進度 ({n+1}/{len(to_fix)})")
        except Exception as e:
            print(f"  [FAIL] {e}")
            failed += 1

        # 避免触发 API 限流
        await asyncio.sleep(0.5)

    # 最终保存
    with open(path, "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)

    print(f"\n[DONE] 成功 {success} 題，失敗 {failed} 題")
    print(f"[DONE] 已寫回 {path}")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())