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
