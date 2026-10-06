"use client";

import Image from "next/image";

interface NextDorPageLoaderProps {
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
}

export function NextDorPageLoader({
  message = "Loading NextDor...",
  subMessage = "Shop More, Wait Less",
  fullScreen = true,
}: NextDorPageLoaderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center bg-zinc-50/90 backdrop-blur-xs transition-opacity duration-300 ${
        fullScreen
          ? "fixed inset-0 z-50 min-h-screen"
          : "min-h-[400px] w-full py-16"
      }`}
    >
      <div className="relative flex flex-col items-center">
        {/* Outer glowing pulsing orb */}
        <div className="absolute -inset-4 rounded-full bg-[#ff9900]/15 blur-xl animate-pulse" />

        {/* Outer dual-spin ring */}
        <div className="relative flex h-24 w-24 items-center justify-center">
          {/* Static track */}
          <div className="absolute inset-0 rounded-full border-4 border-zinc-200/80" />

          {/* Golden animated spinner ring */}
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#ff9900] border-r-[#f08804]" />

          {/* Inner dark badge with NextDor initial logo */}
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#131921] shadow-md ring-2 ring-[#ff9900]/40">
            <span className="text-xl font-black tracking-tight text-[#ff9900]">
              ND
            </span>
          </div>
        </div>

        {/* NextDor Brand Typography */}
        <div className="mt-5 text-center">
          <p className="text-sm font-bold tracking-wide text-zinc-900">
            {message}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-[#ff9900]">
            {subMessage}
          </p>
        </div>

        {/* Micro loading dots */}
        <div className="mt-4 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#ff9900] [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#ff9900] [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#ff9900]" />
        </div>
      </div>
    </div>
  );
}
