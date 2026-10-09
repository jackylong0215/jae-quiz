import { LocalizedAttributes } from './i18n.jsx';
import { localizedFetch } from './i18n-api.js';
import { LocalizedText, LocalizedMarkdown, useLocale, getQuestionText, questionOptions, t } from './i18n.jsx';
import React, { useState, useEffect, useMemo, Component, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { api as axios } from './i18n-api.js';
import FavoriteButton from './FavoriteButton.jsx';
import SpeakButton from './SpeakButton.jsx';
import { useSearchParams } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? `http://${window.location.hostname}:8000` : 'http://127.0.0.1:8000');const rehypeKatexOptions = [rehypeKatex, { output: 'html' }];

const ZH_TO_EN_CATEGORY = {
  '三角學': 'Trigonometry', '三角函數': 'Trigonometry',
  '幾何': 'Geometry', '平面幾何': 'Geometry', '解析幾何': 'Geometry', '立體幾何': 'Geometry',
  '代數': 'Algebra', '代數運算': 'Algebra',
  '函數': 'Functions', '函數與對數': 'Functions',
  '概率': 'Probability', '排列與概率': 'Probability',
  '數列': 'Sequences', '數列與級數': 'Sequences',
  '統計': 'Statistics', '微積分': 'Calculus',
};

const PUA_SYMBOL_MAP = {
  '\uF03D': ' = ', '\uF02D': ' - ', '\uF02B': ' + ',
  '\uF03C': ' < ', '\uF03E': ' > ', '\uF0A3': ' \\le ',
  '\uF0B3': ' \\ge ', '\uF0B1': ' \\pm ', '\uF070': ' \\pi ',
  '\uF0CE': ' \\in ', '\uF0C6': ' \\cap ', '\uF061': ' \\alpha ',
  '\uF071': ' \\theta ', '\uF974': '若',
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

function cleanDiagramUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:image')) return url;
  const filename = url.split('/').pop().replace(/[?#].*$/, '');
  if (!filename) return url;
  return `${API_BASE_URL}/diagrams/${filename}`;
}

const CATEGORY_MAP = {
  Algebra: '代數', Calculus: '微積分', Geometry: '幾何',
  Trigonometry: '三角學', Probability: '概率', Statistics: '統計',
  Sequences: '數列', Functions: '函數', 'Number Theory': '數論', Other: '其他'
};
const DIFFICULTY_MAP = { Easy: '基礎', Medium: '中等', Hard: '困難' };
const TYPE_MAP = { MCQ: '選擇題', Long: '解答大題' };

class QuizErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) {
    console.error("Quiz Page Crash caught by ErrorBoundary:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ maxWidth: 700, margin: '50px auto', padding: 30, background: '#fff', borderRadius: 16, border: '1px solid #fee2e2', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: '#b91c1c', marginBottom: 12 }}><LocalizedText value="測驗介面載入出現異常" /></h2>
          <p style={{ color: '#475569', fontSize: 14, marginBottom: 24 }}><LocalizedText value="系統已自動防護並攔截錯誤，避免白屏。" /></p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => window.location.href = '/browse'} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}><LocalizedText value="← 返回題庫" /></button>
            <button onClick={() => this.setState({ hasError: false })} style={{ padding: '10px 20px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}><LocalizedText value="🔄 嘗試恢復" /></button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function extractOptions(q) {
  if (!q) return {};
  const candidates = [questionOptions(q)];
  let raw = null;
  for (const c of candidates) {
    if (c && typeof c === 'object' && Object.keys(c).length > 0) { raw = c; break; }
  }
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

function QuizContent() {
  useLocale();
  const navigate = useNavigate();
  const [questionSource, setQuestionSource] = useState('past');
  const [phase, setPhase] = useState('setup');
  const [loading, setLoading] = useState(false);
  const [activeQuestions, setActiveQuestions] = useState([]);

  const [searchParams] = useSearchParams();

  // 自動從後端載入題庫
  useEffect(() => {
    if (activeQuestions.length === 0) {
      setLoading(true);
      localizedFetch(`${API_BASE_URL}/prestored/questions`)
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok) throw new Error(`HTTP ${r.status}: ${data.detail || 'Unknown'}`);
          console.log('[DEBUG] /prestored/questions returned:', data.total, '題');
          if (data.questions && data.questions.length > 0) setActiveQuestions(data.questions);
        })
        .catch((err) => console.error('Could not auto-fetch prestored questions:', err))
        .finally(() => setLoading(false));
    }
  }, []);

  // 從錯題本跳過來
  useEffect(() => {
    if (searchParams.get('source') === 'practice') {
      const saved = sessionStorage.getItem('jae_practice_quiz');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setQuizId(data.quiz_id);
          setQuizQuestions(data.questions || []);
          setAnswers({});
          setElapsedSeconds(0);
          setCurrentIdx(0);
          setResults(null);
          setAiFeedback('');
          setPhase('taking');
          sessionStorage.removeItem('jae_practice_quiz');
        } catch (e) {
          console.warn('Failed to load practice quiz:', e);
        }
      }
    }
  }, []);

  const ALL_CATEGORIES = ['三角學', '幾何', '代數', '函數', '概率', '數列', '微積分', '解析幾何'];
  const availableCategories = ALL_CATEGORIES;

  const [numQuestions, setNumQuestions] = useState(10);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);

  useEffect(() => {
    if (activeQuestions.length > 0) {
      setNumQuestions(prev => Math.min(Math.max(1, prev || 10), activeQuestions.length));
    }
  }, [activeQuestions]);

  const [quizId, setQuizId] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // ⭐ 新增：每題作答時間
  const [timePerQuestion, setTimePerQuestion] = useState({});
  const questionStartTime = useRef(Date.now());

  const [results, setResults] = useState(null);
  const [aiFeedback, setAiFeedback] = useState('');
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  useEffect(() => {
    let timer;
    if (phase === 'taking') {
      timer = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [phase]);

  // ⭐ 記錄進入某題的時間
  const recordTimeForCurrentQuestion = () => {
    const now = Date.now();
    const spent = Math.round((now - questionStartTime.current) / 1000);
    if (spent > 0 && spent < 3600) {
      setTimePerQuestion(prev => ({
        ...prev,
        [currentIdx]: (prev[currentIdx] || 0) + spent,
      }));
    }
    questionStartTime.current = now;
  };

  // ⭐ 換題（帶時間記錄）
  const goToQuestion = (nextIdx) => {
    recordTimeForCurrentQuestion();
    setCurrentIdx(nextIdx);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleStartQuiz = async () => {
    if (questionSource === 'past' && activeQuestions.length === 0) {
      alert(t("正在載入題庫數據，請稍候再點擊..."));
      return;
    }

    setLoading(true);

    let pool = [...activeQuestions];
    if (questionSource === 'past' && selectedCategories.length > 0) {
      const expanded = new Set();
      for (const cat of selectedCategories) {
        expanded.add(cat);
        if (ZH_TO_EN_CATEGORY[cat]) expanded.add(ZH_TO_EN_CATEGORY[cat]);
      }
      pool = pool.filter(q => expanded.has(q.main_category));
    }
    if (questionSource === 'past' && selectedDifficulties.length > 0) {
      pool = pool.filter(q => selectedDifficulties.includes(q.difficulty));
    }
    if (questionSource === 'past' && selectedTypes.length > 0) {
      pool = pool.filter(q => selectedTypes.includes(q.question_type));
    }
    if (questionSource === 'past' && pool.length === 0) {
      alert(t('沒有符合篩選條件的題目，請更換科目或難度'));
      setLoading(false);
      return;
    }

    const maxCount = questionSource === 'ai' ? 20 : pool.length;
    const countTarget = Math.min(Math.max(1, parseInt(numQuestions, 10) || 10), maxCount);

    try {
      const endpoint = questionSource === 'ai'
        ? `${API_BASE_URL}/generate-ai-quiz`
        : `${API_BASE_URL}/generate-quiz`;

      const body = questionSource === 'ai'
        ? { count: countTarget, categories: selectedCategories.length > 0 ? selectedCategories : availableCategories, difficulties: selectedDifficulties, types: selectedTypes }
        : { questions: pool, count: countTarget, difficulties: selectedDifficulties, types: selectedTypes };

      const token = localStorage.getItem('jae_token');
      const res = await axios.post(endpoint, body, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      const data = res.data;

      if (data && data.quiz_id && data.questions && data.questions.length > 0) {
        setQuizId(data.quiz_id);
        setQuizQuestions(data.questions);
        setAnswers({});
        setElapsedSeconds(0);
        setCurrentIdx(0);
        setResults(null);
        setAiFeedback('');
        setTimePerQuestion({});
        questionStartTime.current = Date.now();
        setPhase('taking');
        setLoading(false);
        return;
      }

      alert(t('後端回傳的試卷資料不完整，請稍後再試'));
      setLoading(false);
    } catch (err) {
      console.error('generate-quiz failed:', err);
      const detail = err.response?.data?.detail || err.message || '未知錯誤';
      alert(t(questionSource === 'ai' ? `AI 生成失敗：${detail}` : `無法生成試卷：${detail}`));
      setLoading(false);
    }
  };

  const handleConfirmSubmit = () => {
    setConfirmModalOpen(false);
    executeSubmit();
  };

  const handleSubmit = () => {
    const unanswered = quizQuestions.length - Object.keys(answers).length;
    if (unanswered > 0) {
      setConfirmModalOpen(true);
      return;
    }
    executeSubmit();
  };

  const executeSubmit = async () => {
    setLoading(true);
    // ⭐ 提交前先記錄最後一題的時間
    recordTimeForCurrentQuestion();

    const token = typeof window !== 'undefined' ? localStorage.getItem('jae_token') : null;
    const reqHeaders = { 'Content-Type': 'application/json' };
    if (token) reqHeaders['Authorization'] = `Bearer ${token}`;

    // ⭐ 把時間也一起傳給後端（React state 是非同步的，這裡直接從 ref 拿也行，但先傳目前 state）
    const timeToSend = { ...timePerQuestion };

    try {
      const res = await axios.post(`${API_BASE_URL}/submit-quiz`, {
        quiz_id: quizId,
        answers: Object.fromEntries(
          Object.entries(answers).map(([k, v]) => [String(k), String(v).toUpperCase()])
        ),
        time_per_question: timeToSend,
      }, { headers: reqHeaders });

      if (res.data) {
        setResults(res.data);
        setPhase('results');
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error('Backend submit-quiz failed:', err);
      alert(t(`提交失敗：${err.response?.data?.detail || err.message}`));
      setLoading(false);
    }
  };

  const handleAnswerChange = (val) => {
    const normalized = String(val).toUpperCase();
    setAnswers(prev => ({ ...prev, [currentIdx]: normalized }));
  };

  const fetchPedagogicalFeedback = async () => {
    if (!results) return;
    setLoadingFeedback(true);
    try {
      const breakdown = results.category_breakdown || {};
      const weak = Object.entries(breakdown)
        .filter(([_, st]) => (st.percent || 0) < 60)
        .map(([cat]) => CATEGORY_MAP[cat] || cat);

      const wrongQuestions = (results.results || [])
        .filter(r => r.question_type !== 'Long' && !r.is_correct)
        .map(r => ({
          category: CATEGORY_MAP[r.main_category] || r.main_category,
          number: r.question_number,
          topics: r.sub_topics || [],
          stem: (r.raw_text_zh || '').slice(0, 80),
        }));

      const res = await axios.post(`${API_BASE_URL}/ai/pedagogical-feedback`, {
        score_percent: results.score_percent || 0,
        weak_categories: weak,
        category_breakdown: breakdown,
        wrong_questions: wrongQuestions,
      });
      setAiFeedback(res.data.feedback);
    } catch (e) {
      console.error('Failed to get pedagogical feedback:', e);
      setAiFeedback('本次測驗各科目評估已生成。建議重點強化失分模組的基礎定理與公式練習。');
    } finally {
      setLoadingFeedback(false);
    }
  };

  const toggleCategory = (cat) => {
    setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };
  const toggleDifficulty = (diff) => {
    setSelectedDifficulties(prev => prev.includes(diff) ? prev.filter(d => d !== diff) : [...prev, diff]);
  };
  const toggleType = (type) => {
    setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  // ============= Phase 1: Setup =============
  if (phase === 'setup') {
    const isLoggedIn = !!localStorage.getItem('jae_token');

    return (
      <div className="quiz-container">
        <div className="quiz-header-bar">
          <button className="back-btn" onClick={() => navigate('/browse')}><LocalizedText value="← 返回題庫" /></button>
          <h2><LocalizedText value="📝 四校勝券 · 互動組卷測驗" /></h2>
        </div>

        <div className="setup-card card">
          <div className="setup-info">
            <span className="pool-badge"><LocalizedText value="題庫可用題數：" /><strong><LocalizedText value={activeQuestions.length} /></strong><LocalizedText value="道真題" /></span>
            {activeQuestions.length === 0 && (
              <span className="loading-badge"><LocalizedText value="⏳ 正在自動連接並載入本地真題庫..." /></span>
            )}
          </div>

          <div className="form-item">
            <label><LocalizedText value="題目來源：" /></label>
            <div className="source-toggle">
              <button
                type="button"
                className={`source-btn ${questionSource === 'past' ? 'active' : ''}`}
                onClick={() => setQuestionSource('past')}
              ><LocalizedText value="📚 歷屆真題" /><span className="source-sub"><LocalizedText value="直接使用原題" /></span>
              </button>
              <button
                type="button"
                className={`source-btn ${questionSource === 'ai' ? 'active' : ''}`}
                onClick={() => setQuestionSource('ai')}
              ><LocalizedText value="🤖 AI 相似題" /><span className="source-sub"><LocalizedText value="同類型新題" /></span>
              </button>
            </div>
            {questionSource === 'ai' && !isLoggedIn && (
              <div style={{ marginTop: 8, color: '#b45309', fontSize: '0.85rem' }}><LocalizedText value="⚠️ AI 生成需要先登入帳號" /></div>
            )}
          </div>

          <div className="form-item">
            <label><LocalizedText value="測驗題數：" /><strong><LocalizedText value={numQuestions} /></strong><LocalizedText value="題" /></label>
            <input
              type="range"
              min="1"
              max={questionSource === 'ai' ? 20 : Math.max(1, activeQuestions.length)}
              value={numQuestions}
              onChange={(e) => setNumQuestions(parseInt(e.target.value, 10))}
              className="slider"
            />
          </div>

          {availableCategories.length > 0 && (
            <div className="form-item">
              <label><LocalizedText value="科目模組篩選：" />{selectedCategories.length === 0 && (
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 400, marginLeft: 6 }}><LocalizedText value="（未選 = 全部科目）" /></span>
                )}
              </label>
              <div className="chips-group">
                {availableCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={`filter-chip ${selectedCategories.includes(cat) ? 'active' : ''}`}
                    onClick={() => toggleCategory(cat)}
                  >
                    <LocalizedText value={cat} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-item">
            <label><LocalizedText value="難度篩選：" /></label>
            <div className="chips-group">
              {['Easy', 'Medium', 'Hard'].map(diff => (
                <button
                  key={diff}
                  type="button"
                  className={`filter-chip ${selectedDifficulties.includes(diff) ? 'active' : ''}`}
                  onClick={() => toggleDifficulty(diff)}
                >
                  <LocalizedText value={DIFFICULTY_MAP[diff]} />
                </button>
              ))}
            </div>
          </div>

          <div className="form-item">
            <label><LocalizedText value="題型篩選：" /></label>
            <div className="chips-group">
              {['MCQ', 'Long'].map(t => (
                <button
                  key={t}
                  type="button"
                  className={`filter-chip ${selectedTypes.includes(t) ? 'active' : ''}`}
                  onClick={() => toggleType(t)}
                >
                  <LocalizedText value={TYPE_MAP[t]} />
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn btn-primary start-btn"
            onClick={handleStartQuiz}
            disabled={loading || (questionSource === 'past' && activeQuestions.length === 0)}
          >
            <LocalizedText value={loading ? (questionSource === 'ai' ? '🤖 AI 生成中，請稍候...' : '正在生成試卷...') : '🚀 開始作答測驗'} />
          </button>
        </div>
      </div>
    );
  }

  // ============= Phase 2: Taking =============
  if (phase === 'taking') {
    if (!quizQuestions || quizQuestions.length === 0) {
      return (
        <div className="quiz-container">
          <div className="card text-center p-8">
            <h3><LocalizedText value="⚠️ 測驗試題載入中或未抽取到題目" /></h3>
            <button className="btn btn-primary mt-4" onClick={() => setPhase('setup')}><LocalizedText value="返回重試" /></button>
          </div>
        </div>
      );
    }

    const safeIdx = Math.max(0, Math.min(currentIdx, quizQuestions.length - 1));
    const q = quizQuestions[safeIdx] || quizQuestions[0];
    const isMCQ = q.question_type === 'MCQ' || !q.question_type;
    const questionText = getQuestionText(q);
    const optionsMap = extractOptions(q);
    const optionLetters = ['A', 'B', 'C', 'D', 'E'].filter(l => Boolean(optionsMap[l]));
    const hasOptions = optionLetters.length > 0;

    return (
      <div className="quiz-container">
        {confirmModalOpen && (
          <div className="modal-overlay" onClick={() => setConfirmModalOpen(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <h3 className="modal-title"><LocalizedText value="⚠️ 還有題目尚未完成作答" /></h3>
              <p className="modal-text"><LocalizedText value="還有" /><strong><LocalizedText value={quizQuestions.length - Object.keys(answers).length} /></strong><LocalizedText value="題尚未填寫答案，確定現在交卷嗎？" /></p>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setConfirmModalOpen(false)}><LocalizedText value="繼續作答" /></button>
                <button className="btn btn-success" onClick={handleConfirmSubmit}><LocalizedText value="確認提交" /></button>
              </div>
            </div>
          </div>
        )}

        <div className="quiz-top-bar card">
          <div className="progress-info"><LocalizedText value="第" /><strong><LocalizedText value={safeIdx + 1} /></strong> / <LocalizedText value={quizQuestions.length} /><LocalizedText value="題" /><span className="answered-sub"><LocalizedText value="（已作答" /><LocalizedText value={Object.keys(answers).length} /> / <LocalizedText value={quizQuestions.length} /><LocalizedText value="題）" /></span>
          </div>
          <div className="timer-badge">⏱️ <LocalizedText value={formatTime(elapsedSeconds)} /></div>
        </div>

        <div className="card navdot-card">
          <div className="navdots-strip">
            {quizQuestions.map((_, i) => (
              <LocalizedAttributes key={i}><button
                key={i}
                type="button"
                className={`navdot ${answers[i] ? 'done' : ''} ${i === safeIdx ? 'current' : ''}`}
                onClick={() => goToQuestion(i)}
                title={`第 ${i + 1} 題`}
              >
                <LocalizedText value={i + 1} />
              </button></LocalizedAttributes>
            ))}
          </div>
        </div>

        <div className="question-taking-card card">
<div className="question-meta-row">
  <span className="meta-tag tag-category"><LocalizedText value={CATEGORY_MAP[q.main_category] || q.main_category || '數學'} /></span>
  <span className="meta-tag tag-type"><LocalizedText value={TYPE_MAP[q.question_type] || '選擇題'} /></span>
  <span className="meta-tag tag-difficulty"><LocalizedText value={DIFFICULTY_MAP[q.difficulty] || q.difficulty || '中等'} /></span>
  {q.source === 'ai' && (
    <span className="meta-tag" style={{ background: '#8b5cf6', color: '#fff' }}><LocalizedText value="🤖 AI 生成" /></span>
  )}
  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
    <SpeakButton
      text={getQuestionText(q)}
      options={extractOptions(q)}
      size="small"
    />
    <FavoriteButton
      question={q}
      questionId={q.id || `${q.question_number}-${q.raw_text_zh?.slice(0, 20)}`}
    />
  </div>
</div>

          <div className="question-body">
            <LocalizedMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
              {normalizeLatex(questionText)}
            </LocalizedMarkdown>
          </div>

          {q.diagram_image && (
            <div className="diagram-box">
              <LocalizedAttributes><img
                src={cleanDiagramUrl(q.diagram_image)}
                alt={"配圖"}
                className="diagram-img"
                onError={(e) => { e.target.style.display = 'none'; }}
              /></LocalizedAttributes>
            </div>
          )}

          <div className="answer-section">
            {isMCQ ? (
              hasOptions ? (
                <div className="mcq-options-grid">
                  {optionLetters.map(opt => {
                    const content = optionsMap[opt];
                    const isSelected = answers[safeIdx] === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        className={`option-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleAnswerChange(opt)}
                      >
                        <span className="option-letter"><LocalizedText value={opt} /></span>
                        <span className="option-content">
                          <LocalizedMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                            {normalizeLatex(content)}
                          </LocalizedMarkdown>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mcq-options-letter-only">
                  {['A', 'B', 'C', 'D', 'E'].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      className={`option-btn-letter ${answers[safeIdx] === opt ? 'selected' : ''}`}
                      onClick={() => handleAnswerChange(opt)}
                    >
                      <span className="option-letter"><LocalizedText value={opt} /></span>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div className="long-answer-box">
                <LocalizedAttributes><textarea
                  placeholder={"請在此輸入你的最終答案或解題數值..."}
                  value={answers[safeIdx] || ''}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  rows={4}
                  className="long-textarea"
                /></LocalizedAttributes>
              </div>
            )}
          </div>
        </div>

        <div className="quiz-bottom-nav">
          <button
            className="btn btn-secondary"
            onClick={() => goToQuestion(Math.max(0, safeIdx - 1))}
            disabled={safeIdx === 0}
          ><LocalizedText value="← 上一題" /></button>

          {safeIdx < quizQuestions.length - 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => goToQuestion(Math.min(quizQuestions.length - 1, safeIdx + 1))}
            ><LocalizedText value="下一題 →" /></button>
          ) : (
            <button className="btn btn-success" onClick={handleSubmit} disabled={loading}>
              <LocalizedText value={loading ? '正在批改中...' : '🎯 提交測驗並查看報告'} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ============= Phase 3: Results =============
  if (phase === 'results') {
    if (!results) {
      return (
        <div className="quiz-container">
          <div className="card text-center p-8">
            <h3><LocalizedText value="⏳ 正在計算測驗成績..." /></h3>
            <button className="btn btn-primary mt-4" onClick={() => setPhase('setup')}><LocalizedText value="返回重試" /></button>
          </div>
        </div>
      );
    }

    const reviewList = results.results || [];
    const mcqList = reviewList.filter(r => r.question_type !== 'Long');
    const longList = reviewList.filter(r => r.question_type === 'Long');
    const totalQ = mcqList.length;
    const correctQ = mcqList.filter(r => r.is_correct).length;
    const scorePct = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;
    const longCount = longList.length;
    const breakdown = results.category_breakdown || {};

    return (
      <div className="quiz-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <button className="btn btn-secondary" onClick={() => navigate('/browse')}><LocalizedText value="← 返回題庫" /></button>
          <h2 style={{ margin: 0 }}><LocalizedText value="📊 四校勝券 · 模擬測驗診斷報告" /></h2>
          <div style={{ width: 100 }} />
        </div>

        <div className="results-summary card">
          <div className="score-circle-wrapper">
            <div className="score-circle" style={{
              borderColor: scorePct >= 80 ? '#10b981' : scorePct >= 60 ? '#f59e0b' : '#ef4444'
            }}>
              <div className="score-number"><LocalizedText value={correctQ} /> <span className="score-total">/ <LocalizedText value={totalQ} /></span></div>
              <div className="score-pct"><LocalizedText value={scorePct} />%</div>
            </div>
          </div>
          <p className="time-taken"><LocalizedText value="總作答用時：" /><strong><LocalizedText value={formatTime(elapsedSeconds)} /></strong></p>
          {longCount > 0 && (
            <p className="time-taken" style={{ marginTop: 6, fontSize: '0.85rem', color: '#0369a1' }}><LocalizedText value="ℹ️ 本次測驗含" /><LocalizedText value={longCount} /><LocalizedText value="道解答大題，不計入自動評分，請自行核對解析。" /></p>
          )}
        </div>

        {Object.keys(breakdown).length > 0 && (
          <div className="card">
            <h3><LocalizedText value="📈 各學科模組得分率與掌握評定（僅選擇題）" /></h3>
            <table className="stats-table">
              <thead>
                <tr>
                  <th><LocalizedText value="模組" /></th><th><LocalizedText value="正確 / 總題數" /></th><th><LocalizedText value="得分率" /></th><th><LocalizedText value="狀態評定" /></th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(breakdown).map(([cat, stat]) => {
                  const pct = stat.percent !== undefined ? stat.percent : 0;
                  return (
                    <tr key={cat}>
                      <td><strong><LocalizedText value={CATEGORY_MAP[cat] || cat} /></strong></td>
                      <td><LocalizedText value={stat.correct} /> / <LocalizedText value={stat.total} /></td>
                      <td>
                        <div className="progress-cell">
                          <div className="progress-bg">
                            <div className="progress-fill" style={{
                              width: `${pct}%`,
                              background: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
                            }} />
                          </div>
                          <span><LocalizedText value={pct} />%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`eval-pill ${pct >= 80 ? 'green' : pct >= 50 ? 'yellow' : 'red'}`}>
                          <LocalizedText value={pct >= 80 ? '熟練掌握' : pct >= 50 ? '尚待鞏固' : '重點薄弱'} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="card pedagogical-card">
          <div className="pedagogical-header">
            <div>
              <h3><LocalizedText value="🎓 AI 個人化提分建議" /></h3>
              <p className="pedagogical-sub"><LocalizedText value="根據你的錯題與弱項模組，給出具體可執行的學習處方" /></p>
            </div>
            {!aiFeedback && (
              <button className="feedback-btn" onClick={fetchPedagogicalFeedback} disabled={loadingFeedback}>
                <LocalizedText value={loadingFeedback ? 'AI 分析中...' : '生成專屬提分建議'} />
              </button>
            )}
          </div>
          {aiFeedback && (
            <div className="pedagogical-content">
              <LocalizedMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                {normalizeLatex(aiFeedback)}
              </LocalizedMarkdown>
            </div>
          )}
        </div>

        <div className="reviews-list">
          <h3><LocalizedText value="🔍 逐題對錯覆盤與公式詳解" /></h3>
          {reviewList.map((r, i) => {
            const isLong = r.question_type === 'Long';
            const isCorrect = r.is_correct;
            const cardClass = isLong ? 'long-border' : (isCorrect ? 'correct-border' : 'wrong-border');

            return (
              <div key={i} className={`card review-card ${cardClass}`}>
                <div className="review-header">
                  <div className="review-title">
                    <h4><LocalizedText value={r.question_number || `第 ${i + 1} 題`} /></h4>
                    <span className="review-cat"><LocalizedText value={CATEGORY_MAP[r.main_category] || r.main_category || ''} /></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isLong ? (
                      <span className="status-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}><LocalizedText value="📖 自我核對" /></span>
                    ) : (
                      <span className={`status-badge ${isCorrect ? 'success' : 'error'}`}>
                        <LocalizedText value={isCorrect ? '✅ 答對' : '❌ 答錯'} />
                      </span>
                    )}
                    <FavoriteButton question={r} questionId={r.id || `${r.question_number}-${r.raw_text_zh?.slice(0, 20)}`} />
                  </div>
                </div>

                <div className="question-markdown">
                  <LocalizedMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                    {normalizeLatex(r.raw_text_zh || r.raw_text_en || '')}
                  </LocalizedMarkdown>
                </div>

                {r.diagram_image && (
                  <div className="diagram-box">
                    <LocalizedAttributes><img src={cleanDiagramUrl(r.diagram_image)} alt={"配圖"} className="diagram-img" onError={(e) => { e.target.style.display = 'none'; }} /></LocalizedAttributes>
                  </div>
                )}

                {!isLong && (() => {
                  const optionsMap = extractOptions(r);
                  const letters = ['A', 'B', 'C', 'D', 'E'].filter(l => Boolean(optionsMap[l]));
                  if (letters.length === 0) return null;
                  const correctLetter = String(r.correct_answer || r.answer || '').trim().toUpperCase();
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14, marginBottom: 14 }}>
                      {letters.map(letter => {
                        const isRight = letter === correctLetter;
                        return (
                          <div key={letter} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
                            background: isRight ? '#dcfce7' : '#f8fafc',
                            border: `1.5px solid ${isRight ? '#10b981' : '#e2e8f0'}`,
                            borderRadius: 8, fontSize: '0.95rem', lineHeight: 1.6,
                          }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 24, height: 24,
                              background: isRight ? '#10b981' : '#2563eb',
                              color: '#fff', fontWeight: 700, fontSize: '0.8rem',
                              borderRadius: '50%', flexShrink: 0, marginTop: 2,
                            }}>
                              <LocalizedText value={letter} />
                            </span>
                            <div style={{ flex: 1, color: isRight ? '#15803d' : '#1e293b', wordBreak: 'break-word' }}>
                              <LocalizedMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                                {normalizeLatex(optionsMap[letter])}
                              </LocalizedMarkdown>
                            </div>
                            {isRight && (
                              <span style={{ color: '#15803d', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}><LocalizedText value="✅ 正確" /></span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {isLong ? (
                  <div className="long-self-check">
                    <div className="long-self-check-hint"><LocalizedText value="📝 此為解答大題，請對照下方「你的作答」與「參考詳解」自行核對。" /></div>
                    <div className="long-compare-grid">
                      <div className="long-answer-panel user-panel">
                        <div className="panel-title"><LocalizedText value="✍️ 你的作答" /></div>
                        <pre className="user-answer-pre"><LocalizedText value={r.user_answer || '(未作答)'} /></pre>
                      </div>
                      <div className="long-answer-panel standard-panel">
                        <div className="panel-title"><LocalizedText value="📘 參考答案" /></div>
                        <div className="standard-answer-content">
                          <LocalizedMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                            {normalizeLatex(r.correct_answer || r.answer || '（無標準答案）')}
                          </LocalizedMarkdown>
                        </div>
                      </div>
                    </div>
                    {r.solution && (
                      <details className="solution-details" open>
                        <summary><LocalizedText value="💡 查看權威步驟推導與解析" /></summary>
                        <div className="solution-text">
                          <LocalizedMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                            {normalizeLatex(r.solution)}
                          </LocalizedMarkdown>
                        </div>
                      </details>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="answers-compare">
                      <div className={`ans-box ${isCorrect ? 'user-correct' : 'user-wrong'}`}>
                        <strong><LocalizedText value="你的作答：" /></strong> <LocalizedText value={r.user_answer || '(未作答)'} />
                      </div>
                      <div className="ans-box standard-correct">
                        <strong><LocalizedText value="標準答案：" /></strong> <LocalizedText value={r.correct_answer || r.answer || '(無答案)'} />
                      </div>
                    </div>
                    {r.solution && (
                      <details className="solution-details">
                        <summary><LocalizedText value="💡 查看權威步驟推導與解析" /></summary>
                        <div className="solution-body">
                          <div className="solution-text">
                            <LocalizedMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                              {normalizeLatex(r.solution)}
                            </LocalizedMarkdown>
                          </div>
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="results-actions" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => setPhase('setup')}><LocalizedText value="🔄 重新生成測驗" /></button>
        </div>
      </div>
    );
  }

  return null;
}

export default function QuizPage() {
  useLocale();
  return (
    <QuizErrorBoundary>
      <style>{styles}</style>
      <QuizContent />
    </QuizErrorBoundary>
  );
}

const styles = `
.solution-details[open] .solution-body { grid-template-rows: 1fr; opacity: 1; }
.solution-body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.35s ease, opacity 0.3s ease; overflow: hidden; opacity: 0; }
.solution-body > * { min-height: 0; }
.quiz-container { max-width: 860px; margin: 0 auto; padding: 20px 16px 60px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Microsoft JhengHei", sans-serif; color: #1e293b; }
.card { background: #ffffff; border-radius: 14px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03); border: 1px solid #e2e8f0; }
.quiz-header-bar { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.source-toggle { display: flex; gap: 10px; }
.source-btn { flex: 1; padding: 14px 16px; border: 2px solid #e2e8f0; background: #f8fafc; border-radius: 12px; cursor: pointer; text-align: left; transition: all 0.15s; font-family: inherit; font-size: 0.95rem; color: #334155; font-weight: 600; display: flex; flex-direction: column; gap: 4px; }
.source-btn.active { border-color: #2563eb; background: #eff6ff; color: #1e40af; }
.source-sub { font-size: 0.78rem; font-weight: 400; opacity: 0.75; }
.back-btn { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; color: #475569; transition: all 0.2s; }
.back-btn:hover { background: #e2e8f0; }
.pool-badge { display: inline-block; background: #eff6ff; color: #1d4ed8; padding: 6px 14px; border-radius: 20px; font-size: 0.9rem; font-weight: 600; margin-bottom: 16px; }
.loading-badge { display: inline-block; margin-left: 10px; color: #64748b; font-size: 0.85rem; }
.form-item { margin-bottom: 20px; }
.form-item label { display: block; font-weight: 600; color: #334155; margin-bottom: 8px; }
.slider { width: 100%; cursor: pointer; }
.chips-group { display: flex; flex-wrap: wrap; gap: 8px; }
.filter-chip { background: #f8fafc; border: 1.5px solid #cbd5e1; padding: 6px 14px; border-radius: 20px; cursor: pointer; font-size: 0.9rem; font-weight: 500; color: #475569; transition: all 0.2s; }
.filter-chip.active { background: #2563eb; border-color: #2563eb; color: #ffffff; }
.btn { padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 0.95rem; cursor: pointer; border: none; transition: all 0.2s; }
.btn-primary { background: #2563eb; color: #fff; }
.btn-primary:hover:not(:disabled) { background: #1d4ed8; }
.btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
.btn-success { background: #10b981; color: #fff; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.start-btn { width: 100%; padding: 14px; font-size: 1.05rem; }
.quiz-top-bar { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; }
.progress-info { font-size: 1.1rem; font-weight: 600; }
.answered-sub { font-size: 0.85rem; color: #64748b; font-weight: normal; margin-left: 8px; }
.timer-badge { background: #fef3c7; color: #b45309; padding: 6px 14px; border-radius: 12px; font-weight: 700; font-size: 0.95rem; }
.navdot-card { padding: 12px 16px; margin-bottom: 14px; }
.navdots-strip { display: flex; flex-wrap: wrap; gap: 6px; }
.navdot { width: 32px; height: 32px; border-radius: 6px; border: 1.5px solid #cbd5e1; background: #fff; color: #64748b; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
.navdot.done { background: #dcfce7; border-color: #10b981; color: #15803d; }
.navdot.current { outline: 2px solid #2563eb; outline-offset: 1px; font-weight: 700; }
.question-taking-card { padding: 24px; }
.question-meta-row { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.meta-tag { padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; }
.tag-category { background: #eff6ff; color: #1d4ed8; }
.tag-type { background: #f3e8ff; color: #6b21a8; }
.tag-difficulty { background: #fef3c7; color: #b45309; }
.question-body { font-size: 1.05rem; line-height: 1.8; margin-bottom: 24px; word-break: break-word; }
.mcq-options-grid { display: flex; flex-direction: column; gap: 12px; }
.option-btn { display: flex; align-items: flex-start; gap: 14px; padding: 14px 18px; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 10px; cursor: pointer; text-align: left; transition: all 0.15s; width: 100%; color: inherit; font: inherit; }
.option-btn:hover { border-color: #3b82f6; background: #eff6ff; }
.option-btn.selected { border-color: #2563eb; background: #dbeafe; }
.option-letter { width: 28px; height: 28px; border-radius: 6px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #334155; flex-shrink: 0; }
.option-btn.selected .option-letter { background: #2563eb; color: #fff; }
.option-content { flex: 1; line-height: 1.5; font-size: 1rem; }
.mcq-options-letter-only { display: flex; gap: 10px; }
.option-btn-letter { width: 48px; height: 48px; border-radius: 10px; border: 2px solid #e2e8f0; background: #f8fafc; cursor: pointer; font-size: 1.1rem; font-weight: 700; }
.option-btn-letter.selected { background: #2563eb; color: #fff; border-color: #2563eb; }
.long-textarea { width: 100%; padding: 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 1rem; outline: none; }
.long-textarea:focus { border-color: #2563eb; }
.quiz-bottom-nav { display: flex; justify-content: space-between; margin-top: 24px; }
.modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.modal-box { background: #fff; border-radius: 14px; padding: 24px; max-width: 420px; width: 90%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); }
.modal-title { margin: 0 0 10px; font-size: 1.15rem; color: #b45309; }
.modal-text { margin: 0 0 20px; color: #475569; font-size: 0.95rem; line-height: 1.6; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
.results-summary { text-align: center; padding: 30px; }
.score-circle-wrapper { display: flex; justify-content: center; margin-bottom: 16px; }
.score-circle { width: 150px; height: 150px; border-radius: 50%; border: 8px solid #2563eb; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.score-number { font-size: 2rem; font-weight: 800; }
.score-total { font-size: 1.1rem; color: #64748b; font-weight: 500; }
.score-pct { font-size: 1.1rem; font-weight: 700; color: #64748b; }
.time-taken { font-size: 0.95rem; color: #64748b; margin: 0; }
.stats-table { width: 100%; border-collapse: collapse; margin-top: 14px; }
.stats-table th, .stats-table td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 0.92rem; }
.progress-cell { display: flex; align-items: center; gap: 10px; }
.progress-bg { flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 4px; }
.eval-pill { padding: 4px 10px; border-radius: 12px; font-size: 0.78rem; font-weight: 700; }
.eval-pill.green { background: #dcfce7; color: #15803d; }
.eval-pill.yellow { background: #fef3c7; color: #b45309; }
.eval-pill.red { background: #fee2e2; color: #b91c1c; }
.pedagogical-card { background: #f0fdf4; border: 1.5px solid #86efac; }
.pedagogical-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
.pedagogical-sub { font-size: 0.85rem; color: #15803d; margin: 2px 0 0; }
.feedback-btn { padding: 8px 16px; background: #16a34a; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
.pedagogical-content { margin-top: 16px; padding-top: 16px; border-top: 1px dashed #86efac; line-height: 1.7; color: #14532d; }
.review-card { border-left: 6px solid #cbd5e1; }
.review-card.correct-border { border-left-color: #10b981; }
.review-card.wrong-border { border-left-color: #ef4444; }
.review-card.long-border { border-left-color: #0ea5e9; }
.review-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.review-cat { font-size: 0.85rem; color: #64748b; margin-left: 8px; }
.status-badge { padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 0.85rem; }
.status-badge.success { background: #dcfce7; color: #15803d; }
.status-badge.error { background: #fee2e2; color: #b91c1c; }
.answers-compare { display: flex; gap: 12px; margin: 14px 0; flex-wrap: wrap; }
.ans-box { flex: 1; min-width: 180px; padding: 10px 14px; border-radius: 8px; font-size: 0.95rem; }
.user-correct { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
.user-wrong { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
.standard-correct { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }
.solution-details { margin-top: 12px; padding: 10px; background: #f8fafc; border-radius: 8px; }
.solution-details summary { cursor: pointer; font-weight: 600; color: #0369a1; }
.solution-text { margin-top: 10px; line-height: 1.7; color: #1e293b; }
.results-actions { display: flex; justify-content: space-between; margin-top: 24px; }
.diagram-box { margin: 12px 0; text-align: center; }
.diagram-img { max-width: 100%; max-height: 260px; object-fit: contain; }
.long-self-check { margin-top: 12px; }
.long-self-check-hint { padding: 8px 12px; background: #e0f2fe; color: #075985; border-radius: 6px; font-size: 0.88rem; margin-bottom: 12px; }
.long-compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
@media (max-width: 768px) { .long-compare-grid { grid-template-columns: 1fr; } }
.long-answer-panel { border-radius: 8px; padding: 12px 14px; font-size: 0.92rem; line-height: 1.6; }
.long-answer-panel.user-panel { background: #fffbeb; border: 1px solid #fde68a; }
.long-answer-panel.standard-panel { background: #f0f9ff; border: 1px solid #bae6fd; }
.panel-title { font-weight: 700; font-size: 0.85rem; margin-bottom: 8px; color: #334155; }
.user-answer-pre { margin: 0; font-family: inherit; white-space: pre-wrap; word-break: break-word; color: #78350f; }
.standard-answer-content { color: #0c4a6e; word-break: break-word; }
`;