'use client';

import React from 'react';
import Image from 'next/image';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const LOGO_SRC = `${BASE_PATH}/brand/cineflow-logo.png`;

interface CineFlowLogoProps {
  /** Rendered pixel size (square), used to prevent layout shift. */
  size?: number;
  className?: string;
}

/**
 * Official CineFlow logo (supplied owner artwork, served as-is).
 * Full lockup: mark + CineFlow wordmark. Never cropped.
 * Fixed width/height prevent layout shift while the asset loads.
 */
export const CineFlowLogo: React.FC<CineFlowLogoProps> = ({
  size,
  className = '',
}) => {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <Image
      src={LOGO_SRC}
      alt="CineFlow logo"
      width={size ?? 512}
      height={size ?? 512}
      sizes="(max-width: 640px) 36px, 176px"
      style={style}
      draggable={false}
      priority={false}
      className={`shrink-0 select-none rounded-xl object-contain ${className}`}
    />
  );
};
