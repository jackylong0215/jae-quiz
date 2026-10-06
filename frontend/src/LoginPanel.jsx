import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function LoginPanel({ isOpen, onClose, onAuthChange }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('login'); // 'login', 'register', 'profile'
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  // Login form state
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFullName, setRegFullName] = useState('');
    // 👁️ 密碼可見性
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);

  // 讀取本地 localStorage 的登入狀態
  useEffect(() => {
    const savedUser = localStorage.getItem('jae_user');
    const savedToken = localStorage.getItem('jae_token');
    if (savedUser && savedToken) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        setTab('profile');
      } catch (e) {
        localStorage.removeItem('jae_user');
        localStorage.removeItem('jae_token');
      }
    }
  }, [isOpen]);

  // 載入歷史測驗
  const fetchHistory = async () => {
    const token = localStorage.getItem('jae_token');
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/user/quiz-history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data.history || []);
    } catch (e) {
      console.error('Fetch history error:', e);
    }
  };

  useEffect(() => {
    if (tab === 'profile' && user) {
      fetchHistory();
    }
  }, [tab, user]);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, {
        username: loginId,
        password: loginPassword,
      });
      const { access_token, user: userData } = res.data;
      localStorage.setItem('jae_token', access_token);
      localStorage.setItem('jae_user', JSON.stringify(userData));
      setUser(userData);
      setTab('profile');
      if (onAuthChange) onAuthChange(userData);
    } catch (err) {
      setError(err.response?.data?.detail || '登入失敗，請確認帳號密碼');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/register`, {
        username: regUsername,
        email: regEmail,
        password: regPassword,
        full_name: regFullName,
      });
      const { access_token, user: userData } = res.data;
      localStorage.setItem('jae_token', access_token);
      localStorage.setItem('jae_user', JSON.stringify(userData));
      setUser(userData);
      setTab('profile');
      if (onAuthChange) onAuthChange(userData);
    } catch (err) {
      setError(err.response?.data?.detail || '註冊失敗，請更換用戶名或郵箱');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jae_token');
    localStorage.removeItem('jae_user');
    setUser(null);
    setTab('login');
    if (onAuthChange) onAuthChange(null);
  };

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="login-modal-header">
          <div className="login-modal-title">
            {user ? '👤 用戶中心與測驗記錄' : '🔐 澳門四校聯考考生系統'}
          </div>
          <button className="login-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tab Buttons (if not logged in) */}
        {!user ? (
          <div className="login-tab-bar">
            <button
              className={`login-tab-btn ${tab === 'login' ? 'active' : ''}`}
              onClick={() => { setTab('login'); setError(''); }}
            >
              已有帳號 登入
            </button>
            <button
              className={`login-tab-btn ${tab === 'register' ? 'active' : ''}`}
              onClick={() => { setTab('register'); setError(''); }}
            >
              新考生 註冊
            </button>
          </div>
        ) : null}

        {error && <div className="login-error-box">⚠️ {error}</div>}

        {/* Tab 1: Login */}
        {!user && tab === 'login' && (
          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label>用戶名 或 註冊郵箱：</label>
              <input
                type="text"
                required
                placeholder="請輸入用戶名或郵箱"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="login-input"
              />
            </div>
                        <div className="form-group">
              <label>密碼：</label>
              <div className="password-input-wrapper">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  placeholder="請輸入密碼"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="login-input password-input"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  aria-label={showLoginPassword ? '隱藏密碼' : '顯示密碼'}
                  tabIndex={-1}
                >
                  {showLoginPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="login-submit-btn">
              {loading ? '正在登入...' : '立即登入'}
            </button>
            <div className="login-hint">
              💡 登入後可持久化儲存每次 Quiz 測驗成績與 AI 弱點診斷報告。
            </div>
          </form>
        )}

        {/* Tab 2: Register */}
        {!user && tab === 'register' && (
          <form onSubmit={handleRegister} className="login-form">
            <div className="form-group">
              <label>用戶名 (唯一帳號)：</label>
              <input
                type="text"
                required
                placeholder="英文或拼音帳號"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                className="login-input"
              />
            </div>
            <div className="form-group">
              <label>電子郵箱：</label>
              <input
                type="email"
                required
                placeholder="student@example.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="login-input"
              />
            </div>
            <div className="form-group">
              <label>學生姓名 / 稱呼：</label>
              <input
                type="text"
                placeholder="例如：陳同學"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                className="login-input"
              />
            </div>
                        <div className="form-group">
              <label>設置密碼 (至少 6 位)：</label>
              <div className="password-input-wrapper">
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  placeholder="請設置密碼"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="login-input password-input"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  aria-label={showRegPassword ? '隱藏密碼' : '顯示密碼'}
                  tabIndex={-1}
                >
                  {showRegPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="login-submit-btn">
              {loading ? '正在註冊...' : '免費創建帳號'}
            </button>
          </form>
        )}

        {/* Tab 3: Profile & Quiz History */}
        {user && (
          <div className="profile-container">
            <div className="profile-info-card">
              <div className="profile-name">
                  {user.is_admin ? '👑 ' : '🎓 '}
                  歡迎回來，<strong>{user.full_name || user.username}</strong>！
                  {user.is_admin && (
                    <span className="admin-badge">管理員</span>
                  )}
                </div>
              <div className="profile-meta">
                帳號：{user.username} ‧ 郵箱：{user.email}
                {user.is_admin && ' ‧ 權限：管理員'}
              </div>
              {user.is_admin && (
  <button
    className="logout-btn"
    style={{
      background: '#fef3c7',
      color: '#92400e',
      borderColor: '#fcd34d',
      marginRight: 8,
    }}
    onClick={() => {
      onClose();
      window.location.href = '/admin';
    }}
  >
    👑 管理後台
  </button>
)}
              <button onClick={handleLogout} className="logout-btn">
                🚪 登出當前帳號
              </button>
            </div>

            <div className="history-section-title">
              📜 我的歷史測驗記錄 ({history.length} 次)：
            </div>

            {history.length === 0 ? (
              <div className="empty-history-hint">
                尚無測驗記錄，前往「開始測驗」完成一次模擬考即可自動在此歸檔！
              </div>
            ) : (
              <div className="history-list-box no-scrollbar">
                {history.map((h, idx) => (
                  <div
                    key={idx}
                    className="history-item-card clickable"
                    onClick={() => {
                      onClose();
                      navigate(`/review/${h.quiz_id}`);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="history-item-top">
                      <span className="history-date">📅 {h.created_at}</span>
                      <span className="history-score-badge" style={{
                        background: h.score_percent >= 80 ? '#10b981' : h.score_percent >= 50 ? '#f59e0b' : '#ef4444'
                      }}>
                        {h.score_percent}% 得分 ({h.correct_count}/{h.total_count} 題)
                      </span>
                    </div>
                    {h.category_breakdown && Object.keys(h.category_breakdown).length > 0 && (
                      <div className="history-breakdown-tags">
                        {Object.entries(h.category_breakdown).map(([cat, st], ci) => (
                          <span key={ci} className="history-cat-tag">
                            {cat}: {st.percent}%
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#2563eb', fontWeight: 600 }}>
                      點此查看錯題回顧 →
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .login-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 16px;
        }
        .login-modal-card {
          background: #ffffff;
          width: 100%;
          max-width: 480px;
          border-radius: 16px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
          overflow: hidden;
          animation: popIn 0.2s ease-out;
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .login-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .login-modal-title {
          font-weight: 700;
          font-size: 1.1rem;
          color: #1e293b;
        }
        .login-modal-close {
          background: none;
          border: none;
          font-size: 1.25rem;
          cursor: pointer;
          color: #64748b;
        }
        .login-tab-bar {
          display: flex;
          border-bottom: 1px solid #e2e8f0;
        }
        .login-tab-btn {
          flex: 1;
          padding: 12px;
          background: #f1f5f9;
          border: none;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
        }
        .login-tab-btn.active {
          background: #fff;
          color: #2563eb;
          border-bottom: 2px solid #2563eb;
        }
        .login-error-box {
          margin: 12px 20px 0;
          padding: 10px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          border-radius: 8px;
          font-size: 0.9rem;
        }
        .login-form {
          padding: 20px;
        }
        .form-group {
          margin-bottom: 14px;
        }
        .form-group label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          color: #475569;
          margin-bottom: 6px;
        }
        .login-input {
          width: 100%;
          padding: 10px 12px;
          border: 1.5px solid #cbd5e1;
          border-radius: 8px;
          font-size: 0.95rem;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.2s;
        }
                  .password-input-wrapper {
          position: relative;
          width: 100%;
        }

        .password-input-wrapper .password-input {
          padding-right: 44px;   /* 給眼睛按鈕留空間 */
        }

        .password-toggle-btn {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 1.1rem;
          line-height: 1;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
          opacity: 0.75;
        }

        .password-toggle-btn:hover {
          background: #f1f5f9;
          opacity: 1;
        }

        .password-toggle-btn:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }
        .login-input:focus {
          border-color: #2563eb;
        }
          
        .login-submit-btn {
          width: 100%;
          padding: 12px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          margin-top: 10px;
        }
        .login-submit-btn:disabled {
          background: #94a3b8;
        }
        .login-hint {
          font-size: 0.8rem;
          color: #64748b;
          margin-top: 12px;
          line-height: 1.4;
        }
        .profile-container {
          padding: 20px;
        }
        .profile-info-card {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 16px;
        }
        .profile-name {
          font-size: 1.05rem;
          color: #0369a1;
          margin-bottom: 4px;
        }
        .admin-badge {
        display: inline-block;
        margin-left: 8px;
        padding: 2px 10px;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: #ffffff;
        border-radius: 12px;
        font-size: 0.7rem;
        font-weight: 700;
        vertical-align: middle;
      }
        .profile-meta {
          font-size: 0.85rem;
          color: #0284c7;
          margin-bottom: 12px;
        }
        .logout-btn {
          padding: 6px 14px;
          background: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fca5a5;
          border-radius: 6px;
          font-size: 0.85rem;
          cursor: pointer;
          font-weight: 600;
        }
        .history-section-title {
          font-weight: 700;
          font-size: 0.95rem;
          color: #334155;
          margin-bottom: 10px;
        }
        .empty-history-hint {
          padding: 20px;
          text-align: center;
          color: #94a3b8;
          font-size: 0.9rem;
          background: #f8fafc;
          border-radius: 8px;
        }
        .history-list-box {
          max-height: 240px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .history-item-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 14px;
        }
        .history-item-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .history-date {
          font-size: 0.8rem;
          color: #64748b;
        }
        .history-score-badge {
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .history-breakdown-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .history-cat-tag {
          font-size: 0.75rem;
          background: #e2e8f0;
          padding: 2px 6px;
          border-radius: 4px;
          color: #475569;
        }
      `}</style>
    </div>
  );
}
