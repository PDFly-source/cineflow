'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { CineFlowWordmark } from '@/components/brand/Wordmark';

/**
 * Final branding: premium centered developer-signature footer.
 * Deep-navy surface on the page background, restrained gold tagline,
 * muted-grey copyright. Hidden on the player page so it never competes
 * with player chrome, and padded at the bottom to clear the floating
 * bottom pill navigation.
 */
export const SignatureFooter: React.FC = () => {
  // GitHub Pages static export uses trailingSlash: true, so pathname arrives
  // as '/player/' — normalize before comparing (same fix as Navbar/BottomPillNav).
  // usePathname() can be null outside a Next router context (e.g. unit tests);
  // default to '/' so the footer still renders.
  const pathname = usePathname() ?? '/';
  const isPlayerPage = pathname.replace(/\/+$/, '') === '/player';
  if (isPlayerPage) return null;

  return (
    <footer className="mt-8 border-t border-[var(--bd)]/60 bg-[#06080F]">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-6 pt-8 text-center sm:gap-3.5 sm:pt-10 pb-[calc(112px+env(safe-area-inset-bottom,0px))]">
        <CineFlowWordmark className="text-lg sm:text-xl" />

        <p
          aria-label="CineFlow tagline"
          className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#D8B57A] sm:text-[11px]"
        >
          Private · Cinema · Control
        </p>

        <p className="text-[11px] font-medium text-[var(--t2)] sm:text-xs">
          Crafted &amp; Developed by{' '}
          <span className="font-bold text-[var(--tx)]">PKD</span>
        </p>

        <p className="text-[10px] text-[#7A8497] sm:text-[11px]">
          © 2026 CineFlow. All rights reserved.
        </p>
      </div>
    </footer>
  );
};
