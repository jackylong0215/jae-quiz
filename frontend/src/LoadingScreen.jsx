import { LocalizedText, useLocale } from './i18n.jsx';
import React from 'react';

export function LoadingScreen({ message = '正在載入題庫...' }) {
  useLocale();
  return (
    <div className="loading-overlay">
      <div className="loading-spinner" />
      <p className="loading-message"><LocalizedText value={message} /></p>
    </div>
  );
}

export function SkeletonCard() {
  useLocale();
  return (
    <div className="skeleton-card">
      <div className="skeleton-tags">
        <div className="skeleton-tag" />
        <div className="skeleton-tag" />
        <div className="skeleton-tag" />
      </div>
      <div className="skeleton-line full" />
      <div className="skeleton-line medium" />
      <div className="skeleton-line short" />
      <div className="skeleton-options">
        <div className="skeleton-option" />
        <div className="skeleton-option" />
        <div className="skeleton-option" />
        <div className="skeleton-option" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3 }) {
  useLocale();
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
}