import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const navigate = useNavigate();
  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('jae_user'));
    } catch {
      return null;
    }
  });

  return (
    <div className="home-page">
      {/* 背景裝飾 */}
      <div className="home-bg-blob blob-1" />
      <div className="home-bg-blob blob-2" />
      <div className="home-bg-blob blob-3" />

      <div className="home-hero">
        {/* Badge */}
        <div className="home-badge">
          <span className="badge-dot" />
          澳門四校聯考 (JAE)
        </div>

        {/* 大標題 */}
        <h1 className="home-title">四校勝券</h1>

        {/* 副標題 */}
        <p className="home-subtitle">
          2017–2026 年數學正卷、附加卷、模擬試題
          <br />
          共 <strong>11 套 245 題</strong>，附完整答案與解析
        </p>

        {/* 特色標籤 */}
        <div className="home-features">
          <span className="feature-chip">📖 歷屆真題</span>
          <span className="feature-chip">✏️ 模擬測驗</span>
          <span className="feature-chip">📊 弱點分析</span>
          <span className="feature-chip">🔍 逐題詳解</span>
        </div>

        

        {/* 登入狀態 */}
        <div className="home-footer">
          {user ? (
            <span className="user-status logged-in">
              👤 已登入：{user.full_name || user.username}
              {user.is_admin && <span className="admin-tag">管理員</span>}
            </span>
          ) : (
            <span className="user-status">
              未登入也可以練習，登入後可儲存測驗紀錄
            </span>
          )}
        </div>
      </div>

      {/* ===== 使用教學 ===== */}
      <div className="tutorial-section">
        <h2 className="tutorial-title">
          <span className="tutorial-title-icon">🎯</span>
          三步驟，開始你的備考
        </h2>

        <div className="tutorial-grid">
          <div className="tutorial-step">
            <div className="step-number">1</div>
            <div className="step-icon">📚</div>
            <h3 className="step-title">挑選試卷</h3>
            <p className="step-desc">
              從 2017–2026 年的正卷、附加卷、模擬試題中選擇。
            </p>
          </div>

          <div className="tutorial-step">
            <div className="step-number">2</div>
            <div className="step-icon">✏️</div>
            <h3 className="step-title">開始作答</h3>
            <p className="step-desc">
              用篩選器挑選科目與難度，然後進入限時模擬測驗，模擬真實考試節奏。
            </p>
          </div>

          <div className="tutorial-step">
            <div className="step-number">3</div>
            <div className="step-icon">📊</div>
            <h3 className="step-title">檢視分析</h3>
            <p className="step-desc">
              交卷後立即看到逐題對錯、標準答案、詳細步驟解析與弱點診斷報告。
            </p>
          </div>
        </div>

        {/* 額外提示 */}
        <div className="tutorial-tips">
          <div className="tip-item">
            <span className="tip-icon">💡</span>
            <span className="tip-text">
              <strong>技巧：</strong>點擊題號導航列可快速跳至特定題目。
            </span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">🎓</span>
            <span className="tip-text">
              <strong>建議：</strong>註冊帳號後，測驗紀錄會自動歸檔，方便追蹤進度。
            </span>
          </div>
        </div>

{/* CTA */}
<div className="tutorial-cta">
  <button
    className="cta-btn"
    onClick={() => navigate('/browse')}
  >
    📖 開始練習
  </button>
  <button
    className="cta-btn secondary-cta"
    onClick={() => navigate('/favorites')}
  >
    ⭐ 我的收藏
  </button>
</div>
      </div>

      {/* ===== CSS ===== */}
      <style>{`
.home-page {
  min-height: 100vh;
  width: 100vw;
  margin-left: calc(-50vw + 50%);
  margin-right: calc(-50vw + 50%);
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #f0f9ff 0%, #e0e7ff 100%);
}

.home-bg-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
  pointer-events: none;
  z-index: 0;
  animation: blobFloat 20s ease-in-out infinite;
}

@keyframes blobFloat {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -20px) scale(1.05); }
  66% { transform: translate(-20px, 30px) scale(0.95); }
}
        .blob-1 {
          width: 400px;
          height: 400px;
          background: #93c5fd;
          top: -100px;
          left: -100px;
        }
        .blob-2 {
          width: 350px;
          height: 350px;
          background: #c4b5fd;
          top: 100px;
          right: -80px;
        }
        .blob-3 {
          width: 300px;
          height: 300px;
          background: #a5f3fc;
          bottom: 200px;
          left: 30%;
        }

        /* Hero 區 */
        .home-hero {
          position: relative;
          z-index: 1;
          max-width: 640px;
          margin: 0 auto;
          padding: 80px 24px 40px;
          text-align: center;
        }

        .home-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          background: #ffffff;
          color: #3730a3;
          border-radius: 24px;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 20px;
          box-shadow: 0 2px 10px rgba(55, 48, 163, 0.1);
          border: 1px solid #c7d2fe;
            animation: badgeFloat 3s ease-in-out infinite;
        }
        @keyframes badgeFloat {
        0%, 100% { transform: translateY(0); box-shadow: 0 2px 10px rgba(55, 48, 163, 0.1); }
        50% { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(55, 48, 163, 0.2); }
      }
        .badge-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

.home-title {
  font-size: 4rem;
  font-weight: 900;
  margin: 0 0 20px;
  letter-spacing: 4px;
  line-height: 1.1;
  background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 25%, #7c3aed 50%, #2563eb 75%, #1e3a8a 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: titleShine 6s linear infinite;
}

@keyframes titleShine {
  0% { background-position: 0% center; }
  100% { background-position: 200% center; }
}

        .home-subtitle {
          color: #334155;
          font-size: 1.35rem;
          font-weight: 500;
          line-height: 1.9;
          margin: 0 0 32px;
          letter-spacing: 0.5px;
        }
        .home-subtitle strong {
          color: #2563eb;
          font-weight: 800;
          font-size: 1.5rem;
        }

.home-features {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-bottom: 32px;
}

.feature-chip {
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid #e0e7ff;
  border-radius: 20px;
  font-size: 0.85rem;
  color: #4338ca;
  font-weight: 500;
  backdrop-filter: blur(10px);
  opacity: 0;
  animation: chipFadeIn 0.5s ease-out forwards;
}

.feature-chip:nth-child(1) { animation-delay: 0.1s; }
.feature-chip:nth-child(2) { animation-delay: 0.2s; }
.feature-chip:nth-child(3) { animation-delay: 0.3s; }
.feature-chip:nth-child(4) { animation-delay: 0.4s; }

@keyframes chipFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

        /* 按鈕區 */
        .home-actions {
          display: flex;
          gap: 14px;
          justify-content: center;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }
        .home-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 28px;
          border-radius: 14px;
          cursor: pointer;
          border: none;
          font-size: 1rem;
          transition: all 0.2s ease;
          text-align: left;
          min-width: 220px;
        }
        .home-btn.primary {
          background: linear-gradient(135deg, #2563eb, #4f46e5);
          color: #ffffff;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
        }
        .home-btn.secondary {
          background: #ffffff;
          color: #2563eb;
          border: 2px solid #bfdbfe;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
        .home-btn:hover {
          transform: translateY(-3px);
        }
        .home-btn.primary:hover {
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.4);
        }
        .home-btn.secondary:hover {
          border-color: #2563eb;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.15);
        }
        .btn-icon {
          font-size: 1.6rem;
          flex-shrink: 0;
        }
        .btn-text {
          display: flex;
          flex-direction: column;
          line-height: 1.3;
        }
        .btn-title {
          font-weight: 700;
          font-size: 1rem;
        }
        .btn-sub {
          font-size: 0.78rem;
          opacity: 0.85;
          font-weight: 400;
        }

        /* 登入狀態 */
        .home-footer {
          font-size: 0.9rem;
        }
        .user-status {
          color: #2c3849;
          font-weight: 500;
          font-size: 1.1rem;
        }
        .user-status.logged-in {
          color: #15803d;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .admin-tag {
          padding: 2px 10px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: #ffffff;
          border-radius: 12px;
          font-size: 0.7rem;
          font-weight: 700;
        }

        /* ===== 使用教學區 ===== */
        .tutorial-section {
          position: relative;
          z-index: 1;
          max-width: 1000px;
          margin: 40px auto 0;
          padding: 48px 24px 60px;
          background: #ffffff;
          border-radius: 32px 32px 0 0;
          box-shadow: 0 -8px 30px rgba(30, 58, 138, 0.08);
        }

        .tutorial-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-size: 1.75rem;
          font-weight: 800;
          color: #1e293b;
          margin: 0 0 40px;
          text-align: center;
        }
        .tutorial-title-icon {
          font-size: 1.5rem;
        }

        .tutorial-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-bottom: 32px;
        }
        @media (max-width: 768px) {
          .tutorial-grid {
            grid-template-columns: 1fr;
          }
        }

        .tutorial-step {
          position: relative;
          padding: 32px 24px 24px;
          background: linear-gradient(180deg, #f8fafc 0%, #f0f9ff 100%);
          border: 1px solid #e0e7ff;
          border-radius: 20px;
          text-align: center;
          transition: all 0.25s;
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .tutorial-step:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(37, 99, 235, 0.12);
          border-color: #93c5fd;
            background: linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%);
        }

        .step-number {
          position: absolute;
          top: -16px;
          left: 50%;
          transform: translateX(-50%);
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #2563eb, #4f46e5);
          color: #ffffff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1rem;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
  animation: numberPulse 2.5s ease-in-out infinite;

        }


@keyframes numberPulse {
  0%, 100% { box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35); }
  50% { box-shadow: 0 4px 20px rgba(37, 99, 235, 0.65); }
}

        .step-icon {
          font-size: 2.5rem;
          margin: 8px 0 12px;
        }

        .step-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 10px;
        }
        .step-desc {
          font-size: 0.9rem;
          color: #64748b;
          line-height: 1.7;
          margin: 0;
        }

        /* 提示區 */
.tutorial-tips {
  display: flex;
  flex-direction: column;   /* ← 改成纵向排列 */
  align-items: center;      /* 居中 */
  gap: 16px;                /* 行间距 */
  padding: 30px;
  background: #fffbeb;
  border: 5px solid #fef3c7;
  border-radius: 16px;
  margin-bottom: 32px;
}
        .tip-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.9rem;
          color: #78350f;
        }
        .tip-icon {
          font-size: 1.2rem;
        }
        .tip-text strong {
          color: #92400e;
          font-weight: 700;
        }

        /* CTA */
.tutorial-cta {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.secondary-cta {
  background: #ffffff !important;
  color: #2563eb !important;
  border: 2px solid #bfdbfe !important;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1) !important;
  animation: none !important;
  padding: 16px 36px !important;
  font-size: 1.05rem !important;
}

.secondary-cta:hover {
  border-color: #2563eb !important;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.2) !important;
  transform: translateY(-3px);
}
                .cta-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 18px 48px;
          background: linear-gradient(135deg, #2563eb, #4f46e5);
          color: #ffffff;
          border: none;
          border-radius: 16px;
          font-size: 1.15rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(37, 99, 235, 0.35);
          transition: all 0.2s;
          letter-spacing: 1px;
          animation: breathe 2.5s ease-in-out infinite;
        }
@keyframes breathe {
  0%, 100% {
    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.35);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 14px 40px rgba(37, 99, 235, 0.6);
    transform: scale(1.02);
  }
}
        .cta-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 14px 32px rgba(37, 99, 235, 0.45);
        }
        .cta-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(16, 185, 129, 0.4);
        }

        /* 手機版調整 */
        @media (max-width: 640px) {
          .home-hero {
            padding: 48px 20px 24px;
          }
          .home-subtitle {
            font-size: 1.15rem;
            line-height: 1.8;
          }
          .home-subtitle strong {
            font-size: 1.25rem;
          }
          .home-btn {
            min-width: 100%;
            width: 100%;
          }
          .tutorial-section {
            padding: 32px 16px 40px;
          }
          .tutorial-title {
            font-size: 1.4rem;
          }
          .tutorial-tips {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}