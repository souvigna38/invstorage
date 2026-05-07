"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  StarIcon,
  MapPinIcon,
  ArrowsRightLeftIcon,
  TagIcon,
  QrCodeIcon,
} from "@heroicons/react/24/solid";
import { StarIcon as StarOutline } from "@heroicons/react/24/outline";
import type { ProductItem } from "@/lib/types";
import LocationSelector from "./LocationSelector";
import type { Location } from "@/lib/types";

interface ProductProps {
  product: ProductItem;
  locations: Location[];
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  checked_out: "bg-yellow-100 text-yellow-800",
  in_repair: "bg-red-100 text-red-800",
  retired: "bg-gray-100 text-gray-500",
};

export default function Product({
  product,
  locations,
  selectMode = false,
  isSelected = false,
  onToggleSelect,
}: ProductProps) {
  const [showLocationModal, setShowLocationModal] = useState(false);
  const router = useRouter();

  const goToDetail = () => {
    if (selectMode) {
      onToggleSelect?.();
      return;
    }
    router.push(`/item/${product.id}`);
  };

  const statusClass = STATUS_COLORS[product.status] || "bg-gray-100 text-gray-600";

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) =>
      i < Math.round(rating) ? (
        <StarIcon key={i} className="h-4 w-4 text-[#febd69]" />
      ) : (
        <StarOutline key={i} className="h-4 w-4 text-[#febd69]" />
      )
    );
  };

  return (
    <>
      <div
        className={`relative flex flex-col m-3 bg-white z-20 p-6 rounded-lg shadow-sm border hover:shadow-md transition-all duration-200 group ${
          selectMode && isSelected
            ? "border-[#febd69] border-2 ring-2 ring-[#febd69]/30 bg-[#fffbf0]"
            : selectMode
            ? "border-gray-200 hover:border-[#febd69] cursor-pointer"
            : "border-gray-100"
        }`}
        onClick={selectMode ? goToDetail : undefined}
      >
        {/* Selection Checkbox */}
        {selectMode && (
          <div className="absolute top-2 left-2 z-30">
            <div
              className={`h-6 w-6 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer ${
                isSelected
                  ? "bg-[#febd69] border-[#f0c14b]"
                  : "bg-white border-gray-300 hover:border-[#febd69]"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.();
              }}
            >
              {isSelected && (
                <svg className="h-4 w-4 text-[#131921]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Status Badge */}
        <span
          className={`absolute top-2 right-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusClass}`}
        >
          {product.status.replace("_", " ")}
        </span>

        {/* For Sale Badge (Medusa) */}
        {product.medusa_product_id && (
          <span className="absolute top-2 left-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 z-10">
            For Sale
          </span>
        )}

        {/* Category Tag */}
        {product.category_name && (
          <p className="text-xs text-[#007185] mb-1 font-medium">
            {product.category_name}
          </p>
        )}

        {/* Image — clickable to detail page */}
        <div
          onClick={selectMode ? undefined : goToDetail}
          className="relative w-full h-48 flex items-center justify-center mb-3 cursor-pointer"
        >
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.title || "Product image"}
              fill
              unoptimized={product.image_url.includes("localhost")}
              className="object-contain hover:scale-105 transition-transform duration-200"
              sizes="(max-width: 768px) 100vw, 25vw"
            />
          ) : (
            <div className="w-full h-full bg-gray-50 rounded flex items-center justify-center hover:bg-gray-100 transition-colors">
              <QrCodeIcon className="h-16 w-16 text-gray-300" />
            </div>
          )}
        </div>

        {/* Title — clickable to detail page */}
        <h4
          onClick={selectMode ? undefined : goToDetail}
          className="text-sm font-medium text-[#0f1111] line-clamp-2 mb-1 cursor-pointer hover:text-[#c45500] transition-colors"
        >
          {product.title}
        </h4>

        {/* Rating */}
        <div className="flex items-center mb-1">
          <div className="flex">{renderStars(product.rating)}</div>
          <span className="text-xs text-[#007185] ml-1">
            ({product.rating_count})
          </span>
        </div>

        {/* Price / Value — 3-tier display */}
        <div className="mb-2 space-y-0.5">
          {/* Primary: Estimated Value (largest) */}
          {product.estimated_value != null && product.estimated_value > 0 ? (
            <div className="flex items-baseline">
              <span className="text-xs align-super text-[#0f1111]">$</span>
              <span className="text-lg font-bold text-[#0f1111]">
                {Math.floor(product.estimated_value)}
              </span>
              <span className="text-xs align-super text-[#0f1111]">
                {(product.estimated_value % 1).toFixed(2).substring(1)}
              </span>
              <span className="text-[10px] text-gray-400 ml-1.5">Est. Value</span>
            </div>
          ) : (
            <div className="flex items-baseline">
              <span className="text-xs align-super text-[#0f1111]">$</span>
              <span className="text-lg font-bold text-[#0f1111]">
                {Math.floor(product.price)}
              </span>
              <span className="text-xs align-super text-[#0f1111]">
                {(product.price % 1).toFixed(2).substring(1)}
              </span>
              <span className="text-[10px] text-gray-400 ml-1.5">Purchase</span>
            </div>
          )}
          {/* Secondary prices (compact) */}
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-gray-400">
            {product.sold_price != null && product.sold_price > 0 && (
              <span className="text-green-600 font-medium">Sold ${product.sold_price.toFixed(2)}</span>
            )}
            {product.list_price != null && product.list_price > 0 && !product.sold_price && (
              <span className="text-blue-500">Listed ${product.list_price.toFixed(2)}</span>
            )}
            {product.msrp_price != null && product.msrp_price > 0 && (
              <span>
                MSRP <span className="line-through">${product.msrp_price.toFixed(2)}</span>
              </span>
            )}
            {product.price > 0 && product.estimated_value != null && product.estimated_value > 0 && (
              <span>Paid ${product.price.toFixed(2)}</span>
            )}
          </div>
        </div>

        {/* Asset Info */}
        <div className="space-y-1 mb-3 text-xs text-gray-500">
          {product.asset_tag && (
            <div className="flex items-center">
              <TagIcon className="h-3 w-3 mr-1" />
              <span className="font-mono">{product.asset_tag}</span>
            </div>
          )}
          {product.location_name && (
            <div className="flex items-center">
              <MapPinIcon className="h-3 w-3 mr-1 text-[#c45500]" />
              <span>{product.location_name}</span>
            </div>
          )}
          {product.manufacturer && product.model_name && (
            <p className="truncate">
              {product.manufacturer} · {product.model_name}
            </p>
          )}
          <div className="flex items-center gap-2 text-[11px]">
            <span>Purchased: <span className="font-medium text-gray-700">
              {product.purchase_cost != null && product.purchase_cost > 0
                ? `$${product.purchase_cost.toFixed(2)}`
                : "$0/0/0"}
            </span></span>
            <span className={product.purchase_date ? "text-gray-400" : "text-red-400 font-medium"}>
              {product.purchase_date
                ? new Date(product.purchase_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "0/0/0"}
            </span>
          </div>
        </div>

        {/* Action Button — replaces "Add to Cart" */}
        <button
          onClick={(e) => {
            if (selectMode) {
              e.stopPropagation();
              onToggleSelect?.();
              return;
            }
            setShowLocationModal(true);
          }}
          disabled={!selectMode && product.status === "retired"}
          className={`mt-auto w-full flex items-center justify-center gap-2 rounded-full py-1.5 text-xs font-semibold transition-colors ${
            product.status === "retired"
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b] border border-[#a88734] hover:from-[#f0c14b] hover:to-[#e7a321] active:from-[#f0c14b] text-[#111] cursor-pointer"
          }`}
        >
          <ArrowsRightLeftIcon className="h-4 w-4" />
          Move / Transfer
        </button>
      </div>

      {/* Location Selector Modal */}
      {showLocationModal && (
        <LocationSelector
          item={product}
          locations={locations}
          onClose={() => setShowLocationModal(false)}
        />
      )}
    </>
  );
}
