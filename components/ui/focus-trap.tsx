'use client';

import React, { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

type Props = {
  active: boolean;
  children: React.ReactNode;
  className?: string;
  onEscape?: () => void;
  /** role dialog/alertdialog */
  role?: string;
  'aria-label'?: string;
  'aria-modal'?: boolean | 'true' | 'false';
};

/**
 * Atrapa el foco dentro del panel (modales / bottom sheets).
 * Esc cierra si se pasa onEscape.
 */
export function FocusTrap({
  active,
  children,
  className,
  onEscape,
  role = 'dialog',
  'aria-label': ariaLabel,
  'aria-modal': ariaModal = true,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const root = rootRef.current;
    if (!root) return;

    const nodes = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.offsetParent !== null
      );

    const first = nodes()[0];
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = nodes();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previousFocus.current?.focus?.();
    };
  }, [active, onEscape]);

  return (
    <div
      ref={rootRef}
      className={className}
      role={role}
      aria-modal={ariaModal}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
