'use client';

import { AnimatePresence, motion } from 'motion/react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToastStore, type ToastItem, type ToastVariant } from '@/lib/ui/toast';

const VARIANT_STYLES: Record<
  ToastVariant,
  { bar: string; icon: typeof Info; iconClass: string }
> = {
  success: {
    bar: 'border-emerald-200/80 bg-emerald-50/95 text-emerald-950 shadow-emerald-100/50',
    icon: CheckCircle2,
    iconClass: 'text-emerald-600',
  },
  error: {
    bar: 'border-rose-200/80 bg-rose-50/95 text-rose-950 shadow-rose-100/50',
    icon: AlertCircle,
    iconClass: 'text-rose-600',
  },
  warning: {
    bar: 'border-amber-200/80 bg-amber-50/95 text-amber-950 shadow-amber-100/50',
    icon: AlertTriangle,
    iconClass: 'text-amber-600',
  },
  info: {
    bar: 'border-sky-200/80 bg-sky-50/95 text-sky-950 shadow-sky-100/50',
    icon: Info,
    iconClass: 'text-sky-600',
  },
};

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const style = VARIANT_STYLES[item.variant];
  const Icon = style.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      role="status"
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm ${style.bar}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconClass}`} aria-hidden />
      <div className="min-w-0 flex-1">
        {item.title && <p className="text-sm font-semibold leading-tight">{item.title}</p>}
        <p className={`text-sm leading-snug ${item.title ? 'mt-0.5 opacity-90' : ''}`}>
          {item.message}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100"
        aria-label="Cerrar notificación"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

export function ToastProvider() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6"
    >
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}