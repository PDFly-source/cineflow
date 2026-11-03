'use client';

import React from 'react';
import Image from 'next/image';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const LOGO_SRC = `${BASE_PATH}/brand/cineflow-logo.png`;

/**
 * Intrinsic size of the official lockup (v0.2.3 branding).
 * The artwork is a single composition — film-strip "C" with the play mark,
 * the Cineflow wordmark, and the PRIVATE · CINEMA · CONTROL tagline — so its
 * aspect ratio must travel with it. Declaring the real dimensions here keeps
 * next/image from reserving a square box and never stretches the artwork.
 */
const LOCKUP_W = 1000;
const LOCKUP_H = 880;

interface CineFlowLogoProps {
  /**
   * Layout classes for the artwork itself. Size it with a width (or a
   * max-width container) and let the intrinsic ratio set the height; adding a
   * fixed height with a fixed width would distort the lockup.
   */
  className?: string;
  /** Load eagerly — only for the launch screen, which is above the fold. */
  priority?: boolean;
}

/**
 * Official CineFlow brand lockup (supplied owner artwork, served as-is).
 * Full composition: mark + Cineflow wordmark + PRIVATE · CINEMA · CONTROL.
 * Never cropped, never stretched — object-contain with the real aspect ratio.
 */
export const CineFlowLogo: React.FC<CineFlowLogoProps> = ({
  className = '',
  priority = false,
}) => (
  <Image
    src={LOGO_SRC}
    alt="CineFlow — film-strip C and play mark, Cineflow wordmark, PRIVATE · CINEMA · CONTROL"
    width={LOCKUP_W}
    height={LOCKUP_H}
    sizes="(max-width: 640px) 260px, 340px"
    priority={priority}
    draggable={false}
    className={`h-auto max-w-full shrink-0 select-none object-contain ${className}`}
  />
);
