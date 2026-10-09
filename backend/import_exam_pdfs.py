"""Local-only PDF indexing, bilingual bank validation and SQLite synchronisation.

No network clients, AI calls or OCR uploads are used. PDF font text is an audit
trail, not display-ready mathematics. The reviewed JSON is the source of truth
for LaTeX and bilingual stems/options; English worked solutions in the PDF remain
available for checking existing explanations.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'papers/source'
MATH = re.compile(r'\$\$[\s\S]*?\$\$|(?<!\$)\$(?!\$)[^$]*?\$(?!\$)')
CJK = re.compile(r'[\u3400-\u9fff\uf900-\ufaff]')
BAD_GLYPHS = re.compile(r'[\ue000-\uf8ff\x00-\x08\x0b\x0c\x0e-\x1f\ufffd]')


def read_json(name):
    return json.loads((SOURCE / name).read_text(encoding='utf-8'))


def extract_local():
    import pymupdf
    destination = SOURCE / 'pdf_text'
    destination.mkdir(exist_ok=True)
    count = 0
    for paper in read_json('pdf_import_manifest.json'):
        with pymupdf.open(ROOT / paper['file']) as document:
            for i, page in enumerate(document, 1):
                (destination / f"{paper['id']}-{i:02}.txt").write_text(page.get_text(sort=True), encoding='utf-8')
                count += 1
    return count


def validate():
    import pymupdf
    manifest = read_json('pdf_import_manifest.json')
    papers = read_json('papers.json')
    questions = read_json('questions.json')
    aliases = read_json('question_id_aliases.json')
    assert len({q['id'] for q in questions}) == len(questions), 'Duplicate question IDs'
    paper_ids = {p['id'] for p in papers}
    assert len(paper_ids) == len(papers), 'Duplicate paper IDs'
    assert all(q['paperId'] in paper_ids for q in questions), 'Unknown paper ID'
    ids = {q['id'] for q in questions}
    assert not set(aliases) & ids and set(aliases.values()) <= ids, 'Invalid duplicate aliases'
    for paper in papers:
        group = [q for q in questions if q['paperId'] == paper['id']]
        assert len(group) == paper['questionCount'], paper['id']
        assert sum(q['questionType'] == 'multiple_choice' for q in group) == paper['mcCount'], paper['id']
        assert sum(q['questionType'] == 'written' for q in group) == paper['writtenCount'], paper['id']
    formulas = answers = pages = imported = options = written_marks = 0
    source_issues = []
    for paper in manifest:
        path = ROOT / paper['file']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == paper['sha256'], path
        with pymupdf.open(path) as document:
            assert len(document) == paper['pageCount'], paper['id']
            pages += len(document)
            for n in range(1, len(document) + 1):
                audit = SOURCE / 'pdf_text' / f"{paper['id']}-{n:02}.txt"
                assert audit.exists() and audit.read_text(encoding='utf-8') == document[n-1].get_text(sort=True), audit
            if paper['kind'] == 'standard':
                table_text = document[paper['englishAnswerPages'][0]-1].get_text(sort=True)
                answer_table = {int(n): a for n, a in re.findall(r'^\s*(\d{1,2})\s+([A-E])\s*$', table_text, re.M)}
                assert set(answer_table) == set(range(1, 16)), paper['id']
            group = [q for q in questions if q['paperId'] == paper['id']]
            for kind in ('multiple_choice', 'written'):
                numbered = [q['number'] for q in group if q['questionType'] == kind]
                assert sorted(numbered) == list(range(1, len(numbered)+1)), (paper['id'], kind)
            for page_number in paper['questionPages']:
                written = sorted([q for q in group if q['questionType'] == 'written' and q['source']['page'] == page_number], key=lambda q: q['number'])
                if written:
                    original_marks = re.findall(r'[（(]\s*(\d+)\s*分', document[page_number-1].get_text(sort=True))
                    stored_marks = re.findall(r'[（(]\s*(\d+)\s*分', '\n'.join(q['question'] for q in written))
                    assert original_marks == stored_marks, ('Missing subpart marks', paper['id'], page_number)
            for q in group:
                imported += 1
                assert q.get('english', '').strip() and not CJK.search(q['english']), q['id']
                assert Counter(MATH.findall(q['question'])) == Counter(MATH.findall(q['english'])), ('Different mathematics', q['id'])
                for field in ('question', 'english', 'answer', 'explanation'):
                    assert not BAD_GLYPHS.search(q.get(field, '')), ('Broken display glyph', q['id'], field)
                formulas += len(MATH.findall(q['question'])) + len(MATH.findall(q['english']))
                assert q['source']['sha256'] == paper['sha256'] and q['source']['pdf'] == paper['pdf'], q['id']
                assert q['source']['page'] in paper['questionPages'] and q['source']['englishPage'] in paper['englishQuestionPages'], q['id']
                if q.get('diagram'):
                    assert (ROOT / 'papers/diagrams' / Path(q['diagram']).name).is_file(), ('Missing diagram', q['id'])
                if q['questionType'] == 'multiple_choice':
                    assert [o['id'] for o in q['options']] == list('ABCDE'), q['id']
                    assert q['answer'] == answer_table[q['number']], ('Answer mismatch', q['id'])
                    answers += 1
                    for option in q['options']:
                        assert option.get('text_en') and not CJK.search(option['text_en']), q['id']
                        assert not BAD_GLYPHS.search(option['text'] + option['text_en']), q['id']
                        assert MATH.findall(option['text']) == MATH.findall(option['text_en']), q['id']
                        formulas += len(MATH.findall(option['text'])) * 2
                        options += 1
                else:
                    assert q['options'] == [], q['id']
                    zh_marks = re.findall(r'[（(]\s*(\d+)\s*分', q['question'])
                    en_marks = re.findall(r'\((\d+)\s*marks?\)', q['english'])
                    assert zh_marks == en_marks and sum(map(int, zh_marks)) == q['points'], ('Wrong marks', q['id'])
                    written_marks += 1
                if q.get('sourceIssues'):
                    source_issues.append({'id': q['id'], 'issues': q['sourceIssues']})
    return {'pdfs': len(manifest), 'pages': pages, 'importedQuestions': imported,
            'translatedOptions': options, 'officialMcqAnswersVerified': answers,
            'writtenQuestionMarksVerified': written_marks,
            'questionAndOptionMathSpans': formulas, 'totalQuestions': len(questions),
            'papers': len(papers), 'sourceIssues': source_issues,
            'method': 'local-only; no external service calls',
            'explanationScope': 'Existing explanations retained except explicit corrections; not comprehensively rechecked or translated.'}


def sync_database(destination=None):
    path = Path(destination) if destination else ROOT / 'papers/db/prestored.db'
    with sqlite3.connect(path) as db:
        db.execute('PRAGMA foreign_keys=ON')
        # The shipped schema already includes quiz_sessions. Never reset it.
        sessions_before = db.execute('SELECT * FROM quiz_sessions ORDER BY id').fetchall()
        additions = {
            'papers': {'title_en': 'TEXT', 'pdf': 'TEXT'},
            'questions': {'english': 'TEXT', 'answer_en': 'TEXT', 'explanation_en': 'TEXT', 'diagram_alt_en': 'TEXT', 'source_json': 'TEXT'},
            'options': {'text_en': 'TEXT'},
        }
        for table, columns in additions.items():
            existing = {row[1] for row in db.execute(f'PRAGMA table_info({table})')}
            for column, kind in columns.items():
                if column not in existing:
                    db.execute(f'ALTER TABLE {table} ADD COLUMN {column} {kind}')
        def upsert(table, values, primary):
            columns = list(values)
            setters = ','.join(f'{key}=excluded.{key}' for key in columns if key not in primary)
            sql = f"INSERT INTO {table} ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)}) ON CONFLICT ({','.join(primary)}) DO UPDATE SET {setters}"
            db.execute(sql, [values[key] for key in columns])
        papers, questions = read_json('papers.json'), read_json('questions.json')
        for p in papers:
            upsert('papers', dict(id=p['id'], title=p['title'], year=p.get('year'), kind=p.get('kind'), question_count=p['questionCount'], mc_count=p['mcCount'], written_count=p['writtenCount'], max_score=p.get('maxScore'), source_file=p.get('source'), page_count=p.get('pageCount'), title_en=p.get('title_en'), pdf=p.get('pdf')), ['id'])
        columns = {'paper_id':'paperId','question_type':'questionType','raw_extract':'rawExtract','review_note':'reviewNote','diagram_alt':'diagramAlt','diagram_alt_en':'diagramAlt_en'}
        for q in questions:
            record = {key:q.get(key) for key in ('id','number','section','question','answer','topic','subtopic','difficulty','points','status','explanation','diagram','english','answer_en','explanation_en')}
            record.update({key:q.get(value) for key,value in columns.items()})
            record.update(page=q.get('source',{}).get('page'),source_file=q.get('source',{}).get('file'),source_json=json.dumps(q.get('source',{}),ensure_ascii=False),hints_json=json.dumps(q.get('hints',[]),ensure_ascii=False),common_mistakes_json=json.dumps(q.get('commonMistakes',{}),ensure_ascii=False),formulas_json=json.dumps(q.get('formulas',[]),ensure_ascii=False))
            upsert('questions', record, ['id'])
            db.execute('DELETE FROM options WHERE question_id=?', [q['id']])
            for index, option in enumerate(q['options']):
                upsert('options', dict(question_id=q['id'],label=option['id'],text=option['text'],text_en=option.get('text_en'),sort_order=index), ['question_id','label'])
        # Remove obsolete bank rows only; keep session references via aliases.
        ids = {q['id'] for q in questions}
        for identifier, in db.execute('SELECT id FROM questions').fetchall():
            if identifier not in ids:
                db.execute('DELETE FROM questions WHERE id=?', [identifier])
        paper_ids = {p['id'] for p in papers}
        for identifier, in db.execute('SELECT id FROM papers').fetchall():
            if identifier not in paper_ids:
                db.execute('DELETE FROM papers WHERE id=?', [identifier])
        db.execute('CREATE TABLE IF NOT EXISTS question_aliases (old_id TEXT PRIMARY KEY, question_id TEXT NOT NULL REFERENCES questions(id))')
        for old, new in read_json('question_id_aliases.json').items():
            upsert('question_aliases', {'old_id':old,'question_id':new}, ['old_id'])
        assert sessions_before == db.execute('SELECT * FROM quiz_sessions ORDER BY id').fetchall(), 'Session data changed'
        assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        assert not db.execute('PRAGMA foreign_key_check').fetchall()
        return {'questions':len(questions),'papers':len(papers),'preservedSessions':len(sessions_before)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--extract', action='store_true', help='Extract all PDF pages locally for the audit trail')
    parser.add_argument('--validate', action='store_true', help='Verify source hashes, bilingual content, math parity and official MCQ answers')
    parser.add_argument('--sync-db', action='store_true', help='Validate, then update the existing SQLite bank without resetting quiz sessions')
    args = parser.parse_args()
    if not any(vars(args).values()):
        parser.error('Choose --extract, --validate or --sync-db')
    if args.extract:
        print(json.dumps({'extractedPages':extract_local()}))
    if args.validate or args.sync_db:
        report = validate()
        if args.sync_db:
            report['database'] = sync_database()
        print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
