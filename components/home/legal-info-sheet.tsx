'use client';

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { FocusTrap } from '@/components/ui/focus-trap';
import { PrivacidadContent } from '@/components/legal/privacidad-content';
import { TerminosContent } from '@/components/legal/terminos-content';
import { cn } from '@/lib/utils/cn';

export type LegalTab = 'privacidad' | 'terminos';

type Props = {
  open: boolean;
  tab: LegalTab;
  onTabChange: (tab: LegalTab) => void;
  onClose: () => void;
};

type VvBox = { top: number; left: number; width: number; height: number };

/**
 * Caja del visualViewport: en Android Chrome/WebView un `position:fixed; top:0`
 * se ancla al layout viewport y la barra superior (logo) queda FUERA de lo visible.
 */
function useVisualViewportBox(active: boolean): VvBox {
  const [box, setBox] = useState<VvBox>(() => ({
    top: 0,
    left: 0,
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }));

  useLayoutEffect(() => {
    if (!active || typeof window === 'undefined') return;

    const apply = () => {
      const vv = window.visualViewport;
      if (vv) {
        setBox({
          top: Math.round(vv.offsetTop),
          left: Math.round(vv.offsetLeft),
          width: Math.round(vv.width),
          height: Math.round(vv.height),
        });
      } else {
        setBox({
          top: 0,
          left: 0,
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }
    };

    apply();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    // WebView a veces reporta offset tarde
    const t1 = window.setTimeout(apply, 50);
    const t2 = window.setTimeout(apply, 250);

    return () => {
      vv?.removeEventListener('resize', apply);
      vv?.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [active]);

  return box;
}

/** Hueco bajo status bar / notch (env suele ser 0 en Android). */
function useStatusBarPadPx(active: boolean): number {
  const [px, setPx] = useState(56);

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;

    const measure = () => {
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
      // Si env() ya trae valor (iOS), úsalo; si no, mínimos altos en Android
      const floor = isAndroid ? 56 : 12;
      setPx(Math.ceil(Math.max(floor, envTop, envTop > 0 ? envTop : floor)));
    };

    measure();
    window.addEventListener('resize', measure);
    const t = window.setTimeout(measure, 100);
    return () => {
      window.removeEventListener('resize', measure);
      window.clearTimeout(t);
    };
  }, [active]);

  return px;
}

/**
 * Panel legal del botón ℹ️ del mapa.
 * Barra superior con logo ViaMorelia siempre visible (anclada al visualViewport).
 */
export function LegalInfoSheet({ open, tab, onTabChange, onClose }: Props) {
  const titleId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const vv = useVisualViewportBox(open);
  const statusPad = useStatusBarPadPx(open);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [open, tab]);

  useEffect(() => {
    if (!open) return;
    const shell = document.querySelector('.vm-app-shell');
    const prev = shell instanceof HTMLElement ? shell.style.overflow : '';
    if (shell instanceof HTMLElement) shell.style.overflow = 'hidden';
    return () => {
      if (shell instanceof HTMLElement) shell.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <FocusTrap
      active={open}
      onEscape={onClose}
      aria-label="Información legal de ViaMorelia"
      className="pointer-events-auto fixed z-[90]"
      role="presentation"
      aria-modal={false}
    >
      {/*
        NO usar inset-0 CSS: en Android el fixed se va arriba del área visible.
        top/left/width/height = visualViewport (lo que el usuario realmente ve).
      */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-legal-sheet
        className="flex flex-col overflow-hidden bg-white text-slate-900 shadow-2xl"
        style={{
          position: 'fixed',
          top: vv.top,
          left: vv.left,
          width: vv.width || '100%',
          height: vv.height || '100%',
          zIndex: 90,
          // Status bar / notch DENTRO del viewport visible
          paddingTop: statusPad,
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'max(0px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0px, env(safe-area-inset-right, 0px))',
          boxSizing: 'border-box',
        }}
      >
        {/* Barra con logo — lo que faltaba ver en Android */}
        <header className="shrink-0 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 py-2.5 sm:px-4">
            <Image
              src="/brand/icono-64.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 object-contain"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold leading-tight text-emerald-800">
                ViaMorelia
              </p>
              <p id={titleId} className="truncate text-[11px] font-medium text-slate-500">
                Privacidad y términos
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="vm-btn-icon !h-10 !w-10 !rounded-xl shrink-0"
              aria-label="Cerrar información"
            >
              <X className="h-5 w-5 text-slate-600" />
            </button>
          </div>

          <div
            className="mx-auto flex max-w-2xl gap-1 px-3 pb-2.5 sm:px-4"
            role="tablist"
            aria-label="Sección legal"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'privacidad'}
              onClick={() => onTabChange('privacidad')}
              className={cn(
                'flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors cursor-pointer sm:text-sm',
                tab === 'privacidad'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              Privacidad
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'terminos'}
              onClick={() => onTabChange('terminos')}
              className={cn(
                'flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors cursor-pointer sm:text-sm',
                tab === 'terminos'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              Términos
            </button>
          </div>
        </header>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pt-4 sm:px-5"
          style={{
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="mx-auto max-w-2xl pb-8">
            {tab === 'privacidad' ? (
              <PrivacidadContent onOpenTerminos={() => onTabChange('terminos')} />
            ) : (
              <TerminosContent
                onOpenPrivacidad={() => onTabChange('privacidad')}
                onClose={onClose}
              />
            )}
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}
