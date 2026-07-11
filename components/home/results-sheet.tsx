'use client';

import React, { useCallback, useRef } from 'react';
import {
  motion,
  AnimatePresence,
  useDragControls,
  type PanInfo,
} from 'motion/react';
import { Heart, Map, Navigation, Route as RouteIcon, X } from 'lucide-react';
import { FocusTrap } from '@/components/ui/focus-trap';
import { cn } from '@/lib/utils/cn';

export type SheetPanel = 'results' | 'routes' | 'favorites';

/** Solo dos estados: abierto (~60% vh) o cerrado. Sin peek/mid/full. */
const OPEN_VH = 60;

type FooterAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
};

type Props = {
  open: boolean;
  isDesktop: boolean;
  panel: SheetPanel;
  onPanelChange: (p: SheetPanel) => void;
  onClose: () => void;
  children: React.ReactNode;
  /** Acción primaria fija (p. ej. Ver en el mapa). Siempre visible en móvil. */
  footerAction?: FooterAction | null;
};

export function ResultsSheet({
  open,
  isDesktop,
  panel,
  onPanelChange,
  onClose,
  children,
  footerAction,
}: Props) {
  const dragControls = useDragControls();
  const touchStartYRef = useRef<number | null>(null);

  const closeSheet = useCallback(() => {
    touchStartYRef.current = null;
    // Cerrar teclado antes de animar el panel (iOS)
    if (typeof document !== 'undefined') {
      const el = document.activeElement;
      if (el instanceof HTMLElement) el.blur();
    }
    onClose();
  }, [onClose]);

  const onDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (isDesktop) return;
      // Solo cierra: no hay alturas intermedias
      if (info.velocity.y > 350 || info.offset.y > 48) {
        closeSheet();
      }
    },
    [closeSheet, isDesktop]
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Desktop: overlay modal bloqueante. Móvil: SIN overlay — el mapa sigue usable. */}
          {isDesktop && (
            <motion.button
              type="button"
              aria-label="Cerrar panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-auto fixed inset-0 z-40 cursor-pointer backdrop-blur-[1px]"
              style={{ background: 'var(--vm-overlay)' }}
              onClick={closeSheet}
            />
          )}

          <FocusTrap
            active={open && isDesktop}
            onEscape={closeSheet}
            aria-label="Panel de viaje y rutas"
            className={
              isDesktop
                ? 'pointer-events-auto fixed left-1/2 top-1/2 z-50 max-h-[min(78vh,560px)] w-[min(94vw,480px)] -translate-x-1/2 -translate-y-1/2 lg:w-[min(92vw,520px)]'
                : 'pointer-events-auto fixed inset-x-0 bottom-0 z-50'
            }
          >
            <motion.div
              key="results-modal"
              initial={
                isDesktop
                  ? { opacity: 0, scale: 0.94, y: 12 }
                  : { opacity: 0, y: '100%' }
              }
              animate={
                isDesktop
                  ? { opacity: 1, scale: 1, y: 0 }
                  : { opacity: 1, y: 0, height: `${OPEN_VH}vh` }
              }
              exit={
                isDesktop
                  ? { opacity: 0, scale: 0.96, y: 8 }
                  : { opacity: 0, y: '100%' }
              }
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
              drag={!isDesktop ? 'y' : false}
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.02, bottom: 0.85 }}
              dragMomentum={false}
              onDragEnd={onDragEnd}
              className={
                isDesktop
                  ? 'pointer-events-auto vm-panel flex h-full max-h-[min(78vh,560px)] w-full flex-col overflow-hidden rounded-2xl border text-[13px]'
                  : 'pointer-events-auto vm-panel relative flex w-full flex-col overflow-hidden rounded-t-3xl border-t pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgba(15,23,42,0.18)]'
              }
              style={!isDesktop ? { maxHeight: '70dvh', minHeight: '48vh' } : undefined}
              role={!isDesktop ? 'dialog' : undefined}
              aria-modal={isDesktop ? true : undefined}
            >
              {/* Cabecera móvil: asa (gesto complementario) + X grande (acción principal) */}
              {!isDesktop && (
                <div className="relative flex shrink-0 items-center justify-between px-2 pt-1">
                  <div
                    className="flex min-h-11 flex-1 cursor-grab flex-col items-center justify-center select-none active:cursor-grabbing"
                    style={{ touchAction: 'none' }}
                    onPointerDown={(event) => {
                      if (!event.isPrimary) return;
                      touchStartYRef.current = event.clientY;
                      dragControls.start(event);
                    }}
                    onPointerUp={(event) => {
                      const startY = touchStartYRef.current;
                      touchStartYRef.current = null;
                      if (startY !== null && event.clientY - startY > 40) closeSheet();
                    }}
                    onPointerCancel={() => {
                      touchStartYRef.current = null;
                    }}
                    aria-label="Deslizar hacia abajo para cerrar (opcional)"
                  >
                    <span className="mt-1 h-1.5 w-12 rounded-full bg-slate-300" aria-hidden />
                    <span className="sr-only">Desliza hacia abajo para cerrar</span>
                  </div>

                  <button
                    type="button"
                    aria-label="Cerrar y ver mapa"
                    title="Cerrar"
                    data-testid="sheet-close"
                    className="pointer-events-auto absolute right-2 top-1 z-[70] flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-slate-200 text-slate-900 shadow-sm active:scale-95"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      closeSheet();
                    }}
                  >
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                </div>
              )}

              {/* Pestañas */}
              <div
                className={cn(
                  'flex shrink-0 items-center justify-between gap-2 px-3 py-2',
                  isDesktop && 'px-3 py-2'
                )}
                style={{ borderBottom: '1px solid var(--vm-card-border)' }}
              >
                <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pr-10 md:gap-1" role="tablist">
                  {(
                    [
                      { id: 'results' as const, label: 'Mi viaje', icon: Navigation },
                      { id: 'routes' as const, label: 'Rutas', icon: RouteIcon },
                      { id: 'favorites' as const, label: 'Favoritos', icon: Heart },
                    ] as const
                  ).map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={panel === tab.id}
                        onClick={() => onPanelChange(tab.id)}
                        className={cn(
                          'vm-press flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 py-2 text-[11px] font-bold cursor-pointer touch-manipulation md:min-h-8 md:px-2.5 md:py-1.5 md:text-[11px]',
                          panel === tab.id ? 'vm-chip-active' : 'vm-chip'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {isDesktop && (
                  <button
                    type="button"
                    onClick={closeSheet}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-800 cursor-pointer hover:bg-slate-300"
                    aria-label="Cerrar y ver mapa"
                    title="Cerrar"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>

              {/* Contenido con scroll propio — no pelea con el drag del asa */}
              <div
                className={cn(
                  'min-h-0 flex-1 overflow-y-auto overscroll-contain',
                  isDesktop && 'vm-modal-body-desktop text-[13px] leading-snug'
                )}
                role="tabpanel"
                style={{ touchAction: 'pan-y' }}
              >
                {children}
              </div>

              {/* CTA fija: Ver en el mapa (no depender del gesto) */}
              {footerAction && (
                <div
                  className={cn(
                    'shrink-0 border-t border-slate-200/80 bg-white/95 px-3 py-2.5 backdrop-blur-sm',
                    isDesktop && 'px-3 py-2'
                  )}
                  style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
                >
                  <button
                    type="button"
                    data-testid={footerAction.testId ?? 'sheet-view-map'}
                    disabled={footerAction.disabled}
                    onClick={() => {
                      if (typeof document !== 'undefined') {
                        const el = document.activeElement;
                        if (el instanceof HTMLElement) el.blur();
                      }
                      footerAction.onClick();
                    }}
                    className={cn(
                      'flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition active:scale-[0.99]',
                      isDesktop && 'min-h-9 gap-1.5 rounded-xl py-2 text-xs',
                      footerAction.disabled
                        ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                        : 'cursor-pointer bg-emerald-600 text-white shadow-md hover:bg-emerald-700'
                    )}
                  >
                    <Map className={cn('h-4 w-4 shrink-0', isDesktop && 'h-3.5 w-3.5')} aria-hidden />
                    {footerAction.label}
                  </button>
                </div>
              )}
            </motion.div>
          </FocusTrap>
        </>
      )}
    </AnimatePresence>
  );
}
