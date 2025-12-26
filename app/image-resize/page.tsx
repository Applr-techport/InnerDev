"use client";

import ImageResizer from "@/components/ImageResizer";

export default function ImageResizePage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">이미지 사이즈 변경</h1>
      <p className="text-gray-600 mb-8">
        이미지를 업로드하고 원하는 사이즈로 변경할 수 있습니다.
      </p>
      <ImageResizer />
    </div>
  );
}

