"use client";

import {
  SparklesIcon,
  PencilSquareIcon,
  EyeIcon,
  CubeIcon,
  CheckCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { correctAiLabel } from "@/actions/inventory";
import type { ProductDetail } from "@/lib/types";
import type { TransitionStartFunction } from "react";

export interface ItemAIInsightsProps {
  product: ProductDetail;
  isCorrectingAi: boolean;
  setIsCorrectingAi: (value: boolean) => void;
  correctionResult: { success: boolean; error?: string } | null;
  setCorrectionResult: (value: { success: boolean; error?: string } | null) => void;
  isPending: boolean;
  startTransition: TransitionStartFunction;
}

export default function ItemAIInsights({
  product,
  isCorrectingAi,
  setIsCorrectingAi,
  correctionResult,
  setCorrectionResult,
  isPending,
  startTransition,
}: ItemAIInsightsProps) {
  // Find the first AI-processed image
  const aiImage = product.images.find(
    (img) =>
      img.ai_processed &&
      img.ai_description &&
      !img.ai_description.startsWith("Skipped:") &&
      !img.ai_description.startsWith("Error:")
  );

  if (!aiImage) return null;

  // Check if ai_main_color is a valid CSS color
  const colorValue = aiImage.ai_main_color?.toLowerCase() ?? "";
  const isValidCSSColor =
    /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(colorValue) ||
    /^(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey|brown|cyan|magenta|silver|gold|navy|teal|maroon|olive|lime|aqua|coral|salmon|violet|indigo|beige|tan|khaki)$/i.test(
      colorValue
    );

  const tags: string[] = Array.isArray(aiImage.ai_tags) ? aiImage.ai_tags : [];

  const handleCorrection = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const corrections = {
      title: (fd.get("cor_title") as string)?.trim() || product.title,
      description: (fd.get("cor_description") as string)?.trim() || "",
      object_type: (fd.get("cor_object_type") as string)?.trim() || "",
      main_color: (fd.get("cor_main_color") as string)?.trim() || "",
      detected_text: (fd.get("cor_detected_text") as string)?.trim() || "",
    };
    startTransition(async () => {
      const res = await correctAiLabel(product.id, aiImage.id, corrections);
      setCorrectionResult(res);
      if (res.success) {
        setTimeout(() => {
          setIsCorrectingAi(false);
          setCorrectionResult(null);
        }, 1500);
      }
    });
  };

  return (
    <div className="border-t border-gray-100 p-6 md:p-8">
      <h2 className="text-lg font-bold text-[#0f1111] mb-4 flex items-center gap-2">
        <SparklesIcon className="h-5 w-5 text-purple-500" />
        <span>🤖 Visual Analysis</span>
        <span className="text-xs font-normal bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full ml-2">
          AI-generated
        </span>
        <button
          onClick={() => {
            setIsCorrectingAi(!isCorrectingAi);
            setCorrectionResult(null);
          }}
          className="ml-auto flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-full transition cursor-pointer"
          title="Correct AI identification"
        >
          <PencilSquareIcon className="h-3.5 w-3.5" />
          {isCorrectingAi ? "Cancel" : "Correct"}
        </button>
      </h2>

      {/* ── Correction Form ── */}
      {isCorrectingAi && (
        <form
          onSubmit={handleCorrection}
          className="mb-5 bg-white border-2 border-purple-200 rounded-lg p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <PencilSquareIcon className="h-4 w-4 text-purple-500" />
            <p className="text-sm font-bold text-[#0f1111]">Correct AI Identification</p>
            <p className="text-xs text-gray-400 ml-auto">Saves to item + AI labels</p>
          </div>

          {correctionResult && (
            <div
              className={`mb-4 px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium ${
                correctionResult.success
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {correctionResult.success ? (
                <>
                  <CheckCircleIcon className="h-4 w-4 flex-shrink-0" /> Correction saved — AI
                  labels updated
                </>
              ) : (
                <>
                  <XMarkIcon className="h-4 w-4 flex-shrink-0" />{" "}
                  {correctionResult.error || "Failed to save"}
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Item Title
              </label>
              <input
                name="cor_title"
                defaultValue={product.title}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-[#0f1111] focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Object Type
              </label>
              <input
                name="cor_object_type"
                defaultValue={aiImage.ai_object_type ?? ""}
                placeholder="e.g. server, laptop, RAM stick, cable"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-[#0f1111] focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Main Color
              </label>
              <input
                name="cor_main_color"
                defaultValue={aiImage.ai_main_color ?? ""}
                placeholder="e.g. black, silver, blue"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-[#0f1111] focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Description
              </label>
              <textarea
                name="cor_description"
                defaultValue={aiImage.ai_description ?? ""}
                rows={2}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-[#0f1111] focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent resize-y"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Detected Text / Labels
              </label>
              <input
                name="cor_detected_text"
                defaultValue={aiImage.ai_detected_text ?? ""}
                placeholder="Any visible text, serial numbers, branding"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-[#0f1111] focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setIsCorrectingAi(false);
                setCorrectionResult(null);
              }}
              className="px-4 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || correctionResult?.success}
              className={`px-5 py-1.5 text-sm font-bold rounded-full transition cursor-pointer ${
                isPending || correctionResult?.success
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-b from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 shadow-sm"
              }`}
            >
              {isPending ? "Saving..." : correctionResult?.success ? "Saved!" : "Save Correction"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-gradient-to-br from-purple-50/50 via-white to-indigo-50/50 border border-purple-100 rounded-lg p-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5">
          {/* Left: Description + Tags */}
          <div className="space-y-4">
            {/* AI Description */}
            {aiImage.ai_description && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1.5 flex items-center gap-1">
                  <EyeIcon className="h-3 w-3" />
                  Description
                </p>
                <p className="text-sm text-gray-700 italic leading-relaxed">
                  &ldquo;{aiImage.ai_description}&rdquo;
                </p>
              </div>
            )}

            {/* Object Type */}
            {aiImage.ai_object_type && aiImage.ai_object_type !== "unknown" && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1.5">
                  Detected Type
                </p>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-purple-200 rounded-full text-sm font-medium text-purple-700">
                  <CubeIcon className="h-3.5 w-3.5" />
                  {aiImage.ai_object_type}
                </span>
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1.5">
                  Tags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition"
                    >
                      <span className="text-purple-400 mr-1">#</span>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Detected Text (OCR) */}
            {aiImage.ai_detected_text && aiImage.ai_detected_text.trim().length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1.5">
                  Detected Text (OCR)
                </p>
                <pre className="bg-gray-900 text-green-400 text-xs font-mono px-4 py-3 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {aiImage.ai_detected_text}
                </pre>
              </div>
            )}
          </div>

          {/* Right: Color Swatch */}
          {aiImage.ai_main_color && aiImage.ai_main_color !== "unknown" && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                Color
              </p>
              {isValidCSSColor ? (
                <div
                  className="w-16 h-16 rounded-full border-4 border-white shadow-lg"
                  style={{ backgroundColor: colorValue }}
                  title={aiImage.ai_main_color}
                />
              ) : (
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-purple-200 bg-white flex items-center justify-center">
                  <span className="text-[10px] text-center text-purple-500 font-medium leading-tight px-1">
                    {aiImage.ai_main_color}
                  </span>
                </div>
              )}
              <span className="text-xs text-gray-500 capitalize">{aiImage.ai_main_color}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
