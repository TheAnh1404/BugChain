/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast) => {
    const id = globalThis.crypto?.randomUUID?.() || String(Date.now());
    const nextToast = {
      id,
      type: toast.type || 'info',
      message: toast.message,
    };

    setToasts((current) => [...current.slice(-3), nextToast]);
    window.setTimeout(() => dismissToast(id), 5000);
  }, [dismissToast]);

  useEffect(() => {
    const handleToast = (event) => {
      if (event.detail?.message) {
        showToast(event.detail);
      }
    };

    window.addEventListener('bugchain-toast', handleToast);
    return () => window.removeEventListener('bugchain-toast', handleToast);
  }, [showToast]);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-24 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => {
          const isError = toast.type === 'error';
          const isSuccess = toast.type === 'success';
          return (
            <button
              key={toast.id}
              onClick={() => dismissToast(toast.id)}
              className={`rounded-xl border px-4 py-3 text-left text-sm shadow-xl ${
                isError
                  ? 'border-[#ffb4ab]/30 bg-[#93000a]/90 text-[#ffdad6]'
                  : isSuccess
                    ? 'border-emerald-500/30 bg-emerald-950/90 text-emerald-200'
                    : 'border-[#4a4455] bg-[#100d16]/95 text-[#e8dfee]'
              }`}
              type="button"
            >
              {toast.message}
            </button>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return value;
}
