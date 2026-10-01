"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Upload, X, Loader2, Image as ImageIcon, Link as LinkIcon } from "lucide-react";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  folder?: string;
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  label = "Product Image",
  folder = "nextdor/products",
  disabled = false,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCloudinary = value?.includes("cloudinary.com");

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (JPG, PNG, WebP, AVIF).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must be less than 10MB.");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload image.");
      }

      onChange(data.url);
      setShowUrlInput(false);
      setUrlInput("");
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }

  function handleUrlSubmit() {
    if (!urlInput.trim()) return;
    onChange(urlInput.trim());
    setUrlInput("");
    setShowUrlInput(false);
    setError(null);
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-zinc-700">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-[#f08804] transition"
        >
          <LinkIcon className="h-3 w-3" />
          {showUrlInput ? "Upload File instead" : "Enter Image URL"}
        </button>
      </div>

      {showUrlInput ? (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://..."
            className="flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-xs text-zinc-900 focus:border-[#ff9900] focus:ring-1 focus:ring-[#ff9900] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            className="rounded-xl bg-[#ff9900] px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-[#f08804] transition"
          >
            Apply
          </button>
        </div>
      ) : null}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
        className="hidden"
      />

      {/* Preview Card OR Dropzone */}
      {value ? (
        <div className="relative group overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 p-2 transition hover:border-zinc-300">
          <div className="flex items-center gap-3">
            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <Image
                src={value}
                alt="Product preview"
                fill
                sizes="80px"
                className="object-cover"
                unoptimized={!value.startsWith("http")}
              />
            </div>

            <div className="flex-1 min-w-0 pr-2">
              <p className="truncate text-xs font-medium text-zinc-800">
                {value}
              </p>
              <div className="mt-1 flex items-center gap-2">
                {isCloudinary && (
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    Cloudinary CDN
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isUploading}
                  className="text-xs font-semibold text-[#f08804] hover:underline"
                >
                  Change
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onChange("")}
              disabled={disabled || isUploading}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition"
              title="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-xs">
              <Loader2 className="h-6 w-6 animate-spin text-[#ff9900]" />
              <span className="ml-2 text-xs font-medium text-zinc-700">
                Uploading to Cloudinary...
              </span>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition ${
            dragOver
              ? "border-[#ff9900] bg-amber-50/50"
              : "border-zinc-300 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-400"
          } ${disabled || isUploading ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 className="h-8 w-8 animate-spin text-[#ff9900]" />
              <p className="text-xs font-medium text-zinc-700">
                Uploading to Cloudinary...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-xs border border-zinc-200 text-zinc-600">
                <Upload className="h-5 w-5 text-zinc-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-800">
                  Click to upload <span className="font-normal text-zinc-500">or drag and drop</span>
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-400">
                  PNG, JPG, WebP, AVIF up to 10MB (stored on Cloudinary)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 font-medium">{error}</p>
      )}
    </div>
  );
}
