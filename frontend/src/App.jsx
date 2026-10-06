import React, { useState, useMemo, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import QuizPage from './QuizPage.jsx';
import LoginPanel from './LoginPanel.jsx';
import HomePage from './HomePage.jsx';
import FavoritesPage from './FavoritesPage.jsx';
import AdminPage from './AdminPage.jsx';
import { LoadingScreen, SkeletonList } from './LoadingScreen.jsx';
import FavoriteButton from './FavoriteButton.jsx';
import ReviewPage from './ReviewPage.jsx';

// Configure API Base URL dynamically to match host (127.0.0.1 vs localhost)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? `http://${window.location.hostname}:8000` : 'http://127.0.0.1:8000');

// Configure KaTeX to emit only HTML to prevent duplicate text during mouse selection/copy
const rehypeKatexOptions = [rehypeKatex, { output: 'html' }];

const PUA_SYMBOL_MAP = {
  '\uF03D': ' = ',
  '\uF02D': ' - ',
  '\uF02B': ' + ',
  '\uF03C': ' < ',
  '\uF03E': ' > ',
  '\uF0A3': ' \\le ',
  '\uF0B3': ' \\ge ',
  '\uF0B1': ' \\pm ',
  '\uF070': ' \\pi ',
  '\uF0CE': ' \\in ',
  '\uF0C6': ' \\cap ',
  '\uF061': ' \\alpha ',
  '\uF071': ' \\theta ',
  '\uF974': '若',
};

function normalizeLatex(text) {
  if (!text) return '';
  if (typeof text === 'object') {
    text = text.text || text.content || text.raw || JSON.stringify(text);
  }
  text = String(text);
  for (const [pua, repl] of Object.entries(PUA_SYMBOL_MAP)) {
    text = text.replaceAll(pua, repl);
  }
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\\n/g, '\n')
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$')
    .replace(/\n(?=\([a-zA-Z0-9ivxLCDM]+\))/gi, '\n\n')
    .replace(/([^\n])\n([^\n])/g, '$1  \n$2');
}

function extractOptions(q, lang = 'zh') {
  if (!q) return {};
  let raw = lang === 'en' ? (q.options_en || q.options_zh || q.options) : (q.options_zh || q.options || q.options_en);
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

function cleanDiagramUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:image')) return url;
  const filename = url.split('/').pop().replace(/[?#].*$/, '');
  if (!filename) return url;
  const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
  return `http://${host}:8000/diagrams/${filename}`;
}

const CATEGORY_MAP = {
  Algebra: '代數',
  Calculus: '微積分',
  Geometry: '幾何',
  Trigonometry: '三角學',
  Probability: '概率',
  Statistics: '統計',
  Sequences: '數列',
  Functions: '函數',
  NumberTheory: '數論',
  'Number Theory': '數論',
  Other: '其他',
};

const TYPE_MAP = {
  MCQ: '選擇題',
  Long: '解答大題',
};

const DIFFICULTY_MAP = {
  Easy: '基礎',
  Medium: '中等',
  Hard: '困難',
};

const TOPIC_MAP = {
  'Solid Geometry': '立體幾何',
  Pyramid: '棱錐',
  'Dihedral Angle': '二面角',
  'Coordinate Geometry': '解析幾何',
  'Analytical Geometry': '解析幾何',
  'Conic Sections': '圓錐曲線',
  Ellipse: '橢圓',
  Hyperbola: '雙曲線',
  Parabola: '拋物線',
  Differentiation: '微分導數',
  Integration: '積分面積',
  'Curve Sketching': '曲線作圖',
  'Complex Numbers': '複數',
  'Geometric Progression': '等比數列',
  'Arithmetic Progression': '等差數列',
  Matrices: '矩陣',
  'System of Linear Equations': '線性方程組',
  Determinants: '行列式',
  Vectors: '向量',
  Polynomials: '多項式',
  Inequalities: '不等式',
  Permutations: '排列組合',
  Combinations: '組合',
  'Binomial Theorem': '二項式定理',
  Triangles: '三角形',
  'Trigonometric Functions': '三角函數',
  'Trigonometric Identities': '三角恆等式',
  'Trigonometric Equations': '三角方程',
  Trigonometry: '三角學',
  Logarithms: '對數',
  Exponentials: '指數',
  Sets: '集合',
  'Set Theory': '集合論',
  'Quadratic Equations': '一元二次方程',
  Circle: '圓',
  Circles: '圓的方程',
  Tangent: '切線方程',
  'Remainder Theorem': '餘數定理',
  'Factor Theorem': '因式定理',
  Probability: '概率',
  Statistics: '統計',
  Functions: '函數',
  Sequences: '數列',
  Series: '級數',
};

const DIFFICULTY_COLORS = {
  Easy: '#10b981',
  Medium: '#f59e0b',
  Hard: '#ef4444',
};

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

import { useLocation } from 'react-router-dom';

function PageWrapper({ children }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition">
      {children}
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message: '' });
  const [questions, setQuestions] = useState(() => {
    try {
      const saved = localStorage.getItem('jae_cached_questions');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (questions && questions.length > 0) {
      try {
        localStorage.setItem('jae_cached_questions', JSON.stringify(questions));
      } catch (e) {
        console.warn('Failed to cache questions:', e);
      }
    }
  }, [questions]);
  const [metaStats, setMetaStats] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState('');

  const [language, setLanguage] = useState('zh');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterDifficulty, setFilterDifficulty] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loadingPrestored, setLoadingPrestored] = useState(false);
  const [prestoredPapers, setPrestoredPapers] = useState([]);
  const [selectedPaperId, setSelectedPaperId] = useState('');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const u = localStorage.getItem('jae_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  });

  // 載入預存試卷清單
  useEffect(() => {
    fetch(`${API_BASE_URL}/prestored/papers`)
      .then((r) => r.json())
      .then((d) => {
        const papers = d.papers || [];
        setPrestoredPapers(papers);
        if (papers.length > 0) {
          setSelectedPaperId(papers[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleLoadPrestored = async (paperId = selectedPaperId) => {
    setLoadingPrestored(true);
    try {
      const url = `${API_BASE_URL}/prestored/questions?paper_id=${paperId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('載入題庫失敗');
      const data = await res.json();
      setQuestions(data.questions || []);
      setMetaStats({
        total: data.total || (data.questions ? data.questions.length : 0),
        mode: '歷屆真題庫',
        paperTitle: `歷屆試卷 (${paperId})`
      });
      showToast(`成功載入 ${data.total || data.questions.length} 道歷屆真題！`);
    } catch (err) {
      showToast(`載入失敗: ${err.message}`);
    } finally {
      setLoadingPrestored(false);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setProgress({ percent: 5, message: '正在上傳試卷文件到伺服器...' });
    setQuestions(null);
    setMetaStats(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('jae_token');
      const response = await fetch(`${API_BASE_URL}/analyze-exam-stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`伺服器回應異常 HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'progress') {
              setProgress({ percent: data.percent, message: data.message });
            } else if (data.type === 'result') {
              setQuestions(data.questions || []);
              setMetaStats(data.stats || null);
              showToast(`成功解析 ${data.questions?.length || 0} 道試題！`);
            } else if (data.type === 'error') {
              setError(data.message);
            }
          } catch (err) {
            console.error('JSON parse chunk error:', err, line);
          }
        }
      }

      if (buffer && buffer.trim()) {
        try {
          const data = JSON.parse(buffer.trim());
          if (data.type === 'progress') {
            setProgress({ percent: data.percent, message: data.message });
          } else if (data.type === 'result') {
            setQuestions(data.questions || []);
            setMetaStats(data.stats || null);
            showToast(`成功解析 ${data.questions?.length || 0} 道試題！`);
          } else if (data.type === 'error') {
            setError(data.message);
          }
        } catch (err) {
          console.error('Final buffer flush JSON parse error:', err, buffer);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || '連線後端失敗，請確認 FastAPI 服務是否在運行。');
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    if (!questions) return [];
    return ['All', ...Array.from(new Set(questions.map((q) => q.main_category).filter(Boolean)))];
  }, [questions]);

  const stats = useMemo(() => {
    if (!questions) return null;
    return {
      total: questions.length,
      mcq: questions.filter((q) => q.question_type === 'MCQ').length,
      long: questions.filter((q) => q.question_type === 'Long').length,
      easy: questions.filter((q) => q.difficulty === 'Easy').length,
      medium: questions.filter((q) => q.difficulty === 'Medium').length,
      hard: questions.filter((q) => q.difficulty === 'Hard').length,
      withDiagram: questions.filter((q) => !!q.diagram_image).length,
    };
  }, [questions]);

  const filtered = useMemo(() => {
    if (!questions) return [];
    return questions.filter((q) => {
      if (filterCategory !== 'All' && q.main_category !== filterCategory) return false;
      if (filterDifficulty !== 'All' && q.difficulty !== filterDifficulty) return false;
      if (filterType !== 'All' && q.question_type !== filterType) return false;
      if (searchText) {
        const text = `${q.raw_text_zh || ''} ${q.raw_text_en || ''} ${q.question_number || ''}`;
        if (!text.toLowerCase().includes(searchText.toLowerCase())) return false;
      }
      return true;
    });
  }, [questions, filterCategory, filterDifficulty, filterType, searchText]);

  const scrollToQuestion = (idx) => {
    const el = document.getElementById(`q-${idx}`);
    if (el) {
      const yOffset = -70;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const handleCopyQuestion = async (q) => {
    let copyText = '';
    const qNum = q.question_number || '';
    if (language === 'zh') {
      copyText = `${qNum}\n${q.raw_text_zh || ''}`;
    } else if (language === 'en') {
      copyText = `${qNum}\n${q.raw_text_en || ''}`;
    } else {
      copyText = `【題號】${qNum}\n【中文版】\n${q.raw_text_zh || '無'}\n\n【English Version】\n${q.raw_text_en || 'None'}`;
    }
    try {
      await navigator.clipboard.writeText(copyText);
      showToast('已複製題目內容！');
    } catch {
      showToast('複製失敗，請手動選取');
    }
  };

  const handleCopyFull = async (q) => {
    const qNum = q.question_number || '';
    const bodyZh = q.raw_text_zh ? `【中文題幹】\n${q.raw_text_zh}` : '';
    const bodyEn = q.raw_text_en ? `【英文題幹】\n${q.raw_text_en}` : '';
    const ans = q.answer ? `【標準答案】\n${q.answer}` : '';
    const sol = q.solution ? `【詳細解析】\n${q.solution}` : '';
    const parts = [`【題目】${qNum}`, bodyZh, bodyEn, ans, sol].filter(Boolean);
    const fullText = parts.join('\n\n');
    try {
      await navigator.clipboard.writeText(fullText);
      showToast('已複製含解答解析！');
    } catch {
      showToast('複製失敗，請手動選取');
    }
  };

  const handleExportJSON = () => {
    if (!questions || questions.length === 0) return;
    const blob = new Blob([JSON.stringify({ questions, stats: metaStats }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jae_exam_questions_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已導出 JSON 文件！');
  };

  const handleExportMarkdown = () => {
    if (!questions || questions.length === 0) return;
    let md = `# 澳門四校聯考（JAE）題目庫\n\n`;
    md += `* 總題數：${questions.length} 道\n`;
    if (metaStats) {
      md += `* 試卷頁數：共 ${metaStats.total_pages} 頁（試題 ${metaStats.exam_pages} 頁，解答 ${metaStats.answer_pages} 頁）\n`;
    }
    md += `* 導出時間：${new Date().toLocaleString()}\n\n---\n\n`;

    questions.forEach((q, i) => {
      md += `## ${q.question_number || `第 ${i + 1} 題`} [${q.question_type || '題型'} | ${q.main_category || '科目'} | ${q.difficulty || '難度'}]\n\n`;
      if (q.raw_text_zh) {
        md += `### 中文題幹\n${q.raw_text_zh}\n\n`;
      }
      if (q.raw_text_en) {
        md += `### English Version\n${q.raw_text_en}\n\n`;
      }
      if (q.answer) {
        md += `> **參考答案**：${q.answer}\n\n`;
      }
      if (q.solution) {
        md += `### 解答步驟\n${q.solution}\n\n`;
      }
      md += `---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jae_exam_questions_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已導出 Markdown 文件！');
  };

  const appContent = (
    <div className="app-wrapper">
      {toast && (
        <div className="mobile-toast">
          {toast}
        </div>
      )}

      <header className="app-header">
        <div className="header-top-row">
          <div className="badge-jae" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            澳門四校聯考 (JAE)
          </div>
          <div className="header-auth-box">
            <button
              type="button"
              className="auth-fav-btn"
              onClick={() => navigate('/favorites')}
              title="我的收藏"
            >
              ⭐ 我的收藏
            </button>
            {currentUser ? (
              <button type="button" className="auth-user-btn" onClick={() => setIsLoginOpen(true)}>
                🎓 {currentUser.full_name || currentUser.username} (個人中心)
              </button>
            ) : (
              <button type="button" className="auth-login-btn" onClick={() => setIsLoginOpen(true)}>
                🔐 考生登入 / 註冊
              </button>
            )}
          </div>
        </div>
        <h1 className="main-title">
          四校勝券
        </h1>
        <p className="subtitle">
          2017–2026 年數學正卷、附加卷、模擬試題
        </p>
      </header>

      <div className="prestored-banner-card">
        <div className="prestored-banner-content">
          <div className="prestored-info-col">
            <div className="prestored-tag">🗄️  共 11 套 245 題，附完整答案與解析</div>
            <h2 className="prestored-card-title">澳門四校聯考 · 歷屆真題庫 </h2>
            <p className="prestored-card-desc">
              支援全套試題瀏覽與隨機組卷測驗！
            </p>
          </div>
          <div className="prestored-action-col">
            <select
              className="paper-select-dropdown"
              value={selectedPaperId}
              onChange={(e) => setSelectedPaperId(e.target.value)}
              disabled={loadingPrestored}
            >
              <option value="" disabled>
                {prestoredPapers.length === 0 ? '⏳ 載入試卷清單中...' : '請選擇試卷'}
              </option>
              {prestoredPapers.map((p) => (
                <option key={p.id} value={p.id}>
                  📄 {p.year} {p.title || '數學正卷'} ({p.questionCount || 15} 題)
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-load-prestored"
              onClick={() => handleLoadPrestored(selectedPaperId)}
              disabled={loadingPrestored}
            >
              {loadingPrestored ? '⏳ 載入中...' : '📚 一鍵載入真題庫'}
            </button>
          </div>
        </div>
      </div>

      {currentUser?.is_admin && (
        <div className="source-divider">
          <span className="source-divider-line"></span>
          <span className="source-divider-text">或者 上傳全新 PDF 試卷進行 AI 智能分析</span>
          <span className="source-divider-line"></span>
        </div>
      )}

      {currentUser?.is_admin && (
        <details className="admin-upload-collapsible">
          <summary>🛠️ 管理員工具：上傳新試卷</summary>

          <div className="upload-card">
            <form onSubmit={handleUpload}>
              <label className="file-drop-area">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setFile(e.target.files[0] || null)}
                  style={{ display: 'none' }}
                />
                <div className="upload-icon">📄</div>
                {file ? (
                  <div className="file-info-box">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">({formatFileSize(file.size)})</span>
                    <button
                      type="button"
                      className="clear-file-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        setFile(null);
                      }}
                    >
                      ✕ 清除
                    </button>
                  </div>
                ) : (
                  <div className="upload-hint">
                    <span className="upload-text-bold">點擊選擇試卷文件</span>
                    <span className="upload-text-sub">支援 PDF 或真題圖片 (JPG / PNG)</span>
                  </div>
                )}
              </label>

              <button
                type="submit"
                disabled={!file || loading}
                className={`submit-btn ${!file || loading ? 'disabled' : ''}`}
              >
                {loading ? '正在分析試卷中...' : '開始上傳並分析'}
              </button>
            </form>

            {loading && (
              <div className="progress-container">
                <div className="progress-header">
                  <span className="progress-msg">{progress.message || '正在處理試卷...'}</span>
                  <span className="progress-pct">{progress.percent}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} />
                </div>
              </div>
            )}

            {error && (
              <div className="error-banner">
                ⚠️ {error}
              </div>
            )}
          </div>
        </details>
      )}

      {questions && (
        <>
          <div className="top-stats-container">
            <div className="stats-badges-row no-scrollbar">
              <div className="stat-pill success">總題數：<strong>{stats.total}</strong></div>
              <div className="stat-pill success">選擇題：<strong>{stats.mcq}</strong> | 大題：<strong>{stats.long}</strong></div>
            </div>

            <div className="export-btns-row">
              <button onClick={handleExportJSON} className="export-btn export-json">
                📥 導出 JSON
              </button>
              <button onClick={handleExportMarkdown} className="export-btn export-md">
                📝 導出 Markdown
              </button>
              <button onClick={() => navigate('/quiz')} className="export-btn export-md" style={{ background: '#10b981', borderColor: '#059669', color: 'white' }}>
                📝 開始測驗
              </button>
            </div>
          </div>

          <div className="filter-card">
            <div className="filter-row">
              <span className="control-label">科目分類：</span>
              <div className="chips-scroll no-scrollbar">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFilterCategory(c)}
                    className={`filter-chip ${filterCategory === c ? 'active' : ''}`}
                  >
                    {c === 'All' ? '全部科目' : (CATEGORY_MAP[c] || c)}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-row">
              <span className="control-label">題型：</span>
              <div className="chips-scroll no-scrollbar">
                {['All', 'MCQ', 'Long'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilterType(t)}
                    className={`filter-chip ${filterType === t ? 'active' : ''}`}
                  >
                    {t === 'All' ? '全部題型' : t === 'MCQ' ? '選擇題 (MCQ)' : '解答大題 (Long)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-row">
              <span className="control-label">難度：</span>
              <div className="chips-scroll no-scrollbar">
                {['All', 'Easy', 'Medium', 'Hard'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setFilterDifficulty(d)}
                    className={`filter-chip ${filterDifficulty === d ? 'active' : ''}`}
                  >
                    {d === 'All' ? '全部難度' : (DIFFICULTY_MAP[d] || d)}
                  </button>
                ))}
              </div>
            </div>

            <div className="search-box-wrapper">
              <input
                type="text"
                placeholder="搜尋題目關鍵字、知識點、題號..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="search-input"
              />
              {searchText && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchText('')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="sticky-nav-bar">
            <span className="nav-label">
              題號 ({filtered.length}):
            </span>
            <div className="nav-chips-container no-scrollbar">
              {filtered.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollToQuestion(i)}
                  className="nav-question-pill"
                >
                  {q.question_number || i + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="questions-container">
            {loadingPrestored ? (
              <SkeletonList count={3} />
            ) : (
              filtered.map((q, idx) => {
                return (
                  <div
                    key={idx}
                    id={`q-${idx}`}
                    className="question-card"
                    style={{ borderLeftColor: DIFFICULTY_COLORS[q.difficulty] || '#94a3b8' }}
                  >
                    <div className="card-meta-row">
                      <div className="meta-tags-left">
                        <span className="meta-tag tag-category">
                          {CATEGORY_MAP[q.main_category] || q.main_category}
                        </span>
                        <span className="meta-tag tag-type">
                          {TYPE_MAP[q.question_type] || q.question_type}
                        </span>
                        {(q.sub_topics || []).map((t, i) => (
                          <span key={i} className="meta-tag tag-topic">
                            {TOPIC_MAP[t] || t}
                          </span>
                        ))}
                        <span
                          className="meta-tag"
                          style={{ background: DIFFICULTY_COLORS[q.difficulty] || '#64748b', color: '#fff' }}
                        >
                          {DIFFICULTY_MAP[q.difficulty] || q.difficulty}
                        </span>
                        {typeof q.page === 'number' && (
                          <span className="meta-tag tag-page">
                            第 {q.page} 頁
                          </span>
                        )}
                      </div>

                      <div className="meta-actions-right">
                        <button
                          type="button"
                          onClick={() => handleCopyQuestion(q)}
                          className="action-pill-btn"
                        >
                          📋 複製題幹
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyFull(q)}
                          className="action-pill-btn success"
                        >
                          💡 複製含解答
                        </button>
                        <FavoriteButton
                          question={q}
                          questionId={q.id || `${q.question_number}-${q.raw_text_zh?.slice(0, 20)}`}
                        />
                      </div>
                    </div>

                    <h3 className="question-title">
                      {q.question_number}
                    </h3>

                    <div className={`question-body-grid ${language === 'both' ? 'dual-view' : 'single-view'}`}>
                      {(language === 'zh' || language === 'both') && (
                        <div className="question-text-box">
                          {language === 'both' && <div className="lang-box-label">【中文版】</div>}
                          <div className="question-markdown">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                              {normalizeLatex(q.raw_text_zh || '（本題無中文版題幹）')}
                            </ReactMarkdown>
                          </div>
                          {(() => {
                            const optionsMap = extractOptions(q, 'zh');
                            const optionLetters = ['A', 'B', 'C', 'D', 'E'].filter((l) => Boolean(optionsMap[l]));
                            if (optionLetters.length === 0) return null;
                            return (
                              <div className="mcq-options-container">
                                <div className="mcq-options-grid-display">
                                  {optionLetters.map((letter) => (
                                    <div key={letter} className="mcq-option-card">
                                      <span className="mcq-option-letter-badge">{letter}</span>
                                      <div className="mcq-option-text">
                                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                                          {normalizeLatex(optionsMap[letter])}
                                        </ReactMarkdown>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {(language === 'en' || language === 'both') && (
                        <div className="question-text-box">
                          {language === 'both' && <div className="lang-box-label">【English Version】</div>}
                          <div className="question-markdown">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                              {normalizeLatex(
                                q.raw_text_en && q.raw_text_en.trim() && q.raw_text_en !== q.raw_text_zh
                                  ? q.raw_text_en
                                  : '（澳門四校聯考此歷屆真題為中文試卷，暫無官方英文譯本）'
                              )}
                            </ReactMarkdown>
                          </div>
                          {(() => {
                            const optionsMap = extractOptions(q, 'en');
                            const optionLetters = ['A', 'B', 'C', 'D', 'E'].filter((l) => Boolean(optionsMap[l]));
                            if (optionLetters.length === 0) return null;
                            return (
                              <div className="mcq-options-container">
                                <div className="mcq-options-grid-display">
                                  {optionLetters.map((letter) => (
                                    <div key={letter} className="mcq-option-card">
                                      <span className="mcq-option-letter-badge">{letter}</span>
                                      <div className="mcq-option-text">
                                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                                          {normalizeLatex(optionsMap[letter])}
                                        </ReactMarkdown>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {q.diagram_image && (
                      <div className="diagram-card">
                        <div className="diagram-header">
                          <span className="diagram-title">📐 試題配圖</span>
                          <button
                            type="button"
                            onClick={() => setPreviewImage(cleanDiagramUrl(q.diagram_image))}
                            className="zoom-btn"
                          >
                            🔍 放大查看
                          </button>
                        </div>
                        <div className="diagram-img-wrapper" onClick={() => setPreviewImage(cleanDiagramUrl(q.diagram_image))}>
                          <img
                            src={cleanDiagramUrl(q.diagram_image)}
                            alt="試題配圖"
                            className="diagram-image"
                            onError={(e) => {
                              const filename = (q.diagram_image || '').split('/').pop().replace(/[?#].*$/, '');
                              if (filename && e.target.src.indexOf(':5176') === -1) {
                                e.target.src = `http://${window.location.hostname}:5176/diagrams/${filename}`;
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Answer Accordion - 已移除 .details-body wrapper */}
                    <details className="answer-accordion">
                      <summary className="answer-summary">
                        💡 參考答案與解析
                      </summary>

                      {q.answer && (
                        <div className="answer-highlight-box">
                          <div className="answer-title-label">
                            🎯 參考答案：
                          </div>
                          <div className="answer-markdown">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                              {normalizeLatex(q.answer)}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}

                      {q.solution ? (
                        <div className="question-markdown solution-content">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                            {normalizeLatex(q.solution)}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="no-solution-hint">
                          （官方解答暫未收錄或本卷無對應解答）
                        </div>
                      )}
                    </details>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="scroll-top-btn"
          title="回頂部"
        >
          ↑
        </button>
      )}

      <LoginPanel
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onAuthChange={setCurrentUser}
      />

      {previewImage && (
        <div className="image-zoom-overlay" onClick={() => setPreviewImage(null)}>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setPreviewImage(null)}
          >
            ✕ 關閉
          </button>
          <img src={previewImage} alt="放大配圖" className="zoomed-image" />
          <div className="zoom-hint">輕觸任意處關閉</div>
        </div>
      )}

      <style>{`
        .app-wrapper {
          width: 100%;
          max-width: 1000px;
          margin: 0 auto;
          padding: 24px 16px;
          color: #1e293b;
        }

        .mobile-toast {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #0f172a;
          color: #f8fafc;
          padding: 10px 18px;
          borderRadius: 8px;
          boxShadow: 0 10px 25px rgba(0,0,0,0.25);
          zIndex: 9999;
          font-size: 14px;
          font-weight: 500;
          animation: fadeIn 0.2s ease;
        }

        .app-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .header-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          flex-wrap: wrap;
          gap: 10px;
        }

        .header-auth-box {
          display: flex;
          gap: 8px;
        }

        .auth-login-btn, .auth-user-btn {
          padding: 8px 16px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          color: #334155;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .auth-fav-btn {
          padding: 8px 16px;
          border: 1px solid #fcd34d;
          border-radius: 8px;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          color: #92400e;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s;
          white-space: nowrap;
        }

        .auth-fav-btn:hover {
          background: linear-gradient(135deg, #fde68a 0%, #fbbf24 100%);
          border-color: #f59e0b;
          color: #78350f;
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(245, 158, 11, 0.3);
        }

        .auth-fav-btn:active {
          transform: translateY(0);
        }

        .auth-login-btn:hover, .auth-user-btn:hover {
          background: #f1f5f9;
          border-color: #2563eb;
          color: #2563eb;
        }

        .auth-user-btn {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1e40af;
        }

        .badge-jae {
          display: inline-block;
          padding: 4px 12px;
          background: #e0e7ff;
          color: #3730a3;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .main-title {
          font-size: clamp(2.8rem, 8vw, 6rem);
          font-weight: 900;
          margin: 12px 0 16px;
          letter-spacing: 6px;
          color: #0f172a;
          line-height: 1;
          text-align: center;
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

        .subtitle {
          color: #64748b;
          font-size: clamp(0.95rem, 1.5vw, 1.15rem);
          margin: 0 auto;
          line-height: 1.6;
          text-align: center;
          max-width: 600px;
        }

        .prestored-banner-card {
          background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
          border: 1.5px solid #bfdbfe;
          border-radius: 16px;
          padding: 20px 22px;
          margin-bottom: 20px;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.06);
        }

        .prestored-banner-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }

        .prestored-info-col {
          flex: 1;
          min-width: 280px;
        }

        .prestored-tag {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          color: #1e40af;
          background: #dbeafe;
          padding: 2px 10px;
          border-radius: 12px;
          margin-bottom: 6px;
        }

        .prestored-card-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 6px;
        }

        .prestored-card-desc {
          font-size: 13px;
          color: #475569;
          margin: 0;
          line-height: 1.5;
        }

        .prestored-action-col {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 240px;
        }

        .paper-select-dropdown {
          padding: 9px 12px;
          border: 1.5px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          font-size: 13px;
          font-weight: 500;
          color: #1e293b;
          outline: none;
          cursor: pointer;
        }

        .paper-select-dropdown:focus {
          border-color: #2563eb;
        }

        .btn-load-prestored {
          padding: 10px 16px;
          background: #2563eb;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .btn-load-prestored:hover:not(:disabled) {
          background: #1d4ed8;
          transform: translateY(-1px);
        }

        .btn-load-prestored:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .source-divider {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 18px 0;
          color: #94a3b8;
          font-size: 20px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .source-divider-line {
          flex: 1;
          height: 1px;
          background: #e2e8f0;
        }

        .upload-card {
          background: #ffffff;
          border: 2px dashed #94a3b8;
          border-radius: 14px;
          padding: 24px 18px;
          text-align: center;
          margin-bottom: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        }

        .file-drop-area {
          display: block;
          padding: 20px 12px;
          background: #f8fafc;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          transition: background 0.2s;
          margin-bottom: 16px;
        }

        .file-drop-area:hover {
          background: #f1f5f9;
        }

        .upload-icon {
          font-size: 32px;
          margin-bottom: 6px;
        }

        .upload-hint {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .upload-text-bold {
          font-size: 15px;
          font-weight: 700;
          color: #2563eb;
        }

        .upload-text-sub {
          font-size: 13px;
          color: #64748b;
        }

        .file-info-box {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .file-name {
          font-weight: 600;
          color: #0f172a;
          font-size: 14px;
        }

        .file-size {
          color: #64748b;
          font-size: 13px;
        }

        .clear-file-btn {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fca5a5;
          border-radius: 4px;
          font-size: 12px;
          padding: 2px 8px;
          cursor: pointer;
          font-weight: 600;
        }

        .submit-btn {
          width: 100%;
          max-width: 320px;
          min-height: 44px;
          padding: 10px 24px;
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          background: #2563eb;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
          transition: background 0.2s, transform 0.1s;
        }

        .submit-btn:active {
          transform: scale(0.98);
        }

        .submit-btn.disabled {
          background: #94a3b8;
          cursor: not-allowed;
          box-shadow: none;
        }

        .progress-container {
          margin-top: 20px;
          text-align: left;
          background: #f8fafc;
          padding: 14px 16px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 600;
        }

        .progress-msg {
          color: #2563eb;
        }

        .progress-pct {
          color: #0f172a;
        }

        .progress-track {
          width: 100%;
          height: 10px;
          background: #e2e8f0;
          border-radius: 5px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #2563eb);
          border-radius: 5px;
          transition: width 0.3s ease;
        }

        .error-banner {
          margin-top: 16px;
          padding: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #b91c1c;
          font-size: 14px;
          text-align: left;
        }

        /* 管理員工具高亮面板 */
.admin-upload-collapsible {
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border: 2px dashed #f59e0b;
  border-radius: 12px;
  padding: 0;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);
  overflow: hidden;
  transition: box-shadow 0.25s ease, border-color 0.25s ease;
}

.admin-upload-collapsible:hover {
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.28);
  border-color: #d97706;
}

.admin-upload-collapsible[open] {
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.2);
}

.admin-upload-collapsible summary {
  cursor: pointer;
  font-weight: 700;
  color: #92400e;
  font-size: 1.05rem;
  list-style: none;
  padding: 16px 22px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  transition: background 0.2s ease;
  user-select: none;
  letter-spacing: 0.5px;
}

.admin-upload-collapsible summary::-webkit-details-marker {
  display: none;
}

.admin-upload-collapsible summary::before {
  content: '▶';
  display: inline-block;
  font-size: 11px;
  color: #b45309;
  transition: transform 0.25s ease;
  margin-right: 2px;
}

.admin-upload-collapsible[open] summary::before {
  transform: rotate(90deg);
}

.admin-upload-collapsible[open] summary {
  border-bottom: 1px solid #fde68a;
  background: linear-gradient(135deg, #fde68a 0%, #fcd34d 100%);
}

.admin-upload-collapsible summary:hover {
  background: linear-gradient(135deg, #fde68a 0%, #fbbf24 100%);
}

.admin-upload-collapsible > .upload-card {
  margin: 0;
  border: none;
  border-radius: 0;
  box-shadow: none;
  padding: 20px 18px;
  background: #ffffff;
}

.top-stats-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 24px;
}

.stats-badges-row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

        .stat-pill {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 13px;
          color: #334155;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }

        .stat-pill.success {
          background: #ecfdf5;
          color: #065f46;
          border-color: #a7f3d0;
        }

        .stat-pill.info {
          background: #eff6ff;
          color: #1e40af;
          border-color: #bfdbfe;
        }

.export-btns-row {
  display: flex;
  gap: 14px;
}

        .export-btn {
          padding: 8px 14px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .export-btn:active {
          opacity: 0.8;
        }

        .export-json {
          background: #0f172a;
          color: #fff;
        }

        .export-md {
          background: #2563eb;
          color: #fff;
        }

        .filter-card {
          background: #ffffff;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          margin-bottom: 20px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.03);
        }

        .control-label {
          font-size: 13px;
          font-weight: 700;
          color: #475569;
          min-width: 65px;
        }

        .filter-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .chips-scroll {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          flex: 1;
        }

        .filter-chip {
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 13px;
          cursor: pointer;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          font-weight: 500;
          transition: all 0.15s ease;
          user-select: none;
        }

        .filter-chip.active {
          border-color: #2563eb;
          background: #2563eb;
          color: #ffffff;
          font-weight: 600;
        }

        .search-box-wrapper {
          position: relative;
          margin-top: 4px;
        }

        .search-input {
          width: 100%;
          box-sizing: border-box;
          padding: 9px 36px 9px 12px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        .search-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }

        .search-clear-btn {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 14px;
          cursor: pointer;
          padding: 4px;
        }

        .sticky-nav-bar {
          position: sticky;
          top: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          padding: 10px 8px;
          border-bottom: 1px solid #e2e8f0;
          border-radius: 8px;
          z-index: 100;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.03);
          overflow: visible;
        }

        .sticky-nav-bar::before,
        .sticky-nav-bar::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          width: 24px;
          pointer-events: none;
          z-index: 2;
        }
        .sticky-nav-bar::before {
          left: 70px;
          background: linear-gradient(90deg, rgba(255,255,255,1), rgba(255,255,255,0));
        }
        .sticky-nav-bar::after {
          right: 0;
          background: linear-gradient(-90deg, rgba(255,255,255,1), rgba(255,255,255,0));
        }

        .nav-label {
          font-size: 13px;
          font-weight: 700;
          color: #64748b;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .nav-chips-container {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          overflow-y: hidden;
          white-space: nowrap;
          -webkit-overflow-scrolling: touch;
          padding: 2px 0 8px 0;
          flex: 1;
          min-width: 0;
        }

        .nav-question-pill {
          flex-shrink: 0;
          cursor: pointer;
          padding: 5px 12px;
          border-radius: 6px;
          background: #f1f5f9;
          font-size: 12px;
          font-weight: 700;
          color: #334155;
          border: 1px solid #e2e8f0;
          transition: background 0.15s;
        }

        .nav-question-pill:hover,
        .nav-question-pill:active {
          background: #2563eb;
          color: #ffffff;
          border-color: #2563eb;
        }

        .questions-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .question-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-left: 6px solid #94a3b8;
          border-radius: 12px;
          padding: 22px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.03);
        }

        .card-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 14px;
        }

        .meta-tags-left {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          align-items: center;
        }

        .meta-tag {
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
        }

        .tag-category { background: #2563eb; color: #fff; }
        .tag-type { background: #7c3aed; color: #fff; }
        .tag-topic { background: #059669; color: #fff; font-weight: 500; }
        .tag-page { background: #64748b; color: #fff; }

        .meta-actions-right {
          display: flex;
          gap: 6px;
        }

        .action-pill-btn {
          padding: 5px 10px;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          font-weight: 600;
          color: #334155;
          transition: background 0.15s;
          white-space: nowrap;
        }

        .action-pill-btn:active {
          background: #e2e8f0;
        }

        .action-pill-btn.success {
          background: #f0fdf4;
          border-color: #86efac;
          color: #166534;
        }

        .question-title {
          margin: 0 0 14px 0;
          font-size: 20px;
          color: #0f172a;
          line-height: 1.3;
        }

        .question-body-grid {
          display: flex;
          gap: 16px;
        }

        .question-body-grid.dual-view {
          flex-direction: row;
        }

        .question-body-grid.single-view {
          flex-direction: column;
        }

        .question-text-box {
          flex: 1;
          background: #f8fafc;
          padding: 16px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          line-height: 1.8;
          min-width: 0;
        }

        .lang-box-label {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          margin-bottom: 6px;
        }

        .mcq-options-container {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px dashed #cbd5e1;
        }

        .mcq-options-grid-display {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 10px;
        }

        .mcq-option-card {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 8px 12px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.93rem;
          line-height: 1.5;
          transition: all 0.15s ease;
        }

        .mcq-option-card:hover {
          border-color: #93c5fd;
          background: #f0f7ff;
        }

        .mcq-option-letter-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          background: #2563eb;
          color: #ffffff;
          font-weight: 700;
          font-size: 0.8rem;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .mcq-option-text {
          flex: 1;
          color: #1e293b;
          word-break: break-word;
        }

        .mcq-option-text p {
          margin: 0;
        }

        .diagram-card {
          margin-top: 16px;
          padding: 14px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          text-align: center;
        }

        .diagram-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid #f1f5f9;
        }

        .diagram-title {
          font-size: 13px;
          font-weight: 700;
          color: #334155;
        }

        .zoom-btn {
          padding: 4px 10px;
          font-size: 12px;
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
        }

        .diagram-img-wrapper {
          padding: 8px;
          background: #f8fafc;
          border-radius: 6px;
          display: inline-block;
          max-width: 100%;
        }

        .diagram-image {
          max-width: 100%;
          max-height: 280px;
          object-fit: contain;
          border-radius: 4px;
          cursor: zoom-in;
          display: block;
          margin: 0 auto;
          background: #ffffff;
        }

        /* Answer details - 已移除 .details-body，改為原生 details 行為 */
        .answer-accordion {
          margin-top: 16px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 12px 16px;
        }

        .answer-summary {
          cursor: pointer;
          font-weight: 700;
          color: #15803d;
          font-size: 15px;
          user-select: none;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: color 0.2s;
          list-style: none;
        }

        .answer-summary::-webkit-details-marker {
          display: none;
        }

        .answer-summary::before {
          content: '▶';
          display: inline-block;
          font-size: 10px;
          color: #15803d;
          transition: transform 0.3s ease;
        }

        .answer-accordion[open] .answer-summary::before {
          transform: rotate(90deg);
        }

        .answer-summary:hover {
          color: #166534;
        }

        .answer-highlight-box {
          margin-top: 12px;
          padding: 10px 14px;
          background: #dcfce7;
          border: 1px solid #86efac;
          border-radius: 6px;
          color: #166534;
          font-size: 15px;
        }

        .answer-title-label {
          font-weight: 800;
          margin-bottom: 6px;
          color: #15803d;
        }

        .solution-content {
          margin-top: 14px;
        }

        .no-solution-hint {
          margin-top: 10px;
          color: #94a3b8;
          font-style: italic;
          font-size: 14px;
        }

        .scroll-top-btn {
          position: fixed;
          bottom: 24px;
          right: 20px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #0f172a;
          color: #ffffff;
          border: none;
          font-size: 20px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
          cursor: pointer;
          z-index: 999;
          transition: transform 0.2s, background 0.2s;
        }

        .scroll-top-btn:active {
          transform: scale(0.92);
          background: #2563eb;
        }

        .image-zoom-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 10000;
          cursor: zoom-out;
          padding: 16px;
        }

        .modal-close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(255,255,255,0.2);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.4);
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .zoomed-image {
          max-width: 95%;
          max-height: 80vh;
          border-radius: 8px;
          background: #fff;
          padding: 8px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        }

        .zoom-hint {
          color: #cbd5e1;
          font-size: 13px;
          margin-top: 12px;
        }

        @media (max-width: 768px) {
          .app-wrapper {
            padding: 14px 10px;
          }

          .main-title {
            font-size: clamp(2rem, 10vw, 3rem);
            letter-spacing: 3px;
          }

          .subtitle {
            font-size: 13px;
          }

          .upload-card {
            padding: 16px 12px;
          }

          .submit-btn {
            max-width: 100%;
          }

          .question-body-grid.dual-view {
            flex-direction: column;
          }

          .question-card {
            padding: 16px 12px;
          }

          .card-meta-row {
            flex-direction: column;
            gap: 10px;
          }

          .meta-actions-right {
            width: 100%;
            display: flex;
            gap: 8px;
          }

          .action-pill-btn {
            flex: 1;
            padding: 7px 10px;
            text-align: center;
          }

.top-stats-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;             /* ← 左側統計和右側按鈕之間的間距 */
  margin-bottom: 24px;   /* ← 與下方 filter-card 的距離 */
}

.stats-badges-row {
  display: flex;
  gap: 14px;             /* ← 「總題數」和「選擇題」之間的間距 */
  flex-wrap: wrap;
}

.export-btns-row {
  display: flex;
  gap: 14px;             /* ← 三個按鈕之間的間距 */
  padding: 8px 14px;
  margin: 0 10px;
}

          .export-btn {
            flex: 1;
            padding: 10px;
          }

          .filter-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .chips-scroll {
            width: 100%;
            overflow-x: auto;
            flex-wrap: nowrap;
            white-space: nowrap;
            padding-bottom: 4px;
          }

.admin-upload-collapsible {
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border: 2px dashed #f59e0b;
  border-radius: 12px;
  padding: 0;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);
  overflow: hidden;
  transition: box-shadow 0.25s ease, border-color 0.25s ease;
}

.admin-upload-collapsible:hover {
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.28);
  border-color: #d97706;
}

.admin-upload-collapsible[open] {
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.2);
}

/* summary 做成一个明显的按钮条 */
.admin-upload-collapsible summary {
  cursor: pointer;
  font-weight: 700;
  color: #92400e;
  font-size: 1rem;
  list-style: none;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-bottom: 1px solid transparent;
  transition: background 0.2s ease, border-color 0.2s ease;
  user-select: none;
}

.admin-upload-collapsible summary::-webkit-details-marker {
  display: none;
}

.admin-upload-collapsible summary::before {
  content: '▶';
  display: inline-block;
  font-size: 11px;
  color: #b45309;
  transition: transform 0.25s ease;
  margin-right: 2px;
}

.admin-upload-collapsible[open] summary::before {
  transform: rotate(90deg);
}

.admin-upload-collapsible summary {
  padding: 16px 22px;
  font-size: 1.05rem;
  letter-spacing: 0.5px;
}

.admin-upload-collapsible summary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(245, 158, 11, 0.3);
}

/* 展开后的内容区域 */
.admin-upload-collapsible > .upload-card {
  margin: 0;
  border: none;
  border-radius: 0;
  box-shadow: none;
  padding: 20px 18px;
  background: #ffffff;
}
          .admin-upload-collapsible summary::-webkit-details-marker {
            display: none;
          }
          .admin-upload-collapsible summary::before {
            content: '▶ ';
            display: inline-block;
            transition: transform 0.2s;
            margin-right: 4px;
          }
          .admin-upload-collapsible[open] summary::before {
            transform: rotate(90deg);
          }
          .admin-upload-collapsible[open] summary {
            margin-bottom: 14px;
            padding-bottom: 10px;
            border-bottom: 1px solid #fde68a;
          }
        }
      `}</style>
    </div>
  );
  return (
    <Routes>
      <Route path="/" element={<PageWrapper><HomePage /></PageWrapper>} />
      <Route path="/browse" element={<PageWrapper>{appContent}</PageWrapper>} />
      <Route path="/quiz" element={<PageWrapper><QuizPage /></PageWrapper>} />
      <Route path="/admin" element={<PageWrapper><AdminPage /></PageWrapper>} />
      <Route path="/favorites" element={<PageWrapper><FavoritesPage /></PageWrapper>} />
      <Route path="/review/:quizId" element={<PageWrapper><ReviewPage /></PageWrapper>} />
    </Routes>
  );
}