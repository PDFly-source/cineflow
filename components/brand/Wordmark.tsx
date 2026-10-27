import React from 'react';

interface WordmarkProps {
  /**
   * Classes for the wrapping span. Control the font size/weight from the call
   * site; the split colors/gradient are applied to the inner spans.
   */
  className?: string;
  /** Extra classes for the gradient "Flow" half (e.g. brightness tweaks). */
  flowClassName?: string;
}

/**
 * Text-only CineFlow wordmark (final branding): "Cine" in bold high-contrast
 * light type, "Flow" in a cyan → blue → violet → magenta text gradient.
 * Used by the header and the signature footer so both stay identical.
 * No logo image asset is involved (PWA/manifest icons remain untouched).
 */
export const CineFlowWordmark: React.FC<WordmarkProps> = ({
  className = '',
  flowClassName = '',
}) => (
  <span
    className={`inline-flex select-none items-baseline font-sans font-bold tracking-tight ${className}`}
  >
    <span className="text-[var(--tx)]">Cine</span>
    <span
      className={`bg-[linear-gradient(95deg,#22D3EE_0%,#3B82F6_38%,#8B5CF6_70%,#D946EF_100%)] bg-clip-text text-transparent ${flowClassName}`}
    >
      Flow
    </span>
  </span>
);
