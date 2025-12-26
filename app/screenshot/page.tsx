"use client";

import ScreenshotGenerator from "@/components/ScreenshotGenerator";

export default function ScreenshotPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">앱스토어 스크린샷 생성기</h1>
      <p className="text-gray-600 mb-8">
        이미지를 업로드하고 앱스토어/플레이스토어에 필요한 모든 사이즈의 스크린샷을 생성합니다.
      </p>
      <ScreenshotGenerator />
    </div>
  );
}

