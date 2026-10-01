"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageIcon } from "lucide-react";
import type { ProductImage } from "@/lib/catalog/types";

type ProductGalleryProps = {
  images: ProductImage[];
  productName: string;
};

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Filter out empty or whitespace-only image URLs to prevent next/image runtime crashes
  const validImages = (images || []).filter(
    (img) => typeof img?.src === "string" && img.src.trim().length > 0
  );
  const activeImage = validImages[activeIndex] ?? validImages[0];

  if (!activeImage || !activeImage.src) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl bg-zinc-50 border border-zinc-200/80 text-zinc-400 p-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <ImageIcon className="h-12 w-12 text-zinc-300" />
          <span className="text-xs font-medium text-zinc-500">No product image available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-white border border-zinc-100 p-4 shadow-xs">
        <Image
          src={activeImage.src}
          alt={activeImage.alt || productName}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain"
          priority
        />
      </div>

      {validImages.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {validImages.map((image, index) => (
            <button
              key={`${image.src}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white p-1 transition-all ${
                index === activeIndex
                  ? "border-[#ff9900] shadow-sm"
                  : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <Image
                src={image.src}
                alt={image.alt || productName}
                fill
                sizes="64px"
                className="object-contain"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
