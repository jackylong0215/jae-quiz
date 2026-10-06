import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import axios from 'axios';
import 'katex/dist/katex.min.css';
import FavoriteButton from './FavoriteButton.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`;
const rehypeKatexOptions = [rehypeKatex, { output: 'html' }];

function normalizeLatex(text) {
  if (!text) return '';
  return String(text).replace(/\\n/g, '\n');
}

export default function FavoritesPage() {
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

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>載入中...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#b91c1c' }}>⚠️ {error}</div>;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/browse')}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f1f5f9', cursor: 'pointer', fontWeight: 600 }}
        >
          ← 返回題庫
        </button>
        <h2 style={{ margin: 0 }}>⭐ 我的收藏 ({favorites.length})</h2>
      </div>

      {favorites.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: '#fef3c7', borderRadius: 12, color: '#92400e' }}>
          尚無收藏題目。瀏覽題庫時點擊 ☆ 即可收藏。
        </div>
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
                  <h4 style={{ margin: 0 }}>{q.question_number || `題目 ${i + 1}`}</h4>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
                    收藏於 {f.created_at}
                  </div>
                </div>
                <FavoriteButton question={q} questionId={f.question_id} size="large" />
              </div>

              <div style={{ lineHeight: 1.8, marginBottom: 12 }}>
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                  {normalizeLatex(q.raw_text_zh || q.raw_text_en || '')}
                </ReactMarkdown>
              </div>

              {q.answer && (
                <details style={{ marginTop: 12, background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#0369a1' }}>💡 查看答案與解析</summary>
                  <div style={{ marginTop: 10, lineHeight: 1.7 }}>
                    <div style={{ color: '#15803d', marginBottom: 8 }}>
                      <strong>正確答案：</strong> {q.answer}
                    </div>
                    {q.solution && (
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                        {normalizeLatex(q.solution)}
                      </ReactMarkdown>
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