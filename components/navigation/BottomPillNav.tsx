'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMedia } from '@/context/MediaSessionContext';
import { SubtitlesModal } from '@/components/player/SubtitlesModal';

export const BottomPillNav: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { selectFiles, currentItem } = useMedia();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSubtitlesModal, setShowSubtitlesModal] = React.useState<boolean>(false);

  const handleFabClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      selectFiles(Array.from(files));
      e.target.value = '';
      router.push('/player');
    }
  };

  // If in fullscreen video player, hide pill navigation to give full viewport to video
  // With trailingSlash: true (GitHub Pages export) usePathname() returns
  // '/player/', so compare against the normalized path.
  const isPlayerPage = pathname.replace(/\/+$/, '') === '/player';

  return (
    <>
      {/* Hidden file input for FAB */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,.mkv,.mp4,.webm,.mov,.avi,.m4v,.ts"
        onChange={handleFileInputChange}
        className="hidden"
        aria-label="Quick Select Video"
      />

      {/* Subtitles Studio Modal accessible globally */}
      <SubtitlesModal
        isOpen={showSubtitlesModal}
        onClose={() => setShowSubtitlesModal(false)}
      />

      {/* Bottom Floating Pill Navigation */}
      <nav
        aria-label="CineFlow Navigation"
        className={`pill select-none transition-all duration-300 ${
          // Hide on the player page at every width: landscape phones exceed
          // the 640px breakpoint and the floating pill would otherwise sit
          // over the player's bottom controls and swallow their taps.
          isPlayerPage ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        {/* 1: Home */}
        <Link
          href="/"
          className={pathname === '/' ? 'on' : ''}
          aria-label="Home"
          title="Home Dashboard"
        >
          <svg className="i w-5 h-5" viewBox="0 0 24 24">
            <path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z" stroke="currentColor" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        {/* 2: Library */}
        <Link
          href="/library"
          className={pathname === '/library' ? 'on' : ''}
          aria-label="Library"
          title="Local Media Library"
        >
          <svg className="i w-5 h-5" viewBox="0 0 24 24">
            <rect x="4" y="4" width="7" height="7" rx="2" stroke="currentColor" fill="none" strokeWidth="1.7" />
            <rect x="13" y="4" width="7" height="7" rx="2" stroke="currentColor" fill="none" strokeWidth="1.7" />
            <rect x="4" y="13" width="7" height="7" rx="2" stroke="currentColor" fill="none" strokeWidth="1.7" />
            <rect x="13" y="13" width="7" height="7" rx="2" stroke="currentColor" fill="none" strokeWidth="1.7" />
          </svg>
        </Link>

        {/* 3: FAB Open Video */}
        <button
          onClick={handleFabClick}
          className="fab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ev)] active:scale-95 transition-transform"
          aria-label="Open Video"
          title="Open Video from Device"
        >
          <svg className="i w-6 h-6 text-white" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="currentColor" fill="none" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        {/* 4: Subtitles Studio */}
        <button
          onClick={() => setShowSubtitlesModal(true)}
          className={showSubtitlesModal ? 'on' : ''}
          aria-label="Subtitles"
          title="Subtitle Studio"
        >
          <svg className="i w-5 h-5" viewBox="0 0 24 24">
            <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" fill="none" strokeWidth="1.7" />
            <path d="M10 10a2 2 0 100 4M17 10a2 2 0 100 4" stroke="currentColor" fill="none" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>

        {/* 5: More (Settings, transfer, hidden, tools) */}
        <Link
          href="/more"
          className={pathname === '/more' ? 'on' : ''}
          aria-label="More"
          title="More: transfer, MP3, hidden, settings"
        >
          <svg className="i w-5 h-5" viewBox="0 0 24 24">
            <circle cx="6" cy="12" r="1.6" fill="currentColor" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" />
            <circle cx="18" cy="12" r="1.6" fill="currentColor" />
          </svg>
        </Link>
      </nav>
    </>
  );
};
