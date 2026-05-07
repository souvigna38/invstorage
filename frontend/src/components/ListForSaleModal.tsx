"use client";

import { useState } from "react";
import {
  XMarkIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ShoppingBagIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/solid";
import type { ProductDetail } from "@/lib/types";
import { SERVICE_URLS, MEDUSA_ADMIN_URL } from "@/lib/config";

// Available sales channels for n8n distribution
const SALES_CHANNELS = [
  { id: "ebay", label: "eBay", icon: "🏷️", description: "Official API listing" },
  { id: "amazon", label: "Amazon", icon: "📦", description: "Seller Central API" },
  { id: "craigslist", label: "Craigslist", icon: "📋", description: "Email draft for manual post" },
  { id: "facebook", label: "Facebook Marketplace", icon: "📘", description: "Email draft for manual post" },
] as const;

interface ListForSaleModalProps {
  item: ProductDetail;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ListForSaleModal({
  item,
  isOpen,
  onClose,
  onSuccess,
}: ListForSaleModalProps) {
  const [price, setPrice] = useState(
    item.list_price?.toString() ??
    item.estimated_value?.toString() ??
    item.price?.toString() ??
    ""
  );
  const [description, setDescription] = useState(item.description ?? "");
  // SKU — auto-generated from asset_tag or item ID, editable by user
  // Critical for ERPNext sync: becomes the ERPNext Item Code
  const [sku, setSku] = useState(
    item.asset_tag || `INVT-${item.id}`
  );
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    medusa_product_id?: string;
  } | null>(null);

  if (!isOpen) return null;

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((c) => c !== channelId)
        : [...prev, channelId]
    );
  };

  const handlePublish = async () => {
    setIsSubmitting(true);
    setResult(null);

    try {
      const resp = await fetch("/api/sales/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          price: parseFloat(price) || 0,
          description,
          sku: sku.trim() || undefined,
          channels: selectedChannels,
        }),
      });

      const data = await resp.json();
      setResult(data);

      if (data.success) {
        setTimeout(() => {
          onSuccess?.();
          onClose();
          window.location.reload();
        }, 1500);
      }
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Failed to publish",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnpublish = async () => {
    setIsSubmitting(true);
    setResult(null);

    try {
      const resp = await fetch("/api/sales/unpublish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });

      const data = await resp.json();
      setResult(data);

      if (data.success) {
        setTimeout(() => {
          onSuccess?.();
          onClose();
          window.location.reload();
        }, 1500);
      }
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Failed to unpublish",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isListed = !!item.medusa_product_id;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-2">
            <ShoppingBagIcon className="h-5 w-5" />
            <h2 className="font-bold text-lg">
              {isListed ? "Manage Listing" : "List for Sale"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition cursor-pointer"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Item Summary */}
        <div className="px-5 py-3 bg-gray-50 border-b">
          <p className="font-semibold text-sm text-[#0f1111] truncate">
            {item.title}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {item.asset_tag && (
              <span className="font-mono mr-2">{item.asset_tag}</span>
            )}
            {item.manufacturer && <span>{item.manufacturer}</span>}
            {item.model_name && <span> · {item.model_name}</span>}
          </p>
        </div>

        {/* Result Banner */}
        {result && (
          <div
            className={`px-5 py-3 flex items-center gap-2 ${
              result.success
                ? "bg-green-50 text-green-700 border-b border-green-200"
                : "bg-red-50 text-red-700 border-b border-red-200"
            }`}
          >
            {result.success ? (
              <>
                <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm font-medium">
                  {result.message || "Success!"}
                </span>
              </>
            ) : (
              <>
                <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm font-medium">
                  {result.error || "Something went wrong"}
                </span>
              </>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          {isListed ? (
            /* ── Already Listed View ── */
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBagIcon className="h-5 w-5 text-emerald-600" />
                  <span className="font-bold text-emerald-700">
                    Currently Listed for Sale
                  </span>
                </div>
                <p className="text-sm text-emerald-600">
                  Medusa Product: <span className="font-mono text-xs">{item.medusa_product_id}</span>
                </p>
                {item.list_price != null && item.list_price > 0 && (
                  <p className="text-sm text-emerald-600 mt-1">
                    List Price: <span className="font-bold">${item.list_price.toFixed(2)}</span>
                  </p>
                )}
              </div>

              <a
                href={MEDUSA_ADMIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                Open Medusa Admin Dashboard
              </a>

              <button
                onClick={handleUnpublish}
                disabled={isSubmitting}
                className="w-full py-2.5 text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Removing..." : "Remove Listing"}
              </button>
            </div>
          ) : (
            /* ── New Listing Form ── */
            <>
              {/* Price Reference Row */}
              <div className="flex items-center flex-wrap gap-3 text-xs text-gray-400">
                {item.estimated_value != null && item.estimated_value > 0 && (
                  <span>Est. Value: <span className="font-medium text-gray-600">${item.estimated_value.toFixed(2)}</span></span>
                )}
                {item.msrp_price != null && item.msrp_price > 0 && (
                  <span>MSRP: <span className="font-medium text-gray-600">${item.msrp_price.toFixed(2)}</span></span>
                )}
                {item.price > 0 && (
                  <span>Paid: <span className="font-medium text-gray-600">${item.price.toFixed(2)}</span></span>
                )}
              </div>

              {/* Sale Price */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Sale Price ($)
                </label>
                <div className="relative">
                  <CurrencyDollarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-lg font-bold text-[#0f1111] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* SKU — Required for ERPNext sync */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  SKU (Item Code)
                  <span className="text-red-400 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase().replace(/\s+/g, "-"))}
                  placeholder="e.g., CAM-RED-001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-[#0f1111] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Unique identifier for ERPNext sync. Auto-generated from asset tag or item ID.
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Sale Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe the item for potential buyers..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[#0f1111] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-y"
                />
              </div>

              {/* Sales Channels — n8n Distribution */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Distribute to Channels
                  <span className="text-gray-400 font-normal normal-case ml-1">(via n8n)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SALES_CHANNELS.map((channel) => {
                    const isSelected = selectedChannels.includes(channel.id);
                    return (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => toggleChannel(channel.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition cursor-pointer ${
                          isSelected
                            ? "bg-emerald-50 border-emerald-400 text-emerald-800 ring-1 ring-emerald-400"
                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <span className="text-base">{channel.icon}</span>
                        <div className="min-w-0">
                          <span className="font-medium block truncate">{channel.label}</span>
                          <span className="text-[10px] text-gray-400 block truncate">{channel.description}</span>
                        </div>
                        {isSelected && (
                          <CheckCircleIcon className="h-4 w-4 text-emerald-500 ml-auto flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedChannels.length > 0 && (
                  <p className="text-[10px] text-emerald-500 mt-1.5">
                    n8n will auto-distribute to: {selectedChannels.join(", ")}
                  </p>
                )}
              </div>

              {/* Info */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-600">
                <p className="font-medium mb-1">Powered by Medusa.js + n8n + ERPNext</p>
                <p>
                  Creates a product listing in Medusa (source of truth). The SKU
                  links this item to ERPNext for accounting &amp; inventory tracking.
                  {selectedChannels.length > 0
                    ? " n8n will automatically distribute to selected channels."
                    : " Select channels above to auto-distribute via n8n."}
                  {" "}Manage via{" "}
                  <a
                    href={MEDUSA_ADMIN_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    Medusa
                  </a>
                  {", "}
                  <a
                    href={SERVICE_URLS.n8n}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    n8n
                  </a>
                  {", or "}
                  <a
                    href={SERVICE_URLS.erpnext}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    ERPNext
                  </a>.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!isListed && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handlePublish}
              disabled={isSubmitting || !price || parseFloat(price) <= 0 || !sku.trim()}
              className={`px-6 py-2 text-sm font-bold rounded-full transition cursor-pointer ${
                isSubmitting || !price || parseFloat(price) <= 0 || !sku.trim()
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-sm"
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Publishing...
                </span>
              ) : (
                `List for $${parseFloat(price || "0").toFixed(2)}`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
