// src/ui/ToastProvider.tsx
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastVariant = 'success' | 'danger' | 'info' | 'warning';

export type ToastOptions = {
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
  // Optional inline action (e.g., Undo)
  actionLabel?: string;
  onAction?: () => void;
};

type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastContextValue = {
  showToast: (opts: ToastOptions) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((opts: ToastOptions) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const toast: Toast = {
      id,
      message: opts.message,
      variant: opts.variant ?? 'info',
      actionLabel: opts.actionLabel,
      onAction: opts.onAction,
    };
    setToasts((prev) => [...prev, toast]);

    const duration = opts.durationMs ?? 2200;
    if (duration > 0) {
      setTimeout(() => dismissToast(id), duration);
    }
  }, [dismissToast]);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Viewport */}
      <div
        aria-live="polite"
        role="status"
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
              color: '#fff',
              background:
                t.variant === 'success' ? '#059669' :
                t.variant === 'danger'  ? '#dc2626' :
                t.variant === 'warning' ? '#d97706' :
                                           '#111827',
              border: '1px solid rgba(255,255,255,0.12)',
              maxWidth: 360,
              fontSize: 13,
            }}
          >
            {/* tiny dot */}
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: '#ffffff',
                opacity: 0.9,
                flex: '0 0 auto',
              }}
            />
            <span style={{ lineHeight: 1.25 }}>{t.message}</span>

            {t.actionLabel && t.onAction && (
              <button
                type="button"
                onClick={() => { t.onAction?.(); dismissToast(t.id); }}
                style={{
                  marginLeft: 'auto',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.6)',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                {t.actionLabel}
              </button>
            )}

            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss"
              title="Dismiss"
              style={{
                marginLeft: t.actionLabel ? 6 : 'auto',
                background: 'transparent',
                border: 0,
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}