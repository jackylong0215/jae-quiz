"""Local, deterministic English reference answers/options; no provider calls."""
from collections import Counter
import json
from pathlib import Path
import re

from translate_bank import CJK, MATH, english_math, protect, restore

ROOT = Path(__file__).resolve().parents[1]
PHRASES = {
    '將切線代入拋物線方程，令判別式為零，得': 'Substituting the tangent line into the parabola equation and setting the discriminant to zero gives ',
    '用歸納法及三角加法公式證明 (i)；利用': 'Prove (i) by induction and the angle-addition formulas; using ',
    '曲線先遞減後遞增，無局部極大點或拐點': 'The curve decreases and then increases, with no local maximum or point of inflection',
    '證明見解析': 'See the worked solution for the proof.', '圖見解析': 'See the graph in the worked solution.',
    '局部極大點': 'Local maximum at ', '局部極小點為': 'Local minimum at ', '局部極小點': 'Local minimum at ',
    '局部極大值': 'Local maximum value ', '局部極小值': 'Local minimum value ',
    '通解為 (i)': 'the general solution is given in (i)', '通解為': 'the general solution is ',
    '軌跡為直線': 'The locus is the straight line ', '軌跡為': 'The locus is ',
    '的最大值為': ' has maximum value ', '的最小值為': ' has minimum value ',
    '拐點': 'Point of inflection at ', '切線方程': 'Tangent equations ', '切點': 'Points of tangency ',
    '最小值': 'Minimum value ', '最大值': 'Maximum value ', '表格': 'Table',
    '公里': ' km', '體積': 'Volume ', '距離': 'Distance ', '面積': 'Area ',
    '範圍': 'Range ', '存在': 'Yes', '解為': 'the solutions are ', '和為': 'the sum is ',
    '當': 'when ', '時': '', '或': ' or ', '及': ' and ', '和': ' and ', '可得': 'it follows that ',
    '因': 'Since ', '故': 'therefore ', '展開': 'Expand ', '並使用': ' and use ', '得': ' gives ',
}


def translate_answer(source):
    masked, spans = protect(source)
    for original, target in sorted(PHRASES.items(), key=lambda item: -len(item[0])):
        masked = masked.replace(original, target)
    masked = masked.replace('，', ', ').replace('；', '; ').replace('。', '.').replace('：', ': ')
    return restore(masked, spans)


def validate_bank(questions):
    for q in questions:
        for source, target in [('question','english'),('explanation','explanation_en'),('answer','answer_en')]:
            assert q.get(target) and not CJK.search(q[target]), (q['id'],target)
            assert Counter(english_math(span) for span in MATH.findall(q[source])) == Counter(MATH.findall(q[target])), (q['id'],target,'mathematics changed')
        for option in q.get('options', []):
            assert option.get('text_en') and not CJK.search(option['text_en']), (q['id'],option['id'])
            assert Counter(MATH.findall(option['text'])) == Counter(MATH.findall(option['text_en'])), q['id']


if __name__ == '__main__':
    path = ROOT / 'papers/source/questions.json'
    questions = json.loads(path.read_text())
    for q in questions:
        q['answer_en'] = translate_answer(q['answer'])
        for option in q.get('options', []):
            if not option.get('text_en'):
                option['text_en'] = option['text'].replace('以上皆非', 'None of the above')
    validate_bank(questions)
    path.write_text(json.dumps(questions,ensure_ascii=False,indent=2)+'\n')
    print(f'Validated {len(questions)} English stems, answers, explanations and all options with matching mathematics.')
