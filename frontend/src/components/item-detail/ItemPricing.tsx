"use client";

import type { ProductDetail } from "@/lib/types";

export interface ItemPricingProps {
  product: ProductDetail;
  isLookingUpMsrp: boolean;
  handleMsrpLookup: () => Promise<void>;
  msrpResult: { success: boolean; msrp?: number | null; message?: string; error?: string } | null;
}

export default function ItemPricing({
  product,
  isLookingUpMsrp,
  handleMsrpLookup,
  msrpResult,
}: ItemPricingProps) {
  return (
    <div className="mb-4 space-y-3">
      {/* Hero price — largest display */}
      <div>
        <span className="text-xs text-gray-500">
          {product.sold_price != null && product.sold_price > 0
            ? "Sold Price"
            : product.estimated_value != null && product.estimated_value > 0
            ? "Estimated Value"
            : "Purchase Price"}
        </span>
        <div className="flex items-baseline">
          <span className="text-sm align-super text-[#0f1111]">$</span>
          <span className="text-3xl font-light text-[#0f1111]">
            {product.sold_price != null && product.sold_price > 0
              ? Math.floor(product.sold_price)
              : product.estimated_value != null && product.estimated_value > 0
              ? Math.floor(product.estimated_value)
              : Math.floor(product.price)}
          </span>
          <span className="text-sm align-super text-[#0f1111]">
            {(product.sold_price != null && product.sold_price > 0
              ? product.sold_price % 1
              : product.estimated_value != null && product.estimated_value > 0
              ? product.estimated_value % 1
              : product.price % 1
            ).toFixed(2).substring(1)}
          </span>
        </div>
      </div>

      {/* All price tiers — always visible */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden text-sm">
        <div className="grid grid-cols-2 divide-x divide-y divide-gray-200">
          {/* Purchase Price */}
          <div className="p-3">
            <p className="text-[10px] text-gray-400 uppercase font-medium mb-0.5">Purchase Price</p>
            <p className={`font-semibold ${product.purchase_cost != null && product.purchase_cost > 0 ? "text-[#0f1111]" : product.price > 0 ? "text-[#0f1111]" : "text-red-400"}`}>
              {product.purchase_cost != null && product.purchase_cost > 0
                ? `$${product.purchase_cost.toFixed(2)}`
                : product.price > 0
                ? `$${product.price.toFixed(2)}`
                : "$0/0/0"}
            </p>
          </div>
          {/* Purchase Date */}
          <div className="p-3">
            <p className="text-[10px] text-gray-400 uppercase font-medium mb-0.5">Purchase Date</p>
            <p className={`font-semibold ${product.purchase_date ? "text-[#0f1111]" : "text-red-400"}`}>
              {product.purchase_date
                ? new Date(product.purchase_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "0/0/0"}
            </p>
          </div>
          {/* Estimated Value */}
          <div className="p-3">
            <p className="text-[10px] text-gray-400 uppercase font-medium mb-0.5">Estimated Value</p>
            <p className={`font-semibold ${product.estimated_value != null && product.estimated_value > 0 ? "text-[#0f1111]" : "text-red-400"}`}>
              {product.estimated_value != null && product.estimated_value > 0
                ? `$${product.estimated_value.toFixed(2)}`
                : "$0/0/0"}
            </p>
          </div>
          {/* MSRP */}
          <div className="p-3">
            <p className="text-[10px] text-gray-400 uppercase font-medium mb-0.5">MSRP</p>
            <p className={`font-semibold ${product.msrp_price != null && product.msrp_price > 0 ? "text-gray-500 line-through" : "text-red-400"}`}>
              {product.msrp_price != null && product.msrp_price > 0
                ? `$${product.msrp_price.toFixed(2)}`
                : "$0/0/0"}
            </p>
            {product.msrp_source && (
              <p className="text-[9px] text-gray-300 mt-0.5 truncate">{product.msrp_source}</p>
            )}
          </div>
          {/* List Price */}
          <div className="p-3">
            <p className="text-[10px] text-gray-400 uppercase font-medium mb-0.5">List Price</p>
            <p className={`font-semibold ${product.list_price != null && product.list_price > 0 ? "text-blue-600" : "text-red-400"}`}>
              {product.list_price != null && product.list_price > 0
                ? `$${product.list_price.toFixed(2)}`
                : "$0/0/0"}
            </p>
            {product.listing_url && (
              <a href={product.listing_url} target="_blank" rel="noopener noreferrer"
                className="text-[9px] text-blue-500 hover:underline">View Listing</a>
            )}
          </div>
          {/* Sold Price */}
          <div className="p-3">
            <p className="text-[10px] text-gray-400 uppercase font-medium mb-0.5">Sold Price</p>
            <p className={`font-semibold ${product.sold_price != null && product.sold_price > 0 ? "text-green-600" : "text-red-400"}`}>
              {product.sold_price != null && product.sold_price > 0
                ? `$${product.sold_price.toFixed(2)}`
                : "$0/0/0"}
            </p>
            {product.sold_date && (
              <p className="text-[9px] text-gray-400 mt-0.5">
                {new Date(product.sold_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Lookup MSRP button */}
      {!(product.msrp_price != null && product.msrp_price > 0) && (
        <button
          onClick={handleMsrpLookup}
          disabled={isLookingUpMsrp}
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {isLookingUpMsrp ? (
            <>
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Searching Google...
            </>
          ) : (
            <>🔍 Look up MSRP</>
          )}
        </button>
      )}
      {msrpResult && !msrpResult.success && (
        <p className="text-[10px] text-red-500 mt-0.5">
          {msrpResult.error || msrpResult.message}
        </p>
      )}
      {msrpResult && msrpResult.success && !msrpResult.msrp && (
        <p className="text-[10px] text-amber-600 mt-0.5">
          {msrpResult.message || "No price found"}
        </p>
      )}
    </div>
  );
}
