"use client";

import { useState, useTransition } from "react";
import {
  XMarkIcon,
  MapPinIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/solid";
import { transferItem } from "@/actions/inventory";
import type { ProductItem, Location } from "@/lib/types";

interface LocationSelectorProps {
  item: ProductItem;
  locations: Location[];
  onClose: () => void;
}

export default function LocationSelector({
  item,
  locations,
  onClose,
}: LocationSelectorProps) {
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  const handleTransfer = () => {
    if (!selectedLocation) return;

    startTransition(async () => {
      const res = await transferItem(item.id, selectedLocation, note || undefined);
      setResult(res);
      if (res.success) {
        setTimeout(() => onClose(), 1500);
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-[#232f3e] text-white">
          <h2 className="font-bold text-lg">Transfer Item</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-full transition"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Item Summary */}
        <div className="p-4 bg-gray-50 border-b">
          <p className="font-semibold text-sm text-[#0f1111]">{item.title}</p>
          <p className="text-xs text-gray-500 mt-1">
            {item.asset_tag && <span className="font-mono">{item.asset_tag} · </span>}
            Current: <span className="font-medium">{item.location_name || "Unassigned"}</span>
          </p>
        </div>

        {/* Success / Error State */}
        {result && (
          <div
            className={`p-4 flex items-center gap-2 ${
              result.success
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {result.success ? (
              <>
                <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm font-medium">
                  Transfer complete! Item moved successfully.
                </span>
              </>
            ) : (
              <>
                <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm font-medium">
                  {result.error || "Transfer failed"}
                </span>
              </>
            )}
          </div>
        )}

        {/* Location List */}
        {!result?.success && (
          <>
            <div className="p-4 overflow-y-auto max-h-60">
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">
                Select destination
              </p>
              <div className="space-y-1">
                {locations.map((loc) => {
                  const isCurrent = loc.id === item.location_id;
                  return (
                    <button
                      key={loc.id}
                      disabled={isCurrent}
                      onClick={() => setSelectedLocation(loc.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left text-sm transition ${
                        isCurrent
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : selectedLocation === loc.id
                          ? "bg-[#febd69]/20 border-2 border-[#f0c14b] text-[#0f1111]"
                          : "hover:bg-gray-50 border-2 border-transparent text-[#0f1111]"
                      }`}
                    >
                      <MapPinIcon
                        className={`h-5 w-5 flex-shrink-0 ${
                          isCurrent
                            ? "text-gray-300"
                            : selectedLocation === loc.id
                            ? "text-[#c45500]"
                            : "text-gray-400"
                        }`}
                      />
                      <div className="flex-grow min-w-0">
                        <p className="font-medium truncate">
                          {loc.name}
                          {isCurrent && (
                            <span className="text-xs ml-2 font-normal text-gray-400">
                              (current)
                            </span>
                          )}
                        </p>
                        {loc.description && (
                          <p className="text-xs text-gray-500 truncate">
                            {loc.description}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Note Input */}
            <div className="px-4 pb-2">
              <input
                type="text"
                placeholder="Add a note (optional)..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#febd69]"
              />
            </div>

            {/* Confirm Button */}
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={handleTransfer}
                disabled={!selectedLocation || isPending}
                className={`w-full py-2.5 rounded-full text-sm font-bold transition ${
                  !selectedLocation || isPending
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b] border border-[#a88734] hover:from-[#f0c14b] hover:to-[#e7a321] text-[#111]"
                }`}
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Transferring...
                  </span>
                ) : (
                  "Confirm Transfer"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
