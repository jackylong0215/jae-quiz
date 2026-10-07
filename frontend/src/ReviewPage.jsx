import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import axios from 'axios';
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
  const raw = q.options_zh || q.options || q.options_en;
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
          err.response?.status === 401 ? '請先登入才能查看錯題回顧' :
          err.response?.status === 404 ? '找不到此測驗記錄（可能未登入時建立，或 ID 不符）' :
          (err.response?.data?.detail || err.message || '載入失敗')
        );
      })
      .finally(() => setLoading(false));
  }, [quizId]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>載入中...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#b91c1c' }}>⚠️ {error}</div>;
  if (!review) return null;

  const allQuestions = review.questions || [];
  const wrongCount = allQuestions.filter(q => q.is_correct === false).length;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/browse')}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f1f5f9', cursor: 'pointer', fontWeight: 600 }}
        >
          ← 返回題庫
        </button>
        <h2 style={{ margin: 0 }}>🔍 測驗回顧</h2>
      </div>

      <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>📅 {review.created_at}</span>
          <span>🎯 得分：{review.score_percent}%</span>
          <span style={{ color: '#15803d' }}>✅ 答對：{review.correct_count}/{review.total_count}</span>
          <span style={{ color: '#b91c1c' }}>❌ 錯題：{wrongCount}</span>
        </div>
      </div>

      {allQuestions.map((q, i) => {
        const isCorrect = q.is_correct === true;
        const isLong = q.question_type === 'Long';

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
                <h4 style={{ margin: 0 }}>{q.question_number || `第 ${i + 1} 題`}</h4>
                <span style={{
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: '0.75rem',
                  marginTop: 4,
                  display: 'inline-block'
                }}>
                  {CATEGORY_MAP[q.main_category] || q.main_category}
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
                  {isCorrect ? '✅ 答對' : (isLong ? '📖 自我核對' : '❌ 答錯')}
                </span>
                <FavoriteButton
                  question={q}
                  questionId={q.id || `${q.question_number}-${q.raw_text_zh?.slice(0, 20)}`}
                />
              </div>
            </div>

            {/* 题干 */}
            <div style={{ lineHeight: 1.8, marginBottom: 16 }}>
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                {normalizeLatex(q.raw_text_zh || q.raw_text_en || '')}
              </ReactMarkdown>
            </div>
            {/* 選項列表（MCQ 才顯示） */}
{(() => {
  const optionsMap = extractOptions(q);
  const letters = ['A', 'B', 'C', 'D', 'E'].filter(l => Boolean(optionsMap[l]));
  if (letters.length === 0) return null;
  
  const correctLetter = String(q.correct_answer || '').trim().toUpperCase();
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      {letters.map(letter => {
        const isCorrect = letter === correctLetter;
        return (
          <div
            key={letter}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 14px',
              background: isCorrect ? '#dcfce7' : '#f8fafc',
              border: `1.5px solid ${isCorrect ? '#10b981' : '#e2e8f0'}`,
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
              background: isCorrect ? '#10b981' : '#2563eb',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.8rem',
              borderRadius: '50%',
              flexShrink: 0,
              marginTop: 2,
            }}>
              {letter}
            </span>
            <div style={{ flex: 1, color: isCorrect ? '#15803d' : '#1e293b', wordBreak: 'break-word' }}>
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                {normalizeLatex(optionsMap[letter])}
              </ReactMarkdown>
            </div>
            {isCorrect && (
              <span style={{ color: '#15803d', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                ✅ 正確
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
})()}

            {/* 你的作答 vs 正确答案 */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{
                flex: 1,
                minWidth: 180,
                padding: 12,
                background: isCorrect ? '#dcfce7' : '#fee2e2',
                borderRadius: 8,
                color: isCorrect ? '#15803d' : '#b91c1c'
              }}>
                <strong>你的作答：</strong> {q.user_answer || '(未作答)'}
              </div>
              <div style={{
                flex: 1,
                minWidth: 180,
                padding: 12,
                background: '#f0f9ff',
                borderRadius: 8,
                color: '#0c4a6e'
              }}>
                <strong>正確答案：</strong>
                <div style={{ marginTop: 6 }}>
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                    {normalizeLatex(q.correct_answer || '(無答案)')}
                  </ReactMarkdown>
                </div>
              </div>
            </div>

            {/* 解析 */}
            {q.solution && (
              <details style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }} open={!isCorrect}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#0369a1' }}>
                  💡 查看解題步驟
                </summary>
                <div style={{ marginTop: 12, lineHeight: 1.8 }}>
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                    {normalizeLatex(q.solution)}
                  </ReactMarkdown>
                </div>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}