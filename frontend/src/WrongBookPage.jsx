import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import axios from 'axios';
import 'katex/dist/katex.min.css';
import SpeakButton from './SpeakButton.jsx';
import { StreakBadge, MasteryTrend, Achievements } from './StatsWidgets.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`;
const rehypeKatexOptions = [rehypeKatex, { output: 'html' }];

const CATEGORY_MAP = {
  Algebra: '代數', Calculus: '微積分', Geometry: '幾何',
  Trigonometry: '三角學', Probability: '概率', Statistics: '統計',
  Sequences: '數列', Functions: '函數', 'Number Theory': '數論', Other: '其他'
};

const MASTERY_META = {
  mastered: { label: '熟練掌握', color: '#10b981', bg: '#dcfce7' },
  partial:  { label: '部分掌握', color: '#f59e0b', bg: '#fef3c7' },
  fuzzy:    { label: '概念模糊', color: '#ef4444', bg: '#fee2e2' },
  unknown:  { label: '需要加強', color: '#b91c1c', bg: '#fecaca' },
};

const DIAGNOSIS_META = {
  careless:       { label: '粗心大意', icon: '⚡' },
  forgot_formula: { label: '公式遺忘', icon: '📐' },
  concept_gap:    { label: '概念缺失', icon: '🧩' },
  ok:             { label: '正常',     icon: '✅' },
};

function normalizeLatex(text) {
  if (!text) return '';
  return String(text).replace(/\\n/g, '\n');
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

export default function WrongBookPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wrongQuestions, setWrongQuestions] = useState({});
  const [topicMastery, setTopicMastery] = useState([]);
  const [topicDiagnosis, setTopicDiagnosis] = useState([]);
  const [expandedTopics, setExpandedTopics] = useState({});
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceError, setPracticeError] = useState('');

  // 彈窗：選擇真題 / AI
  const [practiceModalTopic, setPracticeModalTopic] = useState(null);
  const [practiceSource, setPracticeSource] = useState('past');
  const [practiceCount, setPracticeCount] = useState(5);

  // 彈窗：複習筆記
  const [noteModal, setNoteModal] = useState(null); // { topic, diagnosis_type, note, loading }

  useEffect(() => {
    const token = localStorage.getItem('jae_token');
    if (!token) {
      setError('請先登入');
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      axios.get(`${API_BASE_URL}/user/wrong-questions`, { headers })
        .then(r => r.data.grouped || {})
        .catch(() => ({})),
      axios.get(`${API_BASE_URL}/user/topic-mastery`, { headers })
        .then(r => r.data.topics || [])
        .catch(() => []),
      axios.get(`${API_BASE_URL}/user/topic-diagnosis`, { headers })
        .then(r => r.data.topics || [])
        .catch(() => []),
    ])
      .then(([grouped, mastery, diagnosis]) => {
        const allGroups = {};
        for (const cat of Object.keys(grouped)) allGroups[cat] = true;
        setExpandedTopics(allGroups);
        setWrongQuestions(grouped);
        setTopicMastery(mastery);
        setTopicDiagnosis(diagnosis);
      })
      .finally(() => setLoading(false));
  }, []);

  const openPracticeModal = (topic) => {
    setPracticeModalTopic(topic);
    setPracticeSource('past');
    setPracticeCount(5);
    setPracticeError('');
  };

  const closePracticeModal = () => {
    if (practiceLoading) return;
    setPracticeModalTopic(null);
  };

  const handlePractice = async () => {
    const token = localStorage.getItem('jae_token');
    if (!token) { alert('請先登入'); return; }

    setPracticeLoading(true);
    setPracticeError('');

    try {
      const res = await axios.post(
        `${API_BASE_URL}/user/practice-by-topic`,
        { topic: practiceModalTopic, count: practiceCount, source: practiceSource },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data && res.data.quiz_id && res.data.questions && res.data.questions.length > 0) {
        sessionStorage.setItem('jae_practice_quiz', JSON.stringify({
          quiz_id: res.data.quiz_id,
          questions: res.data.questions,
          topic: practiceModalTopic,
        }));
        setPracticeModalTopic(null);
        navigate('/quiz?source=practice');
      } else {
        setPracticeError('生成練習失敗：題目資料不完整');
      }
    } catch (err) {
      console.error('Practice error:', err);
      setPracticeError(err.response?.data?.detail || err.message || '生成練習失敗');
    } finally {
      setPracticeLoading(false);
    }
  };

  /* ============================================================
     生成 AI 複習筆記
     ============================================================ */
  const handleGenerateNote = async (topic, diagnosisType) => {
    const token = localStorage.getItem('jae_token');
    if (!token) { alert('請先登入'); return; }

    setNoteModal({ topic, diagnosis_type: diagnosisType, note: '', loading: true });

    try {
      const res = await axios.post(`${API_BASE_URL}/ai/generate-review-note`, {
        topic,
        diagnosis_type: diagnosisType,
        recent_attempts: [],
      }, { headers: { Authorization: `Bearer ${token}` } });

      setNoteModal({ topic, diagnosis_type: diagnosisType, note: res.data.note, loading: false });
    } catch (err) {
      setNoteModal({
        topic,
        diagnosis_type: diagnosisType,
        note: `⚠️ 生成失敗：${err.response?.data?.detail || err.message}`,
        loading: false,
      });
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>載入中...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#b91c1c' }}>⚠️ {error}</div>;

  const totalWrong = Object.values(wrongQuestions).reduce((sum, arr) => sum + arr.length, 0);
  const weakTopics = topicMastery.filter(t => t.status === 'weak');

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/browse')}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f1f5f9', cursor: 'pointer', fontWeight: 600 }}
        >
          ← 返回題庫
        </button>
        <h2 style={{ margin: 0 }}>📕 我的錯題本</h2>
      </div>

{/* ==================== 🔥 連續學習天數 ==================== */}
<div style={{ marginBottom: 20, textAlign: 'center' }}>
  <StreakBadge />
</div>

{/* ==================== 📈 知識點趨勢 ==================== */}
<MasteryTrend />

{/* ==================== 🏆 成就徽章 ==================== */}
<Achievements />

      {/* ==================== 🧠 多層診斷 ==================== */}
      {topicDiagnosis.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: 12, padding: 22, marginBottom: 20,
          border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>🧠 知識點多層診斷</h3>
          <p style={{ margin: '0 0 18px', fontSize: '0.85rem', color: '#64748b' }}>
            根據你的作答正確率、平均用時、近期表現綜合分析
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {topicDiagnosis.map((t, i) => {
              const meta = MASTERY_META[t.mastery_level] || MASTERY_META.unknown;
              const diag = DIAGNOSIS_META[t.diagnosis_type] || DIAGNOSIS_META.ok;
              return (
                <div
                  key={i}
                  style={{
                    background: '#f8fafc', border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${meta.color}`,
                    borderRadius: 10, padding: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                    <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{t.topic}</strong>
                    <span style={{
                      background: meta.bg, color: meta.color,
                      padding: '2px 10px', borderRadius: 999,
                      fontSize: '0.75rem', fontWeight: 700,
                    }}>
                      {meta.label}
                    </span>
                    <span style={{
                      background: '#fff', color: '#475569',
                      padding: '2px 10px', borderRadius: 999,
                      fontSize: '0.75rem', border: '1px solid #e2e8f0',
                    }}>
                      {diag.icon} {diag.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 16, fontSize: '0.82rem', color: '#64748b', marginBottom: 8, flexWrap: 'wrap' }}>
                    <span>正確率：<strong style={{ color: meta.color }}>{t.correct_rate}%</strong></span>
                    <span>作答次數：<strong style={{ color: '#334155' }}>{t.total_attempts}</strong></span>
                    <span>平均用時：<strong style={{ color: '#334155' }}>{t.avg_time_seconds} 秒</strong></span>
                    {t.recent_results?.length > 0 && (
                      <span>
                        最近：
                        {t.recent_results.slice(0, 3).map((r, ri) => (
                          <span key={ri} style={{ marginLeft: 4, color: r === 'correct' ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                            {r === 'correct' ? '✓' : '✗'}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>

                  {t.recommendation && (
                    <div style={{
                      fontSize: '0.85rem', color: '#334155', background: '#fff',
                      padding: '8px 12px', borderRadius: 8, marginBottom: 10,
                      border: '1px solid #e2e8f0', lineHeight: 1.6,
                    }}>
                      💡 {t.recommendation}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {t.mastery_level !== 'mastered' && (
                      <button
                        onClick={() => openPracticeModal(t.topic)}
                        style={{
                          padding: '6px 14px', fontSize: '0.82rem',
                          background: '#2563eb', color: '#fff',
                          border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                        }}
                      >
                        🎯 練更多題
                      </button>
                    )}
                    {(t.diagnosis_type === 'forgot_formula' || t.diagnosis_type === 'concept_gap' || t.diagnosis_type === 'careless') && (
                      <button
                        onClick={() => handleGenerateNote(t.topic, t.diagnosis_type)}
                        style={{
                          padding: '6px 14px', fontSize: '0.82rem',
                          background: '#fff', color: '#7c3aed',
                          border: '1.5px solid #c4b5fd', borderRadius: 8,
                          cursor: 'pointer', fontWeight: 600,
                        }}
                      >
                        📝 生成複習筆記
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== 知識點掌握度（舊版，保留） ==================== */}
      {topicMastery.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20,
          border: '1px solid #e2e8f0', boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem' }}>📊 知識點掌握度（總覽）</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topicMastery.slice(0, 15).map((t, i) => {
              const color = t.mastery_percent >= 80 ? '#10b981'
                : t.mastery_percent >= 60 ? '#f59e0b'
                : '#ef4444';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: '0 0 130px', fontSize: '0.9rem', color: '#334155', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.topic}
                  </div>
                  <div style={{ flex: 1, height: 18, background: '#f1f5f9', borderRadius: 9, overflow: 'hidden' }}>
                    <div style={{
                      width: `${t.mastery_percent}%`,
                      height: '100%',
                      background: color,
                      borderRadius: 9,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <div
                    style={{
                      flex: '0 0 130px', fontSize: '0.82rem', color: '#64748b',
                      textAlign: 'right', whiteSpace: 'nowrap',
                    }}
                    title="答對次數 / 總作答次數（掌握度）"
                  >
                    <span style={{ color: '#10b981', fontWeight: 700 }}>{t.correct}</span>
                    <span style={{ color: '#94a3b8' }}>/</span>
                    <span style={{ color: '#334155', fontWeight: 600 }}>{t.total}</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginLeft: 6 }}>答對/作答</span>
                    <span style={{ marginLeft: 8, color: t.mastery_percent >= 60 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                      {t.mastery_percent}%
                    </span>
                  </div>
                  {t.mastery_percent < 60 && (
                    <button
                      onClick={() => openPracticeModal(t.topic)}
                      style={{
                        flex: '0 0 auto', padding: '4px 10px', fontSize: '0.8rem',
                        background: '#fef3c7', color: '#92400e',
                        border: '1px solid #fcd34d', borderRadius: 6,
                        cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                      }}
                    >
                      🎯 練更多題
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 優先補強 */}
      {weakTopics.length > 0 && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fcd34d',
          borderRadius: 12, padding: 16, marginBottom: 20,
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#92400e' }}>
            🔥 優先補強（{weakTopics.length} 個弱項）
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {weakTopics.map((t, i) => (
              <button
                key={i}
                onClick={() => openPracticeModal(t.topic)}
                style={{
                  padding: '8px 14px', background: '#fff',
                  border: '1px solid #fcd34d', borderRadius: 8,
                  cursor: 'pointer', fontWeight: 600, color: '#78350f', fontSize: '0.9rem',
                }}
              >
                {t.topic} ({t.mastery_percent}%)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 錯題列表 */}
      {totalWrong === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center',
          background: '#dcfce7', borderRadius: 12, color: '#15803d', fontWeight: 600,
        }}>
          🎉 錯題本是空的！繼續保持！
        </div>
      ) : (
        <>
          <h3 style={{ margin: '0 0 12px' }}>📚 錯題列表（共 {totalWrong} 題）</h3>
          {Object.entries(wrongQuestions).map(([category, list]) => (
            <div key={category} style={{ marginBottom: 20 }}>
              <button
                onClick={() => setExpandedTopics(prev => ({ ...prev, [category]: !prev[category] }))}
                style={{
                  width: '100%', textAlign: 'left', background: '#f1f5f9',
                  border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 14px',
                  fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>
                  {expandedTopics[category] ? '▼' : '▶'} {CATEGORY_MAP[category] || category}
                  <span style={{ marginLeft: 8, fontWeight: 500, color: '#64748b', fontSize: '0.85rem' }}>
                    ({list.length} 題)
                  </span>
                </span>
              </button>

              {expandedTopics[category] && list.map((w, i) => {
                const q = w.question;
                const optionsMap = extractOptions(q);
                const letters = ['A', 'B', 'C', 'D', 'E'].filter(l => Boolean(optionsMap[l]));
                const correctLetter = String(w.correct_answer || '').trim().toUpperCase();

                return (
                  <div key={i} style={{
                    background: '#fff', borderRadius: 12, padding: 20, marginTop: 10,
                    border: '1px solid #e2e8f0', borderLeft: '6px solid #ef4444',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
                  }}>
<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-start' }}>
  <div>
    <h4 style={{ margin: 0 }}>{q.question_number || `第 ${i + 1} 題`}</h4>
    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
      <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
        錯 {w.wrong_count} 次
      </span>
      {(w.sub_topics || []).map((t, ti) => (
        <span key={ti} style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem' }}>
          {t}
        </span>
      ))}
    </div>
  </div>
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{w.last_wrong_at}</span>
    <SpeakButton
      text={q.raw_text_zh || q.raw_text_en || ''}
      options={optionsMap}
      size="small"
      label="朗讀題目"
    />
  </div>
</div>

                    <div style={{ lineHeight: 1.8, marginBottom: 14 }}>
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                        {normalizeLatex(q.raw_text_zh || q.raw_text_en || '')}
                      </ReactMarkdown>
                    </div>

                    {letters.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                        {letters.map(letter => {
                          const isRight = letter === correctLetter;
                          return (
                            <div key={letter} style={{
                              display: 'flex', alignItems: 'flex-start', gap: 10,
                              padding: '10px 14px',
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
                                {letter}
                              </span>
                              <div style={{ flex: 1, color: isRight ? '#15803d' : '#1e293b', wordBreak: 'break-word' }}>
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                                  {normalizeLatex(optionsMap[letter])}
                                </ReactMarkdown>
                              </div>
                              {isRight && (
                                <span style={{ color: '#15803d', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>✅ 正確</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 140, padding: 10, background: '#fee2e2', borderRadius: 8, color: '#b91c1c', fontSize: '0.9rem' }}>
                        <strong>你的作答：</strong> {w.user_answer || '(未作答)'}
                      </div>
                      <div style={{ flex: 1, minWidth: 140, padding: 10, background: '#f0f9ff', borderRadius: 8, color: '#0c4a6e', fontSize: '0.9rem' }}>
                        <strong>正確答案：</strong> {w.correct_answer}
                      </div>
                    </div>

                    {q.solution && (
                      <details style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#0369a1', fontSize: '0.9rem' }}>
                          💡 查看解題步驟
                        </summary>
                        <div style={{ marginTop: 12, lineHeight: 1.8 }}>
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                            {normalizeLatex(q.solution)}
                          </ReactMarkdown>
                        </div>
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'flex-end' }}>
      <SpeakButton
        text={q.solution}
        size="small"
        label="🔊 朗讀詳解"
      />
    </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}

      {/* ==================== 練習選擇彈窗 ==================== */}
      {practiceModalTopic && (
        <div
          onClick={closePracticeModal}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, padding: 28,
              width: '100%', maxWidth: 460,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 4px' }}>🎯 專項練習</h3>
            <p style={{ margin: '0 0 20px', fontSize: '0.9rem', color: '#64748b' }}>
              知識點：<strong style={{ color: '#0f172a' }}>{practiceModalTopic}</strong>
            </p>

            {/* 題目來源 */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                題目來源
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { value: 'past', label: '📚 只用真題', sub: '從歷屆題庫中抽題' },
                  { value: 'ai',   label: '🤖 全部 AI 生成', sub: 'AI 根據此知識點出新題' },
                  { value: 'mix',  label: '⚖️ 混合模式', sub: '真題優先，不足時 AI 補齊' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPracticeSource(opt.value)}
                    style={{
                      padding: '10px 14px', textAlign: 'left',
                      background: practiceSource === opt.value ? '#eff6ff' : '#f8fafc',
                      border: `2px solid ${practiceSource === opt.value ? '#2563eb' : '#e2e8f0'}`,
                      borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', flexDirection: 'column', gap: 2,
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>{opt.label}</span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 題數（含快速選擇按鈕，修在同一個 div 裡） */}
            <div style={{ marginBottom: 22 }}>
              <div style={{
                fontSize: '0.9rem', fontWeight: 600, color: '#334155',
                marginBottom: 12, display: 'flex',
                justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>題數</span>
                <strong style={{ color: '#2563eb', fontSize: '1.05rem' }}>{practiceCount} 題</strong>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                value={practiceCount}
                onChange={(e) => setPracticeCount(parseInt(e.target.value, 10))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {[5, 10, 15, 20].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPracticeCount(n)}
                    style={{
                      flex: '1 1 calc(25% - 6px)',
                      minWidth: 60,
                      padding: '8px 10px',
                      fontSize: '0.85rem',
                      background: practiceCount === n ? '#2563eb' : '#f1f5f9',
                      color: practiceCount === n ? '#fff' : '#475569',
                      border: `1.5px solid ${practiceCount === n ? '#2563eb' : '#cbd5e1'}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontWeight: 700,
                      transition: 'all 0.15s',
                    }}
                  >
                    {n} 題
                  </button>
                ))}
              </div>
            </div>

            {practiceError && (
              <div style={{
                padding: 10, background: '#fef2f2', border: '1px solid #fecaca',
                color: '#b91c1c', borderRadius: 8, fontSize: '0.85rem', marginBottom: 14,
              }}>
                ⚠️ {practiceError}
              </div>
            )}

            <div style={{
              display: 'flex', gap: 12, justifyContent: 'flex-end',
              marginTop: 24, paddingTop: 20,
              borderTop: '1px solid #f1f5f9', flexWrap: 'wrap',
            }}>
              <button
                onClick={closePracticeModal}
                disabled={practiceLoading}
                style={{
                  padding: '10px 22px', background: '#f8fafc', color: '#475569',
                  border: '1.5px solid #cbd5e1', borderRadius: 10,
                  cursor: practiceLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: '0.92rem', transition: 'all 0.15s',
                }}
              >
                取消
              </button>
              <button
                onClick={handlePractice}
                disabled={practiceLoading}
                style={{
                  padding: '10px 26px',
                  background: practiceLoading ? '#94a3b8' : '#2563eb',
                  color: '#fff', border: 'none', borderRadius: 10,
                  cursor: practiceLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '0.92rem',
                  boxShadow: practiceLoading ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.25)',
                  transition: 'all 0.15s',
                }}
              >
                {practiceLoading ? '生成中...' : '🚀 開始練習'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 📝 複習筆記彈窗 ==================== */}
      {noteModal && (
        <div
          onClick={() => !noteModal.loading && setNoteModal(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, padding: 28,
              width: '100%', maxWidth: 680, maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>📝 複習筆記</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  知識點：<strong style={{ color: '#0f172a' }}>{noteModal.topic}</strong>
                </p>
              </div>
              <button
                onClick={() => setNoteModal(null)}
                disabled={noteModal.loading}
                style={{
                  background: 'transparent', border: 'none', fontSize: '1.2rem',
                  cursor: noteModal.loading ? 'not-allowed' : 'pointer',
                  color: '#64748b', padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            {noteModal.loading ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <div style={{
                  display: 'inline-block', width: 36, height: 36,
                  border: '3px solid #e2e8f0', borderTopColor: '#7c3aed',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                }} />
                <p style={{ marginTop: 16, color: '#64748b' }}>AI 正在生成專屬筆記...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (
              <div style={{ lineHeight: 1.9, fontSize: '0.95rem', color: '#1e293b' }}>
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatexOptions, rehypeRaw]}>
                  {noteModal.note}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}