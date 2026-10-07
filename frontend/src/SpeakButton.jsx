import React, { useState, useEffect, useRef } from 'react';

/* ============================================================
   1. sanitizeForSpeech
   ============================================================ */
function sanitizeForSpeech(text) {
  if (!text) return '';
  if (typeof text === 'object') {
    text = text.text || text.content || text.raw || JSON.stringify(text);
  }
  let s = String(text);

  // 移除 LaTeX 環境標記
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, ' $1 ');
  s = s.replace(/\$([^$]+)\$/g, ' $1 ');

  // ===== 1. Unicode 上標 =====
  const superscriptMap = {
    '⁰': ' 的 0 次方 ', '¹': ' 的 1 次方 ', '²': ' 的平方 ',
    '³': ' 的立方 ', '⁴': ' 的 4 次方 ', '⁵': ' 的 5 次方 ',
    '⁶': ' 的 6 次方 ', '⁷': ' 的 7 次方 ', '⁸': ' 的 8 次方 ',
    '⁹': ' 的 9 次方 ', 'ⁿ': ' 的 n 次方 ',
  };
  for (const [sup, repl] of Object.entries(superscriptMap)) {
    s = s.replaceAll(sup, repl);
  }

  // ===== 2. Unicode 下標 =====
  const subscriptMap = {
    '₀': ' 下標 0 ', '₁': ' 下標 1 ', '₂': ' 下標 2 ',
    '₃': ' 下標 3 ', '₄': ' 下標 4 ', '₅': ' 下標 5 ',
    '₆': ' 下標 6 ', '₇': ' 下標 7 ', '₈': ' 下標 8 ',
    '₉': ' 下標 9 ', 'ₙ': ' 下標 n ', 'ₓ': ' 下標 x ',
  };
  for (const [sub, repl] of Object.entries(subscriptMap)) {
    s = s.replaceAll(sub, repl);
  }

  // ===== 3. 其他數學符號 =====
  const symbolMap = {
    '×': ' 乘以 ', '÷': ' 除以 ', '±': ' 正負 ', '∓': ' 負正 ',
    '≤': ' 小於等於 ', '≥': ' 大於等於 ', '≠': ' 不等於 ',
    '≈': ' 約等於 ', '≡': ' 恆等於 ',
    '√': ' 根號 ', '∛': ' 立方根 ',
    '∞': ' 無窮 ', 'π': ' 圓周率 ',
    'α': ' alpha ', 'β': ' beta ', 'γ': ' gamma ', 'δ': ' delta ', 'ε': ' epsilon ',
    'θ': ' theta ', 'λ': ' lambda ', 'μ': ' mu ', 'ρ': ' rho ', 'σ': ' sigma ',
    'φ': ' phi ', 'ω': ' omega ', 'Δ': ' Delta ', 'Σ': ' Sigma ', 'Ω': ' Omega ',
    '∈': ' 屬於 ', '∉': ' 不屬於 ', '⊂': ' 子集 ', '⊆': ' 子集或等於 ',
    '∩': ' 交集 ', '∪': ' 聯集 ', '∅': ' 空集合 ',
    '∀': ' 對所有 ', '∃': ' 存在 ',
    '→': ' 趨近 ', '⇒': ' 所以 ', '⇔': ' 等價於 ',
    '∫': ' 積分 ', '∑': ' 加總 ', '∏': ' 連乘 ', '∂': ' 偏 ', '∇': ' 梯度 ',
    '∠': ' 角 ', '°': ' 度 ', '△': ' 三角形 ', '⊥': ' 垂直 ', '∥': ' 平行 ',
    '≅': ' 全等 ', '∼': ' 相似 ',
  };
  for (const [sym, repl] of Object.entries(symbolMap)) {
    s = s.replaceAll(sym, repl);
  }

  // ===== 4. LaTeX 指令 =====
  const latexMap = [
    // 分數
    [/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, ' $1 除以 $2 '],
    [/\\dfrac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, ' $1 除以 $2 '],
    [/\\tfrac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, ' $1 除以 $2 '],
    // 根號
    [/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, ' $1 次根號 $2 '],
    [/\\sqrt\s*\{([^{}]*)\}/g, ' 根號 $1 '],
    // 上下標
    [/\^\{([^{}]*)\}/g, ' 的 $1 次方 '],
    [/\^([0-9a-zA-Z])/g, ' 的 $1 次方 '],
    [/_\{([^{}]*)\}/g, ' 下標 $1 '],
    [/_([0-9a-zA-Z])/g, ' 下標 $1 '],
    // 運算子
    [/\\times/g, ' 乘以 '],
    [/\\cdot/g, ' 乘以 '],
    [/\\div/g, ' 除以 '],
    [/\\pm/g, ' 正負 '],
    [/\\mp/g, ' 負正 '],
    [/\\leq|\\le(?![a-zA-Z])/g, ' 小於等於 '],
    [/\\geq|\\ge(?![a-zA-Z])/g, ' 大於等於 '],
    [/\\neq|\\ne(?![a-zA-Z])/g, ' 不等於 '],
    [/\\approx/g, ' 約等於 '],
    [/\\equiv/g, ' 恆等於 '],
    [/\\to|\\rightarrow/g, ' 趨近 '],
    [/\\Rightarrow|\\implies/g, ' 所以 '],
    [/\\Leftrightarrow|\\iff/g, ' 等價於 '],
    // 希臘
    [/\\alpha/g, ' alpha '], [/\\beta/g, ' beta '], [/\\gamma/g, ' gamma '],
    [/\\delta/g, ' delta '], [/\\Delta/g, ' Delta '], [/\\epsilon/g, ' epsilon '],
    [/\\theta/g, ' theta '], [/\\lambda/g, ' lambda '], [/\\mu/g, ' mu '],
    [/\\pi/g, ' 圓周率 '], [/\\rho/g, ' rho '], [/\\sigma/g, ' sigma '],
    [/\\Sigma/g, ' Sigma '], [/\\phi/g, ' phi '], [/\\omega/g, ' omega '], [/\\Omega/g, ' Omega '],
    // 運算
    [/\\sum/g, ' 加總 '], [/\\prod/g, ' 連乘 '], [/\\int/g, ' 積分 '],
    [/\\lim/g, ' 極限 '], [/\\infty/g, ' 無窮 '], [/\\partial/g, ' 偏 '],
    // 集合
    [/\\cap/g, ' 交集 '], [/\\cup/g, ' 聯集 '],
    [/\\in(?![a-zA-Z])/g, ' 屬於 '], [/\\notin/g, ' 不屬於 '],
    [/\\subset/g, ' 子集 '], [/\\subseteq/g, ' 子集或等於 '],
    [/\\emptyset|\\varnothing/g, ' 空集合 '],
    [/\\forall/g, ' 對所有 '], [/\\exists/g, ' 存在 '],
    // 三角/對數
    [/\\sin/g, ' sine '], [/\\cos/g, ' cosine '], [/\\tan/g, ' tangent '],
    [/\\cot/g, ' cotangent '], [/\\sec/g, ' secant '], [/\\csc/g, ' cosecant '],
    [/\\arcsin/g, ' arc sine '], [/\\arccos/g, ' arc cosine '], [/\\arctan/g, ' arc tangent '],
    [/\\log/g, ' log '], [/\\ln/g, ' ln '], [/\\exp/g, ' exp '],
    // 其他
    [/\\left\.|\\right\./g, ''],
    [/\\left|\\right/g, ''],
    [/\\big|\\Big|\\bigg|\\Bigg/g, ''],
    [/\\\{/g, ' 左大括號 '], [/\\\}/g, ' 右大括號 '],
    [/\\\|/g, ' 直線 '], [/\\\\/g, ' 換行 '],
    [/\\[,;:!]/g, ' '], [/\\quad|\\qquad/g, ' '],
    [/\\text\s*\{([^{}]*)\}/g, ' $1 '],
    [/\\mathrm\s*\{([^{}]*)\}/g, ' $1 '],
    [/\\mathbf\s*\{([^{}]*)\}/g, ' $1 '],
    [/\\[a-zA-Z]+/g, ' '],
    [/[{}]/g, ' '],
    // 純文字分數
    [/(\d+)\s*\/\s*(\d+)/g, ' $1 除以 $2 '],
    [/([a-zA-Z])\s*\/\s*([a-zA-Z])/g, ' $1 除以 $2 '],
    [/(\d+)\s*\/\s*([a-zA-Z])/g, ' $1 除以 $2 '],
    [/([a-zA-Z])\s*\/\s*(\d+)/g, ' $1 除以 $2 '],
  ];

  for (const [pattern, replacement] of latexMap) {
    s = s.replace(pattern, replacement);
  }

  // ===== 5. 減號 vs 負號（關鍵！）=====
  // 先把所有減號變體統一成「半形 -」
  s = s.replace(/[−–—－]/g, '-');

  // 5a. 負號：開頭是 -（例如 "-x"、"-2"）
  s = s.replace(/^-\s*/g, ' 負 ');

  // 5b. 負號：運算符後是 -（例如 "= -x"、"+ -2"、"× -5"）
  //     運算符包含：= + × ÷ < > ≤ ≥ ≠ ( [ { , ;
  s = s.replace(/([\=\(\[\{\,\;])\s*-\s*/g, '$1 負 ');
  s = s.replace(/([\+\×\÷])\s*-\s*/g, '$1 負 ');

  // 5c. 負號：在空白後、字母/數字前（例如 " -2"）
  //     但如果前面是數字/字母，就是運算子（減號）
  s = s.replace(/(^|[\s\(\[\{])\s*-\s*(?=[0-9a-zA-Z\(])/g, '$1 負 ');

  // 5d. 剩下的所有 - 都是運算子（減號）
  s = s.replace(/\s*-\s*/g, ' 減 ');

  // ===== 6. 移除 Markdown =====
  s = s.replace(/[*_~`#>]+/g, ' ');
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  s = s.replace(/^\s*[-*+]\s+/gm, '');
  s = s.replace(/^\s*\d+\.\s+/gm, '');

  // ===== 7. 括號 =====
  s = s.replace(/\(/g, ' 左括號 ');
  s = s.replace(/\)/g, ' 右括號 ');

  // ===== 8. 標點 =====
  s = s.replace(/[,，]/g, '，');
  s = s.replace(/[.。]/g, '。');

  // ===== 9. 清理空白 =====
  s = s.replace(/\s+/g, ' ').trim();

  console.log('[sanitizeForSpeech] 結果:', s);
  return s;
}

/* ============================================================
   2. detectLang
   ============================================================ */
function detectLang(text) {
  if (!text) return 'zh-HK';
  const cjkCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const latinCount = (text.match(/[a-zA-Z]/g) || []).length;
  console.log('[detectLang] CJK:', cjkCount, 'Latin:', latinCount);
  if (cjkCount > 0) return 'zh-HK';
  return 'en-US';
}

/* ============================================================
   3. pickBestVoice
   ============================================================ */
function pickBestVoice(voices, lang) {
  if (!voices || voices.length === 0) return null;
  console.log('[pickBestVoice] 目標語言:', lang);

  let match = voices.find(v => v.lang === lang);
  if (match) return match;

  if (lang === 'zh-HK') {
    let hk = voices.find(v => v.lang === 'zh-HK' || v.lang === 'yue-HK');
    if (hk) {
      console.log('[pickBestVoice] 找到粵語:', hk.name, hk.lang);
      return hk;
    }
    const hkByName = voices.filter(v =>
      v.name.includes('Tracy') || v.name.includes('Hong Kong') ||
      v.name.includes('香港') || v.name.includes('Sinji') || v.name.includes('粵')
    );
    if (hkByName.length > 0) return hkByName[0];

    const hkPrefix = voices.find(v => v.lang.toLowerCase().startsWith('zh-hk'));
    if (hkPrefix) return hkPrefix;

    console.log('[pickBestVoice] 無粵語，退回 zh-TW');
    let tw = voices.find(v => v.lang === 'zh-TW');
    if (tw) return tw;

    console.log('[pickBestVoice] 無 zh-TW，退回 zh-CN');
    let cn = voices.find(v => v.lang === 'zh-CN');
    if (cn) return cn;

    const anyZh = voices.find(v => v.lang.toLowerCase().includes('zh'));
    if (anyZh) return anyZh;
  }

  const langPrefix = lang.split('-')[0];
  match = voices.find(v => v.lang.startsWith(langPrefix));
  if (match) return match;

  const zhVoices = voices.filter(v => v.lang.toLowerCase().includes('zh'));
  if (zhVoices.length > 0) return zhVoices[0];

  return null;
}

/* ============================================================
   4. SpeakButton 元件
   ============================================================ */
export default function SpeakButton({
  text,
  options = null,
  rate = 0.95,
  size = 'normal',
  label = '朗讀',
  stopLabel = '停止',
}) {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const [voices, setVoices] = useState([]);
  const utteranceRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSupported(false);
      return;
    }
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) setVoices(v);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    const t1 = setTimeout(loadVoices, 100);
    const t2 = setTimeout(loadVoices, 500);
    const t3 = setTimeout(loadVoices, 1500);
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleClick = () => {
    if (!supported) {
      alert('你的瀏覽器不支援語音朗讀功能。建議使用 Chrome、Edge 或 Safari。');
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    let speechText = sanitizeForSpeech(text);
    if (options && typeof options === 'object') {
      const letters = ['A', 'B', 'C', 'D', 'E'].filter(l => options[l]);
      if (letters.length > 0) {
        speechText += '。選項：';
        for (const l of letters) {
          speechText += `${l}、${sanitizeForSpeech(options[l])}。`;
        }
      }
    }

    if (!speechText.trim()) {
      alert('沒有可朗讀的內容');
      return;
    }

    const lang = detectLang(text);
    console.log('[SpeakButton] 朗讀文字:', speechText);
    console.log('[SpeakButton] 偵測語言:', lang);

    let bestVoice = pickBestVoice(voices, lang);
    if (!bestVoice && voices.length > 0) bestVoice = voices[0];
    console.log('[SpeakButton] 選中的語音:', bestVoice ? `${bestVoice.name} (${bestVoice.lang})` : '系統預設');

    const u = new SpeechSynthesisUtterance(speechText);
    u.lang = lang;
    u.rate = rate;
    u.pitch = 1.0;
    u.volume = 1.0;
    if (bestVoice) u.voice = bestVoice;

    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = (e) => {
      console.error('[SpeakButton] Speech error:', e);
      setSpeaking(false);
    };

    utteranceRef.current = u;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  if (!supported) return null;

  const fontSize = size === 'large' ? '1.05rem' : size === 'small' ? '0.8rem' : '0.9rem';
  const padding = size === 'large' ? '8px 18px' : size === 'small' ? '4px 10px' : '6px 14px';

  return (
    <button
      type="button"
      onClick={handleClick}
      title={speaking ? '停止朗讀' : '朗讀此內容'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding,
        fontSize,
        fontWeight: 600,
        background: speaking ? '#ef4444' : '#f0f9ff',
        color: speaking ? '#ffffff' : '#0369a1',
        border: `1.5px solid ${speaking ? '#ef4444' : '#bae6fd'}`,
        borderRadius: 999,
        cursor: 'pointer',
        transition: 'all 0.2s',
        fontFamily: 'inherit',
        boxShadow: speaking ? '0 4px 12px rgba(239, 68, 68, 0.3)' : 'none',
      }}
    >
      <span style={{ fontSize: size === 'small' ? '0.9rem' : '1rem' }}>
        {speaking ? '⏹️' : '🔈'}
      </span>
      {speaking ? stopLabel : label}
    </button>
  );
}