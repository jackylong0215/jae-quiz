import { LocalizedText, LocalizedMarkdown, useLocale, getQuestionText, getQuestionSolution, getQuestionAnswer, questionOptions } from './i18n.jsx';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { api as axios } from './i18n-api.js';
import 'katex/dist/katex.min.css';
import FavoriteButton from './FavoriteButton.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`;
const rehypeKatexOptions = [rehypeKatex, { output: 'html' }];

const CATEGORY_MAP = {
  Algebra: '代數', Calculus: '微積分', Geometry: '幾何',
  Trigonometry: '三角學', Probability: '概率', Statistics: '統計',
  Sequences: '數列', Functions: '函數', 'Number Theory': '數論', Other: '其他'
};

function normalizeLatex(text) {
  if (!text) return '';
  text = String(text);
  return text.replace(/\\n/g, '\n');
}

function extractOptions(q) {
  if (!q) return {};
  const raw = questionOptions(q);
  if (!raw) return {};

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const cleaned = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v) cleaned[k.toUpperCase()] = typeof v === 'object' ? (v.text || JSON.stringify(v)) : String(v);
    }
    return cleaned;
  }

  if (Array.isArray(raw)) {
    const cleaned = {};
    raw.forEach((item, idx) => {
      const key = (item.id || item.letter || item.label || String.fromCharCode(65 + idx)).toUpperCase();
      cleaned[key] = item.text || item.content || String(item);
    });
    return cleaned;
  }

  return {};
}

export default function ReviewPage() {
  useLocale();
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('jae_token');
    if (!token) {
      setError('請先登入');
      setLoading(false);
      return;
    }

    axios.get(`${API_BASE_URL}/user/quiz-review/${quizId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => setReview(res.data))
      .catch(err => {
        console.error('Review load failed:', err);
        setError(
          err.response?.status === 401 ? '請先登入才能查看測驗回顧' :
          err.response?.status === 404 ? '找不到此測驗記錄（可能未登入時建立，或 ID 不符）' :
          (err.response?.data?.detail || err.message || '載入失敗')
        );
      })
      .finally(() => setLoading(false));
  }, [quizId]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><LocalizedText value="載入中..." /></div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#b91c1c' }}>⚠️ <LocalizedText value={error} /></div>;
  if (!review) return null;

  const allQuestions = review.questions || [];
  const mcqQuestions = allQuestions.filter(q => q.question_type !== 'Long');
  const longQuestions = allQuestions.filter(q => q.question_type === 'Long');
  const correctCount = allQuestions.filter(q => q.is_correct === true).length;
  const wrongCount = allQuestions.filter(q => q.is_correct === false).length;
  const longCount = longQuestions.length;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/browse')}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f1f5f9', cursor: 'pointer', fontWeight: 600 }}
        ><LocalizedText value="← 返回題庫" /></button>
        <h2 style={{ margin: 0 }}><LocalizedText value="🔍 測驗回顧" /></h2>
      </div>

      <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>📅 <LocalizedText value={review.created_at} /></span>
          <span><LocalizedText value="🎯 得分：" /><LocalizedText value={review.score_percent} />%</span>
          <span style={{ color: '#15803d' }}><LocalizedText value="✅ 答對：" /><LocalizedText value={correctCount} />/<LocalizedText value={mcqQuestions.length} /><LocalizedText value="（選擇題）" /></span>
          <span style={{ color: '#b91c1c' }}><LocalizedText value="❌ 錯題：" /><LocalizedText value={wrongCount} /></span>
          {longCount > 0 && (
            <span style={{ color: '#0369a1' }}><LocalizedText value="📖 自我核對：" /><LocalizedText value={longCount} /></span>
          )}
        </div>
      </div>

      {allQuestions.map((q, i) => {
        const isCorrect = q.is_correct === true;
        const isLong = q.question_type === 'Long';
        const optionsMap = extractOptions(q);
        const letters = ['A', 'B', 'C', 'D', 'E'].filter(l => Boolean(optionsMap[l]));
        const correctLetter = String(q.correct_answer || q.answer || '').trim().toUpperCase();

        return (
          <div
            key={i}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 20,
              marginBottom: 16,
              borderLeft: `6px solid ${isCorrect ? '#10b981' : (isLong ? '#0ea5e9' : '#ef4444')}`,
              boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
            }}
          >
            {/* 标题行 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-start' }}>
              <div>
                <h4 style={{ margin: 0 }}><LocalizedText value={q.question_number || `第 ${i + 1} 題`} /></h4>
                <span style={{
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: '0.75rem',
                  marginTop: 4,
                  display: 'inline-block'
                }}>
                  <LocalizedText value={CATEGORY_MAP[q.main_category] || q.main_category} />
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  background: isCorrect ? '#dcfce7' : (isLong ? '#e0f2fe' : '#fee2e2'),
                  color: isCorrect ? '#15803d' : (isLong ? '#0369a1' : '#b91c1c'),
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}>
                  <LocalizedText value={isCorrect ? '✅ 答對' : (isLong ? '📖 自我核對' : '❌ 答錯')} />
                </span>
                <FavoriteButton
                  question={q}
                  questionId={q.id || `${q.question_number}-${q.raw_text_zh?.slice(0, 20)}`}
                />
              </div>
            </div>

            {/* 题干 */}
            <div style={{ lineHeight: 1.8, marginBottom: 16 }}>
              <LocalizedMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                {normalizeLatex(getQuestionText(q))}
              </LocalizedMarkdown>
            </div>

            {/* 選項列表（MCQ 才顯示） */}
            {letters.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {letters.map(letter => {
                  const isRightAnswer = letter === correctLetter;
                  return (
                    <div
                      key={letter}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '10px 14px',
                        background: isRightAnswer ? '#dcfce7' : '#f8fafc',
                        border: `1.5px solid ${isRightAnswer ? '#10b981' : '#e2e8f0'}`,
                        borderRadius: 8,
                        fontSize: '0.95rem',
                        lineHeight: 1.6,
                      }}
                    >
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        background: isRightAnswer ? '#10b981' : '#2563eb',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        borderRadius: '50%',
                        flexShrink: 0,
                        marginTop: 2,
                      }}>
                        <LocalizedText value={letter} />
                      </span>
                      <div style={{ flex: 1, color: isRightAnswer ? '#15803d' : '#1e293b', wordBreak: 'break-word' }}>
                        <LocalizedMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                          {normalizeLatex(optionsMap[letter])}
                        </LocalizedMarkdown>
                      </div>
                      {isRightAnswer && (
                        <span style={{ color: '#15803d', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}><LocalizedText value="✅ 正確" /></span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 你的作答 vs 正确答案 */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{
                flex: 1,
                minWidth: 180,
                padding: 12,
                background: isCorrect ? '#dcfce7' : (isLong ? '#fffbeb' : '#fee2e2'),
                borderRadius: 8,
                color: isCorrect ? '#15803d' : (isLong ? '#78350f' : '#b91c1c')
              }}>
                <strong><LocalizedText value="你的作答：" /></strong> <LocalizedText value={q.user_answer || '(未作答)'} />
              </div>
              <div style={{
                flex: 1,
                minWidth: 180,
                padding: 12,
                background: '#f0f9ff',
                borderRadius: 8,
                color: '#0c4a6e'
              }}>
                <strong><LocalizedText value="正確答案：" /></strong>
                <div style={{ marginTop: 6 }}>
                  <LocalizedMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                    {normalizeLatex(getQuestionAnswer(q) || '(無答案)')}
                  </LocalizedMarkdown>
                </div>
              </div>
            </div>

            {/* 解析 */}
            {getQuestionSolution(q) && (
              <details style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }} open={!isCorrect}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#0369a1' }}><LocalizedText value="💡 查看解題步驟" /></summary>
                <div style={{ marginTop: 12, lineHeight: 1.8 }}>
                  <LocalizedMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                    {normalizeLatex(getQuestionSolution(q))}
                  </LocalizedMarkdown>
                </div>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}