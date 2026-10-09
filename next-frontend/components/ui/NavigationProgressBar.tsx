"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<"idle" | "loading" | "completing">("idle");
  const [progress, setProgress] = useState(0);

  const statusRef = useRef<"idle" | "loading" | "completing">("idle");
  const isFirstRender = useRef(true);

  const trickleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimerRef = useRef<NodeJS.Timeout | null>(null);

  const updateStatus = useCallback((newStatus: "idle" | "loading" | "completing") => {
    statusRef.current = newStatus;
    setStatus(newStatus);
  }, []);

  const clearAllTimers = useCallback(() => {
    if (trickleTimerRef.current) {
      clearInterval(trickleTimerRef.current);
      trickleTimerRef.current = null;
    }
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const completeProgress = useCallback(() => {
    clearAllTimers();

    if (statusRef.current === "idle") return;

    updateStatus("completing");
    setProgress(100);

    resetTimerRef.current = setTimeout(() => {
      updateStatus("idle");
      setProgress(0);
    }, 280);
  }, [clearAllTimers, updateStatus]);

  const startProgress = useCallback(() => {
    clearAllTimers();
    updateStatus("loading");
    setProgress(25);

    // Smooth trickle: advance towards 90% in diminishing increments
    trickleTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        if (prev < 40) return prev + 12;
        if (prev < 65) return prev + 6;
        if (prev < 80) return prev + 3;
        return prev + 1;
      });
    }, 200);

    // Safety timeout: auto-complete if navigation stalls or is cancelled
    safetyTimerRef.current = setTimeout(() => {
      completeProgress();
    }, 6000);
  }, [clearAllTimers, updateStatus, completeProgress]);

  // Complete progress on pathname or searchParams change
  const searchParamsString = searchParams.toString();
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (statusRef.current === "loading") {
      completeProgress();
    }
  }, [pathname, searchParamsString, completeProgress]);

  // Intercept clicks on internal links to start progress
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:") ||
        target.target === "_blank" ||
        target.hasAttribute("download") ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      try {
        const targetUrl = new URL(target.href, window.location.href);
        // External link
        if (targetUrl.origin !== window.location.origin) return;

        // Same exact pathname and search query (anchor jump or same page)
        const isSamePage =
          targetUrl.pathname === window.location.pathname &&
          targetUrl.search === window.location.search;

        if (isSamePage) return;
      } catch {
        return;
      }

      startProgress();
    }

    function handlePopState() {
      startProgress();
    }

    document.addEventListener("click", handleClick);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("popstate", handlePopState);
      clearAllTimers();
    };
  }, [startProgress, clearAllTimers]);

  if (status === "idle") return null;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      className="pointer-events-none fixed top-0 left-0 right-0 z-[99999] h-1 bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-[#ff9900] via-[#ffb84d] to-[#ff9900] shadow-[0_0_12px_rgba(255,153,0,0.85)] transition-all ease-out"
        style={{
          width: `${progress}%`,
          opacity: status === "completing" ? 0 : 1,
          transitionDuration: status === "completing" ? "250ms" : "200ms",
        }}
      />
    </div>
  );
}
