import { LocalizedAttributes } from './i18n.jsx';
import { LocalizedText, useLocale } from './i18n.jsx';
import React, { useEffect, useState } from 'react';
import { api as axios } from './i18n-api.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`;

/* ============================================================
   連續學習天數徽章
   ============================================================ */
export function StreakBadge() {
  useLocale();
  const [streak, setStreak] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('jae_token');
    if (!token) return;
    axios.get(`${API_BASE_URL}/user/streak`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => setStreak(r.data))
      .catch(() => {});
  }, []);

  if (!streak || streak.current_streak === 0) return null;

  return (
    <LocalizedAttributes><div
      title={`最長連續 ${streak.longest_streak} 天 · 共學習 ${streak.total_days} 天`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
        border: '1.5px solid #fcd34d',
        borderRadius: 999,
        fontSize: '0.85rem',
        fontWeight: 700,
        color: '#92400e',
        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)',
      }}
    ><LocalizedText value="🔥 連續學習" /><strong style={{ fontSize: '1rem' }}><LocalizedText value={streak.current_streak} /></strong><LocalizedText value="天" /></div></LocalizedAttributes>
  );
}

/* ============================================================
   趨勢圖（SVG 折線圖，無依賴）
   ============================================================ */
function TrendChart({ points, color }) {
  useLocale();
  if (!points || points.length === 0) return null;

  const W = 400;
  const H = 120;
  const PAD = { top: 10, right: 10, bottom: 20, left: 30 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // X 軸：日期索引
  // Y 軸：0-100%
  const xs = points.map((_, i) => PAD.left + (i / Math.max(1, points.length - 1)) * innerW);
  const ys = points.map(p => PAD.top + (1 - p.percent / 100) * innerH);

  const pathD = points.map((_, i) => `${i === 0 ? 'M' : 'L'} ${xs[i]} ${ys[i]}`).join(' ');

  // 填充區域
  const fillD = `${pathD} L ${xs[xs.length - 1]} ${PAD.top + innerH} L ${xs[0]} ${PAD.top + innerH} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {/* 網格線 0% / 50% / 100% */}
      {[0, 50, 100].map(pct => {
        const y = PAD.top + (1 - pct / 100) * innerH;
        return (
          <g key={pct}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
            <text x={PAD.left - 6} y={y + 3} fontSize="9" fill="#94a3b8" textAnchor="end"><LocalizedText value={pct} />%</text>
          </g>
        );
      })}

      {/* 填充 */}
      <path d={fillD} fill={color} fillOpacity="0.1" />

      {/* 折線 */}
      <path d={pathD} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* 點 */}
      {points.map((p, i) => (
        <circle key={i} cx={xs[i]} cy={ys[i]} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />
      ))}
    </svg>
  );
}

/* ============================================================
   趨勢區塊
   ============================================================ */
export function MasteryTrend() {
  useLocale();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('jae_token');
    if (!token) { setLoading(false); return; }
    axios.get(`${API_BASE_URL}/user/mastery-trend`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => setData(r.data.topics || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || data.length === 0) return null;

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 22, marginBottom: 20,
      border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}><LocalizedText value="📈 知識點趨勢（近 30 天）" /></h3>
      <p style={{ margin: '0 0 18px', fontSize: '0.85rem', color: '#64748b' }}><LocalizedText value="追蹤每個知識點的掌握度變化，看看你的進步曲線" /></p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {data.map((t, i) => {
          const color = t.trend === 'up' ? '#10b981' : t.trend === 'down' ? '#ef4444' : '#94a3b8';
          const trendIcon = t.trend === 'up' ? '📈' : t.trend === 'down' ? '📉' : '➡️';
          const trendText = t.trend === 'up' ? `+${t.delta}%` : t.trend === 'down' ? `${t.delta}%` : '持平';

          return (
            <div key={i} style={{
              background: '#f8fafc', borderRadius: 10, padding: 14,
              border: '1px solid #e2e8f0',
              borderLeft: `4px solid ${color}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}><LocalizedText value={t.topic} /></strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                  <span style={{ color: '#64748b' }}>
                    <LocalizedText value={t.first_percent} />% → <strong style={{ color }}><LocalizedText value={t.last_percent} />%</strong>
                  </span>
                  <span style={{ color, fontWeight: 700 }}>
                    <LocalizedText value={trendIcon} /> <LocalizedText value={trendText} />
                  </span>
                </div>
              </div>
              <TrendChart points={t.points} color={color} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   成就徽章
   ============================================================ */
export function Achievements() {
  useLocale();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('jae_token');
    if (!token) { setLoading(false); return; }
    axios.get(`${API_BASE_URL}/user/achievements`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return null;

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 22, marginBottom: 20,
      border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}><LocalizedText value="🏆 成就徽章" /></h3>
        <span style={{
          background: '#eff6ff', color: '#1d4ed8',
          padding: '4px 12px', borderRadius: 999,
          fontSize: '0.8rem', fontWeight: 700,
        }}>
          <LocalizedText value={data.unlocked_count} /> / <LocalizedText value={data.total_count} /><LocalizedText value="已解鎖" /></span>
      </div>
      <p style={{ margin: '0 0 18px', fontSize: '0.85rem', color: '#64748b' }}><LocalizedText value="持續練習，收集所有徽章！" /></p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: 12,
      }}>
        {data.achievements.map((a) => (
          <LocalizedAttributes key={a.id}><div
            key={a.id}
            title={`${a.title}：${a.desc}（進度 ${a.progress}）`}
            style={{
              background: a.unlocked ? '#f0fdf4' : '#f8fafc',
              border: `1.5px solid ${a.unlocked ? '#86efac' : '#e2e8f0'}`,
              borderRadius: 10,
              padding: '14px 12px',
              textAlign: 'center',
              opacity: a.unlocked ? 1 : 0.55,
              transition: 'transform 0.15s',
              cursor: 'default',
            }}
            onMouseEnter={(e) => { if (a.unlocked) e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{ fontSize: '2rem', marginBottom: 6 }}><LocalizedText value={a.icon} /></div>
            <div style={{
              fontWeight: 700, fontSize: '0.88rem',
              color: a.unlocked ? '#15803d' : '#64748b',
              marginBottom: 4,
            }}>
              <LocalizedText value={a.title} />
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.4 }}>
              <LocalizedText value={a.desc} />
            </div>
            <div style={{
              marginTop: 8, fontSize: '0.7rem', fontWeight: 700,
              color: a.unlocked ? '#10b981' : '#cbd5e1',
            }}>
              <LocalizedText value={a.unlocked ? '✓ 已解鎖' : a.progress} />
            </div>
          </div></LocalizedAttributes>
        ))}
      </div>
    </div>
  );
}