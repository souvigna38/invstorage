"use client";

import { UserIcon, ClockIcon } from "@heroicons/react/24/solid";
import type { ActionLogEntry } from "@/lib/types";

const ACTION_ICONS: Record<string, string> = {
  transfer: "🔄",
  checkout: "📤",
  checkin: "📥",
  create: "✨",
  update: "✏️",
};

export interface ItemActivityLogProps {
  actionLogs: ActionLogEntry[];
  formatDateTime: (iso: string | null) => string;
}

export default function ItemActivityLog({
  actionLogs,
  formatDateTime,
}: ItemActivityLogProps) {
  return (
    <div className="border-t border-gray-100 p-6 md:p-8">
      <h2 className="text-lg font-bold text-[#0f1111] mb-4">
        <ClockIcon className="h-5 w-5 inline mr-2 text-gray-400" />
        Activity History
        <span className="text-sm font-normal text-gray-400 ml-2">
          ({actionLogs.length} entries)
        </span>
      </h2>

      {actionLogs.length > 0 ? (
        <div className="space-y-0">
          {actionLogs.map((log, i) => (
            <div
              key={log.id}
              className={`flex items-start gap-3 py-3 ${
                i < actionLogs.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              {/* Icon */}
              <span className="text-lg flex-shrink-0 mt-0.5">
                {ACTION_ICONS[log.action_type] || "📋"}
              </span>

              {/* Content */}
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium capitalize text-[#0f1111]">
                    {log.action_type.replace("_", " ")}
                  </span>
                  {log.performed_by_name && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <UserIcon className="h-3 w-3" />
                      {log.performed_by_name}
                    </span>
                  )}
                </div>

                {/* Location flow */}
                {(log.from_location_name || log.to_location_name) && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {log.from_location_name && (
                      <span>{log.from_location_name}</span>
                    )}
                    {log.from_location_name && log.to_location_name && (
                      <span className="mx-1">→</span>
                    )}
                    {log.to_location_name && (
                      <span className="font-medium text-[#c45500]">
                        {log.to_location_name}
                      </span>
                    )}
                  </p>
                )}

                {log.note && (
                  <p className="text-xs text-gray-500 mt-0.5 italic">
                    &quot;{log.note}&quot;
                  </p>
                )}
              </div>

              {/* Date */}
              <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                {formatDateTime(log.action_date)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">
          No activity recorded for this item yet.
        </p>
      )}
    </div>
  );
}
