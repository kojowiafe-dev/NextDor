"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  MessageCircle,
  Phone,
  Mail,
  Truck,
  X,
  Headphones,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { SITE_CONFIG } from "@/lib/constants/siteConfig";

export function FloatingSupportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6"
      aria-label="Customer Support Menu"
    >
      {/* Popover Card */}
      {isOpen && (
        <div className="mb-3 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 transition-all animate-in fade-in slide-in-from-bottom-3 duration-200">
          {/* Card Header */}
          <div className="bg-[#131921] px-4 py-3.5 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff9900] text-zinc-950 font-bold">
                  <Headphones className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">NextDor Support</h3>
                  <p className="text-[11px] text-zinc-300">We&apos;re here to help in Ghana</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition"
                aria-label="Close support menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Action List */}
          <div className="divide-y divide-zinc-100 p-2">
            {/* WhatsApp — Primary Quick Action */}
            <a
              href={SITE_CONFIG.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-emerald-50 group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs group-hover:scale-105 transition-transform">
                <MessageCircle className="h-5 w-5 fill-current" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-zinc-900 group-hover:text-emerald-700">
                    Chat on WhatsApp
                  </p>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 uppercase">
                    Instant
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Quick answers from live support team
                </p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-zinc-400 group-hover:text-emerald-600 shrink-0" />
            </a>

            {/* Direct Phone Call */}
            <a
              href={`tel:${SITE_CONFIG.phone}`}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-amber-50 group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff9900] text-zinc-950 shadow-xs group-hover:scale-105 transition-transform">
                <Phone className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-zinc-900 group-hover:text-[#c7511f]">
                  Call {SITE_CONFIG.phoneDisplay}
                </p>
                <p className="text-[11px] text-zinc-500">
                  {SITE_CONFIG.hours.split("(")[0].trim()}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-[#c7511f] shrink-0" />
            </a>

            {/* Email Support */}
            <a
              href={`mailto:${SITE_CONFIG.email}`}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-zinc-50 group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 shadow-xs group-hover:scale-105 transition-transform">
                <Mail className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-zinc-900">
                  Email Support
                </p>
                <p className="text-[11px] text-zinc-500">
                  {SITE_CONFIG.email}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
            </a>

            {/* Track Order Shortcut */}
            <Link
              href="/track"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-zinc-50 group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-xs group-hover:scale-105 transition-transform">
                <Truck className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-zinc-900">
                  Track Your Package
                </p>
                <p className="text-[11px] text-zinc-500">
                  Live status by ND-XXXXX order number
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
            </Link>
          </div>

          {/* Footer note */}
          <div className="bg-zinc-50 px-4 py-2 text-center text-[10px] text-zinc-400 border-t border-zinc-100">
            NextDor Buyer Protection Guarantee
          </div>
        </div>
      )}

      {/* The Floating Hover Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-[#131921] text-white shadow-xl ring-2 ring-white/80 transition-all duration-300 hover:scale-105 hover:bg-[#232f3e] focus:outline-none focus:ring-4 focus:ring-[#ff9900]/40 active:scale-95"
      >
        {/* Subtle pulsing background ring */}
        <span className="absolute -inset-1 rounded-full bg-emerald-500/25 animate-ping opacity-75 pointer-events-none duration-1000" />

        {/* WhatsApp pill indicator */}
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow-xs ring-2 ring-white">
          <MessageCircle className="h-3 w-3 fill-current" />
        </span>

        {isOpen ? (
          <X className="h-6 w-6 text-white transition-transform duration-200" />
        ) : (
          <div className="flex flex-col items-center justify-center">
            <Headphones className="h-5 w-5 text-[#ff9900] group-hover:rotate-12 transition-transform duration-200" />
            <span className="text-[9px] font-extrabold tracking-tight text-white uppercase mt-0.5">
              Help
            </span>
          </div>
        )}
      </button>
    </div>
  );
}
