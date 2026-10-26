'use client';

import React from 'react';

interface EmptyStateCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  dashed?: boolean;
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
  dashed = false,
}) => {
  return (
    <div
      className={`card flex items-center gap-3 p-3 sm:p-3.5 transition-all ${
        dashed ? 'border-dashed' : ''
      } ${className}`}
    >
      <div className="tile">{icon}</div>
      <div className="flex-1 min-w-0">
        <strong className="block text-sm font-semibold text-[var(--tx)] truncate mb-0.5">
          {title}
        </strong>
        <p className="text-xs text-[var(--t2)] leading-relaxed">{description}</p>
      </div>
      {actionLabel && (
        <button
          onClick={onAction}
          className="chip on shrink-0 hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ev)]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
