"use client";

import Image from "next/image";
import { QrCodeIcon } from "@heroicons/react/24/solid";

export interface ItemImageGalleryProps {
  selectedImage: string | null;
  setSelectedImage: (url: string) => void;
  allImages: string[];
  productTitle: string;
}

export default function ItemImageGallery({
  selectedImage,
  setSelectedImage,
  allImages,
  productTitle,
}: ItemImageGalleryProps) {
  return (
    <div className="p-6 md:p-8 border-b md:border-b-0 md:border-r border-gray-100">
      {/* Main Image */}
      <div className="relative w-full aspect-square bg-gray-50 rounded-lg flex items-center justify-center mb-4 overflow-hidden">
        {selectedImage ? (
          <Image
            src={selectedImage}
            alt={productTitle}
            fill
            unoptimized={selectedImage.includes("localhost")}
            className="object-contain p-4"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        ) : (
          <QrCodeIcon className="h-32 w-32 text-gray-200" />
        )}
      </div>

      {/* Thumbnail Strip */}
      {allImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {allImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelectedImage(img)}
              className={`relative w-16 h-16 rounded-md border-2 flex-shrink-0 overflow-hidden transition ${
                selectedImage === img
                  ? "border-[#c45500]"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <Image
                src={img}
                alt={`${productTitle} thumbnail ${i + 1}`}
                fill
                unoptimized={img.includes("localhost")}
                className="object-contain p-1"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
