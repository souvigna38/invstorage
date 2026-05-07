import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

interface ScanPageProps {
  params: Promise<{ tag: string }>;
}

/**
 * Scan Redirector — handles iPhone camera QR code scans.
 *
 * Flow:
 *   1. Camera scans QR → opens http://host:3000/scan/LPN-0001
 *   2. We look up the asset_tag in the DB.
 *   3. Found  → redirect to /item/[id]  (instant detail view)
 *   4. Not found → redirect to /seller/add?asset_tag=[tag]  (Scan-to-Create)
 */
export default async function ScanPage({ params }: ScanPageProps) {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag);

  // Look up the item by asset_tag (case-insensitive)
  const item = await prisma.items.findFirst({
    where: {
      asset_tag: { equals: decodedTag, mode: "insensitive" },
      deleted_at: null,
    },
    select: { id: true },
  });

  if (item) {
    // Found — go straight to the item detail page
    redirect(`/item/${item.id}`);
  } else {
    // Not found — redirect to "Scan to Create" with the tag pre-filled
    redirect(`/seller/add?asset_tag=${encodeURIComponent(decodedTag)}`);
  }
}
