"""Adapt persisted bilingual question fields without translating identifiers."""


def bilingual_fields(question):
    options = question.get('options') or []
    zh, en = {}, {}
    if isinstance(options, list):
        for option in options:
            key = str(option.get('id') or option.get('letter') or '').upper()
            if key:
                zh[key] = option.get('text', '')
                if option.get('text_en'):
                    en[key] = option['text_en']
        # An incomplete English options set must not hide untranslated options.
        if set(en) != set(zh):
            en = {}
    elif isinstance(options, dict):
        zh = options
    stored_en = question.get('options_en')
    if isinstance(stored_en, dict) and set(stored_en) == set(zh):
        en = stored_en
    return {
        'raw_text_zh': question.get('raw_text_zh') or question.get('question') or question.get('question_zh') or '',
        'raw_text_en': question.get('raw_text_en') or question.get('english') or question.get('question_en') or '',
        'options': zh,
        'options_zh': zh,
        'options_en': en,
        'answer_en': question.get('answer_en') or '',
        'solution_zh': question.get('explanation') or question.get('solution') or '',
        'solution_en': question.get('explanation_en') or question.get('solution_en') or '',
    }


def translation_lookup(questions):
    """Match saved snapshots by their original stem, never by quiz position."""
    stems, ambiguous = {}, set()
    for q in questions:
        stem = q.get('question')
        if not stem:
            continue
        if stem in stems:
            ambiguous.add(stem)
        stems[stem] = q
    return {'ids': {q['id']: q for q in questions if q.get('id')},
            'stems': {stem: q for stem, q in stems.items() if stem not in ambiguous}}


def with_bank_translations(question, lookup):
    stem = question.get('raw_text_zh') or question.get('question')
    source = lookup['ids'].get(question.get('id')) or lookup['stems'].get(stem)
    if not source or stem != source.get('question') or question.get('ai_generated') or question.get('generated'):
        return question.copy()
    result = question.copy()
    fields = bilingual_fields(source)
    for field in ('raw_text_en', 'options_en', 'answer_en'):
        if fields[field]:
            result[field] = fields[field]
    # Avoid attaching the new explanation to a different saved/custom solution.
    saved_solution = question.get('solution_zh') or question.get('explanation') or question.get('solution')
    if not saved_solution or saved_solution in (fields['solution_zh'], fields['solution_en']):
        result['solution_zh'] = fields['solution_zh']
        result['solution_en'] = fields['solution_en']
    return result
