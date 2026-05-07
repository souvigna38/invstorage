import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintLabel from "./PrintLabel";

interface PrintPageProps {
  params: Promise<{ id: string }>;
}

export default async function PrintPage({ params }: PrintPageProps) {
  const { id } = await params;
  const itemId = parseInt(id, 10);

  if (isNaN(itemId)) notFound();

  const item = await prisma.items.findUnique({
    where: { id: itemId, deleted_at: null },
    select: {
      id: true,
      title: true,
      asset_tag: true,
      serial_number: true,
      model_name: true,
      manufacturer: true,
      locations_items_location_idTolocations: { select: { name: true } },
    },
  });

  if (!item) notFound();

  const hostIp = process.env.NEXT_PUBLIC_HOST_IP || "localhost";
  const scanUrl = `http://${hostIp}:3000/scan/${item.asset_tag || `id-${item.id}`}`;

  return (
    <PrintLabel
      title={item.title}
      assetTag={item.asset_tag}
      serialNumber={item.serial_number}
      model={[item.manufacturer, item.model_name].filter(Boolean).join(" ")}
      location={item.locations_items_location_idTolocations?.name ?? null}
      scanUrl={scanUrl}
      itemId={item.id}
    />
  );
}
