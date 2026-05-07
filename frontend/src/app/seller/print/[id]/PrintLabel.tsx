"use client";

import QRCode from "react-qr-code";
import Link from "next/link";

interface PrintLabelProps {
  title: string;
  assetTag: string | null;
  serialNumber: string | null;
  model: string;
  location: string | null;
  scanUrl: string;
  itemId: number;
}

export default function PrintLabel({
  title,
  assetTag,
  serialNumber,
  model,
  location,
  scanUrl,
  itemId,
}: PrintLabelProps) {
  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          /* Hide everything except the label */
          body * {
            visibility: hidden;
          }
          #print-label,
          #print-label * {
            visibility: visible;
          }
          #print-label {
            position: absolute;
            left: 0;
            top: 0;
            width: 4in;
            height: 6in;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: 4in 6in;
            margin: 0;
          }
        }
      `}</style>

      {/* Screen Controls */}
      <div className="no-print min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 max-w-md w-full">
          <h1 className="text-lg font-bold text-[#0f1111] mb-1">Print Asset Label</h1>
          <p className="text-sm text-gray-500 mb-4">
            Preview below. Click &quot;Print Label&quot; to send to your thermal printer.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="flex-1 bg-gradient-to-b from-[#f7dfa5] to-[#f0c14b] border border-[#a88734] hover:from-[#f0c14b] hover:to-[#e7a321] text-[#111] font-bold py-2.5 px-4 rounded-full text-sm transition cursor-pointer"
            >
              🖨️ Print Label
            </button>
            <Link
              href={`/item/${itemId}`}
              className="flex-1 text-center bg-white border-2 border-gray-300 text-[#0f1111] font-bold py-2.5 px-4 rounded-full text-sm hover:bg-gray-50 transition"
            >
              ← Back to Item
            </Link>
          </div>
        </div>

        {/* Label Preview (also the print target) */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b text-xs text-gray-400 font-medium uppercase tracking-wider no-print">
            4×6 Label Preview
          </div>
          <div
            id="print-label"
            className="w-[4in] h-[6in] bg-white flex flex-col items-center justify-between p-6 border-2 border-dashed border-gray-200"
          >
            {/* Top: Header */}
            <div className="text-center w-full">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-1">
                Property of
              </p>
              <h2 className="text-xl font-black tracking-wide text-[#0f1111]">
                BIGBRAIN
              </h2>
              <div className="w-16 h-0.5 bg-[#febd69] mx-auto mt-2" />
            </div>

            {/* Center: QR Code */}
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 bg-white border-2 border-gray-200 rounded-xl">
                <QRCode value={scanUrl} size={180} level="H" />
              </div>
              {/* Asset Tag — big & bold */}
              {assetTag && (
                <p className="text-3xl font-black font-mono tracking-wider text-[#0f1111]">
                  {assetTag}
                </p>
              )}
            </div>

            {/* Bottom: Item Info */}
            <div className="text-center w-full space-y-1">
              <p className="text-xs font-semibold text-[#0f1111] truncate max-w-full">
                {title}
              </p>
              {model && (
                <p className="text-[10px] text-gray-500 truncate">{model}</p>
              )}
              {serialNumber && (
                <p className="text-[10px] font-mono text-gray-400">
                  S/N: {serialNumber}
                </p>
              )}
              {location && (
                <p className="text-[10px] text-gray-400">📍 {location}</p>
              )}
              <div className="pt-2 border-t border-gray-200 mt-2">
                <p className="text-[8px] text-gray-300 font-mono">
                  InvStorage · Scan QR to view details
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
