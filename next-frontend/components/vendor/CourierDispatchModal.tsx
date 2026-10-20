"use client";

import { useState } from "react";
import {
  X,
  Truck,
  CheckCircle2,
  RefreshCw,
  Phone,
  User,
  Calendar,
  FileText,
  AlertCircle,
  Hash,
} from "lucide-react";

interface CourierDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorOrderId: string;
  orderNumber: string;
  customerName: string;
  destination: string;
  onDispatch: (dispatchData: {
    carrier: "FEZ" | "KWIK" | "DHL" | "INTERNAL";
    trackingNumber: string;
    driverName?: string;
    driverPhone?: string;
    estimatedDelivery?: string;
    notes?: string;
  }) => Promise<void>;
}

const CARRIER_OPTIONS = [
  {
    id: "FEZ" as const,
    name: "Fez Delivery",
    desc: "Doorstep & Last-Mile Delivery Across Greater Accra & Regions",
    prefix: "ND-FEZ",
  },
  {
    id: "KWIK" as const,
    name: "Kwik Delivery",
    desc: "Same-Day On-Demand Motorbike Express Delivery",
    prefix: "ND-KWIK",
  },
  {
    id: "DHL" as const,
    name: "DHL Express Ghana",
    desc: "Inter-Regional Priority Freight & Nationwide Coverage",
    prefix: "ND-DHL",
  },
  {
    id: "INTERNAL" as const,
    name: "In-House Store Rider",
    desc: "Merchant's Direct Fleet / Personal Dispatch Rider",
    prefix: "ND-STORE",
  },
];

export function CourierDispatchModal({
  isOpen,
  onClose,
  vendorOrderId,
  orderNumber,
  customerName,
  destination,
  onDispatch,
}: CourierDispatchModalProps) {
  const [carrier, setCarrier] = useState<"FEZ" | "KWIK" | "DHL" | "INTERNAL">("FEZ");
  const [trackingNumber, setTrackingNumber] = useState(
    `ND-FEZ-${Math.floor(100000 + Math.random() * 900000)}`
  );
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [estimatedDelivery, setEstimatedDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCarrierChange = (newCarrier: "FEZ" | "KWIK" | "DHL" | "INTERNAL") => {
    setCarrier(newCarrier);
    const selected = CARRIER_OPTIONS.find((c) => c.id === newCarrier);
    const prefix = selected ? selected.prefix : "ND";
    setTrackingNumber(`${prefix}-${Math.floor(100000 + Math.random() * 900000)}`);
  };

  const handleGenerateTracking = () => {
    const selected = CARRIER_OPTIONS.find((c) => c.id === carrier);
    const prefix = selected ? selected.prefix : "ND";
    setTrackingNumber(`${prefix}-${Math.floor(100000 + Math.random() * 900000)}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingNumber.trim()) {
      setError("Tracking number is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onDispatch({
        carrier,
        trackingNumber: trackingNumber.trim(),
        driverName: driverName.trim() || undefined,
        driverPhone: driverPhone.trim() || undefined,
        estimatedDelivery: estimatedDelivery || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to dispatch order with courier.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-900/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff9900] text-zinc-900">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Courier Dispatch &amp; Handover</h3>
              <p className="text-xs text-zinc-400">
                Order #{orderNumber} • {customerName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Delivery destination callout */}
          <div className="rounded-xl bg-zinc-50 p-3.5 border border-zinc-200/80 text-xs text-zinc-600 flex justify-between items-center">
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                Destination Hub
              </span>
              <span className="font-semibold text-zinc-900">{destination}</span>
            </div>
            <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-[11px] font-bold text-blue-700">
              Ready for Handover
            </span>
          </div>

          {/* Carrier Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-800 block">
              1. Select Logistics Carrier Partner
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CARRIER_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleCarrierChange(c.id)}
                  className={`flex flex-col text-left p-3 rounded-xl border text-xs transition ${
                    carrier === c.id
                      ? "border-[#ff9900] bg-[#fff8ee] ring-2 ring-[#ff9900]/20"
                      : "border-zinc-200 hover:border-zinc-300 bg-white"
                  }`}
                >
                  <span className="font-bold text-zinc-900">{c.name}</span>
                  <span className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">{c.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tracking Number */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-zinc-400" />
                <span>2. Waybill / Tracking Number *</span>
              </label>
              <button
                type="button"
                onClick={handleGenerateTracking}
                className="text-[11px] font-semibold text-[#ff9900] hover:underline flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" /> Auto-Generate
              </button>
            </div>
            <input
              type="text"
              required
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="e.g. ND-FEZ-849201"
              className="w-full font-mono text-xs rounded-xl border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20 focus:outline-none"
            />
          </div>

          {/* Driver Contact Details (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-zinc-400" />
                <span>Rider / Driver Name</span>
              </label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="e.g. Kwesi Mensah"
                className="w-full text-xs rounded-xl border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-zinc-400" />
                <span>Rider Phone Number</span>
              </label>
              <input
                type="tel"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                placeholder="e.g. 024 400 1234"
                className="w-full text-xs rounded-xl border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Estimated Delivery Date & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                <span>Estimated Delivery</span>
              </label>
              <input
                type="date"
                value={estimatedDelivery}
                onChange={(e) => setEstimatedDelivery(e.target.value)}
                className="w-full text-xs rounded-xl border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-zinc-400" />
                <span>Package Notes</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Handle with care"
                className="w-full text-xs rounded-xl border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 transition"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Registering Dispatch...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Confirm Dispatch &amp; Notify Customer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
