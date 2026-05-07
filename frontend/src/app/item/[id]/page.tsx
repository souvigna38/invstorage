import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductById, getLocations, getCategories } from "@/actions/inventory";
import Header from "@/components/Header";
import ItemDetail from "@/components/ItemDetail";
import { ChevronRightIcon } from "@heroicons/react/24/solid";

interface ItemPageProps {
  params: Promise<{ id: string }>;
}

export default async function ItemPage({ params }: ItemPageProps) {
  const { id } = await params;
  const itemId = parseInt(id, 10);

  if (isNaN(itemId)) notFound();

  const [product, locations, categories] = await Promise.all([
    getProductById(itemId),
    getLocations(),
    getCategories(),
  ]);

  if (!product) notFound();

  return (
    <div className="bg-[#eaeded] min-h-screen">
      <Header categories={categories} />

      {/* Breadcrumb */}
      <div className="max-w-screen-xl mx-auto px-4 pt-4">
        <nav className="flex items-center text-sm text-gray-500">
          <Link href="/" className="hover:text-[#c45500] hover:underline">
            All Items
          </Link>
          <ChevronRightIcon className="h-3 w-3 mx-2" />
          {product.category_name && (
            <>
              <Link
                href={`/?category=${product.category_slug}`}
                className="hover:text-[#c45500] hover:underline"
              >
                {product.category_name}
              </Link>
              <ChevronRightIcon className="h-3 w-3 mx-2" />
            </>
          )}
          <span className="text-gray-800 truncate max-w-xs">{product.title}</span>
        </nav>
      </div>

      {/* Detail Component */}
      <ItemDetail product={product} locations={locations} />

      {/* Footer */}
      <footer className="bg-[#232f3e] text-white text-center py-6 mt-8">
        <p className="text-sm text-gray-400">
          InvStorage — Personal Inventory Docker · Powered by PostgreSQL + Next.js
        </p>
      </footer>
    </div>
  );
}
