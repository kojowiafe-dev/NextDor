"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { API_BASE } from "@/lib/api-config";

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
  endpoint?: string; // defaults to `${API_BASE}/vendors/portal/products/bulk`
  authToken: string;
}

interface ParsedItem {
  name: string;
  price: number;
  salePrice?: number | null;
  stockQty?: number;
  categoryName?: string;
  imageUrl?: string;
  description?: string;
}

interface RowError {
  row: number;
  name: string;
  message: string;
}

export function BulkUploadModal({
  isOpen,
  onClose,
  onSuccess,
  endpoint = `${API_BASE}/vendors/portal/products/bulk`,
  authToken,
}: BulkUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [clientErrors, setClientErrors] = useState<RowError[]>([]);
  const [serverErrors, setServerErrors] = useState<RowError[]>([]);
  const [showErrorList, setShowErrorList] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<number | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Generate and download a sample CSV template with instructions
  function handleDownloadTemplate() {
    const csvContent =
      "Name,Price,SalePrice,StockQuantity,Category,ImageUrl,Description\n" +
      '"Classic Cotton T-Shirt",45.00,38.00,20,"Fashion","https://images.unsplash.com/photo-1521572267360-ee0c2909d518","100% premium cotton tee with relaxed fit"\n' +
      '"Wireless Bluetooth Earbuds",120.00,,15,"Electronics","https://images.unsplash.com/photo-1590658268037-6bf12165a8df","Noise cancelling wireless earbuds with fast charging"\n' +
      '"Organic Honey 500g",35.00,,50,"Groceries",,"Raw unpasteurized local honey"\n';

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "nextdor_products_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Robust RFC 4180 CSV parser
  function parseCSV(text: string): { items: ParsedItem[]; errors: RowError[] } {
    const lines: string[] = [];
    let currentLine = "";
    let inQuotes = false;

    // Split taking quoted multi-line fields into account
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        currentLine += char;
      } else if ((char === "\n" || (char === "\r" && text[i + 1] === "\n")) && !inQuotes) {
        if (char === "\r") i++; // skip \n
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = "";
      } else {
        currentLine += char;
      }
    }
    if (currentLine.trim()) lines.push(currentLine.trim());

    if (lines.length < 2) {
      throw new Error("The CSV file must contain a header row and at least one product row.");
    }

    // Helper to parse comma separated values handling quotes
    function parseRow(rowStr: string): string[] {
      const values: string[] = [];
      let val = "";
      let inside = false;

      for (let j = 0; j < rowStr.length; j++) {
        const c = rowStr[j];
        if (c === '"') {
          if (inside && rowStr[j + 1] === '"') {
            val += '"';
            j++;
          } else {
            inside = !inside;
          }
        } else if (c === "," && !inside) {
          values.push(val.trim());
          val = "";
        } else {
          val += c;
        }
      }
      values.push(val.trim());
      return values;
    }

    const rawHeaders = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const items: ParsedItem[] = [];
    const errors: RowError[] = [];

    // Map header names to known fields
    const getIndex = (aliases: string[]) =>
      rawHeaders.findIndex((h) => aliases.some((a) => h.includes(a)));

    const nameIdx = getIndex(["name", "title", "product"]);
    const priceIdx = getIndex(["price", "regularprice", "previousprice", "originalprice", "unitprice"]);
    const saleIdx = getIndex(["saleprice", "sale", "discount", "currentprice"]);
    const stockIdx = getIndex(["stock", "qty", "quantity"]);
    const catIdx = getIndex(["category", "cat"]);
    const imgIdx = getIndex(["image", "img", "photo", "url"]);
    const descIdx = getIndex(["desc", "detail"]);

    if (nameIdx === -1 || priceIdx === -1) {
      throw new Error('CSV must contain at least "Name" and "Price" columns.');
    }

    for (let r = 1; r < lines.length; r++) {
      const rowNum = r + 1;
      const values = parseRow(lines[r]);

      const name = values[nameIdx]?.trim() || "";
      const rawPrice = values[priceIdx]?.replace(/[^0-9.]/g, "") || "";
      const parsedA = parseFloat(rawPrice);

      if (!name || name.length < 2) {
        errors.push({
          row: rowNum,
          name: name || `Row ${rowNum}`,
          message: "Product name is required (at least 2 characters).",
        });
        continue;
      }

      if (isNaN(parsedA) || parsedA <= 0) {
        errors.push({
          row: rowNum,
          name,
          message: `Invalid price "${values[priceIdx] || ""}". Must be a number greater than 0.`,
        });
        continue;
      }

      let finalPrice = parsedA;
      let finalSalePrice: number | null = null;

      if (saleIdx !== -1 && values[saleIdx]) {
        const parsedB = parseFloat(values[saleIdx].replace(/[^0-9.]/g, ""));
        if (!isNaN(parsedB) && parsedB > 0) {
          if (parsedB < parsedA) {
            // parsedA is previous (regular), parsedB is current (sale)
            finalPrice = parsedA;
            finalSalePrice = parsedB;
          } else if (parsedB > parsedA) {
            // parsedB is previous (regular), parsedA is current (sale)
            finalPrice = parsedB;
            finalSalePrice = parsedA;
          }
        }
      }

      let stockQty = 10; // default
      if (stockIdx !== -1 && values[stockIdx]) {
        const parsedStock = parseInt(values[stockIdx].replace(/[^0-9]/g, ""), 10);
        if (!isNaN(parsedStock) && parsedStock >= 0) {
          stockQty = parsedStock;
        }
      }

      items.push({
        name,
        price: finalPrice,
        salePrice: finalSalePrice,
        stockQty,
        categoryName: catIdx !== -1 ? values[catIdx]?.trim() : undefined,
        imageUrl: imgIdx !== -1 ? values[imgIdx]?.trim() : undefined,
        description: descIdx !== -1 ? values[descIdx]?.trim() || name : name,
      });
    }

    return { items, errors };
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setGeneralError(null);
    setServerErrors([]);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const { items, errors } = parseCSV(content);
        setParsedItems(items);
        setClientErrors(errors);
      } catch (err: any) {
        setGeneralError(err.message || "Failed to read CSV file. Please verify format.");
        setParsedItems([]);
        setClientErrors([]);
      }
    };
    reader.onerror = () => {
      setGeneralError("Error reading file.");
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (parsedItems.length === 0) return;

    setIsUploading(true);
    setGeneralError(null);
    setServerErrors([]);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ items: parsedItems }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setGeneralError(json.error?.message || "Failed to process bulk upload.");
        return;
      }

      const { createdCount, errors } = json.data;
      setUploadSuccess(createdCount);
      if (errors && errors.length > 0) {
        setServerErrors(errors);
      }

      onSuccess(createdCount);
    } catch (err: any) {
      setGeneralError(`Network error during bulk import: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  }

  function resetState() {
    setFileName(null);
    setParsedItems([]);
    setClientErrors([]);
    setServerErrors([]);
    setUploadSuccess(null);
    setGeneralError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-zinc-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 bg-zinc-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Bulk Product Import</h2>
              <p className="text-xs text-zinc-500">Upload your product catalog using CSV</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-4 overflow-y-auto grow">
          {/* Success Banner */}
          {uploadSuccess !== null ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
              <div>
                <h3 className="text-base font-bold text-emerald-900">Import Completed!</h3>
                <p className="text-xs text-emerald-700 mt-1">
                  Successfully imported <strong>{uploadSuccess} products</strong> into your catalog.
                </p>
              </div>
              {serverErrors.length > 0 && (
                <div className="text-left text-xs text-amber-800 bg-amber-50/80 p-3 rounded-lg border border-amber-200">
                  <p className="font-semibold mb-1">⚠️ {serverErrors.length} products skipped:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {serverErrors.slice(0, 5).map((e, idx) => (
                      <li key={idx}>
                        Row {e.row} ({e.name}): {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="pt-2">
                <button
                  onClick={() => {
                    resetState();
                    onClose();
                  }}
                  className="w-full rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-700"
                >
                  Done & View Inventory
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* General Error notice */}
              {generalError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  <p>{generalError}</p>
                </div>
              )}

              {/* Step 1: Template Download */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Step 1</span>
                  <p className="text-xs font-medium text-zinc-800">Need the formatted spreadsheet?</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 shrink-0"
                >
                  <Download className="h-3.5 w-3.5 text-purple-600" />
                  <span>Download Template</span>
                </button>
              </div>

              {/* Step 2: Upload CSV */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Step 2: Choose File</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer rounded-2xl border-2 border-dashed border-zinc-300 hover:border-purple-500 bg-white p-6 text-center transition hover:bg-purple-50/30"
                >
                  <Upload className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-zinc-800">
                    {fileName ? fileName : "Tap here to select your CSV file"}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Supports .csv files with up to 500 products per upload
                  </p>
                </div>
              </div>

              {/* Preview & Validation Summary */}
              {parsedItems.length > 0 && (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-800">
                      ✅ {parsedItems.length} Products Ready to Import
                    </span>
                    {clientErrors.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowErrorList(!showErrorList)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:underline"
                      >
                        <span>{clientErrors.length} Issue(s)</span>
                        {showErrorList ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    )}
                  </div>

                  {/* Sample preview items */}
                  <div className="text-[11px] text-zinc-500 bg-white rounded-lg p-2.5 border border-zinc-200/80 space-y-1">
                    <p className="font-medium text-zinc-700">Preview sample:</p>
                    <div className="truncate text-zinc-600">
                      • {parsedItems[0]?.name} — GHS {parsedItems[0]?.price.toFixed(2)} (Qty: {parsedItems[0]?.stockQty})
                    </div>
                    {parsedItems[1] && (
                      <div className="truncate text-zinc-600">
                        • {parsedItems[1]?.name} — GHS {parsedItems[1]?.price.toFixed(2)} (Qty: {parsedItems[1]?.stockQty})
                      </div>
                    )}
                    {parsedItems.length > 2 && (
                      <p className="text-[10px] text-zinc-400 italic">
                        + {parsedItems.length - 2} more product(s)
                      </p>
                    )}
                  </div>

                  {/* Expandable validation error list */}
                  {showErrorList && clientErrors.length > 0 && (
                    <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 border border-amber-200 space-y-1 max-h-36 overflow-y-auto">
                      <p className="font-bold text-[11px]">The following rows contain issues and will be skipped:</p>
                      <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                        {clientErrors.map((err, idx) => (
                          <li key={idx}>
                            Row {err.row} ({err.name}): {err.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {uploadSuccess === null && (
          <div className="border-t border-zinc-200 px-5 py-3.5 bg-zinc-50 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={parsedItems.length === 0 || isUploading}
              onClick={handleImport}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50 transition"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Importing {parsedItems.length} Products...</span>
                </>
              ) : (
                <span>Confirm & Import ({parsedItems.length})</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
