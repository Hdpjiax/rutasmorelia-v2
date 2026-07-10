'use client';

import * as React from 'react';

/**
 * Botón estilo shadcn (sin dependencia de @radix).
 * Variantes: default | secondary | outline | ghost | destructive
 */
export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<ButtonVariant, string> = {
  default: 'bg-emerald-700 text-white hover:bg-emerald-800',
  secondary: 'bg-slate-900 text-white hover:bg-slate-800',
  outline: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
  destructive: 'bg-rose-600 text-white hover:bg-rose-700',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-lg px-2.5 text-xs',
  md: 'h-10 rounded-xl px-3.5 text-sm',
  lg: 'h-11 rounded-xl px-4 text-sm',
  icon: 'h-10 w-10 rounded-xl p-0',
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 disabled:pointer-events-none disabled:opacity-50 cursor-pointer ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
);
Button.displayName = 'Button';
