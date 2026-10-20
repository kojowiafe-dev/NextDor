"use client";

import { useState } from "react";
import {
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  ShieldCheck,
  Package,
  Trash2,
} from "lucide-react";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { formatPrice } from "@/lib/utils";
import {
  submitReturnRequest,
  type ReturnReason,
  type ReturnRequest,
} from "@/lib/returns/api";

interface OrderItem {
  id: string;
  productName: string;
  productImage?: string | null;
  unitPrice?: number | string;
  price?: number | string;
  quantity: number;
  subtotal: number | string;
}

interface ReturnRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  items: OrderItem[];
  token: string;
  onSuccess: (returnReq: ReturnRequest) => void;
}

const REASONS: Array<{ id: ReturnReason; label: string; desc: string }> = [
  {
    id: "DAMAGED_ITEM",
    label: "Damaged in Transit",
    desc: "Item or packaging arrived physically broken, scratched, or crushed",
  },
  {
    id: "DEFECTIVE_PRODUCT",
    label: "Defective / Malfunctioning",
    desc: "Product does not power on, function properly, or has internal flaws",
  },
  {
    id: "WRONG_ITEM_SENT",
    label: "Wrong Item Received",
    desc: "Received a different color, size, specification, or product entirely",
  },
  {
    id: "NOT_AS_DESCRIBED",
    label: "Not as Described",
    desc: "Item differs materially from photographs or listed specifications",
  },
  {
    id: "MISSING_PARTS",
    label: "Missing Parts / Accessories",
    desc: "Components, cables, tags, or promised extras were omitted from parcel",
  },
  {
    id: "OTHER",
    label: "Other Legitimate Reason",
    desc: "Other concern within the 48-Hour buyer protection window",
  },
];

export function ReturnRequestModal({
  isOpen,
  onClose,
  orderNumber,
  items,
  token,
  onSuccess,
}: ReturnRequestModalProps) {
  const [selectedItems, setSelectedItems] = useState<
    Record<string, { selected: boolean; quantity: number }>
  >(() => {
    const init: Record<string, { selected: boolean; quantity: number }> = {};
    items.forEach((item) => {
      init[item.id] = { selected: true, quantity: item.quantity };
    });
    return init;
  });

  const [reason, setReason] = useState<ReturnReason>("DAMAGED_ITEM");
  const [details, setDetails] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleItem = (itemId: string) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        selected: !prev[itemId]?.selected,
      },
    }));
  };

  const setItemQuantity = (itemId: string, qty: number) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        quantity: Math.max(1, qty),
      },
    }));
  };

  const handleAddEvidence = (url: string) => {
    if (evidenceUrls.length >= 5) {
      setError("Maximum 5 evidence images allowed.");
      return;
    }
    setEvidenceUrls((prev) => [...prev, url]);
  };

  const handleRemoveEvidence = (index: number) => {
    setEvidenceUrls((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Calculate estimated refund
  const estimatedRefund = items.reduce((sum, item) => {
    const sel = selectedItems[item.id];
    if (!sel || !sel.selected) return sum;
    const pricePerUnit =
      Number(item.unitPrice ?? item.price ?? Number(item.subtotal) / item.quantity) || 0;
    return sum + pricePerUnit * sel.quantity;
  }, 0);

  const selectedCount = Object.values(selectedItems).filter((v) => v.selected).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCount === 0) {
      setError("Please select at least one item to return.");
      return;
    }
    if (details.trim().length < 5) {
      setError("Please provide at least a few words explaining the issue (min 5 characters).");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payloadItems = Object.entries(selectedItems)
      .filter(([_, val]) => val.selected)
      .map(([orderItemId, val]) => ({
        orderItemId,
        quantity: val.quantity,
      }));

    try {
      const result = await submitReturnRequest(
        orderNumber,
        {
          reason,
          details: details.trim(),
          evidenceUrls,
          items: payloadItems,
        },
        token
      );
      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to submit return request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative my-8 w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-900/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff9900] text-zinc-900">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Request Return &amp; Refund</h3>
              <p className="text-xs text-zinc-400">Order #{orderNumber} • 48-Hour Buyer Protection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* 48h Protection Callout */}
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Protected by NextDor 48-Hour Escrow Policy</p>
              <p className="text-emerald-800/80 mt-0.5">
                Merchant funds remain safely locked in escrow until the inspection window passes.
                Approved returns are refunded directly to your original MoMo wallet or Card.
              </p>
            </div>
          </div>

          {/* 1. Item Selection */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
              1. Select Items to Return
            </label>
            <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden">
              {items.map((item) => {
                const sel = selectedItems[item.id] || { selected: false, quantity: 1 };
                const unitPrice =
                  Number(item.unitPrice ?? item.price ?? Number(item.subtotal) / item.quantity) || 0;

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3.5 text-xs transition ${
                      sel.selected ? "bg-amber-50/40" : "bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={sel.selected}
                        onChange={() => toggleItem(item.id)}
                        className="h-4 w-4 rounded border-zinc-300 text-[#ff9900] focus:ring-[#ff9900]"
                      />
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-zinc-100 border border-zinc-200">
                        {item.productImage ? (
                          <img
                            src={item.productImage}
                            alt={item.productName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-zinc-400 font-bold">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-900">{item.productName}</p>
                        <p className="text-zinc-500">Unit Price: {formatPrice(unitPrice, "GHS")}</p>
                      </div>
                    </div>

                    {sel.selected && (
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-zinc-500">Qty:</label>
                        <select
                          value={sel.quantity}
                          onChange={(e) => setItemQuantity(item.id, Number(e.target.value))}
                          className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-bold text-zinc-800 focus:border-[#ff9900] focus:outline-none"
                        >
                          {Array.from({ length: item.quantity }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Reason for Return */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
              2. Why are you requesting this return?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReason(r.id)}
                  className={`flex flex-col text-left p-3 rounded-xl border text-xs transition cursor-pointer ${
                    reason === r.id
                      ? "border-[#ff9900] bg-[#fff8ee] ring-2 ring-[#ff9900]/20"
                      : "border-zinc-200 hover:border-zinc-300 bg-white"
                  }`}
                >
                  <span className="font-bold text-zinc-900">{r.label}</span>
                  <span className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">{r.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Details & Explanation */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
              3. Describe the issue in detail *
            </label>
            <textarea
              required
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide a clear description of what is wrong with the package or items..."
              className="w-full text-xs rounded-xl border border-zinc-300 p-3 text-zinc-900 focus:border-[#ff9900] focus:ring-2 focus:ring-[#ff9900]/20 focus:outline-none"
            />
          </div>

          {/* 4. Photo Evidence (Optional but recommended) */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
              4. Photo / Video Evidence (Recommended)
            </label>
            <p className="text-[11px] text-zinc-500">
              Clear photos of damaged seals, defect areas, or waybills accelerate claim approvals.
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {evidenceUrls.map((url, idx) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-zinc-200 group">
                  <img src={url} alt={`Evidence ${idx + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveEvidence(idx)}
                    className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {evidenceUrls.length < 5 && (
                <div className="aspect-square flex items-center justify-center">
                  <ImageUpload
                    onChange={handleAddEvidence}
                    folder="nextdor/returns"
                    label="Add Photo"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Financial Refund Estimation Pill */}
          <div className="flex items-center justify-between rounded-xl bg-zinc-900 p-4 text-white text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                Estimated Refund Amount
              </span>
              <span className="text-lg font-black text-[#ff9900]">
                {formatPrice(estimatedRefund, "GHS")}
              </span>
            </div>
            <span className="text-zinc-400 text-right text-[11px]">
              Credited directly to your wallet upon inspection
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedCount === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-[#c7511f] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#b14418] disabled:opacity-50 transition cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Submitting Claim...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Submit Return Claim</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
