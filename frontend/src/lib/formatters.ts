// =============================================================================
// Shared formatting utilities — used across Product cards, ItemDetail, modals
// =============================================================================

/**
 * Format a price value for display. Returns "$X.XX" or "$0/0/0" for missing.
 */
export function formatPrice(value: number | null | undefined): string {
  if (value != null && value > 0) {
    return `$${value.toFixed(2)}`;
  }
  return "$0/0/0";
}

/**
 * Returns true if a price value is present and positive.
 */
export function hasPrice(value: number | null | undefined): boolean {
  return value != null && value > 0;
}

/**
 * Format a date string for short display (e.g., "Feb 14, 2026").
 * Returns "0/0/0" for missing dates.
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "0/0/0";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a date string for display (e.g., "14 Feb 2026").
 * Returns a dash for missing dates.
 */
export function formatDateAU(iso: string | null): string {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format a date-time string (e.g., "14 Feb 2026, 02:30 PM").
 * Returns a dash for missing values.
 */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
