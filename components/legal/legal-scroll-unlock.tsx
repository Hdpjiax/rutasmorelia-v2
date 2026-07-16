'use client';

import { useEffect } from 'react';

/**
 * Fuerza scroll de documento en páginas legales.
 * Refuerzo por si Tailwind (body overflow-hidden) o el shell del mapa
 * ganan al CSS en algún WebView/tablet.
 */
export function LegalScrollUnlock() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    html.setAttribute('data-legal-scroll', '1');
    body.setAttribute('data-legal-scroll', '1');

    const prev = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      htmlMaxHeight: html.style.maxHeight,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      bodyMaxHeight: body.style.maxHeight,
      bodyPosition: body.style.position,
    };

    html.style.setProperty('overflow', 'auto', 'important');
    html.style.setProperty('height', 'auto', 'important');
    html.style.setProperty('max-height', 'none', 'important');
    body.style.setProperty('overflow', 'auto', 'important');
    body.style.setProperty('overflow-y', 'scroll', 'important');
    body.style.setProperty('height', 'auto', 'important');
    body.style.setProperty('max-height', 'none', 'important');
    body.style.setProperty('position', 'static', 'important');
    body.style.setProperty('-webkit-overflow-scrolling', 'touch');

    // Subir al inicio al entrar (si hay scroll residual el header se “pierde” arriba)
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    return () => {
      html.removeAttribute('data-legal-scroll');
      body.removeAttribute('data-legal-scroll');
      html.style.overflow = prev.htmlOverflow;
      html.style.height = prev.htmlHeight;
      html.style.maxHeight = prev.htmlMaxHeight;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
      body.style.maxHeight = prev.bodyMaxHeight;
      body.style.position = prev.bodyPosition;
      body.style.removeProperty('overflow-y');
      body.style.removeProperty('-webkit-overflow-scrolling');
    };
  }, []);

  return null;
}
