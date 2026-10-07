import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginPanel from './LoginPanel.jsx';

/* ==================== SVG 圖示 ==================== */
const IconBook = () => (
  <svg width="72" height="72" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="10" y="10" width="44" height="44" rx="4" />
    <path d="M18 22h28M18 30h28M18 38h20" />
    <circle cx="14" cy="14" r="1.5" fill="currentColor" />
    <circle cx="18" cy="14" r="1.5" fill="currentColor" />
    <circle cx="22" cy="14" r="1.5" fill="currentColor" />
  </svg>
);

const IconPencil = () => (
  <svg width="72" height="72" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16h24v32H12z" />
    <path d="M20 24h8M20 32h8M20 40h8" />
    <path d="M40 20l8-8 8 8-8 8z" />
    <path d="M42 42l6-6" />
  </svg>
);

const IconChart = () => (
  <svg width="72" height="72" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="24" cy="40" r="10" />
    <path d="M24 40V30M24 40h10" />
    <rect x="40" y="30" width="6" height="20" />
    <rect x="50" y="22" width="6" height="28" />
    <circle cx="52" cy="14" r="8" />
    <path d="M49 14l2 2 4-4" />
  </svg>
);

const IconGlobe = () => (
  <svg width="60" height="60" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="32" cy="32" r="22" />
    <path d="M32 10c6 8 6 36 0 44M32 10c-6 8-6 36 0 44M10 32h44M14 20c8 4 28 4 36 0M14 44c8-4 28-4 36 0" />
  </svg>
);

const IconShield = () => (
  <svg width="60" height="60" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M32 8l20 8v16c0 12-8 20-20 24-12-4-20-12-20-24V16z" />
    <path d="M22 32l7 7 14-14" />
  </svg>
);

const IconClipboard = () => (
  <svg width="60" height="60" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="14" y="10" width="36" height="46" rx="3" />
    <path d="M22 22h20M22 30h20M22 38h12" />
    <circle cx="48" cy="46" r="12" fill="white" />
    <circle cx="48" cy="46" r="12" />
    <path d="M43 46l3 3 6-6" />
  </svg>
);

const IconClock = () => (
  <svg width="60" height="60" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="32" cy="32" r="22" />
    <path d="M32 18v14l10 6" />
    <path d="M20 8l-6 6M44 8l6 6" />
  </svg>
);

const IconPen2 = () => (
  <svg width="60" height="60" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 44l-2 10 10-2 28-28-8-8z" />
    <path d="M40 16l8 8" />
  </svg>
);

const IconEyeOff = () => (
  <svg width="60" height="60" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 32s10-16 24-16 24 16 24 16-10 16-24 16S8 32 8 32z" />
    <circle cx="32" cy="32" r="6" />
    <path d="M8 8l48 48" />
  </svg>
);

const IconArrowRight = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const IconStar = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const IconChevronDown = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconLogout = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

/* ==================== Hero 動態背景 ==================== */
const HeroBackground = () => (
  <svg className="hero-bg-svg" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0f172a" />
        <stop offset="55%" stopColor="#141f38" />
        <stop offset="100%" stopColor="#1e293b" />
      </linearGradient>
      <radialGradient id="glow1" cx="20%" cy="20%" r="40%">
        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="glow2" cx="85%" cy="80%" r="45%">
        <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.42" />
        <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="glow3" cx="50%" cy="50%" r="35%">
        <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
      </radialGradient>
    </defs>

    <rect width="1200" height="600" fill="url(#heroGrad)" />

    <g className="hero-glow">
      <rect width="1200" height="600" fill="url(#glow1)" />
      <rect width="1200" height="600" fill="url(#glow2)" />
      <rect width="1200" height="600" fill="url(#glow3)" />
    </g>

    <g fontFamily="Georgia, serif" fill="#ffffff">
      <text className="float-slow" x="80" y="120" fontSize="48" fillOpacity="0.06">∫ f(x) dx</text>
      <text className="float-med"  x="950" y="150" fontSize="42" fillOpacity="0.06">∑ n=1..∞</text>
      <text className="float-fast" x="100" y="500" fontSize="40" fillOpacity="0.06">dy/dx</text>
      <text className="float-slow" x="900" y="520" fontSize="38" fillOpacity="0.06">lim x→0</text>
      <text className="float-med"  x="500" y="80"  fontSize="36" fillOpacity="0.05">√(a²+b²)</text>
      <text className="float-fast" x="520" y="560" fontSize="36" fillOpacity="0.05">a² + b² = c²</text>
      <text className="float-slow" x="200" y="300" fontSize="34" fillOpacity="0.05">sin²θ + cos²θ = 1</text>
      <text className="float-med"  x="830" y="320" fontSize="34" fillOpacity="0.05">e^(iπ) + 1 = 0</text>
    </g>

    <g fill="none" stroke="#ffffff" strokeWidth="1.2">
      <circle className="spin-slow" cx="150" cy="420" r="60" strokeOpacity="0.07" style={{ transformOrigin: '150px 420px' }} />
      <circle className="spin-med"  cx="1050" cy="200" r="80" strokeOpacity="0.07" style={{ transformOrigin: '1050px 200px' }} />
      <polygon className="spin-fast" points="620,300 700,440 540,440" strokeOpacity="0.07" style={{ transformOrigin: '620px 380px' }} />
      <polygon className="spin-slow" points="300,220 380,260 360,340 280,340 260,260" strokeOpacity="0.07" style={{ transformOrigin: '320px 290px' }} />
      <path d="M 750 90 L 850 190 L 750 190 Z" strokeOpacity="0.07" />
    </g>

    <g stroke="#ffffff" strokeOpacity="0.045" strokeDasharray="6 8">
      <line className="dash-move" x1="0" y1="300" x2="1200" y2="300" />
      <line x1="600" y1="0" x2="600" y2="600" />
      <line x1="0" y1="150" x2="1200" y2="450" />
      <line x1="0" y1="450" x2="1200" y2="150" />
    </g>
  </svg>
);

/* ==================== 主元件 ==================== */
export default function HomePage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(0);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('jae_user'));
    } catch {
      return null;
    }
  });

  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    category: '題目錯誤',
    message: '',
  });
  const [contactLoading, setContactLoading] = useState(false);
  const [contactStatus, setContactStatus] = useState(null);

  const handleLogout = () => {
    localStorage.removeItem('jae_token');
    localStorage.removeItem('jae_user');
    localStorage.removeItem('jae_favorites');
    setUser(null);
    window.location.reload();
  };

  const handleAuthChange = (newUser) => {
    setUser(newUser);
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactForm.message.trim()) return;

    setContactLoading(true);
    setContactStatus(null);

    try {
      const API_BASE_URL =
        import.meta.env.VITE_API_BASE_URL ||
        `http://${window.location.hostname}:8000`;

      const res = await fetch(`${API_BASE_URL}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '送出失敗');

      setContactStatus({ type: 'success', text: '✓ 已收到你的回報，我們會盡快處理。' });
      setContactForm({ name: '', email: '', category: '題目錯誤', message: '' });
    } catch (err) {
      setContactStatus({ type: 'error', text: `✗ 送出失敗：${err.message}` });
    } finally {
      setContactLoading(false);
    }
  };

  const faqs = [
    { q: '需要付費嗎？', a: '完全免費。所有題目、詳解、測驗功能都不需要付費，也不需要綁定信用卡。' },
    { q: '題庫包含哪些年份？', a: '收錄 2017 至 2026 年的澳門四校聯考數學科正卷、附加卷與模擬試題，共 11 套 245 題，每題都附完整答案與逐步解析。' },
    { q: '可以只練特定科目或難度嗎？', a: '可以。在「開始練習」頁面可以按科目（代數、幾何、三角學等）、難度（基礎、中等、困難）、題型（選擇題、解答大題）篩選，只練你想加強的部分。' },
    { q: '測驗紀錄會保存嗎？', a: '註冊帳號後，每次測驗的成績、錯題、各科得分率都會自動歸檔。你可以在「個人中心」查看歷史紀錄，並針對弱點複習。' },
    { q: '詳解是怎麼來的？', a: '我們使用 AI 對每一題生成詳細解題步驟，並人工校對。若你在使用中發現任何錯誤，歡迎透過下方表單回報，我們會盡快修正。' },
    { q: '手機可以用嗎？', a: '可以。整個網站是響應式設計，手機、平板、電腦都能正常使用。' },
  ];

  return (
    <div className="home-page">
      {/* ==================== HERO ==================== */}
      <section className="hero">
        <HeroBackground />

        <div className="hero-user-floating">
          {user ? (
            <div className="user-banner logged-in">
              <div className="user-avatar" style={{ background: user.is_admin ? '#f59e0b' : '#2563eb' }}>
                {(user.full_name || user.username || '?').charAt(0)}
              </div>
              <div className="user-info">
                <div className="user-greeting">
                  {user.is_admin ? '👑 管理員' : '🎓 考生'}
                </div>
                <div className="user-name">
                  {user.full_name || user.username}
                </div>
              </div>
              {user.is_admin && <span className="user-badge">ADMIN</span>}
              <button className="user-logout" onClick={handleLogout} title="登出">
                <IconLogout />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="user-banner guest"
              onClick={() => setIsLoginOpen(true)}
            >
              <div className="user-avatar guest-avatar">?</div>
              <div className="user-info">
                <div className="user-greeting">訪客模式</div>
                <div className="user-name">點此登入 / 註冊</div>
              </div>
            </button>
          )}
        </div>

        <div className="hero-inner">
          <h1 className="hero-title">
            <span className="hero-title-text">四校勝券</span>
            <span className="sparkle sparkle-1" />
            <span className="sparkle sparkle-2" />
            <span className="sparkle sparkle-3" />
            <span className="sparkle sparkle-4" />
          </h1>

          <p className="hero-subtitle">
            2017–2026 年數學正卷、附加卷、模擬試題。<br />
            共 <strong>11</strong> 套 <strong>245</strong> 題，附完整答案與逐步解析。
          </p>

          <div className="hero-actions">
            <button className="btn-primary" onClick={() => navigate('/browse')}>
              開始練習
              <IconArrowRight />
            </button>
            <button className="btn-ghost" onClick={() => navigate('/favorites')}>
              <IconStar />
              我的收藏
            </button>

            <button
  className="home-btn"
  onClick={() => navigate('/wrong-book')}
  style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '16px 28px',
    background: '#ffffff',
    color: '#b91c1c',
    border: '2px solid #fecaca',
    borderRadius: 14,
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
    marginLeft: 12,
  }}
>
  📕 我的錯題本
</button>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-value">245</div>
              <div className="hero-stat-label">道題目</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-value">11</div>
              <div className="hero-stat-label">套試卷</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-value">10</div>
              <div className="hero-stat-label">年跨度</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-value">100%</div>
              <div className="hero-stat-label">附詳解</div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 三步驟 ==================== */}
      <section className="section section-white">
        <div className="section-inner">
          <div className="section-header">
            <h2 className="section-title">三步驟，開始你的備考</h2>
            <p className="section-desc">
              從挑選試卷到檢視分析，整個流程只需要幾分鐘。
            </p>
          </div>

          <div className="cards-3">
            <div className="feature-card">
              <div className="feature-icon icon-purple"><IconBook /></div>
              <h3 className="feature-title">挑選試卷</h3>
              <p className="feature-desc">
                從 2017–2026 年的正卷、附加卷、模擬試題中選擇。
                可以按年份、科目、難度篩選，找到最適合你的練習材料。
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon icon-red"><IconPencil /></div>
              <h3 className="feature-title">開始作答</h3>
              <p className="feature-desc">
                用篩選器挑選科目與難度，進入限時模擬測驗。
                作答介面模擬真實考試節奏，幫你習慣考場壓力。
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon icon-green"><IconChart /></div>
              <h3 className="feature-title">檢視分析</h3>
              <p className="feature-desc">
                交卷後立即看到逐題對錯、標準答案、詳細步驟解析，
                以及各科目的弱點診斷報告。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 功能特色 ==================== */}
      <section className="section section-tint">
        <div className="section-inner">
          <div className="section-header">
            <h2 className="section-title">功能特色</h2>
            <p className="section-desc">
              不只是一個題庫，而是一套完整的備考工具。
            </p>
          </div>

          <div className="cards-3">
            <div className="feature-card feature-card-left">
              <div className="feature-icon-box icon-green"><IconGlobe /></div>
              <h3 className="feature-title">隨時隨地練習</h3>
              <p className="feature-desc">
                只要有網路，你可以在任何裝置上打開題庫、作答、複習。手機、平板、電腦都能用。
              </p>
            </div>
            <div className="feature-card feature-card-left">
              <div className="feature-icon-box icon-blue"><IconShield /></div>
              <h3 className="feature-title">帳號安全</h3>
              <p className="feature-desc">
                密碼使用 bcrypt 加密，登入使用 JWT 權杖。你的測驗紀錄只有你自己看得到。
              </p>
            </div>
            <div className="feature-card feature-card-left">
              <div className="feature-icon-box icon-pink"><IconClipboard /></div>
              <h3 className="feature-title">自動評分</h3>
              <p className="feature-desc">
                選擇題自動批改，交卷後立即看到分數、答對題數與各科得分率。
              </p>
            </div>
            <div className="feature-card feature-card-left">
              <div className="feature-icon-box icon-orange"><IconClock /></div>
              <h3 className="feature-title">限時模擬</h3>
              <p className="feature-desc">
                你可以設定測驗時間，模擬真實考場的節奏。也可以不限時，當作平時練習。
              </p>
            </div>
            <div className="feature-card feature-card-left">
              <div className="feature-icon-box icon-purple"><IconPen2 /></div>
              <h3 className="feature-title">逐步解析</h3>
              <p className="feature-desc">
                每一題都有完整解題步驟、公式推導與答案。不是只有答案，而是教你怎麼想。
              </p>
            </div>
            <div className="feature-card feature-card-left">
              <div className="feature-icon-box icon-slate"><IconEyeOff /></div>
              <h3 className="feature-title">公開與私人</h3>
              <p className="feature-desc">
                未登入可以自由瀏覽題庫。登入後，你的測驗紀錄、錯題、收藏都會被保存。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 使用者見證 ==================== */}
      <section className="section section-white">
        <div className="section-inner">
          <div className="section-header">
            <h2 className="section-title">他們這樣說</h2>
            <p className="section-desc">
              從 2017 到 2026 的題目都在這裡，用過的學生怎麼說。
            </p>
          </div>

          <div className="cards-3">
            {[
              {
                name: '陳同學',
                role: '2025 應屆考生',
                avatarBg: '#6366f1',
                initials: '陳',
                rating: 5,
                text: '原本數學一直卡在 60 幾分，用了這個題庫每天刷 20 題，把歷屆真題都做過一遍。最後聯考數學拿到 87 分，真的差很多。',
              },
              {
                name: '李同學',
                role: '2024 重考生',
                avatarBg: '#ec4899',
                initials: '李',
                rating: 5,
                text: '最大的優點是每題都有詳解，不會像以前一樣錯了也不知道為什麼。弱點分析很準，直接告訴我哪個單元要加強。',
              },
              {
                name: '王同學',
                role: '2026 應屆考生',
                avatarBg: '#10b981',
                initials: '王',
                rating: 5,
                text: '可以按難度篩選真的很方便，前期先練基礎題打底，後期只練難題。模擬測驗的限時功能讓我習慣考試節奏。',
              },
            ].map((t, i) => (
              <div key={i} className="testimonial-card">
                <div className="testimonial-stars">
                  {Array.from({ length: t.rating }).map((_, k) => (
                    <svg key={k} width="18" height="18" viewBox="0 0 24 24" fill="#f59e0b">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>
                <p className="testimonial-text">「{t.text}」</p>
                <div className="testimonial-user">
                  <div className="testimonial-avatar" style={{ background: t.avatarBg }}>
                    {t.initials}
                  </div>
                  <div>
                    <div className="testimonial-name">{t.name}</div>
                    <div className="testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== FAQ ==================== */}
      <section className="section section-tint">
        <div className="section-inner">
          <div className="section-header">
            <h2 className="section-title">還有疑問嗎？</h2>
            <p className="section-desc">
              如果你還有其他問題，歡迎透過下方表單回報，我們會盡快回覆。
            </p>
          </div>

          <div className="faq-list">
            {faqs.map((f, i) => (
              <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`}>
                <button
                  className="faq-question"
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                >
                  <span>{f.q}</span>
                  <span className="faq-chevron"><IconChevronDown /></span>
                </button>
                <div className="faq-answer">
                  <div className="faq-answer-inner">{f.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== 聯絡我們 ==================== */}
      <section className="section section-white">
        <div className="section-inner">
          <div className="section-header">
            <h2 className="section-title">有問題想回報？</h2>
            <p className="section-desc">
              如果你發現題目錯誤、詳解有誤，或想給我們建議，歡迎直接告訴我們。
            </p>
          </div>

          <div className="contact-card">
            <form onSubmit={handleContactSubmit} className="contact-form">
              <div className="form-row">
                <div className="form-field">
                  <label>你的稱呼（可選）</label>
                  <input
                    type="text"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    placeholder="例如：陳同學"
                    className="form-input"
                  />
                </div>
                <div className="form-field">
                  <label>電子郵件（可選）</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    placeholder="student@example.com"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-field">
                <label>問題類別</label>
                <div className="category-chips">
                  {['題目錯誤', '詳解有誤', '功能建議', '帳號問題', '其他'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`category-chip ${contactForm.category === c ? 'active' : ''}`}
                      onClick={() => setContactForm({ ...contactForm, category: c })}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label>訊息內容</label>
                <textarea
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  placeholder="請描述你遇到的問題，例如：第 p00-m5 題的詳解好像有錯..."
                  rows={5}
                  className="form-textarea"
                  required
                />
              </div>

              {contactStatus && (
                <div className={`contact-status ${contactStatus.type}`}>
                  {contactStatus.text}
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={contactLoading}>
                  {contactLoading ? '送出中...' : '送出訊息'}
                  {!contactLoading && <IconArrowRight />}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ==================== CTA ==================== */}
      <section className="cta-section">
        <div className="cta-glow" />
        <div className="section-inner">
          <h2 className="cta-title">準備好開始了嗎？</h2>
          <p className="cta-desc">
            245 道真題、11 套試卷、完整的逐步解析，全部免費。
          </p>
          <button className="btn-primary btn-large" onClick={() => navigate('/browse')}>
            立即開始練習
            <IconArrowRight />
          </button>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="home-footer">
        <div className="footer-inner">
          澳門四校聯考數學科題庫 · 供學生自主練習使用
        </div>
      </footer>

      {/* ==================== LOGIN MODAL ==================== */}
      <LoginPanel
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onAuthChange={handleAuthChange}
      />

      {/* ==================== STYLES ==================== */}
      <style>{`
        .home-page {
          width: 100vw;
          margin-left: calc(-50vw + 50%);
          background: #ffffff;
          color: #0f172a;
          font-family: 'PingFang TC', 'Microsoft JhengHei', 'Noto Sans TC',
                       'Heiti TC', 'Hiragino Sans TC', 'Microsoft YaHei',
                       -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }

        .hero-inner,
        .section-inner,
        .footer-inner {
          max-width: 1120px;
          margin: 0 auto;
          padding: 0 24px;
          position: relative;
          z-index: 2;
        }

        .hero {
          position: relative;
          padding: 120px 0 100px;
          text-align: center;
          overflow: hidden;
          background: #0f172a;
          min-height: 640px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .hero-bg-svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }

        .hero-glow { animation: glowPulse 8s ease-in-out infinite; }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.78; }
          50%      { opacity: 1; }
        }

        .float-slow { animation: floatY 12s ease-in-out infinite; }
        .float-med  { animation: floatY 9s ease-in-out infinite; }
        .float-fast { animation: floatY 7s ease-in-out infinite; }
        @keyframes floatY {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-14px); }
        }

        .spin-slow { animation: spinCW 60s linear infinite; }
        .spin-med  { animation: spinCCW 40s linear infinite; }
        .spin-fast { animation: spinCW 30s linear infinite; }
        @keyframes spinCW {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes spinCCW {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }

        .dash-move { animation: dashMove 20s linear infinite; }
        @keyframes dashMove {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -280; }
        }

        .hero-user-floating {
          position: absolute;
          top: 28px;
          left: 28px;
          z-index: 5;
        }

        .user-banner {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          padding: 10px 20px 10px 10px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 999px;
          -webkit-backdrop-filter: blur(10px);
          backdrop-filter: blur(10px);
          font-family: inherit;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .user-banner.logged-in {
          box-shadow: 0 8px 32px rgba(37, 99, 235, 0.35);
          border-color: rgba(96, 165, 250, 0.5);
        }

        .user-banner.guest {
          opacity: 0.88;
          cursor: pointer;
        }
        .user-banner.guest:hover {
          opacity: 1;
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(37, 99, 235, 0.35);
          border-color: rgba(96, 165, 250, 0.6);
        }
        .user-banner.guest:active { transform: scale(0.98); }

        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.1rem;
          flex-shrink: 0;
          animation: avatarGlow 3s ease-in-out infinite alternate;
        }
        @keyframes avatarGlow {
          0%   { box-shadow: 0 0 14px rgba(245, 158, 11, 0.25); }
          100% { box-shadow: 0 0 26px rgba(245, 158, 11, 0.55); }
        }

        .guest-avatar {
          background: rgba(255, 255, 255, 0.15);
          color: #94a3b8;
          animation: none;
          box-shadow: none;
        }

        .user-info { text-align: left; line-height: 1.3; }
        .user-greeting {
          font-size: 0.75rem;
          color: #94a3b8;
          font-weight: 600;
          letter-spacing: 0.05em;
        }
        .user-name {
          font-size: 1rem;
          color: #ffffff;
          font-weight: 700;
        }

        .user-badge {
          padding: 3px 10px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: #ffffff;
          border-radius: 999px;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          box-shadow: 0 0 14px rgba(245, 158, 11, 0.4);
        }

        .user-logout {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: rgba(239, 68, 68, 0.15);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .user-logout:hover {
          background: rgba(239, 68, 68, 0.35);
          color: #ffffff;
          transform: scale(1.05);
        }
        .user-logout:active { transform: scale(0.95); }

        .hero-title {
          position: relative;
          display: inline-block;
          font-size: clamp(3rem, 9vw, 5.4rem);
          font-weight: 900;
          letter-spacing: 0.04em;
          line-height: 1.2;
          margin: 0 0 24px;
          color: #ffffff;
        }

        .hero-title-text {
          display: inline-block;
          color: #ffffff;
          background: linear-gradient(
            135deg,
            #ffffff 0%,
            #dbeafe 30%,
            #c7d2fe 55%,
            #e9d5ff 78%,
            #ffffff 100%
          );
          background-size: 300% 300%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradientShift 6s ease-in-out infinite;
          filter: drop-shadow(0 0 22px rgba(96, 165, 250, 0.4))
                  drop-shadow(0 0 44px rgba(124, 58, 237, 0.25));
        }
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .hero-title::after {
          content: '';
          position: absolute;
          bottom: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 0%;
          height: 3px;
          background: linear-gradient(90deg,
                      transparent, #60a5fa, #a78bfa, #60a5fa, transparent);
          border-radius: 999px;
          box-shadow: 0 0 24px rgba(96, 165, 250, 0.65);
          animation: underlineGrow 1.6s ease-out 0.4s forwards;
        }
        @keyframes underlineGrow {
          0%   { width: 0%;  opacity: 0; }
          100% { width: 70%; opacity: 1; }
        }

        .sparkle {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ffffff;
          pointer-events: none;
          opacity: 0;
          box-shadow: 0 0 10px #60a5fa, 0 0 20px #a78bfa;
          animation: sparkleAnim 3s ease-in-out infinite;
        }
        .sparkle-1 { top: -12px;    left: 12%;    animation-delay: 0s;   }
        .sparkle-2 { top: 25%;      right: -22px; animation-delay: 1s;   }
        .sparkle-3 { bottom: -12px; right: 22%;   animation-delay: 2s;   }
        .sparkle-4 { bottom: 30%;   left: -22px;  animation-delay: 1.5s; }
        @keyframes sparkleAnim {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50%      { opacity: 1; transform: scale(1.2); }
        }

        .hero-subtitle {
          font-size: 1.15rem;
          line-height: 1.9;
          color: #94a3b8;
          max-width: 640px;
          margin: 0 auto 44px;
          letter-spacing: 0.02em;
        }
        .hero-subtitle strong {
          color: #fbbf24;
          font-weight: 900;
          font-size: 1.25rem;
          text-shadow: 0 0 18px rgba(251, 191, 36, 0.5);
          animation: numberPulse 2.2s ease-in-out infinite;
        }
        @keyframes numberPulse {
          0%, 100% { text-shadow: 0 0 18px rgba(251, 191, 36, 0.35); }
          50%      { text-shadow: 0 0 32px rgba(251, 191, 36, 0.75); }
        }

        .hero-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 72px;
        }

        .btn-primary,
        .btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 15px 30px;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          letter-spacing: 0.05em;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          border: 1.5px solid transparent;
          position: relative;
          overflow: hidden;
        }

        .btn-primary {
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          color: #ffffff;
          box-shadow: 0 6px 28px rgba(37, 99, 235, 0.45),
                      0 0 40px rgba(124, 58, 237, 0.15);
        }
        .btn-primary::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg,
                      transparent, rgba(255, 255, 255, 0.22), transparent);
          transition: left 0.6s ease;
        }
        .btn-primary:hover::before { left: 100%; }
        .btn-primary:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 12px 40px rgba(37, 99, 235, 0.6),
                      0 0 60px rgba(124, 58, 237, 0.3);
        }
        .btn-primary:active { transform: translateY(0) scale(0.98); }
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .btn-primary.btn-large {
          padding: 18px 42px;
          font-size: 1.1rem;
        }

        .btn-ghost {
          background: rgba(255, 255, 255, 0.05);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.2);
          -webkit-backdrop-filter: blur(6px);
          backdrop-filter: blur(6px);
        }
        .btn-ghost:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(96, 165, 250, 0.55);
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 8px 32px rgba(37, 99, 235, 0.25);
        }
        .btn-ghost:active { transform: translateY(0) scale(0.98); }

        .hero-stats {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 32px;
          flex-wrap: wrap;
        }

        .hero-stat { text-align: center; }
        .hero-stat-value {
          font-size: 2.1rem;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: -0.02em;
          line-height: 1;
          margin-bottom: 8px;
          text-shadow: 0 0 22px rgba(96, 165, 250, 0.35);
          transition: all 0.3s ease;
        }
        .hero-stat:hover .hero-stat-value {
          color: #93c5fd;
          text-shadow: 0 0 32px rgba(96, 165, 250, 0.8);
          transform: scale(1.08);
        }
        .hero-stat-label {
          font-size: 0.82rem;
          color: #64748b;
          letter-spacing: 0.06em;
        }
        .hero-stat-divider {
          width: 1px;
          height: 34px;
          background: linear-gradient(180deg,
                      transparent, rgba(255, 255, 255, 0.15), transparent);
        }

        .section { padding: 92px 0; position: relative; }
        .section-white { background: #ffffff; }
        .section-tint {
          background: linear-gradient(180deg, #f8fafc 0%, #f0f9ff 55%, #f8fafc 100%);
        }

        .section-header {
          text-align: center;
          margin-bottom: 56px;
        }

        .section-title {
          font-size: clamp(1.9rem, 4.2vw, 2.6rem);
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
          margin: 0 auto 14px;
          line-height: 1.3;
          text-align: center;
          display: block;
          max-width: 720px;
        }

        .section-desc {
          font-size: 1rem;
          color: #64748b;
          margin: 0 auto;
          line-height: 1.75;
          text-align: center;
          max-width: 640px;
        }

        .cards-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        .feature-card {
          background: #ffffff;
          border-radius: 14px;
          padding: 40px 28px;
          text-align: center;
          box-shadow: 0 10px 30px rgba(59, 130, 246, 0.07);
          border: 1px solid rgba(226, 232, 240, 0.7);
          transition: box-shadow 0.3s, transform 0.3s, border-color 0.3s;
          position: relative;
          overflow: hidden;
        }
        .feature-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #2563eb, #7c3aed, #10b981);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .feature-card:hover {
          box-shadow: 0 20px 48px rgba(59, 130, 246, 0.18);
          transform: translateY(-6px);
          border-color: rgba(96, 165, 250, 0.4);
        }
        .feature-card:hover::before { opacity: 1; }
        .feature-card-left { text-align: left; padding: 36px 28px; }

        .feature-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          color: #2563eb;
          transition: transform 0.3s;
        }
        .feature-card:hover .feature-icon { transform: scale(1.08) rotate(-4deg); }

        .feature-icon-box {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          background: #f8fafc;
          border-radius: 18px;
          margin-bottom: 24px;
          transition: transform 0.3s, background 0.3s;
        }
        .feature-card:hover .feature-icon-box {
          transform: scale(1.06);
          background: #f1f5f9;
        }

        .icon-purple { color: #6366f1; }
        .icon-red    { color: #ef4444; }
        .icon-green  { color: #10b981; }
        .icon-blue   { color: #3b82f6; }
        .icon-pink   { color: #ec4899; }
        .icon-orange { color: #f59e0b; }
        .icon-slate  { color: #64748b; }

        .feature-title {
          font-size: 1.35rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.01em;
          margin: 0 0 14px;
        }
        .feature-desc {
          font-size: 0.95rem;
          line-height: 1.75;
          color: #475569;
          margin: 0;
        }

        .testimonial-card {
          background: #ffffff;
          border-radius: 14px;
          padding: 32px 28px;
          border: 1px solid rgba(226, 232, 240, 0.85);
          box-shadow: 0 10px 30px rgba(59, 130, 246, 0.06);
          display: flex;
          flex-direction: column;
          gap: 18px;
          transition: box-shadow 0.3s, transform 0.3s;
        }
        .testimonial-card:hover {
          box-shadow: 0 18px 44px rgba(59, 130, 246, 0.14);
          transform: translateY(-4px);
        }
        .testimonial-stars { display: flex; gap: 3px; }
        .testimonial-text {
          font-size: 0.98rem;
          line-height: 1.85;
          color: #334155;
          margin: 0;
          flex: 1;
        }
        .testimonial-user {
          display: flex;
          align-items: center;
          gap: 14px;
          padding-top: 18px;
          border-top: 1px solid #f1f5f9;
        }
        .testimonial-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1rem;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        }
        .testimonial-name { font-size: 0.95rem; font-weight: 700; color: #0f172a; }
        .testimonial-role { font-size: 0.82rem; color: #64748b; }

        .faq-list {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .faq-item {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.25s ease;
          position: relative;
        }
        .faq-item::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 4px;
          background: linear-gradient(180deg, #2563eb, #7c3aed);
          opacity: 0;
          transition: opacity 0.25s;
        }
        .faq-item.open {
          border-color: #bfdbfe;
          box-shadow: 0 8px 28px rgba(59, 130, 246, 0.12);
        }
        .faq-item.open::before { opacity: 1; }

        .faq-question {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-family: inherit;
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
          text-align: left;
          transition: background 0.2s;
        }
        .faq-question:hover { background: #f8fafc; }
        .faq-chevron {
          display: inline-flex;
          color: #64748b;
          transition: transform 0.3s;
          flex-shrink: 0;
        }
        .faq-item.open .faq-chevron {
          transform: rotate(180deg);
          color: #2563eb;
        }
        .faq-answer {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.35s ease;
        }
        .faq-item.open .faq-answer { max-height: 420px; }
        .faq-answer-inner {
          padding: 0 24px 20px;
          font-size: 0.95rem;
          line-height: 1.8;
          color: #475569;
        }

        .contact-card {
          max-width: 720px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 40px 36px;
          box-shadow: 0 14px 40px rgba(59, 130, 246, 0.08);
        }
        .contact-form { display: flex; flex-direction: column; gap: 20px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .form-field { display: flex; flex-direction: column; gap: 8px; }
        .form-field label {
          font-size: 0.85rem;
          font-weight: 700;
          color: #334155;
        }
        .form-input,
        .form-textarea {
          width: 100%;
          padding: 12px 14px;
          border: 1.5px solid #cbd5e1;
          border-radius: 10px;
          font-size: 0.95rem;
          font-family: inherit;
          color: #0f172a;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
          background: #ffffff;
        }
        .form-input:focus,
        .form-textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
        }
        .form-textarea {
          resize: vertical;
          min-height: 120px;
          line-height: 1.7;
        }
        .category-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .category-chip {
          padding: 7px 15px;
          border: 1.5px solid #cbd5e1;
          background: #ffffff;
          color: #475569;
          border-radius: 999px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        .category-chip:hover {
          border-color: #2563eb;
          color: #2563eb;
          transform: translateY(-1px);
        }
        .category-chip.active {
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          border-color: transparent;
          color: #ffffff;
          font-weight: 700;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
        }
        .contact-status {
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 600;
        }
        .contact-status.success {
          background: #f0fdf4;
          border: 1px solid #86efac;
          color: #166534;
        }
        .contact-status.error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }
        .form-actions { display: flex; justify-content: flex-end; }

        .cta-section {
          position: relative;
          padding: 100px 0;
          text-align: center;
          background: linear-gradient(180deg, #ffffff 0%, #eff6ff 50%, #f0f9ff 100%);
          overflow: hidden;
        }
        .cta-glow {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(37, 99, 235, 0.14), transparent 70%);
          filter: blur(60px);
          pointer-events: none;
          animation: ctaGlow 6s ease-in-out infinite alternate;
        }
        @keyframes ctaGlow {
          0%   { opacity: 0.7; transform: translate(-50%, -50%) scale(0.94); }
          100% { opacity: 1;   transform: translate(-50%, -50%) scale(1.06); }
        }
        .cta-title {
          font-size: clamp(1.9rem, 4.5vw, 2.7rem);
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.02em;
          margin: 0 0 16px;
          position: relative;
          z-index: 2;
        }
        .cta-desc {
          font-size: 1.05rem;
          color: #475569;
          margin: 0 0 36px;
          position: relative;
          z-index: 2;
          line-height: 1.75;
        }

        .home-footer {
          padding: 34px 0;
          border-top: 1px solid #e2e8f0;
          background: #ffffff;
        }
        .footer-inner {
          text-align: center;
          font-size: 0.85rem;
          color: #94a3b8;
          letter-spacing: 0.04em;
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-glow,
          .float-slow, .float-med, .float-fast,
          .spin-slow, .spin-med, .spin-fast,
          .dash-move,
          .hero-title-text,
          .hero-title::after,
          .sparkle,
          .hero-subtitle strong,
          .user-avatar,
          .cta-glow {
            animation: none !important;
          }
        }

        @media (max-width: 900px) {
          .cards-3 { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 640px) {
          .hero {
            padding: 96px 0 68px;
            min-height: auto;
            display: block;
          }

          .hero-user-floating {
            top: 16px;
            left: 50%;
            transform: translateX(-50%);
            width: calc(100% - 32px);
            display: flex;
            justify-content: center;
          }

          .user-banner { padding: 8px 16px 8px 8px; }
          .user-avatar { width: 34px; height: 34px; font-size: 0.95rem; }
          .user-name { font-size: 0.9rem; }

          .hero-title { font-size: clamp(2.4rem, 12vw, 3.6rem); }
          .hero-subtitle { font-size: 1rem; margin-bottom: 32px; }

          .hero-actions { margin-bottom: 48px; flex-direction: column; width: 100%; }
          .btn-primary, .btn-ghost { width: 100%; justify-content: center; }

          .hero-stats { gap: 22px; }
          .hero-stat-value { font-size: 1.7rem; }
          .hero-stat-divider { display: none; }

          .section { padding: 60px 0; }
          .section-header { margin-bottom: 40px; }

          .cards-3 { grid-template-columns: 1fr; }
          .feature-card { padding: 30px 22px; }
          .feature-card-left { padding: 28px 22px; }

          .faq-question { padding: 16px 20px; font-size: 0.95rem; }
          .faq-answer-inner { padding: 0 20px 16px; }

          .form-row { grid-template-columns: 1fr; }
          .contact-card { padding: 28px 20px; }
          .form-actions { justify-content: stretch; }
          .form-actions .btn-primary { width: 100%; justify-content: center; }

          .cta-section { padding: 68px 0; }
          .cta-glow { width: 340px; height: 340px; }

          .math-float { font-size: 22px !important; }
        }
      `}</style>
    </div>
  );
}