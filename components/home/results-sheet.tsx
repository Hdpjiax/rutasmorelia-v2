'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  motion,
  AnimatePresence,
  useDragControls,
  type PanInfo,
} from 'motion/react';
import { Heart, Navigation, Route as RouteIcon, X } from 'lucide-react';
import { FocusTrap } from '@/components/ui/focus-trap';
import { cn } from '@/lib/utils/cn';

export type SheetPanel = 'results' | 'routes' | 'favorites';
export type SheetSnap = 'peek' | 'mid' | 'full';

type Props = {
  open: boolean;
  isDesktop: boolean;
  panel: SheetPanel;
  onPanelChange: (p: SheetPanel) => void;
  onClose: () => void;
  children: React.ReactNode;
};

const SNAP_VH: Record<SheetSnap, number> = {
  peek: 22,
  mid: 52,
  full: 78,
};

function snapFromDrag(offsetY: number, velocityY: number, current: SheetSnap): SheetSnap | 'close' {
  // Un gesto intencional hacia abajo cierra desde cualquier altura.
  // Así el usuario nunca queda atrapado teniendo que pasar por varios snaps.
  if (velocityY > 850 || offsetY > 120) return 'close';

  if (velocityY < -700 || offsetY < -80) {
    if (current === 'peek') return 'mid';
    return 'full';
  }

  if (offsetY > 48) {
    if (current === 'full') return 'mid';
    if (current === 'mid') return 'peek';
    return 'close';
  }

  if (offsetY < -36) {
    if (current === 'peek') return 'mid';
    return 'full';
  }

  return current;
}

/**
 * Desktop: modal centrado.
 * Móvil: bottom sheet deslizable, con cierre directo hacia abajo.
 */
export function ResultsSheet({
  open,
  isDesktop,
  panel,
  onPanelChange,
  onClose,
  children,
}: Props) {
  const [snap, setSnap] = useState<SheetSnap>('mid');
  const dragControls = useDragControls();

  useEffect(() => {
    if (open) setSnap('mid');
  }, [open]);

  const onDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (isDesktop) return;
      const next = snapFromDrag(info.offset.y, info.velocity.y, snap);
      if (next === 'close') {
        onClose();
        return;
      }
      setSnap(next);
    },
    [isDesktop, onClose, snap]
  );

  const heightVh = SNAP_VH[snap];
  const mapMostlyVisible = !isDesktop && snap === 'peek';

  return (
    <AnimatePresence>
      {open && (
        <>
          {!isDesktop && (
            <motion.button
              type="button"
              aria-label="Cerrar panel y ver mapa"
              initial={{ opacity: 0 }}
              animate={{ opacity: mapMostlyVisible ? 0 : snap === 'full' ? 0.28 : 0.12 }}
              exit={{ opacity: 0 }}
              className={cn(
                'fixed inset-0 z-40 bg-slate-900',
                mapMostlyVisible ? 'pointer-events-none' : 'cursor-pointer'
              )}
              onClick={onClose}
            />
          )}

          {isDesktop && (
            <motion.button
              type="button"
              aria-label="Cerrar panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 cursor-pointer backdrop-blur-[1px]"
              style={{ background: 'var(--vm-overlay)' }}
              onClick={onClose}
            />
          )}

          <FocusTrap
            active={open && isDesktop}
            onEscape={onClose}
            aria-label="Panel de viaje y rutas"
            className={
              isDesktop
                ? 'fixed left-1/2 top-1/2 z-50 max-h-[min(78vh,640px)] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2'
                : 'fixed inset-x-0 bottom-0 z-50'
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
                  : { opacity: 1, y: 0, height: `${heightVh}vh` }
              }
              exit={
                isDesktop
                  ? { opacity: 0, scale: 0.96, y: 8 }
                  : { opacity: 0, y: '100%' }
              }
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              drag={!isDesktop ? 'y' : false}
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.06, bottom: 0.6 }}
              dragMomentum={false}
              onDragEnd={onDragEnd}
              className={
                isDesktop
                  ? 'vm-panel flex h-full max-h-[min(78vh,640px)] w-full flex-col overflow-hidden rounded-3xl border'
                  : 'vm-panel flex w-full flex-col overflow-hidden rounded-t-3xl border-t pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgba(15,23,42,0.18)]'
              }
              style={!isDesktop ? { maxHeight: '88dvh' } : undefined}
            >
              {!isDesktop && (
                <div
                  className="flex shrink-0 cursor-grab touch-none flex-col items-center active:cursor-grabbing select-none"
                  onPointerDown={(e) => dragControls.start(e)}
                  role="slider"
                  aria-valuetext={
                    snap === 'peek' ? 'Panel reducido' : snap === 'mid' ? 'Panel medio' : 'Panel ampliado'
                  }
                  aria-label="Deslizar hacia abajo para cerrar el panel"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' || e.key === 'Escape') onClose();
                    if (e.key === 'ArrowUp') {
                      if (snap === 'peek') setSnap('mid');
                      else setSnap('full');
                    }
                  }}
                >
                  <div className="flex w-full justify-center pb-1 pt-3">
                    <span className="h-1.5 w-14 rounded-full bg-slate-400" />
                  </div>
                  <p className="pb-1.5 text-[10px] font-semibold text-slate-500">
                    Desliza hacia abajo para cerrar
                  </p>
                </div>
              )}

              <div
                className="flex shrink-0 touch-none items-center justify-between gap-2 px-3 py-2"
                style={{ borderBottom: '1px solid var(--vm-card-border)' }}
                onPointerDown={(e) => {
                  if (!isDesktop && e.button === 0) dragControls.start(e);
                }}
              >
                <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist">
                  {(
                    [
                      { id: 'results' as const, label: 'Mi viaje', icon: Navigation },
                      { id: 'routes' as const, label: 'Rutas', icon: RouteIcon },
                      { id: 'favorites' as const, label: 'Favoritos', icon: Heart },
                    ] as const
                  ).map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={panel === t.id}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => {
                          onPanelChange(t.id);
                          if (!isDesktop && snap === 'peek') setSnap('mid');
                        }}
                        className={`vm-press flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold cursor-pointer ${
                          panel === t.id ? 'vm-chip-active' : 'vm-chip'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onClose}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-800 cursor-pointer hover:bg-slate-300"
                  aria-label="Cerrar y ver mapa"
                  title="Cerrar"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div
                className={cn(
                  'min-h-0 flex-1 overflow-y-auto overscroll-contain',
                  !isDesktop && snap === 'peek' && 'max-h-[12vh]'
                )}
                role="tabpanel"
                style={{ touchAction: 'pan-y' }}
              >
                {children}
              </div>
            </motion.div>
          </FocusTrap>
        </>
      )}
    </AnimatePresence>
  );
}
