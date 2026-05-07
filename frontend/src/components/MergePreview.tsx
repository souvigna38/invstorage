"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { mergeItems } from "@/actions/inventory";
import type { ProductItem } from "@/lib/types";

interface MergePreviewProps {
  items: ProductItem[];
  onClose: () => void;
  onMergeComplete: () => void;
}

export default function MergePreview({ items, onClose, onMergeComplete }: MergePreviewProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Determine which item will be primary (same logic as server action)
  // For the preview, show the first item with an image as the "keeper"
  const sorted = [...items].sort((a, b) => {
    // Prefer items with images
    if (a.image_url && !b.image_url) return -1;
    if (!a.image_url && b.image_url) return 1;
    // Then older items (lower ID = created first)
    return a.id - b.id;
  });

  const primaryItem = sorted[0];
  const secondaryItems = sorted.slice(1);

  // Collect all unique image URLs
  const allImageUrls = new Set<string>();
  const images: { url: string; itemId: number; title: string }[] = [];
  for (const item of items) {
    if (item.image_url && !allImageUrls.has(item.image_url)) {
      allImageUrls.add(item.image_url);
      images.push({ url: item.image_url, itemId: item.id, title: item.title });
    }
  }

  const handleMerge = () => {
    startTransition(async () => {
      const res = await mergeItems(items.map((i) => i.id));
      if (res.success) {
        setResult({
          success: true,
          message: `Merged ${res.mergedCount} item(s) into #${res.primaryId}. ${res.photosKept} photo(s) kept.`,
        });
        setTimeout(() => onMergeComplete(), 1500);
      } else {
        setResult({ success: false, message: res.error || "Merge failed" });
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#0f1111]">Merge {items.length} Items</h2>
              <p className="text-sm text-gray-500">
                Combine duplicate items into one, consolidating all photos
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Primary Item (will be kept) */}
          <div>
            <h3 className="text-xs font-bold uppercase text-green-700 mb-2 flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Keeping (Primary)
            </h3>
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              {primaryItem.image_url && (
                <div className="relative h-16 w-16 flex-shrink-0">
                  <Image
                    src={primaryItem.image_url}
                    alt={primaryItem.title}
                    fill
                    unoptimized={primaryItem.image_url.includes("localhost")}
                    className="object-cover rounded-md"
                    sizes="64px"
                  />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-sm text-[#0f1111] truncate">
                  #{primaryItem.id}: {primaryItem.title}
                </p>
                <p className="text-xs text-gray-500">
                  {primaryItem.category_name || "Uncategorized"}
                  {primaryItem.location_name ? ` · ${primaryItem.location_name}` : ""}
                </p>
              </div>
            </div>
          </div>

          {/* Secondary Items (will be deleted) */}
          <div>
            <h3 className="text-xs font-bold uppercase text-red-600 mb-2 flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Deleting ({secondaryItems.length} duplicate{secondaryItems.length > 1 ? "s" : ""})
            </h3>
            <div className="space-y-2">
              {secondaryItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg opacity-80"
                >
                  {item.image_url && (
                    <div className="relative h-12 w-12 flex-shrink-0">
                      <Image
                        src={item.image_url}
                        alt={item.title}
                        fill
                        unoptimized={item.image_url.includes("localhost")}
                        className="object-cover rounded-md"
                        sizes="48px"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700 truncate">
                      #{item.id}: {item.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Photos Summary */}
          <div>
            <h3 className="text-xs font-bold uppercase text-gray-500 mb-2">
              All Photos (unique ones will be consolidated)
            </h3>
            <div className="flex flex-wrap gap-2">
              {images.map(({ url, itemId }) => (
                <div key={url} className="relative h-20 w-20 flex-shrink-0">
                  <Image
                    src={url}
                    alt={`Photo from item #${itemId}`}
                    fill
                    unoptimized={url.includes("localhost")}
                    className="object-cover rounded-lg border border-gray-200"
                    sizes="80px"
                  />
                  <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[9px] px-1 rounded">
                    #{itemId}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {images.length} unique photo{images.length !== 1 ? "s" : ""} will be attached to the
              merged item. Exact duplicates (same URL) will be removed.
            </p>
          </div>

          {/* Result */}
          {result && (
            <div
              className={`p-3 rounded-lg text-sm font-medium ${
                result.success
                  ? "bg-green-100 text-green-800 border border-green-300"
                  : "bg-red-100 text-red-800 border border-red-300"
              }`}
            >
              {result.message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 rounded-b-xl flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={isPending || result?.success === true}
            className="px-5 py-2 text-sm font-bold text-[#131921] bg-[#febd69] hover:bg-[#f3a847] rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Merging...
              </>
            ) : (
              <>Confirm Merge</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
