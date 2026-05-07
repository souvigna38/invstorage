"use client";

import {
  CpuChipIcon,
  CircleStackIcon,
  CubeIcon,
  ServerStackIcon,
  SignalIcon,
} from "@heroicons/react/24/solid";
import type { ProductDetail } from "@/lib/types";

export interface ItemHardwareSpecsProps {
  product: ProductDetail;
}

export default function ItemHardwareSpecs({ product }: ItemHardwareSpecsProps) {
  const hasSpecs =
    product.cpu_type ||
    product.ram_amount ||
    product.hard_drive_info ||
    product.gpu ||
    product.network_info;

  if (!hasSpecs) return null;

  return (
    <div className="bg-[#f7f8fa] border border-gray-200 rounded-lg p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
          <CpuChipIcon className="h-3.5 w-3.5" />
          Hardware Specifications
        </h3>
        {product.role && (
          <span className="text-[10px] font-bold uppercase tracking-wider bg-[#232f3e] text-[#febd69] px-2.5 py-1 rounded-full">
            {product.role}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {product.cpu_type && (
          <div className="bg-white rounded-md p-3 border border-gray-100">
            <p className="text-[10px] text-gray-400 uppercase font-medium mb-0.5">Processor</p>
            <p className="text-sm font-semibold text-[#0f1111] flex items-center gap-1.5">
              <CpuChipIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
              {product.cpu_type}
            </p>
          </div>
        )}
        {product.ram_amount && (
          <div className="bg-white rounded-md p-3 border border-gray-100">
            <p className="text-[10px] text-gray-400 uppercase font-medium mb-0.5">Memory</p>
            <p className="text-sm font-semibold text-[#0f1111] flex items-center gap-1.5">
              <CircleStackIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
              {product.ram_amount}
            </p>
          </div>
        )}
        {product.hard_drive_info && (
          <div className="bg-white rounded-md p-3 border border-gray-100">
            <p className="text-[10px] text-gray-400 uppercase font-medium mb-0.5">Storage</p>
            <p className="text-sm font-semibold text-[#0f1111] flex items-center gap-1.5">
              <CubeIcon className="h-4 w-4 text-purple-500 flex-shrink-0" />
              {product.hard_drive_info}
            </p>
          </div>
        )}
        {product.gpu && (
          <div className="bg-white rounded-md p-3 border border-gray-100">
            <p className="text-[10px] text-gray-400 uppercase font-medium mb-0.5">GPU</p>
            <p className="text-sm font-semibold text-[#0f1111] flex items-center gap-1.5">
              <ServerStackIcon className="h-4 w-4 text-amber-500 flex-shrink-0" />
              {product.gpu}
            </p>
          </div>
        )}
        {product.network_info && (
          <div className="bg-white rounded-md p-3 border border-gray-100 sm:col-span-2">
            <p className="text-[10px] text-gray-400 uppercase font-medium mb-0.5">Network</p>
            <p className="text-sm font-semibold text-[#0f1111] flex items-center gap-1.5">
              <SignalIcon className="h-4 w-4 text-cyan-500 flex-shrink-0" />
              {product.network_info}
            </p>
          </div>
        )}
      </div>
      {/* Detailed Storage Breakdown */}
      {product.storage_detail && (
        <div className="mt-3 bg-white rounded-md p-3 border border-gray-100">
          <p className="text-[10px] text-gray-400 uppercase font-medium mb-1">Storage Breakdown</p>
          <pre className="text-xs text-[#0f1111] whitespace-pre-line font-sans leading-relaxed">
            {product.storage_detail}
          </pre>
        </div>
      )}
    </div>
  );
}
