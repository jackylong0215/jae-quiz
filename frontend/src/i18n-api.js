import axios from 'axios';
import { getLanguage } from './locale-store.js';

export const api = axios.create();
api.interceptors.request.use(config => {
  config.headers.set('Accept-Language', getLanguage());
  return config;
});

export function localizedFetch(input, init = {}) {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  headers.set('Accept-Language', getLanguage());
  return fetch(input, { ...init, headers });
}
