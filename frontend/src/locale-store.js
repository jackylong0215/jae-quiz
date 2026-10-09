let language = 'zh';
try { language = localStorage.getItem('jae_language') === 'en' ? 'en' : 'zh'; }
catch { /* The in-memory preference still works when storage is disabled. */ }

export function getLanguage() { return language; }

export function saveLanguage(next) {
  language = next === 'en' ? 'en' : 'zh';
  try { localStorage.setItem('jae_language', language); } catch { /* Storage can be disabled. */ }
}
