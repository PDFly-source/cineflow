'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  FolderOpen,
  Film,
  Library,
  ListMusic,
  Settings,
  ShieldCheck,
  Activity,
  Search,
  History,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { useMedia } from '@/context/MediaSessionContext';
import { CineFlowLogo } from '@/components/brand/Logo';

const NAV_LINKS = [
  { label: 'Player', href: '/player', icon: Film },
  { label: 'Library', href: '/library', icon: Library },
  { label: 'Playlists', href: '/playlists', icon: ListMusic },
  { label: 'Diagnostics', href: '/diagnostics', icon: Activity },
  { label: 'More', href: '/more', icon: LayoutGrid },
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Privacy', href: '/privacy', icon: ShieldCheck },
];

/** Compact 36px circular icon action used in the header utility zone. */
const headerIconLink =
  'grid h-9 w-9 place-items-center rounded-full border border-[var(--bd)] bg-white/[0.04] text-[var(--t2)] transition-colors hover:border-[var(--ev)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ev)] active:scale-95';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { selectFiles } = useMedia();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // GitHub Pages static export uses trailingSlash: true, so pathname arrives
  // as '/player/' — normalize before comparing (same fix as BottomPillNav).
  const normalizedPath = pathname.replace(/\/+$/, '');

  const handleOpenVideoClick = () => {
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

  const isPlayerPage = normalizedPath === '/player';

  return (
    <>
      {/* Hidden File Input for Header Action */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,.mkv,.mp4,.webm,.mov,.avi,.m4v,.ts"
        onChange={handleFileInputChange}
        className="hidden"
        aria-label="Select local video files"
      />

      <header
        className={`sticky top-0 z-40 w-full border-b border-[var(--bd)]/80 bg-[var(--ob)]/85 backdrop-blur-md ${
          isPlayerPage ? 'hidden sm:block' : 'block'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-3 px-3 sm:h-14 sm:px-6 lg:px-8">
          {/* Zone 1: Brand — logo mark + compact wordmark on the left */}
          <Link
            href="/"
            aria-label="CineFlow home"
            className="flex shrink-0 items-center rounded-xl p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ev)]"
          >
            <CineFlowLogo className="h-9 w-9 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] sm:h-10 sm:w-10" />
          </Link>

          {/* Zone 2: Navigation Links (large screens only — keeps tablets on icon actions) */}
          <nav className="hidden lg:flex items-center gap-5 text-[13px] font-semibold text-[var(--t2)]">
            {NAV_LINKS.map((link) => {
              const isActive = normalizedPath === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap rounded-md py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ev)] ${
                    isActive ? 'font-bold text-white' : 'hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Zone 3: Compact utility actions on the right */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <Link
              href="/library?focus=search"
              aria-label="Search your library"
              title="Search"
              className={headerIconLink}
            >
              <Search className="h-[17px] w-[17px]" />
            </Link>

            <Link
              href="/library"
              aria-label="Recently played videos"
              title="Recent"
              className={headerIconLink}
            >
              <History className="h-[17px] w-[17px]" />
            </Link>

            <PWAInstallButton className="hidden sm:flex" />

            {/* Open Video: compact icon-button on phones, labelled on larger screens */}
            <button
              onClick={handleOpenVideoClick}
              aria-label="Open Video"
              title="Open Video"
              className={`${headerIconLink} sm:hidden`}
            >
              <FolderOpen className="h-[17px] w-[17px]" />
            </button>
            <span className="hidden sm:block" aria-hidden="true">
              <button
                onClick={handleOpenVideoClick}
                className="btn pri h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-xs font-bold text-white transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bv)]"
              >
                <FolderOpen className="h-4 w-4" />
                <span>Open Video</span>
              </button>
            </span>
          </div>
        </div>
      </header>
    </>
  );
};
