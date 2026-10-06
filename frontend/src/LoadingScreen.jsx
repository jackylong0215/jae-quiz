import React from 'react';

export function LoadingScreen({ message = '正在載入題庫...' }) {
  return (
    <div className="loading-overlay">
      <div className="loading-spinner" />
      <p className="loading-message">{message}</p>
    </div>
  );
}

export function SkeletonCard() {
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
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
}