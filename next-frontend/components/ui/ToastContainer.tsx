"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Heart, ShoppingCart, X } from "lucide-react";

export type ToastPayload = {
  id?: string;
  message: string;
  variant?: "cart" | "wishlist" | "info";
  href?: string;
  actionLabel?: string;
};

export function dispatchToast(payload: ToastPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("nextdor-toast", {
      detail: { ...payload, id: payload.id || `${Date.now()}-${Math.random()}` },
    }),
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Array<ToastPayload & { id: string }>>([]);

  useEffect(() => {
    function handleToast(e: Event) {
      const detail = (e as CustomEvent<ToastPayload & { id: string }>).detail;
      if (!detail?.message) return;
      const id = detail.id || `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev.slice(-2), { ...detail, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3200);
    }

    window.addEventListener("nextdor-toast", handleToast);
    return () => window.removeEventListener("nextdor-toast", handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-20 right-4 z-[120] flex flex-col gap-2 md:bottom-6"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-[#131921] px-3.5 py-2.5 text-xs sm:text-sm text-white shadow-xl"
        >
          {toast.variant === "wishlist" ? (
            <Heart className="h-4 w-4 shrink-0 fill-[#ff9900] text-[#ff9900]" />
          ) : toast.variant === "cart" ? (
            <ShoppingCart className="h-4 w-4 shrink-0 text-[#ff9900]" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          )}
          <span className="font-medium line-clamp-1 max-w-[240px]">{toast.message}</span>
          {toast.href && toast.actionLabel && (
            <Link
              href={toast.href}
              className="shrink-0 font-bold text-[#ff9900] hover:underline ml-1"
            >
              {toast.actionLabel}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            aria-label="Dismiss notification"
            className="ml-1 rounded p-0.5 text-zinc-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

