/**
 * Regression tests for Phase 2.9 final branding: text-only wordmark
 * ("Cine" bold light + "Flow" gradient) and the signature footer content.
 * Uses happy-dom to render the real components.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Window } from 'happy-dom';
import { CineFlowWordmark } from '../components/brand/Wordmark';
import { SignatureFooter } from '../components/app-shell/SignatureFooter';

const window = new Window();
const document = window.document;
Object.defineProperty(globalThis, 'document', { value: document, configurable: true, writable: true });
Object.defineProperty(globalThis, 'window', { value: window, configurable: true, writable: true });
Object.defineProperty(globalThis, 'self', { value: window, configurable: true, writable: true });

/** Minimal shape needed from a rendered happy-dom element. */
interface TestEl {
  textContent: string | null;
  className: string;
}

async function render(
  jsx: ReturnType<typeof React.createElement>
): Promise<{ host: ReturnType<typeof document.createElement>; unmount: () => void }> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root: Root = createRoot(host as unknown as Parameters<typeof createRoot>[0]);
  root.render(jsx);
  await new Promise((r) => setTimeout(r, 30)); // let React flush
  return { host, unmount: () => { root.unmount(); host.remove(); } };
}

function spans(host: ReturnType<typeof document.createElement>): TestEl[] {
  return [...host.querySelectorAll('span span')] as unknown as TestEl[];
}

function paragraphs(host: ReturnType<typeof document.createElement>): TestEl[] {
  return [...host.querySelectorAll('p')] as unknown as TestEl[];
}

describe('CineFlowWordmark', () => {
  test('renders text-only "CineFlow" — no logo image assets', async () => {
    const h = await render(React.createElement(CineFlowWordmark));
    try {
      assert.equal(h.host.textContent, 'CineFlow');
      assert.equal(h.host.querySelector('img, image'), null, 'wordmark must not embed a logo image');
      const [cine, flow] = spans(h.host);
      assert.ok(cine && flow, 'inner wordmark spans missing');
      assert.equal(cine.textContent, 'Cine');
      assert.equal(flow.textContent, 'Flow');
    } finally { h.unmount(); }
  });

  test('"Cine" bold light; "Flow" clipped cyan→blue→violet→magenta gradient', async () => {
    const h = await render(React.createElement(CineFlowWordmark));
    try {
      const [cine, flow] = spans(h.host);
      assert.ok(cine && flow, 'inner wordmark spans missing');
      assert.match(cine.className, /text-\[var\(--tx\)\]/, 'Cine half must use light theme text');
      const wrap = h.host.querySelector('span');
      assert.ok(wrap, 'wordmark wrapper span missing');
      assert.match(String(wrap.className), /font-bold/, 'wordmark must be bold');
      const flowClass = flow.className;
      assert.match(flowClass, /#22D3EE/, 'gradient must start cyan');
      assert.match(flowClass, /#3B82F6/, 'gradient must pass blue');
      assert.match(flowClass, /#8B5CF6/, 'gradient must pass violet');
      assert.match(flowClass, /#D946EF/, 'gradient must end magenta');
      assert.match(flowClass, /bg-clip-text text-transparent/, 'gradient must be clipped to text');
    } finally { h.unmount(); }
  });
});

describe('SignatureFooter', () => {
  test('shows wordmark, gold tagline, PKD credit, and copyright', async () => {
    const h = await render(React.createElement(SignatureFooter));
    try {
      const text = h.host.textContent || '';
      assert.ok(text.includes('CineFlow'), 'footer must carry the wordmark');
      assert.match(text, /PRIVATE\s*·\s*CINEMA\s*·\s*CONTROL/i, 'tagline missing');
      assert.match(text, /Crafted & Developed by\s*PKD/, 'developer credit missing');
      assert.match(text, /© 2026 CineFlow\. All rights reserved\./, 'copyright missing');
      // Tagline element itself carries the restrained gold accent
      const tagline = paragraphs(h.host).find((p) =>
        /Private \u00b7 Cinema \u00b7 Control/i.test(p.textContent || ''));
      assert.ok(tagline, 'tagline element not found');
      assert.match(tagline.className, /#D8B57A/, 'tagline must use the gold accent');
      assert.match(tagline.className, /uppercase/, 'tagline must be uppercased');
    } finally { h.unmount(); }
  });
});
