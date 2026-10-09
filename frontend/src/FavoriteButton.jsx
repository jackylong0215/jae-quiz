import { LocalizedAttributes } from './i18n.jsx';
import { LocalizedText, useLocale, t } from './i18n.jsx';
import React, { useState, useEffect } from 'react';
import { api as axios } from './i18n-api.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`;

export default function FavoriteButton({ question, questionId, size = 'normal' }) {
  useLocale();
  const [isFav, setIsFav] = useState(false);
  const [loading, setLoading] = useState(false);

  // 檢查是否已收藏（從 localStorage 快取 + 後端確認）
  useEffect(() => {
    const token = localStorage.getItem('jae_token');
    if (!token || !questionId) return;
    
    // 先從 localStorage 快速判斷
    const cached = JSON.parse(localStorage.getItem('jae_favorites') || '[]');
    setIsFav(cached.includes(questionId));
    
    // 後端確認
    axios.get(`${API_BASE_URL}/user/favorites`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        const favIds = (res.data.favorites || []).map(f => f.question_id);
        localStorage.setItem('jae_favorites', JSON.stringify(favIds));
        setIsFav(favIds.includes(questionId));
      })
      .catch(() => {});
  }, [questionId]);

  const toggleFavorite = async () => {
    const token = localStorage.getItem('jae_token');
    if (!token) {
      alert(t('請先登入才能收藏題目'));
      return;
    }
    if (!questionId) {
      alert(t('此題目缺少 ID，無法收藏'));
      return;
    }

    setLoading(true);
    try {
        if (isFav) {
        await axios.delete(`${API_BASE_URL}/user/favorites`, {
            params: { question_id: questionId },
            headers: { Authorization: `Bearer ${token}` }
        });
        setIsFav(false);
        // 更新快取
        const cached = JSON.parse(localStorage.getItem('jae_favorites') || '[]');
        localStorage.setItem('jae_favorites', JSON.stringify(cached.filter(id => id !== questionId)));
      } else {
        await axios.post(`${API_BASE_URL}/user/favorites`, {
          question_id: questionId,
          question_json: question,
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setIsFav(true);
        // 更新快取
        const cached = JSON.parse(localStorage.getItem('jae_favorites') || '[]');
        if (!cached.includes(questionId)) {
          cached.push(questionId);
          localStorage.setItem('jae_favorites', JSON.stringify(cached));
        }
      }
    } catch (err) {
      console.error('Toggle favorite failed:', err);
      alert(t('操作失敗：' + (err.response?.data?.detail || err.message)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LocalizedAttributes><button
      type="button"
      className={`favorite-btn ${isFav ? 'active' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite();
      }}
      disabled={loading}
      title={isFav ? '取消收藏' : '收藏此題'}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: loading ? 'wait' : 'pointer',
        fontSize: size === 'large' ? '1.5rem' : '1.2rem',
        padding: '4px 8px',
        borderRadius: '6px',
        transition: 'all 0.15s',
        opacity: loading ? 0.5 : 1,
      }}
    >
      <LocalizedText value={isFav ? '⭐' : '☆'} />
    </button></LocalizedAttributes>
  );
}