import { Suspense } from "react";
import { getProducts, getLocations, getCategories } from "@/actions/inventory";
import Header from "@/components/Header";
import ProductFeed from "@/components/ProductFeed";
import VoiceSearch from "@/components/VoiceSearch";

interface HomeProps {
  searchParams: Promise<{ q?: string; category?: string; status?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;

  // Fetch data in parallel from our Docker Postgres
  const [products, locations, categories] = await Promise.all([
    getProducts(params.q, params.category, params.status),
    getLocations(),
    getCategories(),
  ]);

  return (
    <div className="bg-[#eaeded] min-h-screen">
      <Suspense fallback={<div className="h-[120px] bg-[#131921]" />}>
        <Header categories={categories} />
      </Suspense>

      <main className="max-w-screen-2xl mx-auto">
        {/* Search Results Info */}
        {(params.q || params.category) && (
          <div className="px-6 pt-4 pb-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {params.q && (
                <span>
                  Results for: <strong className="text-[#c45500]">&quot;{params.q}&quot;</strong>
                </span>
              )}
              {params.category && (
                <span className="bg-[#232f3e] text-white px-2 py-0.5 rounded-full text-xs">
                  {params.category}
                </span>
              )}
              <span className="text-gray-400">
                — {products.length} item{products.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}

        {/* Product Grid */}
        <ProductFeed products={products} locations={locations} />
      </main>

      {/* Footer */}
      <footer className="bg-[#232f3e] text-white text-center py-6 mt-8">
        <p className="text-sm text-gray-400">
          InvStorage — Personal Inventory Docker · Powered by PostgreSQL + Next.js
        </p>
      </footer>

      {/* Voice Search FAB — "Star Trek" interface */}
      <VoiceSearch />
    </div>
  );
}
