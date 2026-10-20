"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, ShieldCheck } from "lucide-react";

export function ReturnsLookupBar() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = orderNumber.trim();
    if (!clean) return;
    router.push(`/account/orders/${encodeURIComponent(clean)}`);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="h-5 w-5 text-emerald-600" />
        <h3 className="text-sm font-bold text-zinc-900">
          File or Track a Return Online
        </h3>
      </div>
      <p className="text-xs text-zinc-500 mb-4">
        Enter your NextDor Order Number (e.g. <span className="font-mono font-semibold">ND-00101</span>) to inspect items, check escrow clearance, and submit a return request.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="Enter Order Number (e.g. ND-00101)"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-300 text-xs font-mono text-zinc-900 focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c7511f] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#b14418] transition cursor-pointer"
        >
          <span>Find Order &amp; File Claim</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
