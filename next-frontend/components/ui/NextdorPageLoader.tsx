"use client";

import Image from "next/image";

export interface NextDorSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function NextDorSpinner({
  size = "lg",
  className = "",
}: NextDorSpinnerProps) {
  const sizeConfig = {
    sm: {
      outer: "h-12 w-12",
      ringBorder: "border-2",
      inner: "h-7 w-7",
      imgSize: 18,
      imgClass: "h-4 w-4",
    },
    md: {
      outer: "h-16 w-16",
      ringBorder: "border-3",
      inner: "h-10 w-10",
      imgSize: 26,
      imgClass: "h-6 w-6",
    },
    lg: {
      outer: "h-24 w-24",
      ringBorder: "border-4",
      inner: "h-14 w-14",
      imgSize: 36,
      imgClass: "h-9 w-9",
    },
  }[size];

  return (
    <div
      className={`relative flex items-center justify-center ${sizeConfig.outer} ${className}`}
    >
      {/* Static track */}
      <div
        className={`absolute inset-0 rounded-full border-zinc-200/80 ${sizeConfig.ringBorder}`}
      />

      {/* Golden animated spinner ring */}
      <div
        className={`absolute inset-0 animate-spin rounded-full border-transparent border-t-[#ff9900] border-r-[#f08804] ${sizeConfig.ringBorder}`}
      />

      {/* Inner dark badge with NextDor signature arrow logo */}
      <div
        className={`relative flex items-center justify-center rounded-full bg-[#131921] shadow-md ring-2 ring-[#ff9900]/40 overflow-hidden ${sizeConfig.inner}`}
      >
        <Image
          src="/arrow-loader.png"
          alt="NextDor"
          width={sizeConfig.imgSize}
          height={sizeConfig.imgSize}
          priority
          className={`${sizeConfig.imgClass} object-contain drop-shadow-[0_2px_6px_rgba(255,153,0,0.35)]`}
        />
      </div>
    </div>
  );
}

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

        {/* Outer dual-spin ring with signature arrow */}
        <NextDorSpinner size="lg" />

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
