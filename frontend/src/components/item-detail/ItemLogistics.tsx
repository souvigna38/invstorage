"use client";

import Link from "next/link";
import QRCode from "react-qr-code";
import { QrCodeIcon, TagIcon, PrinterIcon } from "@heroicons/react/24/solid";
import type { ProductDetail } from "@/lib/types";

export interface ItemLogisticsProps {
  product: ProductDetail;
}

export default function ItemLogistics({ product }: ItemLogisticsProps) {
  if (!product.asset_tag) return null;

  const hostIp = process.env.NEXT_PUBLIC_HOST_IP || "localhost";
  const scanUrl = `http://${hostIp}:3000/scan/${product.asset_tag}`;
  const prefix = product.asset_tag.split("-")[0]?.toUpperCase();

  const tagType =
    prefix === "LPN"
      ? { label: "Internal License Plate", bg: "bg-[#febd69]/20", text: "text-[#92610e]", border: "border-[#febd69]" }
      : prefix === "BIZ"
      ? { label: "Business Inventory", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" }
      : prefix === "PER"
      ? { label: "Personal Asset", bg: "bg-green-50", text: "text-green-700", border: "border-green-200" }
      : { label: "Asset", bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" };

  return (
    <div className="bg-[#fafafa] border border-gray-200 rounded-lg p-4 mb-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-3">
        <QrCodeIcon className="h-3.5 w-3.5" />
        Logistics
      </h3>
      <div className="flex items-start gap-4">
        {/* QR Code */}
        <div className="flex-shrink-0 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
          <QRCode value={scanUrl} size={128} level="H" />
        </div>
        {/* Tag Info */}
        <div className="flex-grow min-w-0">
          {/* Asset Tag — large monospace */}
          <p className="text-2xl font-black font-mono tracking-wider text-[#0f1111] mb-2">
            {product.asset_tag}
          </p>
          {/* Label Type Badge */}
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold ${tagType.bg} ${tagType.text} ${tagType.border}`}>
            <TagIcon className="h-3 w-3" />
            {tagType.label}
          </span>
          {/* Scan URL (small) */}
          <p className="text-[10px] text-gray-400 font-mono mt-2 truncate">
            {scanUrl}
          </p>
          {/* Print Label Link */}
          <Link
            href={`/seller/print/${product.id}`}
            className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-[#007185] hover:text-[#c45500] hover:underline transition"
          >
            <PrinterIcon className="h-3.5 w-3.5" />
            Print Label (4×6)
          </Link>
        </div>
      </div>
    </div>
  );
}
