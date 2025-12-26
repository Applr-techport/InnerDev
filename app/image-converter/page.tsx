"use client";

import { useState } from "react";
import ImageConverter from "@/components/ImageConverter";

export default function ImageConverterPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">이미지 변환기</h1>
      <p className="text-gray-600 mb-8">
        PNG와 SVG 이미지를 서로 변환할 수 있습니다.
      </p>
      <ImageConverter />
    </div>
  );
}

