import { LocalizedText, LocalizedMarkdown, useLocale, getQuestionText, getQuestionSolution, questionOptions } from './i18n.jsx';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { api as axios } from './i18n-api.js';
import 'katex/dist/katex.min.css';
import FavoriteButton from './FavoriteButton.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`;
const rehypeKatexOptions = [rehypeKatex, { output: 'html' }];

function normalizeLatex(text) {
  if (!text) return '';
  return String(text).replace(/\\n/g, '\n');
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

export default function FavoritesPage() {
  useLocale();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('jae_token');
    if (!token) {
      setError('請先登入');
      setLoading(false);
      return;
    }

    axios.get(`${API_BASE_URL}/user/favorites`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => setFavorites(res.data.favorites || []))
      .catch(err => setError(err.response?.data?.detail || '載入失敗'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><LocalizedText value="載入中..." /></div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#b91c1c' }}>⚠️ <LocalizedText value={error} /></div>;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/browse')}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f1f5f9', cursor: 'pointer', fontWeight: 600 }}
        ><LocalizedText value="← 返回題庫" /></button>
        <h2 style={{ margin: 0 }}><LocalizedText value="⭐ 我的收藏 (" /><LocalizedText value={favorites.length} />)</h2>
      </div>

      {favorites.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: '#fef3c7', borderRadius: 12, color: '#92400e' }}><LocalizedText value="尚無收藏題目。瀏覽題庫時點擊 ☆ 即可收藏。" /></div>
      ) : (
        favorites.map((f, i) => {
          const q = f.question;
          return (
            <div key={i} style={{
              background: '#fff',
              borderRadius: 12,
              padding: 20,
              marginBottom: 16,
              border: '1px solid #e2e8f0',
              borderLeft: '6px solid #f59e0b',
              boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: 0 }}><LocalizedText value={q.question_number || `題目 ${i + 1}`} /></h4>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}><LocalizedText value="收藏於" /><LocalizedText value={f.created_at} />
                  </div>
                </div>
                <FavoriteButton question={q} questionId={f.question_id} size="large" />
              </div>

              <div style={{ lineHeight: 1.8, marginBottom: 12 }}>
                <LocalizedMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                  {normalizeLatex(getQuestionText(q))}
                </LocalizedMarkdown>
              </div>

              {/* 選項列表（MCQ 才顯示） */}
              {(() => {
                const optionsMap = extractOptions(q);
                const letters = ['A', 'B', 'C', 'D', 'E'].filter(l => Boolean(optionsMap[l]));
                if (letters.length === 0) return null;
                
                const correctLetter = String(q.answer || q.correct_answer || '').trim().toUpperCase();
                
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
                            <LocalizedText value={letter} />
                          </span>
                          <div style={{ flex: 1, color: isCorrect ? '#15803d' : '#1e293b', wordBreak: 'break-word' }}>
                            <LocalizedMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                              {normalizeLatex(optionsMap[letter])}
                            </LocalizedMarkdown>
                          </div>
                          {isCorrect && (
                            <span style={{ color: '#15803d', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}><LocalizedText value="✅ 正確" /></span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {q.answer && (
                <details style={{ marginTop: 12, background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#0369a1' }}><LocalizedText value="💡 查看答案與解析" /></summary>
                  <div style={{ marginTop: 10, lineHeight: 1.7 }}>
                    <div style={{ color: '#15803d', marginBottom: 8 }}>
                      <strong><LocalizedText value="正確答案：" /></strong> <LocalizedText value={q.answer} />
                    </div>
                    {getQuestionSolution(q) && (
                      <LocalizedMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                        {normalizeLatex(getQuestionSolution(q))}
                      </LocalizedMarkdown>
                    )}
                  </div>
                </details>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}