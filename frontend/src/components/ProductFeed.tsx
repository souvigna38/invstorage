"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Product from "./Product";
import MergePreview from "./MergePreview";
import RollbackModal from "./RollbackModal";
import type { ProductItem, Location } from "@/lib/types";

interface ProductFeedProps {
  products: ProductItem[];
  locations: Location[];
}

export default function ProductFeed({ products, locations }: ProductFeedProps) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showMergePreview, setShowMergePreview] = useState(false);
  const [showRollback, setShowRollback] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState<{ success: boolean; message: string } | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const router = useRouter();

  const handleSnapshot = async () => {
    setSnapshotting(true);
    setSnapshotResult(null);
    try {
      const res = await fetch("/api/vault/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: new Date().toLocaleString() }),
      });
      const data = await res.json();
      if (data.success) {
        setSnapshotResult({
          success: true,
          message: `Snapshot saved: ${data.itemCount} items, ${data.imageCount} images`,
        });
      } else {
        setSnapshotResult({ success: false, message: data.error || "Snapshot failed" });
      }
    } catch {
      setSnapshotResult({ success: false, message: "Could not reach vault API" });
    } finally {
      setSnapshotting(false);
      setTimeout(() => setSnapshotResult(null), 5000);
    }
  };

  // Dynamically measure the sticky header so the toolbar sits right below it
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const update = () => setHeaderHeight(header.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const enterSelectMode = () => {
    setSelectMode(true);
    setSelectedIds(new Set());
  };

  const handleMergeComplete = () => {
    setShowMergePreview(false);
    exitSelectMode();
    router.refresh();
  };

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg className="h-20 w-20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
        <p className="text-lg font-medium">No items found</p>
        <p className="text-sm">Try adjusting your search or filters</p>
      </div>
    );
  }

  const selectedProducts = products.filter((p) => selectedIds.has(p.id));

  return (
    <>
      {/* Select Mode Toggle — sticky below header */}
      <div
        className="sticky z-40 bg-[#eaeded] flex items-center justify-end px-6 py-2 gap-2"
        style={{ top: headerHeight }}
      >
        {!selectMode ? (
          <div className="flex items-center gap-2">
            {/* Snapshot result toast (inline) */}
            {snapshotResult && (
              <span
                className={`text-xs font-medium px-2 py-1 rounded ${
                  snapshotResult.success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}
              >
                {snapshotResult.message}
              </span>
            )}
            <button
              onClick={handleSnapshot}
              disabled={snapshotting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              {snapshotting ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              {snapshotting ? "Saving..." : "Snapshot"}
            </button>
            <button
              onClick={() => setShowRollback(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Roll Back Date
            </button>
            <button
              onClick={enterSelectMode}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Select &amp; Merge
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {selectedIds.size} selected
            </span>
            <button
              onClick={() => {
                // Select all
                const allIds = new Set(products.map((p) => p.id));
                setSelectedIds(allIds);
              }}
              className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
            >
              All
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded cursor-pointer"
            >
              None
            </button>
            <button
              onClick={exitSelectMode}
              className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Product Grid */}
      <div className="grid grid-flow-row-dense sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <Product
            key={product.id}
            product={product}
            locations={locations}
            selectMode={selectMode}
            isSelected={selectedIds.has(product.id)}
            onToggleSelect={() => toggleSelect(product.id)}
          />
        ))}
      </div>

      {/* Floating Merge Toolbar */}
      {selectMode && selectedIds.size >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#131921] text-white rounded-2xl shadow-2xl px-6 py-3 flex items-center gap-4 border border-[#febd69]/30">
          <div className="text-sm">
            <span className="font-bold text-[#febd69]">{selectedIds.size}</span> items selected
          </div>
          <div className="w-px h-6 bg-gray-600" />
          <button
            onClick={() => setShowMergePreview(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#febd69] text-[#131921] font-bold text-sm rounded-lg hover:bg-[#f3a847] transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Merge into One
          </button>
          <button
            onClick={exitSelectMode}
            className="text-gray-400 hover:text-white text-xs cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Merge Preview Modal */}
      {showMergePreview && (
        <MergePreview
          items={selectedProducts}
          onClose={() => setShowMergePreview(false)}
          onMergeComplete={handleMergeComplete}
        />
      )}

      {/* Rollback Modal */}
      {showRollback && (
        <RollbackModal onClose={() => setShowRollback(false)} />
      )}
    </>
  );
}
