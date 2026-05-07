"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
  Bars3Icon,
  MapPinIcon,
  CameraIcon,
  ShoppingBagIcon,
  BoltIcon,
  BuildingOffice2Icon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { SERVICE_URLS, MEDUSA_ADMIN_URL } from "@/lib/config";
import type { Category } from "@/lib/types";

interface HeaderProps {
  categories: Category[];
  transferListCount?: number;
}

export default function Header({ categories, transferListCount = 0 }: HeaderProps) {
  const [searchInput, setSearchInput] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<{
    show: boolean;
    success: boolean;
    message: string;
  } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (searchInput.trim()) {
      params.set("q", searchInput.trim());
    } else {
      params.delete("q");
    }
    router.push(`/?${params.toString()}`);
  };

  const handleIngest = async () => {
    setIsIngesting(true);
    setIngestResult(null);
    try {
      const resp = await fetch("/api/ingest", { method: "POST" });
      const data = await resp.json();
      if (data.noPhotos) {
        setIngestResult({
          show: true,
          success: true,
          message: "No photos in inbox",
        });
      } else if (data.success) {
        const parts = [];
        if (data.itemsCreated > 0) parts.push(`${data.itemsCreated} items created`);
        if (data.groupsFormed > 0 && data.photosScanned > data.groupsFormed)
          parts.push(`${data.photosScanned} photos → ${data.groupsFormed} groups`);
        if (data.similarMerged > 0) parts.push(`${data.similarMerged} similar merged`);
        if (data.labeled > 0) parts.push(`${data.labeled} labeled`);
        if (data.exactDuplicatesSkipped > 0) parts.push(`${data.exactDuplicatesSkipped} exact dupes skipped`);
        setIngestResult({
          show: true,
          success: true,
          message: parts.length > 0 ? parts.join(", ") : "Done",
        });
        router.refresh();
      } else {
        setIngestResult({
          show: true,
          success: false,
          message: data.error || "Ingest failed",
        });
      }
    } catch (err) {
      setIngestResult({
        show: true,
        success: false,
        message: "Could not reach ingest API",
      });
    } finally {
      setIsIngesting(false);
      setTimeout(() => setIngestResult(null), 5000);
    }
  };

  const handleCategoryClick = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const current = params.get("category");
    if (current === slug) {
      params.delete("category");
    } else {
      params.set("category", slug);
    }
    router.push(`/?${params.toString()}`);
  };

  return (
    <header className="sticky top-0 z-50">
      {/* Top Nav — Amazon Dark Bar */}
      <div className="flex items-center bg-[#131921] p-1 flex-grow py-2 px-4">
        {/* Logo */}
        <div
          className="flex items-center flex-grow sm:flex-grow-0 cursor-pointer mr-4"
          onClick={() => router.push("/")}
        >
          <ClipboardDocumentListIcon className="h-8 w-8 text-white mr-1" />
          <span className="text-white font-bold text-xl">
            inv<span className="text-[#febd69]">Track</span>
          </span>
        </div>

        {/* Location Display */}
        <div className="hidden md:flex items-center text-white mx-4 cursor-pointer">
          <MapPinIcon className="h-5 w-5 text-[#cccccc]" />
          <div className="ml-1">
            <p className="text-[10px] text-[#cccccc] leading-tight">All</p>
            <p className="text-sm font-bold leading-tight">Locations</p>
          </div>
        </div>

        {/* Search */}
        <form
          role="search"
          onSubmit={handleSearch}
          className="hidden sm:flex items-center h-10 rounded-md flex-grow bg-[#febd69] hover:bg-[#f3a847] cursor-pointer"
        >
          <select
            className="p-2 text-xs bg-gray-100 text-gray-800 border-r border-gray-300 rounded-l-md focus:outline-none h-full"
            onChange={(e) => handleCategoryClick(e.target.value)}
            defaultValue=""
          >
            <option value="">All</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
          <input
            className="p-2 h-full w-6 flex-grow flex-shrink rounded-none focus:outline-none px-4 text-sm"
            type="text"
            placeholder="Search inventory by name, tag, serial..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search inventory"
          />
          <button
            type="submit"
            className="h-full w-12 flex items-center justify-center rounded-r-md bg-[#febd69] hover:bg-[#f3a847]"
          >
            <MagnifyingGlassIcon className="h-5 w-5 text-[#131921]" />
          </button>
        </form>

        {/* Right Nav Items */}
        <div className="flex items-center text-xs text-white space-x-6 mx-6 whitespace-nowrap">
          <div className="cursor-pointer hover:underline">
            <p className="text-[10px] text-[#cccccc]">Hello, Admin</p>
            <p className="font-bold text-sm">History & Logs</p>
          </div>
          <div className="cursor-pointer hover:underline">
            <p className="text-[10px] text-[#cccccc]">Asset</p>
            <p className="font-bold text-sm">Reports</p>
          </div>

          {/* Medusa Sales Dashboard */}
          <a
            href={MEDUSA_ADMIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="relative flex items-center cursor-pointer hover:underline"
            title="Open Medusa Sales Dashboard"
          >
            <ShoppingBagIcon className="h-8 w-8" />
            <span className="hidden md:inline font-bold text-sm mt-2">
              Sales
            </span>
          </a>

          {/* n8n Automation Dashboard */}
          <a
            href={SERVICE_URLS.n8n}
            target="_blank"
            rel="noopener noreferrer"
            className="relative flex items-center cursor-pointer hover:underline"
            title="Open n8n Automation Dashboard"
          >
            <BoltIcon className="h-8 w-8" />
            <span className="hidden md:inline font-bold text-sm mt-2">
              n8n
            </span>
          </a>

          {/* ERPNext ERP Dashboard */}
          <a
            href={SERVICE_URLS.erpnext}
            target="_blank"
            rel="noopener noreferrer"
            className="relative flex items-center cursor-pointer hover:underline"
            title="Open ERPNext ERP Dashboard"
          >
            <BuildingOffice2Icon className="h-8 w-8" />
            <span className="hidden md:inline font-bold text-sm mt-2">
              ERP
            </span>
          </a>

          {/* OpenClaw AI Agent */}
          <a
            href={SERVICE_URLS.openclaw}
            target="_blank"
            rel="noopener noreferrer"
            className="relative flex items-center cursor-pointer hover:underline"
            title="OpenClaw AI Agent — Photo-to-Cash Pipeline"
          >
            <SparklesIcon className="h-8 w-8" />
            <span className="hidden md:inline font-bold text-sm mt-2">
              AI
            </span>
          </a>

          {/* Ingest Button */}
          <button
            onClick={handleIngest}
            disabled={isIngesting}
            className="relative flex items-center cursor-pointer hover:underline disabled:opacity-60 disabled:cursor-wait"
            title="Ingest photos from ~/Downloads/PInventoryInbox"
          >
            {isIngesting ? (
              <svg className="animate-spin h-7 w-7 mr-1" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <CameraIcon className="h-8 w-8" />
            )}
            <span className="hidden md:inline font-bold text-sm mt-2">
              {isIngesting ? "Ingesting..." : "Ingest"}
            </span>
          </button>

          {/* Transfer List (replaces Cart) */}
          <div
            onClick={() => router.push("/transfer")}
            className="relative flex items-center cursor-pointer hover:underline"
          >
            <span className="absolute top-0 right-0 md:right-8 h-4 w-4 bg-[#f08804] text-center rounded-full text-black font-bold text-xs">
              {transferListCount}
            </span>
            <ClipboardDocumentListIcon className="h-8 w-8" />
            <span className="hidden md:inline font-bold text-sm mt-2">
              Transfer
            </span>
          </div>
        </div>
      </div>

      {/* Ingest Result Toast */}
      {ingestResult?.show && (
        <div
          className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium ${
            ingestResult.success
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          <CameraIcon className="h-4 w-4" />
          <span>{ingestResult.message}</span>
          <button
            onClick={() => setIngestResult(null)}
            className="ml-2 text-white/70 hover:text-white text-xs cursor-pointer"
          >
            dismiss
          </button>
        </div>
      )}

      {/* Sub Nav — Category Bar */}
      <div className="flex items-center space-x-3 p-2 pl-6 bg-[#232f3e] text-white text-sm overflow-x-auto scrollbar-hide">
        <button
          className="flex items-center hover:underline font-bold"
          onClick={() => router.push("/")}
        >
          <Bars3Icon className="h-5 w-5 mr-1" />
          All Items
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`hover:underline whitespace-nowrap px-2 py-1 rounded ${
              searchParams.get("category") === cat.slug
                ? "bg-[#febd69] text-[#131921] font-bold"
                : ""
            }`}
            onClick={() => handleCategoryClick(cat.slug)}
          >
            {cat.name}{" "}
            {cat.item_count !== undefined && (
              <span className="text-[10px] opacity-70">({cat.item_count})</span>
            )}
          </button>
        ))}
        <button className="hover:underline whitespace-nowrap text-[#febd69] font-semibold">
          + Scan Item
        </button>
      </div>
    </header>
  );
}
