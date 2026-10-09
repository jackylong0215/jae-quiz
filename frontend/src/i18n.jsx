import React, { createContext, useContext, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import translations from './translations.json';
import { getLanguage, saveLanguage } from './locale-store.js';
import { localizedFetch } from './i18n-api.js';

const LocaleContext = createContext({ language: 'zh', setLanguage: () => {}, revision: 0 });
export const hasChinese = value => typeof value === 'string' && /[\u3400-\u9fff\uf900-\ufaff]/u.test(value);
const normalize = text => text.replace(/\s+/g, ' ').trim();
const phrases = Object.entries(translations).filter(([key]) => key.length > 1).sort((a, b) => b[0].length - a[0].length);

// Translate display strings only. API identifiers, filter values and saved answers stay intact.
export function translateStatic(value, language = getLanguage()) {
  if (language !== 'en' || !hasChinese(value)) return value;
  const exact = translations[normalize(value)];
  if (exact) return exact;
  let result = value.replace(/第\s*(\d+)\s*題/g, 'Question $1');
  for (const [source, target] of phrases) result = result.replaceAll(source, target);
  return result;
}

export function t(value) {
  const translated = translateStatic(value);
  return hasChinese(translated) && getLanguage() === 'en'
    ? 'English translation is unavailable.' : translated;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`;
const cache = new Map();
const pending = new Map();
let flushTimer;

async function flushTranslations() {
  flushTimer = undefined;
  const entries = [];
  let characters = 0;
  for (const entry of pending.entries()) {
    if (entries.length === 12 || characters + entry[0].length > 48000) break;
    entries.push(entry);
    characters += entry[0].length;
  }
  entries.forEach(([text]) => pending.delete(text));
  try {
    const response = await localizedFetch(`${API_BASE_URL}/translate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: entries.map(([text]) => text) }),
    });
    if (!response.ok) throw new Error(`Translation failed: HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.translations) || data.translations.length !== entries.length ||
        data.translations.some(text => typeof text !== 'string' || !text.trim() || hasChinese(text))) {
      throw new Error('Invalid English translation');
    }
    entries.forEach(([, handlers], index) => handlers.resolve(data.translations[index]));
  } catch (error) {
    entries.forEach(([, handlers]) => handlers.reject(error));
  }
  if (pending.size) flushTimer = setTimeout(flushTranslations, 30);
}

export function requestTranslation(text) {
  if (typeof text !== 'string' || text.length > 12000) {
    return Promise.reject(new Error('Translation text is too long or invalid.'));
  }
  if (cache.has(text)) return cache.get(text);
  const promise = new Promise((resolve, reject) => pending.set(text, { resolve, reject }));
  cache.set(text, promise);
  if (cache.size > 512) cache.delete(cache.keys().next().value);
  if (!flushTimer) flushTimer = setTimeout(flushTranslations, 30);
  return promise;
}

export function useLocale() { return useContext(LocaleContext); }

export function useEnglishText(value) {
  const { language, revision } = useLocale();
  const staticText = translateStatic(value, language);
  const needsTranslation = language === 'en' && hasChinese(staticText);
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!needsTranslation) return;
    let cancelled = false;
    // Send the original text, never a partly translated mathematical question.
    requestTranslation(value).then(
      text => { if (!cancelled) setResult({ value, revision, text }); },
      () => { if (!cancelled) setResult({ value, revision, text: 'English translation unavailable. Please retry translation.' }); },
    );
    return () => { cancelled = true; };
  }, [value, revision, needsTranslation]);
  if (!needsTranslation) return staticText;
  return result?.value === value && result.revision === revision ? result.text : 'Translating into English…';
}

export function LocalizedText({ value }) {
  const text = useEnglishText(value);
  const { language } = useLocale();
  return language === 'en' && typeof text === 'string' ? ` ${text} ` : text;
}

export function LocalizedMarkdown({ children, ...props }) {
  const text = useEnglishText(children);
  return <ReactMarkdown {...props}>{text}</ReactMarkdown>;
}

export function LocaleProvider({ children }) {
  const [language, updateLanguage] = useState(getLanguage);
  const [revision, setRevision] = useState(0);
  const setLanguage = next => { saveLanguage(next); updateLanguage(next); };
  useEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-Hant';
    document.title = language === 'en' ? 'JAE Exam Success' : '四校勝券';
  }, [language]);
  return <LocaleContext.Provider value={{ language, setLanguage, revision }}>
    <div className="language-toolbar" role="group" aria-label={language === 'en' ? 'Page language' : '頁面語言'}>
      <button type="button" aria-pressed={language === 'zh'} onClick={() => setLanguage('zh')}>
        {language === 'en' ? 'Chinese' : '繁體中文'}
      </button>
      <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
      {language === 'en' && <button type="button" onClick={() => { cache.clear(); setRevision(value => value + 1); }}>Retry translation</button>}
    </div>
    {children}
  </LocaleContext.Provider>;
}

export function getQuestionText(question) {
  return getLanguage() === 'en'
    ? question.raw_text_en || question.raw_text_zh || ''
    : question.raw_text_zh || question.raw_text_en || '';
}

export function questionOptions(question) {
  const candidates = getLanguage() === 'en'
    ? [question.options_en, question.options_zh, question.options, question.choices, question.choices_zh]
    : [question.options_zh, question.options, question.options_en, question.choices, question.choices_zh];
  return candidates.find(value => value && typeof value === 'object' && Object.keys(value).length > 0);
}

export async function englishContent(text) {
  if (!hasChinese(text)) return text;
  return requestTranslation(text);
}

// Localize accessible descriptions without changing input values or API identifiers.
export function LocalizedAttributes({ children }) {
  const title = useEnglishText(children.props.title);
  const placeholder = useEnglishText(children.props.placeholder);
  const ariaLabel = useEnglishText(children.props['aria-label']);
  const alt = useEnglishText(children.props.alt);
  return React.cloneElement(children, { title, placeholder, 'aria-label': ariaLabel, alt });
}
