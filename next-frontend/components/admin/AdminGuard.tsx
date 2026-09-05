"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type AdminGuardProps = {
  children: React.ReactNode;
};

export function AdminGuard({ children }: AdminGuardProps) {
  const { isAuthenticated, isAdmin, isVendor, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/admin/login");
      return;
    }
    if (!isAdmin) {
      if (isVendor) {
        router.replace("/vendor/dashboard");
      } else {
        router.replace("/");
      }
    }
  }, [isLoading, isAuthenticated, isAdmin, isVendor, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1623]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-[#ff9900]" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1623]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-[#ff9900]" />
      </div>
    );
  }

  return <>{children}</>;
}
