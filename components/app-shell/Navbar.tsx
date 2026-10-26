'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FolderOpen, Film, Library, ListMusic, Settings, ShieldCheck, Activity } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { useMedia } from '@/context/MediaSessionContext';
import { LogoIcon, LogoWordmark } from '@/components/brand/Logo';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { selectFiles, currentItem } = useMedia();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const navLinks = [
    { label: 'Player', href: '/player', icon: Film },
    { label: 'Library', href: '/library', icon: Library },
    { label: 'Playlists', href: '/playlists', icon: ListMusic },
    { label: 'Diagnostics', href: '/diagnostics', icon: Activity },
    { label: 'Settings', href: '/settings', icon: Settings },
    { label: 'Privacy', href: '/privacy', icon: ShieldCheck },
  ];

  const isPlayerPage = pathname === '/player';

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
        className={`sticky top-0 z-40 w-full border-b border-[var(--bd)] bg-[var(--ob)]/90 backdrop-blur-md transition-all ${
          isPlayerPage ? 'hidden sm:block' : 'block'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          {/* Zone 1: Brand Wordmark with Exact Sprite Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ev)] rounded-xl p-1"
          >
            <LogoIcon className="group-hover:scale-105 transition-transform" />
            <LogoWordmark className="group-hover:opacity-90 transition-opacity" />
          </Link>

          {/* Zone 2: Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[var(--t2)]">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors whitespace-nowrap shrink-0 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ev)] rounded-md ${
                    isActive
                      ? 'text-white font-bold'
                      : 'text-[var(--t2)] hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action & Install Button */}
          <div className="flex items-center gap-3 shrink-0">
            <PWAInstallButton className="hidden sm:flex" />

            <button
              onClick={handleOpenVideoClick}
              className="btn pri h-10 px-4 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bv)] whitespace-nowrap shrink-0"
            >
              <FolderOpen className="h-4 w-4" />
              <span>Open Video</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
};
