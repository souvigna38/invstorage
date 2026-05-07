"use client";

import { useState, useTransition, useRef } from "react";
import {
  XMarkIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CpuChipIcon,
  InformationCircleIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/solid";
import { updateItem } from "@/actions/inventory";
import type { ProductDetail } from "@/lib/types";

interface EditItemModalProps {
  item: ProductDetail;
  isOpen: boolean;
  onClose: () => void;
}

type TabKey = "general" | "hardware" | "details";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  {
    key: "general",
    label: "General",
    icon: <InformationCircleIcon className="h-4 w-4" />,
  },
  {
    key: "hardware",
    label: "Hardware Specs",
    icon: <CpuChipIcon className="h-4 w-4" />,
  },
  {
    key: "details",
    label: "Details",
    icon: <Cog6ToothIcon className="h-4 w-4" />,
  },
];

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "checked_out", label: "Checked Out" },
  { value: "maintenance", label: "Maintenance" },
  { value: "storage", label: "Storage" },
  { value: "archived", label: "Archived" },
  { value: "lost", label: "Lost" },
  { value: "disposed", label: "Disposed" },
];

// Reusable form field components
function FieldLabel({ label, htmlFor }: { label: string; htmlFor: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1"
    >
      {label}
    </label>
  );
}

function TextInput({
  id,
  name,
  defaultValue,
  placeholder,
  type = "text",
  className = "",
}: {
  id: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-[#0f1111] placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#febd69] focus:border-transparent transition ${className}`}
    />
  );
}

function TextArea({
  id,
  name,
  defaultValue,
  placeholder,
  rows = 3,
}: {
  id: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      rows={rows}
      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-[#0f1111] placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#febd69] focus:border-transparent transition resize-y"
    />
  );
}

export default function EditItemModal({
  item,
  isOpen,
  onClose,
}: EditItemModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await updateItem(item.id, formData);
      setResult(res);
      if (res.success) {
        setTimeout(() => {
          setResult(null);
          onClose();
        }, 1200);
      }
    });
  };

  const handleClose = () => {
    setResult(null);
    setActiveTab("general");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-[#232f3e] text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <PencilSquareIcon className="h-5 w-5 text-[#febd69]" />
            <h2 className="font-bold text-lg">Quick Edit</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition cursor-pointer"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* ── Item Summary ── */}
        <div className="px-5 py-3 bg-gray-50 border-b flex-shrink-0">
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

        {/* ── Success / Error Banner ── */}
        {result && (
          <div
            className={`px-5 py-3 flex items-center gap-2 flex-shrink-0 ${
              result.success
                ? "bg-green-50 text-green-700 border-b border-green-200"
                : "bg-red-50 text-red-700 border-b border-red-200"
            }`}
          >
            {result.success ? (
              <>
                <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm font-medium">
                  Changes saved successfully!
                </span>
              </>
            ) : (
              <>
                <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm font-medium">
                  {result.error || "Failed to save changes"}
                </span>
              </>
            )}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex border-b bg-white flex-shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? "text-[#c45500] border-b-2 border-[#c45500]"
                  : "text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Form ── */}
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-grow overflow-hidden">
          <div className="flex-grow overflow-y-auto px-5 py-5">
            {/* ════════════ TAB: General ════════════ */}
            <div className={activeTab === "general" ? "block" : "hidden"}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Title — full width */}
                <div className="md:col-span-2">
                  <FieldLabel label="Name / Title" htmlFor="title" />
                  <TextInput
                    id="title"
                    name="title"
                    defaultValue={item.title}
                    placeholder="Item name"
                  />
                </div>

                <div>
                  <FieldLabel label="Asset Tag" htmlFor="asset_tag" />
                  <TextInput
                    id="asset_tag"
                    name="asset_tag"
                    defaultValue={item.asset_tag ?? ""}
                    placeholder="e.g. ASSET-0042"
                    className="font-mono"
                  />
                </div>

                <div>
                  <FieldLabel label="Serial Number" htmlFor="serial_number" />
                  <TextInput
                    id="serial_number"
                    name="serial_number"
                    defaultValue={item.serial_number ?? ""}
                    placeholder="e.g. SN-12345"
                    className="font-mono"
                  />
                </div>

                <div>
                  <FieldLabel label="Status" htmlFor="status" />
                  <select
                    id="status"
                    name="status"
                    defaultValue={item.status}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-[#0f1111] focus:outline-none focus:ring-2 focus:ring-[#febd69] focus:border-transparent bg-white"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel label="Purchase Price ($)" htmlFor="price" />
                  <TextInput
                    id="price"
                    name="price"
                    type="number"
                    defaultValue={item.price?.toString() ?? "0"}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <FieldLabel label="Estimated Value ($)" htmlFor="estimated_value" />
                  <TextInput
                    id="estimated_value"
                    name="estimated_value"
                    type="number"
                    defaultValue={item.estimated_value?.toString() ?? ""}
                    placeholder="Current market value"
                  />
                </div>

                <div>
                  <FieldLabel label="MSRP ($)" htmlFor="msrp_price" />
                  <TextInput
                    id="msrp_price"
                    name="msrp_price"
                    type="number"
                    defaultValue={item.msrp_price?.toString() ?? ""}
                    placeholder="Original retail price"
                  />
                </div>

                <div>
                  <FieldLabel label="List Price ($)" htmlFor="list_price" />
                  <TextInput
                    id="list_price"
                    name="list_price"
                    type="number"
                    defaultValue={item.list_price?.toString() ?? ""}
                    placeholder="Asking price for sale"
                  />
                </div>

                <div>
                  <FieldLabel label="Sold Price ($)" htmlFor="sold_price" />
                  <TextInput
                    id="sold_price"
                    name="sold_price"
                    type="number"
                    defaultValue={item.sold_price?.toString() ?? ""}
                    placeholder="Actual sale price"
                  />
                </div>

                <div>
                  <FieldLabel label="Quantity" htmlFor="quantity" />
                  <TextInput
                    id="quantity"
                    name="quantity"
                    type="number"
                    defaultValue={item.quantity?.toString() ?? "1"}
                    placeholder="1"
                  />
                </div>

                <div>
                  <FieldLabel label="Manufacturer" htmlFor="manufacturer" />
                  <TextInput
                    id="manufacturer"
                    name="manufacturer"
                    defaultValue={item.manufacturer ?? ""}
                    placeholder="e.g. Dell, Apple, Cisco"
                  />
                </div>

                <div>
                  <FieldLabel label="Model Name" htmlFor="model_name" />
                  <TextInput
                    id="model_name"
                    name="model_name"
                    defaultValue={item.model_name ?? ""}
                    placeholder="e.g. PowerEdge R730xd"
                  />
                </div>

                <div>
                  <FieldLabel label="Model Number" htmlFor="model_number" />
                  <TextInput
                    id="model_number"
                    name="model_number"
                    defaultValue={item.model_number ?? ""}
                    placeholder="e.g. MK1234LL/A"
                  />
                </div>

                <div>
                  <FieldLabel label="Image URL" htmlFor="image_url" />
                  <TextInput
                    id="image_url"
                    name="image_url"
                    defaultValue={item.image_url ?? ""}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {/* ════════════ TAB: Hardware Specs ════════════ */}
            <div className={activeTab === "hardware" ? "block" : "hidden"}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FieldLabel label="CPU / Processor" htmlFor="cpu_type" />
                  <TextInput
                    id="cpu_type"
                    name="cpu_type"
                    defaultValue={item.cpu_type ?? ""}
                    placeholder="e.g. 2x Intel Xeon Gold 6130"
                  />
                </div>

                <div>
                  <FieldLabel label="RAM / Memory" htmlFor="ram_amount" />
                  <TextInput
                    id="ram_amount"
                    name="ram_amount"
                    defaultValue={item.ram_amount ?? ""}
                    placeholder="e.g. 768 GB DDR4 ECC"
                  />
                </div>

                <div>
                  <FieldLabel label="Boot / Primary Storage" htmlFor="hard_drive_info" />
                  <TextInput
                    id="hard_drive_info"
                    name="hard_drive_info"
                    defaultValue={item.hard_drive_info ?? ""}
                    placeholder="e.g. 228 GB SSD (SATA)"
                  />
                </div>

                <div>
                  <FieldLabel label="GPU / Graphics" htmlFor="gpu" />
                  <TextInput
                    id="gpu"
                    name="gpu"
                    defaultValue={item.gpu ?? ""}
                    placeholder="e.g. NVIDIA RTX 5070 (16 GB)"
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel label="Network Interface" htmlFor="network_info" />
                  <TextInput
                    id="network_info"
                    name="network_info"
                    defaultValue={item.network_info ?? ""}
                    placeholder="e.g. 4x 10G Base-T (Copper) → LACP Bond"
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel label="Role / Function" htmlFor="role" />
                  <TextInput
                    id="role"
                    name="role"
                    defaultValue={item.role ?? ""}
                    placeholder="e.g. Stateless Calculation Engine"
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel label="Storage Breakdown" htmlFor="storage_detail" />
                  <TextArea
                    id="storage_detail"
                    name="storage_detail"
                    defaultValue={item.storage_detail ?? ""}
                    placeholder="Tier 1: 4x 600GB 15k SAS (RAID 10) → /var/lib/postgresql/wal&#10;Tier 2: 16x 1.2TB 10k SAS (RAID 10) → /var/lib/postgresql/data"
                    rows={4}
                  />
                </div>
              </div>
            </div>

            {/* ════════════ TAB: Details ════════════ */}
            <div className={activeTab === "details" ? "block" : "hidden"}>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <FieldLabel label="Description" htmlFor="description" />
                  <TextArea
                    id="description"
                    name="description"
                    defaultValue={item.description ?? ""}
                    placeholder="Describe this item..."
                    rows={4}
                  />
                </div>

                <div>
                  <FieldLabel label="Notes" htmlFor="notes" />
                  <TextArea
                    id="notes"
                    name="notes"
                    defaultValue={item.notes ?? ""}
                    placeholder="Internal notes, maintenance logs, etc."
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel label="Supplier" htmlFor="supplier" />
                    <TextInput
                      id="supplier"
                      name="supplier"
                      defaultValue={item.supplier ?? ""}
                      placeholder="e.g. Amazon, CDW, eBay"
                    />
                  </div>

                  <div>
                    <FieldLabel label="Order / PO Number" htmlFor="order_number" />
                    <TextInput
                      id="order_number"
                      name="order_number"
                      defaultValue={item.order_number ?? ""}
                      placeholder="e.g. ORD-2024-001"
                      className="font-mono"
                    />
                  </div>

                  <div>
                    <FieldLabel
                      label="Warranty (months)"
                      htmlFor="warranty_months"
                    />
                    <TextInput
                      id="warranty_months"
                      name="warranty_months"
                      type="number"
                      defaultValue={item.warranty_months?.toString() ?? ""}
                      placeholder="e.g. 36"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Footer Buttons ── */}
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t bg-gray-50 flex-shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || result?.success}
              className={`px-6 py-2 text-sm font-bold rounded-full transition cursor-pointer ${
                isPending || result?.success
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b] border border-[#a88734] hover:from-[#f0c14b] hover:to-[#e7a321] text-[#111]"
              }`}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
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
                  Saving...
                </span>
              ) : result?.success ? (
                "Saved!"
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
