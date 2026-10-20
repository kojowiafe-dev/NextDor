"use client";

import { useRef } from "react";
import {
  X,
  Printer,
  ShoppingBag,
  MapPin,
  Phone,
  User,
  Calendar,
  Truck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface PackingSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorOrder: {
    id: string;
    subtotal: number | string;
    commissionAmount: number | string;
    vendorEarnings: number | string;
    status: string;
    notes?: string | null;
    createdAt: string;
    order: {
      number: string;
      createdAt: string;
      paymentStatus: string;
      shippingAddress: any;
      notes?: string | null;
      user?: {
        name: string;
        email: string;
        phone?: string | null;
      } | null;
      items: Array<{
        id: string;
        productName: string;
        unitPrice: number | string;
        quantity: number;
        subtotal: number | string;
      }>;
    };
  };
  vendorInfo?: {
    name: string;
    email?: string | null;
    phone?: string | null;
    logoUrl?: string | null;
  } | null;
}

export function PackingSlipModal({
  isOpen,
  onClose,
  vendorOrder,
  vendorInfo,
}: PackingSlipModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const addr = vendorOrder.order.shippingAddress || {};
  const notesLower = ((vendorOrder.notes || "") + " " + (vendorOrder.order.notes || "")).toLowerCase();
  const isCod =
    notesLower.includes("cash on delivery") ||
    notesLower.includes("cod") ||
    vendorOrder.order.paymentStatus === "UNPAID";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      {/* Modal Container */}
      <div className="relative my-8 w-full max-w-3xl rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-900/10 overflow-hidden">
        {/* Top Action Toolbar (Hidden in print) */}
        <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-900 px-6 py-4 text-white print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-[#ff9900]" />
            <h3 className="text-sm font-bold">Print Official Merchant Packing Slip</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl bg-[#ff9900] px-4 py-2 text-xs font-bold text-zinc-900 hover:bg-[#f08804] transition shadow-xs cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div
          ref={printRef}
          className="p-8 sm:p-10 font-sans text-zinc-800 bg-white print:p-0 print:m-0"
        >
          {/* Document Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-zinc-900 pb-6 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-zinc-900">
                  Next<span className="text-[#ff9900]">Dor</span>
                </span>
                <span className="rounded bg-zinc-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                  Marketplace Ghana
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">Shop More, Wait Less • Vendor Fulfillment Slip</p>

              {/* Merchant Details */}
              <div className="mt-4 text-xs space-y-0.5">
                <p className="font-extrabold text-sm text-zinc-900">
                  {vendorInfo?.name || "Marketplace Merchant Partner"}
                </p>
                {vendorInfo?.phone && <p className="text-zinc-600">Tel: {vendorInfo.phone}</p>}
                {vendorInfo?.email && <p className="text-zinc-600">Email: {vendorInfo.email}</p>}
              </div>
            </div>

            <div className="text-left sm:text-right text-xs space-y-1">
              <h2 className="text-lg font-black uppercase text-zinc-900 tracking-wider">
                PACKING SLIP &amp; WAYBILL
              </h2>
              <p className="font-mono font-bold text-sm text-zinc-900">
                Order #{vendorOrder.order.number}
              </p>
              <p className="font-mono text-zinc-500 text-[11px]">
                Sub-Order Ref: {vendorOrder.id.slice(0, 13)}
              </p>
              <p className="text-zinc-600">
                Date: {new Date(vendorOrder.createdAt).toLocaleDateString("en-GH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Payment & COD Alert Banner */}
          <div className="my-6">
            {isCod ? (
              <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-amber-950 flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-sm uppercase tracking-wide text-amber-900">
                    ⚠️ CASH ON DELIVERY (COD) — PAYMENT REQUIRED UPON HANDOVER
                  </p>
                  <p className="text-xs mt-0.5 font-medium">
                    The rider must collect{" "}
                    <strong className="text-base font-black text-amber-900">
                      {formatPrice(Number(vendorOrder.subtotal), "GHS")}
                    </strong>{" "}
                    in cash or Mobile Money from the customer before releasing the parcel.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-black text-xs uppercase tracking-wide text-emerald-900">
                    ✓ PREPAID ONLINE VIA PAYSTACK / MOMO
                  </p>
                  <p className="text-xs font-medium">
                    Do not collect physical cash. Payment is secured under 48-Hour Escrow.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Customer & Destination Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-6 text-xs bg-zinc-50 p-4 rounded-xl border border-zinc-200">
            <div>
              <p className="font-bold text-zinc-400 uppercase tracking-wider text-[10px] mb-1">
                DELIVER TO (CUSTOMER)
              </p>
              <p className="font-bold text-sm text-zinc-900">
                {vendorOrder.order.user?.name || addr.fullName || addr.recipientName || "Valued Customer"}
              </p>
              <p className="text-zinc-600 mt-0.5">
                Phone: {vendorOrder.order.user?.phone || addr.phone || addr.recipientPhone || "N/A"}
              </p>
              <p className="text-zinc-500">
                Email: {vendorOrder.order.user?.email || addr.email || "N/A"}
              </p>
            </div>

            <div>
              <p className="font-bold text-zinc-400 uppercase tracking-wider text-[10px] mb-1">
                DELIVERY DESTINATION ADDRESS
              </p>
              <p className="font-semibold text-zinc-900">{addr.street || "Delivery address specified"}</p>
              <p className="text-zinc-700">
                {[addr.city, addr.region, "Ghana"].filter(Boolean).join(", ")}
              </p>
              {addr.digitalAddress && (
                <p className="font-mono text-zinc-700 font-bold mt-1">
                  GPS: {addr.digitalAddress}
                </p>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="my-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
              Package Contents (Manifest)
            </h4>
            <div className="border border-zinc-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100 text-zinc-700 font-bold border-b border-zinc-200">
                  <tr>
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 text-center w-16">Qty</th>
                    <th className="py-2.5 px-3 text-right w-24">Unit Price</th>
                    <th className="py-2.5 px-3 text-right w-28">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {vendorOrder.order.items.map((item, idx) => (
                    <tr key={item.id} className="text-zinc-800">
                      <td className="py-3 px-3 text-zinc-400 font-medium">{idx + 1}</td>
                      <td className="py-3 px-3 font-semibold text-zinc-900">{item.productName}</td>
                      <td className="py-3 px-3 text-center font-bold">{item.quantity}</td>
                      <td className="py-3 px-3 text-right">
                        {formatPrice(Number(item.unitPrice), "GHS")}
                      </td>
                      <td className="py-3 px-3 text-right font-bold">
                        {formatPrice(Number(item.subtotal), "GHS")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Summary & Escrow Note */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-t border-zinc-200 pt-4 text-xs">
            <div className="space-y-1 text-zinc-500 max-w-sm">
              <p className="font-bold text-zinc-700">NextDor Merchant Invariant Settlement:</p>
              <p>• 90% Net Merchant Split: {formatPrice(Number(vendorOrder.vendorEarnings), "GHS")}</p>
              <p>• 10% Platform Technology Fee: {formatPrice(Number(vendorOrder.commissionAmount), "GHS")}</p>
              <p>• Escrow Window: 48 Hours buyer protection inspection before wallet release.</p>
              {vendorOrder.notes && (
                <p className="text-zinc-700 font-medium italic mt-2">
                  Special Note: "{vendorOrder.notes}"
                </p>
              )}
            </div>

            <div className="w-full sm:w-64 space-y-2 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
              <div className="flex justify-between text-zinc-600 font-medium">
                <span>Subtotal:</span>
                <span>{formatPrice(Number(vendorOrder.subtotal), "GHS")}</span>
              </div>
              <div className="flex justify-between text-zinc-900 font-black text-sm border-t border-zinc-300 pt-2">
                <span>Amount Due:</span>
                <span>{formatPrice(Number(vendorOrder.subtotal), "GHS")}</span>
              </div>
            </div>
          </div>

          {/* Proof of Delivery / Receiver Acknowledgement Block */}
          <div className="mt-8 pt-6 border-t-2 border-dashed border-zinc-300 grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs text-zinc-600">
            <div>
              <p className="font-bold text-zinc-800 uppercase tracking-wider text-[10px] mb-2">
                Courier / Dispatch Handover
              </p>
              <p className="text-[11px] mb-6">Dispatched by: _______________________</p>
              <p className="text-[11px]">Rider Signature &amp; Date: _________________</p>
            </div>

            <div>
              <p className="font-bold text-zinc-800 uppercase tracking-wider text-[10px] mb-2">
                Customer Acceptance &amp; Receipt
              </p>
              <p className="text-[11px] mb-6">
                "I confirm receipt of the above items in sealed, undamaged condition."
              </p>
              <p className="text-[11px]">Recipient Signature: _______________________</p>
            </div>
          </div>

          {/* Document Footer */}
          <div className="mt-8 text-center text-[10px] text-zinc-400 border-t border-zinc-100 pt-3">
            NextDor Ghana • Automated Multi-Vendor Marketplace Operations • https://nextdor.com
          </div>
        </div>
      </div>
    </div>
  );
}
