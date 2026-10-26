'use client';

import React from 'react';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  onClick?: () => void;
}

/**
 * CineFlow Logo Icon (44x44px sprite slice from original branding)
 */
export const LogoIcon: React.FC<LogoProps> = ({ className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`ic shrink-0 cursor-pointer ${className}`}
      aria-label="CineFlow Logo Mark"
      role="img"
    />
  );
};

/**
 * CineFlow Logo Wordmark (124x26px sprite slice from original branding)
 */
export const LogoWordmark: React.FC<LogoProps> = ({ className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`wm shrink-0 cursor-pointer ${className}`}
      aria-label="CineFlow Wordmark"
      role="img"
    />
  );
};

/**
 * CineFlow Full Splash Logo (290x290px with deep violet cinematic glow)
 */
export const LogoSplash: React.FC<LogoProps> = ({ className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`logo-splash shrink-0 transition-transform duration-500 hover:scale-[1.02] ${className}`}
      aria-label="CineFlow Premium Emblem"
      role="img"
    />
  );
};

/**
 * CineFlow Brand Header component
 */
export const BrandHeader: React.FC<{
  showSettingsShortcut?: boolean;
  onSettingsClick?: () => void;
  className?: string;
}> = ({ showSettingsShortcut = true, onSettingsClick, className = '' }) => {
  return (
    <header className={`flex items-center gap-2.5 h-12 w-full select-none ${className}`}>
      <Link href="/" className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ev)] rounded-xl p-1">
        <LogoIcon className="group-hover:scale-105 transition-transform" />
        <LogoWordmark className="group-hover:opacity-90 transition-opacity" />
      </Link>
      <div className="flex-1" />
      {showSettingsShortcut && (
        <Link
          href="/settings"
          onClick={onSettingsClick}
          className="ib flex items-center justify-center transition-colors hover:border-[var(--bv)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ev)]"
          aria-label="Settings"
        >
          <svg className="i w-5 h-5" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" stroke="currentColor" fill="none" strokeWidth="1.7" />
            <path
              d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"
              stroke="currentColor"
              fill="none"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </Link>
      )}
    </header>
  );
};
