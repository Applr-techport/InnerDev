"use client";

import { useState } from "react";
import AppIconGenerator from "@/components/AppIconGenerator";

export default function AppIconPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">앱 아이콘 생성기</h1>
      <p className="text-gray-600 mb-8">
        1024x1024 이미지를 업로드하면 iOS와 Android용 앱 아이콘 이미지셋을 생성합니다.
      </p>
      <AppIconGenerator />
    </div>
  );
}

