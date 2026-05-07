"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Snapshot {
  id: number;
  snapshotDate: string;
  label: string | null;
  status: string;
  itemCount: number;
  imageCount: number;
  sizeBytes: number;
  sizeMB: string;
  createdAt: string;
  completedAt: string;
}

interface RollbackModalProps {
  onClose: () => void;
}

export default function RollbackModal({ onClose }: RollbackModalProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const router = useRouter();

  const fetchSnapshots = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vault/snapshots");
      const data = await res.json();
      if (data.success) {
        setSnapshots(data.snapshots);
      } else {
        setError(data.error || "Failed to load snapshots");
      }
    } catch {
      setError("Could not connect to Vault_SpM1");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const handleSnapshot = async () => {
    setSnapshotting(true);
    setResult(null);
    try {
      const res = await fetch("/api/vault/snapshot", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setResult({
          success: true,
          message: `Snapshot created: ${data.itemCount} items, ${data.imageCount} images`,
        });
        fetchSnapshots();
      } else {
        setResult({ success: false, message: data.error || "Snapshot failed" });
      }
    } catch {
      setResult({ success: false, message: "Could not reach vault API" });
    } finally {
      setSnapshotting(false);
    }
  };

  const handleRollback = async (snapshotId: number) => {
    setRestoring(true);
    setResult(null);
    try {
      const res = await fetch("/api/vault/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({
          success: true,
          message: `Restored to ${new Date(data.snapshotDate).toLocaleDateString()}: ${data.itemsRestored} items, ${data.imagesRestored} images`,
        });
        setTimeout(() => {
          onClose();
          router.refresh();
        }, 2000);
      } else {
        setResult({ success: false, message: data.error || "Rollback failed" });
      }
    } catch {
      setResult({ success: false, message: "Could not reach vault API" });
    } finally {
      setRestoring(false);
      setConfirmId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#131921] text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <svg className="h-5 w-5 text-[#febd69]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Vault_SpM1 — Roll Back Date
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Restore your inventory to any previous snapshot
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Result Toast */}
        {result && (
          <div
            className={`px-6 py-2 text-sm font-medium flex items-center gap-2 ${
              result.success ? "bg-green-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            <span>{result.success ? "OK" : "Error"}:</span>
            <span>{result.message}</span>
          </div>
        )}

        {/* Actions Bar */}
        <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <span className="text-sm text-gray-500">
            {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} available
          </span>
          <button
            onClick={handleSnapshot}
            disabled={snapshotting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#232f3e] rounded-lg hover:bg-[#37475a] disabled:opacity-60 disabled:cursor-wait transition-colors cursor-pointer"
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
            {snapshotting ? "Creating..." : "Take Snapshot Now"}
          </button>
        </div>

        {/* Snapshot List */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-gray-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              <p className="font-medium">{error}</p>
              <button
                onClick={fetchSnapshots}
                className="mt-2 text-sm text-blue-600 hover:underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : snapshots.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <svg className="h-12 w-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="font-medium">No snapshots yet</p>
              <p className="text-sm mt-1">Click &quot;Take Snapshot Now&quot; to create your first backup</p>
            </div>
          ) : (
            <div className="space-y-2">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  onClick={() => setSelectedId(selectedId === snap.id ? null : snap.id)}
                  className={`border rounded-xl p-4 cursor-pointer transition-all ${
                    selectedId === snap.id
                      ? "border-[#febd69] bg-[#fef9ee] shadow-md"
                      : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${selectedId === snap.id ? "bg-[#febd69]" : "bg-green-400"}`} />
                      <div>
                        <p className="font-semibold text-sm text-gray-800">
                          {formatDate(snap.snapshotDate)}
                        </p>
                        {snap.label && (
                          <p className="text-xs text-gray-500 mt-0.5">{snap.label}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>{snap.itemCount} items</p>
                      <p>{snap.imageCount} images ({snap.sizeMB} MB)</p>
                    </div>
                  </div>

                  {/* Rollback action — visible when selected */}
                  {selectedId === snap.id && (
                    <div className="mt-3 pt-3 border-t border-[#febd69]/30 flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        This will replace all current data with this snapshot.
                      </p>
                      {confirmId === snap.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-600 font-semibold">Are you sure?</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRollback(snap.id);
                            }}
                            disabled={restoring}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 cursor-pointer"
                          >
                            {restoring ? "Restoring..." : "Yes, Restore"}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmId(null);
                            }}
                            className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmId(snap.id);
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#131921] bg-[#febd69] rounded-lg hover:bg-[#f3a847] transition-colors cursor-pointer"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Restore This Snapshot
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-400">
          <span>Vault_SpM1 on port 5436 -- daily auto-snapshots at midnight</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
