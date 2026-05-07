"use client";

import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css";

export default function Banner() {
  return (
    <div className="relative">
      {/* Gradient fade at the bottom */}
      <div className="absolute w-full h-32 bg-gradient-to-t from-gray-100 to-transparent bottom-0 z-10" />

      <Carousel
        autoPlay
        infiniteLoop
        showStatus={false}
        showIndicators={false}
        showThumbs={false}
        interval={5000}
      >
        {/* Slide 1 — Quick Actions */}
        <div className="relative h-[300px] md:h-[400px] bg-gradient-to-r from-[#0f1111] to-[#232f3e] flex items-center justify-center">
          <div className="text-center text-white z-10 px-8">
            <h2 className="text-2xl md:text-4xl font-bold mb-3">
              Move Items Instantly
            </h2>
            <p className="text-lg text-gray-400">
              Click any item → Choose a location → Transfer confirmed
            </p>
            <div className="mt-6 inline-flex items-center gap-2 bg-[#febd69] text-[#111] rounded-full px-6 py-2 text-sm font-bold">
              Search · Select · Transfer
            </div>
          </div>
        </div>

        {/* Slide 2 — Asset Tracking */}
        <div className="relative h-[300px] md:h-[400px] bg-gradient-to-r from-[#37475a] to-[#131921] flex items-center justify-center">
          <div className="text-center text-white z-10 px-8">
            <h2 className="text-2xl md:text-4xl font-bold mb-3">
              Personal Inventory Docker
            </h2>
            <p className="text-lg text-gray-400">
              Fully containerized · One-command deploy · Portable across machines
            </p>
            <div className="mt-6 inline-flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-6 py-2 text-sm">
              Running in Docker
            </div>
          </div>
        </div>
      </Carousel>
    </div>
  );
}
