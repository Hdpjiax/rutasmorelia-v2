/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { FocusTrap } from '@/components/ui/focus-trap';
import { toast } from '@/lib/ui/toast';
import { uiTelemetry } from '@/lib/telemetry/ui-events';

const REASONS = [
  { id: 'trace_wrong', label: 'El trazo está mal' },
  { id: 'no_longer_passes', label: 'La ruta ya no pasa por aquí' },
  { id: 'missing_route', label: 'Falta una ruta' },
  { id: 'wrong_name', label: 'Nombre incorrecto' },
  { id: 'direction_wrong', label: 'Dirección ida/vuelta incorrecta' },
  { id: 'other', label: 'Otro' },
] as const;

type Props = {
  open: boolean;
  routeId: string;
  routeName: string;
  onClose: () => void;
};

export function ReportRouteDialog({ open, routeId, routeName, onClose }: Props) {
  const titleId = useId();
  const [reason, setReason] = useState<(typeof REASONS)[number]['id']>('trace_wrong');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setReason('trace_wrong');
      setNote('');
      requestAnimationFrame(() => firstRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/report-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId, routeName, reason, note: note.trim() || undefined }),
      });
      if (!res.ok) throw new Error('fail');
      uiTelemetry.reportRoute(routeId, reason);
      toast('Gracias. Revisaremos el reporte.', 'success');
      onClose();
    } catch {
      // Offline: guardamos localmente el intento
      try {
        const key = 'vm_pending_route_reports';
        const prev = JSON.parse(localStorage.getItem(key) || '[]') as unknown[];
        prev.push({ routeId, routeName, reason, note, at: Date.now() });
        localStorage.setItem(key, JSON.stringify(prev.slice(-30)));
        uiTelemetry.reportRoute(routeId, reason);
        toast('Reporte guardado. Se enviará cuando haya conexión.', 'info');
        onClose();
      } catch {
        toast('No se pudo enviar el reporte', 'error');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <FocusTrap active onEscape={onClose} aria-label="Reportar problema de ruta">
      <div className="pointer-events-auto fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/40"
          aria-label="Cerrar"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative z-10 w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-3xl"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 id={titleId} className="text-base font-bold text-slate-900">
                Reportar un problema
              </h2>
              <p className="mt-0.5 text-[12px] text-slate-600">{routeName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-800 cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="sr-only">Motivo</legend>
            {REASONS.map((r, i) => (
              <button
                key={r.id}
                ref={i === 0 ? firstRef : undefined}
                type="button"
                onClick={() => setReason(r.id)}
                aria-pressed={reason === r.id}
                className={`min-h-11 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold touch-manipulation cursor-pointer ${
                  reason === r.id
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                {r.label}
              </button>
            ))}
          </fieldset>

          <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Detalle (opcional)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
              placeholder="Ej. ya no pasa por Camelinas…"
            />
          </label>

          <button
            type="button"
            disabled={sending}
            onClick={() => void submit()}
            className="mt-3 flex min-h-11 w-full items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white cursor-pointer disabled:opacity-60"
          >
            {sending ? 'Enviando…' : 'Enviar reporte'}
          </button>
        </div>
      </div>
    </FocusTrap>
  );
}
