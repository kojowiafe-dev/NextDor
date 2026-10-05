"use client";

import { useState, useEffect } from "react";
import {
  RefreshCw,
  Store,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import { API_BASE } from "@/lib/api-config";

interface StoreSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string;
  onSyncComplete?: () => void;
}

export function StoreSyncModal({
  isOpen,
  onClose,
  authToken,
  onSyncComplete,
}: StoreSyncModalProps) {
  const [storeUrl, setStoreUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [hasSecretSaved, setHasSecretSaved] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>("IDLE");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    loadSyncSettings();
  }, [isOpen]);

  async function loadSyncSettings() {
    setIsLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/vendors/portal/sync`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setStoreUrl(json.data.wcStoreUrl || "");
        setConsumerKey(json.data.wcConsumerKey || "");
        setHasSecretSaved(json.data.hasSecret || false);
        setLastSyncAt(json.data.wcLastSyncAt || null);
        setSyncStatus(json.data.wcSyncStatus || "IDLE");
      }
    } catch (err: any) {
      setNotice({ type: "error", text: "Failed to load store sync settings." });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setNotice(null);

    try {
      const res = await fetch(`${API_BASE}/vendors/portal/sync`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          wcStoreUrl: storeUrl.trim(),
          wcConsumerKey: consumerKey.trim() || undefined,
          wcConsumerSecret: consumerSecret.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setNotice({ type: "error", text: json.error?.message || "Failed to save settings." });
        return;
      }

      setNotice({ type: "success", text: "WooCommerce store credentials saved successfully!" });
      setHasSecretSaved(json.data.hasSecret);
      setConsumerSecret(""); // Clear secret from form memory
    } catch (err: any) {
      setNotice({ type: "error", text: `Error saving: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTriggerSync() {
    if (!storeUrl.trim()) {
      setNotice({ type: "error", text: "Please enter your store URL first." });
      return;
    }

    setIsSyncing(true);
    setNotice(null);

    try {
      const res = await fetch(`${API_BASE}/vendors/portal/sync/trigger`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setNotice({ type: "error", text: json.error?.message || "Failed to trigger sync." });
        return;
      }

      setNotice({
        type: "success",
        text: "Synchronization started in background! Your catalog will be updated shortly.",
      });
      setSyncStatus("SYNCING");

      // Poll once after 4s to check updated status
      setTimeout(() => {
        loadSyncSettings();
        if (onSyncComplete) onSyncComplete();
      }, 4000);
    } catch (err: any) {
      setNotice({ type: "error", text: `Sync trigger error: ${err.message}` });
    } finally {
      setIsSyncing(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-zinc-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 bg-zinc-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">WooCommerce Store Sync</h2>
              <p className="text-xs text-zinc-500">Auto-import products from your existing store</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto grow">
          {/* Status Banner */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-700">Sync Status:</span>
                {syncStatus === "SYNCING" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 ring-1 ring-blue-700/20">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span>Syncing in background...</span>
                  </span>
                ) : syncStatus === "SUCCESS" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-700/20">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Connected & Up to Date</span>
                  </span>
                ) : syncStatus === "FAILED" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 ring-1 ring-red-700/20">
                    <AlertCircle className="h-3 w-3" />
                    <span>Last sync had errors</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-600">
                    Not connected
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">
                {lastSyncAt
                  ? `Last synced: ${new Date(lastSyncAt).toLocaleString()}`
                  : "No synchronization recorded yet."}
              </p>
            </div>

            {storeUrl && (
              <button
                type="button"
                onClick={handleTriggerSync}
                disabled={isSyncing}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 disabled:opacity-50 shrink-0 transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>Sync Products Now</span>
              </button>
            )}
          </div>

          {/* Feedback notice */}
          {notice && (
            <div
              className={`flex items-start gap-2.5 rounded-xl p-3.5 text-xs ${
                notice.type === "success"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {notice.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              )}
              <p>{notice.text}</p>
            </div>
          )}

          {/* Store Credentials Form */}
          <form onSubmit={handleSaveSettings} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                Store Website URL
              </label>
              <input
                type="url"
                required
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
                placeholder="https://yourstore.com"
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-purple-500 focus:outline-hidden focus:ring-1 focus:ring-purple-500 transition"
              />
              <p className="text-[11px] text-zinc-400 mt-1">
                Your public WooCommerce store address
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                Consumer Key (Optional for public stores)
              </label>
              <input
                type="text"
                value={consumerKey}
                onChange={(e) => setConsumerKey(e.target.value)}
                placeholder="ck_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-purple-500 focus:outline-hidden focus:ring-1 focus:ring-purple-500 transition font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-zinc-800">
                  Consumer Secret
                </label>
                {hasSecretSaved && (
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Saved securely
                  </span>
                )}
              </div>
              <input
                type="password"
                value={consumerSecret}
                onChange={(e) => setConsumerSecret(e.target.value)}
                placeholder={hasSecretSaved ? "••••••••••••••••••••••••••••••••" : "cs_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-purple-500 focus:outline-hidden focus:ring-1 focus:ring-purple-500 transition font-mono"
              />
              <p className="text-[11px] text-zinc-400 mt-1">
                Only needed if your WooCommerce store requires authenticated API access
              </p>
            </div>

            <button
              type="submit"
              disabled={isSaving || !storeUrl.trim()}
              className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50 transition"
            >
              {isSaving ? "Saving Settings..." : "Save Store Connection"}
            </button>
          </form>

          {/* Quick Help Accordion */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 font-semibold text-zinc-700 hover:bg-zinc-100/60 transition"
            >
              <div className="flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-purple-600" />
                <span>How to get your WooCommerce API Keys</span>
              </div>
              {showGuide ? <ChevronUp className="h-3.5 w-3.5 text-zinc-400" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />}
            </button>

            {showGuide && (
              <div className="p-3.5 pt-1 space-y-2 text-[11px] text-zinc-600 border-t border-zinc-200/80 bg-white">
                <p>Follow these 3 simple steps in your WordPress Admin:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Go to <strong>WooCommerce → Settings → Advanced → REST API</strong>.</li>
                  <li>Click <strong>Add key</strong>, name it "NextDor", and set permissions to <strong>Read</strong>.</li>
                  <li>Click <strong>Generate API key</strong>, then copy the Consumer Key and Consumer Secret here.</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 px-5 py-3.5 bg-zinc-50 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
