"use client";

import { useState } from "react";
import {
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { disputeReturnRequest, type ReturnRequest } from "@/lib/returns/api";

interface ReturnClaimCardProps {
  claim: ReturnRequest;
  token: string;
  onRefresh: () => void;
}

const STATUS_LABELS: Record<
  string,
  { label: string; badgeCls: string; icon: typeof Clock; description: string }
> = {
  REQUESTED: {
    label: "Return Requested",
    badgeCls: "bg-amber-50 text-amber-800 border-amber-200",
    icon: Clock,
    description: "Claim submitted. The merchant has 24 hours to review your return request.",
  },
  UNDER_REVIEW: {
    label: "Under Inspection",
    badgeCls: "bg-blue-50 text-blue-800 border-blue-200",
    icon: Clock,
    description: "Merchant is verifying the item and evidence against the 48h escrow policy.",
  },
  APPROVED: {
    label: "Claim Approved",
    badgeCls: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: CheckCircle2,
    description: "Return claim approved. Automated Paystack refund is being disbursed.",
  },
  REJECTED: {
    label: "Claim Rejected",
    badgeCls: "bg-red-50 text-red-800 border-red-200",
    icon: XCircle,
    description: "Merchant declined the return. You can escalate to Super Admin arbitration below.",
  },
  REFUNDED: {
    label: "Refund Completed",
    badgeCls: "bg-purple-50 text-purple-800 border-purple-200",
    icon: CheckCircle2,
    description: "Refund of payment has been settled to your MoMo or card wallet via Paystack.",
  },
};

export function ReturnClaimCard({ claim, token, onRefresh }: ReturnClaimCardProps) {
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeNotes, setDisputeNotes] = useState("");
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  const statusInfo = STATUS_LABELS[claim.status] || STATUS_LABELS.REQUESTED;
  const StatusIcon = statusInfo.icon;

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeNotes.trim()) return;

    setIsSubmittingDispute(true);
    setDisputeError(null);

    try {
      await disputeReturnRequest(claim.id, disputeNotes.trim(), token);
      setShowDisputeModal(false);
      onRefresh();
    } catch (err: any) {
      setDisputeError(err?.message || "Failed to escalate dispute");
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
            <RotateCcw className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-zinc-900">Return Claim Filed</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${statusInfo.badgeCls}`}
              >
                <StatusIcon className="h-3 w-3" />
                {statusInfo.label}
              </span>
              {claim.isDisputed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-800 border border-red-200 px-2.5 py-0.5 text-xs font-bold">
                  <ShieldAlert className="h-3 w-3" /> Under Admin Arbitration
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Filed {new Date(claim.createdAt).toLocaleString()} • Ref: #{claim.id.slice(0, 8)}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="block text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
            Claimed Refund Amount
          </span>
          <span className="text-base font-extrabold text-zinc-900">
            {formatPrice(Number(claim.refundAmount), "GHS")}
          </span>
        </div>
      </div>

      {/* Description & Status */}
      <p className="text-xs text-zinc-600 leading-relaxed bg-zinc-50 p-3 rounded-xl border border-zinc-100">
        {statusInfo.description}
      </p>

      {/* Reason & Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <span className="font-bold text-zinc-400 uppercase tracking-wider text-[10px] block">
            Reason
          </span>
          <span className="font-semibold text-zinc-800">{claim.reason.replace(/_/g, " ")}</span>
        </div>

        {claim.details && (
          <div>
            <span className="font-bold text-zinc-400 uppercase tracking-wider text-[10px] block">
              Customer Note
            </span>
            <span className="text-zinc-600 line-clamp-2">"{claim.details}"</span>
          </div>
        )}
      </div>

      {/* Evidence Photos */}
      {claim.evidenceUrls && claim.evidenceUrls.length > 0 && (
        <div>
          <span className="font-bold text-zinc-400 uppercase tracking-wider text-[10px] block mb-1.5">
            Submitted Evidence
          </span>
          <div className="flex flex-wrap gap-2">
            {claim.evidenceUrls.map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="h-14 w-14 rounded-lg overflow-hidden border border-zinc-200 hover:opacity-80 transition"
              >
                <img src={url} alt="Evidence" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Admin Notes if present */}
      {claim.adminNote && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <span className="font-bold block">NextDor Resolution Note:</span>
          <span>{claim.adminNote}</span>
        </div>
      )}

      {/* Dispute Escalation Action (if rejected or disputed) */}
      {!claim.isDisputed && claim.status === "REJECTED" && (
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
          <p className="text-xs text-zinc-500">
            Disagree with the merchant's decision? Escalate for independent arbitration.
          </p>
          <button
            onClick={() => setShowDisputeModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition cursor-pointer"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
            <span>Escalate Dispute</span>
          </button>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-600" />
                Escalate to Super Admin Arbitration
              </h3>
              <button
                onClick={() => setShowDisputeModal(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-500">
              A NextDor marketplace compliance officer will review your return claim, order photos,
              and merchant communication to issue a final binding ruling.
            </p>

            {disputeError && (
              <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{disputeError}</p>
            )}

            <form onSubmit={handleDisputeSubmit} className="space-y-4">
              <textarea
                required
                rows={4}
                value={disputeNotes}
                onChange={(e) => setDisputeNotes(e.target.value)}
                placeholder="Explain why you believe the merchant's rejection was invalid..."
                className="w-full text-xs rounded-xl border border-zinc-300 p-3 text-zinc-900 focus:border-red-500 focus:outline-none"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDispute || !disputeNotes.trim()}
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isSubmittingDispute ? "Submitting..." : "Submit for Arbitration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
