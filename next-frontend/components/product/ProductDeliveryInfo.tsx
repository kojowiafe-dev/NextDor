"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Truck,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  Clock,
  MapPin,
  Store,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { SITE_CONFIG } from "@/lib/constants/siteConfig";

type ProductDeliveryInfoProps = {
  vendor?: {
    name: string;
    slug: string;
    isVerified?: boolean;
    rating?: number;
  } | null;
  currency?: string;
};

export function ProductDeliveryInfo({ vendor, currency = "GH₵" }: ProductDeliveryInfoProps) {
  const [selectedRegion, setSelectedRegion] = useState<"accra" | "ashanti" | "nationwide">("accra");

  const regionData = {
    accra: {
      name: "Greater Accra",
      cost: SITE_CONFIG.deliveryRates.accraStandard.price,
      time: SITE_CONFIG.deliveryRates.accraStandard.time,
      express: "Same-Day available (GH₵ 45)",
    },
    ashanti: {
      name: "Ashanti (Kumasi)",
      cost: SITE_CONFIG.deliveryRates.kumasiStandard.price,
      time: SITE_CONFIG.deliveryRates.kumasiStandard.time,
      express: "Next-Day available",
    },
    nationwide: {
      name: "Other Regions (Nationwide)",
      cost: SITE_CONFIG.deliveryRates.nationwideStandard.price,
      time: SITE_CONFIG.deliveryRates.nationwideStandard.time,
      express: "Fast intercity dispatch",
    },
  };

  const active = regionData[selectedRegion];
  const vendorName = vendor?.name || "NextDor Direct Flagship";
  const vendorSlug = vendor?.slug || "nextdor";

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
      {/* ─── 1. Delivery Cost & Delivery Time Widget (Item #9 & #10) ─────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fff3e0] text-[#ff9900]">
              <Truck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
                Delivery & Shipping Options
              </h3>
              <p className="text-[11px] text-zinc-500">Delivered directly to your door in Ghana</p>
            </div>
          </div>
        </div>

        {/* Region selector pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {(["accra", "ashanti", "nationwide"] as const).map((reg) => (
            <button
              key={reg}
              type="button"
              onClick={() => setSelectedRegion(reg)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                selectedRegion === reg
                  ? "bg-[#131921] text-white shadow-2xs"
                  : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100"
              }`}
            >
              {regionData[reg].name}
            </button>
          ))}
        </div>

        {/* Delivery Rates and Timeline Box */}
        <div className="rounded-lg bg-white p-3 border border-zinc-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-xs font-bold text-zinc-800">
                {active.name} Doorstep Delivery:
              </span>
            </div>
            <span className="text-xs font-black text-zinc-900">
              {currency} {active.cost.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-zinc-600">
            <Clock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>Estimated delivery in <strong>{active.time}</strong></span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-500 border-t border-zinc-100 pt-1.5">
            <span>Store / Hub Pickup:</span>
            <span className="font-semibold text-emerald-700">Ready in 2 hrs (FREE)</span>
          </div>
        </div>
      </div>

      {/* ─── 2. Seller & Genuine Verified Seller Badge (Item #25 & #26) ──────── */}
      <div className="rounded-lg bg-white p-3 border border-zinc-200/80 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
              <Store className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-zinc-900 truncate">
                  {vendorName}
                </span>
                {/* Genuine Verified Seller Badge */}
                <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                  <CheckCircle2 className="h-3 w-3 fill-blue-600 text-white" />
                  Verified Seller
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Ghanaian Merchant · 98% On-Time Fulfillment
              </p>
            </div>
          </div>

          <Link
            href={`/store/${vendorSlug}`}
            className="flex items-center text-xs font-semibold text-[#c7511f] hover:underline shrink-0 ml-2"
          >
            Store <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ─── 3. NextDor 48-Hour Buyer Protection (Item #32) ─────────────────── */}
      <div className="rounded-lg bg-gradient-to-r from-amber-50 to-orange-50/70 p-3 border border-amber-200/80 shadow-2xs space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#ff9900] shrink-0" />
          <h4 className="text-xs font-bold text-zinc-900">
            NextDor 48-Hour Buyer Protection
          </h4>
        </div>
        <p className="text-[11px] text-zinc-600 leading-relaxed">
          Your payment is held in <strong>secure escrow</strong> until 48 hours after delivery. 
          100% money-back guarantee if the item is damaged, counterfeit, or not as described.
        </p>
        <div className="flex items-center gap-4 text-[11px] text-zinc-700 font-semibold pt-0.5">
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-emerald-600" /> Genuine Products
          </span>
          <span className="flex items-center gap-1">
            <RotateCcw className="h-3 w-3 text-[#c7511f]" /> 7-Day Returns
          </span>
        </div>
      </div>
    </div>
  );
}
