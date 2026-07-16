'use client';

import { useEffect, useState } from 'react';

/**
 * Calcula cuántos px deja libres la status bar / notch / PWA.
 * En Android env(safe-area-inset-top) suele ser 0 aunque el WebView
 * se dibuje debajo de la barra — por eso hay mínimos altos.
 */
function measureTopInsetPx(): number {
  if (typeof window === 'undefined') return 72;

  let envTop = 0;
  try {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);';
    document.body.appendChild(probe);
    envTop = parseFloat(getComputedStyle(probe).paddingTop) || 0;
    probe.remove();
  } catch {
    envTop = 0;
  }

  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isMobile =
    isAndroid ||
    isIOS ||
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(max-width: 1024px)').matches;

  // visualViewport.offsetTop a veces refleja chrome del browser
  const vvTop = window.visualViewport?.offsetTop ?? 0;

  // Mínimos empíricos: status bar ~24–48 + margen; notch / punch-hole más
  const floor = isAndroid ? 72 : isIOS ? 56 : isMobile ? 56 : 12;

  return Math.ceil(Math.max(floor, envTop, vvTop, envTop + 12));
}

type Props = {
  /** 'bar' = franja superior; 'padding' solo expone el valor vía CSS var */
  mode?: 'bar' | 'padding';
  className?: string;
};

/**
 * Franja superior garantizada (logo/nav nunca bajo la status bar).
 * Se usa en /privacidad, /terminos y en el sheet ℹ️.
 */
export function LegalTopInset({ mode = 'bar', className = '' }: Props) {
  const [px, setPx] = useState(72);

  useEffect(() => {
    const apply = () => {
      const next = measureTopInsetPx();
      setPx(next);
      document.documentElement.style.setProperty('--vm-legal-top-inset', `${next}px`);
    };
    apply();
    window.addEventListener('resize', apply);
    window.visualViewport?.addEventListener('resize', apply);
    // Recalcular tras paint (PWA / WebView a veces reportan env tarde)
    const t1 = window.setTimeout(apply, 50);
    const t2 = window.setTimeout(apply, 300);
    return () => {
      window.removeEventListener('resize', apply);
      window.visualViewport?.removeEventListener('resize', apply);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (mode === 'padding') return null;

  return (
    <div
      aria-hidden
      className={`vm-legal-top-inset shrink-0 bg-white ${className}`}
      style={{
        height: px,
        minHeight: px,
        width: '100%',
        flexShrink: 0,
      }}
    />
  );
}

export function useLegalTopInsetPx(): number {
  const [px, setPx] = useState(72);
  useEffect(() => {
    const apply = () => setPx(measureTopInsetPx());
    apply();
    window.addEventListener('resize', apply);
    window.visualViewport?.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('resize', apply);
      window.visualViewport?.removeEventListener('resize', apply);
    };
  }, []);
  return px;
}
